"use server";

import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";

/**
 * Create the very first administrator. Only permitted during first-boot, i.e. when
 * no admin exists yet. Once an admin exists, this is rejected (so it can't be abused
 * to mint extra admins, use the admin Users page for that).
 */
export async function createInitialAdmin(data: {
  username: string;
  fullName: string;
  email?: string;
  password: string;
}) {
  const adminCount = await prisma.user.count({ where: { role: "Admin" } });
  if (adminCount > 0) throw new Error("An administrator already exists.");

  const username = data.username?.trim();
  const fullName = data.fullName?.trim();
  if (!username || !fullName) throw new Error("Username and full name are required.");
  if (!data.password || data.password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const existing = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (existing) throw new Error("That username is already taken.");

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: {
      username,
      fullName,
      email: data.email?.trim() || null,
      role: "Admin",
      passwordHash,
    },
  });

  // Enroll in the active tournament if one exists (mirrors createUser).
  const t = await prisma.tournament.findFirst({ where: { isActive: true }, select: { id: true } });
  if (t) {
    await prisma.tournamentParticipation.upsert({
      where: { tournamentId_userId: { tournamentId: t.id, userId: user.id } },
      create: { tournamentId: t.id, userId: user.id, startingScore: 0, isActive: true },
      update: {},
    });
  }

  return { userId: user.id };
}
