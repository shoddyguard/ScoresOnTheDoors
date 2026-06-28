"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { triggerManualSync } from "@/lib/services/syncService";
import { prisma } from "@/lib/db/prisma";
import { rescorePredictionsForMatch } from "@/lib/services/predictionService";
import { importPredictionsFromCsv } from "@/lib/services/csvImportService";
import bcrypt from "bcryptjs";

export async function triggerSync(tournamentId: string) {
  await requireAdmin();
  const logId = await triggerManualSync(tournamentId);
  revalidatePath("/admin/sync");
  return { logId };
}

/**
 * Create the active tournament (and its Group + Knockout stages, which the sync
 * requires). Used to bootstrap a fresh install where only the schema exists.
 */
export async function createTournament(data: {
  name: string;
  openFootballUrl?: string;
  timeZoneId?: string;
}) {
  await requireAdmin();
  const name = data.name?.trim();
  if (!name) throw new Error("Tournament name is required.");

  // Derive a unique slug from the name.
  const base =
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "tournament";
  let slug = base;
  let n = 1;
  while (await prisma.tournament.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${++n}`;
  }

  const tournament = await prisma.tournament.create({
    data: {
      name,
      slug,
      timeZoneId: data.timeZoneId?.trim() || "Europe/London",
      openFootballUrl: data.openFootballUrl?.trim() || null,
      isActive: true,
    },
  });

  // The sync resolves matches into these stages by kind; without them it imports nothing.
  await prisma.stage.createMany({
    data: [
      { tournamentId: tournament.id, name: "Group Stage", kind: "Group", ordinal: 1 },
      { tournamentId: tournament.id, name: "Knockout Stage", kind: "Knockout", ordinal: 2 },
    ],
  });

  // Enroll all existing users as participants (mirrors createUser's auto-enrollment),
  // so people created before the tournament - e.g. the first admin from /setup - count
  // as players and appear on the leaderboard.
  const users = await prisma.user.findMany({ select: { id: true } });
  if (users.length > 0) {
    await prisma.tournamentParticipation.createMany({
      data: users.map((u) => ({
        tournamentId: tournament.id,
        userId: u.id,
        startingScore: 0,
        isActive: true,
      })),
    });
  }

  revalidatePath("/admin");
  revalidatePath("/leaderboard");
  revalidatePath("/");
  return { tournamentId: tournament.id };
}

/** Returns the ID of the currently active tournament, or throws if none is set. */
async function activeTournamentId(): Promise<string> {
  const t = await prisma.tournament.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!t) throw new Error("No active tournament");
  return t.id;
}

export async function setStartingScore(userId: string, startingScore: number) {
  await requireAdmin();
  if (startingScore < 0) throw new Error("Starting score cannot be negative");
  const tournamentId = await activeTournamentId();
  await prisma.tournamentParticipation.upsert({
    where: { tournamentId_userId: { tournamentId, userId } },
    create: { tournamentId, userId, startingScore, isActive: true },
    update: { startingScore },
  });
  revalidatePath("/admin/users");
  revalidatePath("/leaderboard");
}

export async function createLockOverride(data: {
  tournamentId: string;
  scope: string;
  matchId?: string;
  userId?: string;
  reason?: string;
  unlockedUntilISO?: string;
}) {
  const admin = await requireAdmin();
  await prisma.predictionLockOverride.create({
    data: {
      tournamentId: data.tournamentId,
      scope: data.scope,
      matchId: data.matchId ?? null,
      userId: data.userId ?? null,
      reason: data.reason ?? null,
      unlockedUntil: data.unlockedUntilISO ? new Date(data.unlockedUntilISO) : null,
      createdById: admin.id,
      isActive: true,
    },
  });
  revalidatePath("/admin/locks");
}

export async function deactivateLockOverride(overrideId: string) {
  await requireAdmin();
  await prisma.predictionLockOverride.update({
    where: { id: overrideId },
    data: { isActive: false },
  });
  revalidatePath("/admin/locks");
}

export async function setManualResult(
  matchId: string,
  homeGoals90: number,
  awayGoals90: number,
  advancingTeamId: string | null
) {
  const admin = await requireAdmin();
  const existing = await prisma.result.findUnique({ where: { matchId } });
  if (existing) {
    await prisma.result.update({
      where: { matchId },
      data: {
        homeGoals90,
        awayGoals90,
        advancingTeamId,
        source: "ManualOverride",
        isManualOverride: true,
        overriddenById: admin.id,
        overriddenAt: new Date(),
        version: { increment: 1 },
      },
    });
  } else {
    await prisma.result.create({
      data: {
        matchId,
        homeGoals90,
        awayGoals90,
        advancingTeamId,
        source: "ManualOverride",
        isManualOverride: true,
        overriddenById: admin.id,
        overriddenAt: new Date(),
      },
    });
  }
  await prisma.match.update({ where: { id: matchId }, data: { status: "Finished" } });
  await rescorePredictionsForMatch(matchId);
  revalidatePath("/admin/matches");
  revalidatePath("/leaderboard");
}

export async function recomputeAllScores(tournamentId: string) {
  await requireAdmin();
  const matches = await prisma.match.findMany({
    where: { stage: { tournamentId }, result: { isNot: null } },
    select: { id: true },
  });
  let count = 0;
  for (const m of matches) {
    count += await rescorePredictionsForMatch(m.id);
  }
  revalidatePath("/leaderboard");
  return { count };
}

export async function createUser(data: { username: string; email?: string; fullName: string; role: string; password: string }) {
  await requireAdmin();
  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: {
      username: data.username,
      email: data.email || null,
      fullName: data.fullName,
      role: data.role,
      passwordHash,
    },
  });
  // Auto-enroll new users in the active tournament so they appear on the leaderboard.
  const t = await prisma.tournament.findFirst({ where: { isActive: true }, select: { id: true } });
  if (t) {
    await prisma.tournamentParticipation.upsert({
      where: { tournamentId_userId: { tournamentId: t.id, userId: user.id } },
      create: { tournamentId: t.id, userId: user.id, startingScore: 0, isActive: true },
      update: {},
    });
  }
  revalidatePath("/admin/users");
  revalidatePath("/leaderboard");
  return { userId: user.id };
}

export async function resetUserPassword(userId: string, newPassword: string) {
  await requireAdmin();
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function importPredictions(csvText: string) {
  await requireAdmin();
  const summary = await importPredictionsFromCsv(csvText);
  revalidatePath("/leaderboard");
  return summary;
}

export async function setUserRole(userId: string, role: "Admin" | "Player") {
  await requireAdmin();
  if (role !== "Admin" && role !== "Player") throw new Error("Invalid role");

  // Block removing the last admin. Demoting an Admin to Player is the only way to
  // "remove" admin rights, so guard against it leaving the app with zero admins.
  if (role !== "Admin") {
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (target?.role === "Admin") {
      const adminCount = await prisma.user.count({ where: { role: "Admin" } });
      if (adminCount <= 1) {
        throw new Error("Cannot remove the last admin. Promote another user to Admin first.");
      }
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin/users");
}
