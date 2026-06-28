// Leaderboard computation.
// Totals = startingScore + SUM(awardedPoints for scored predictions).
// Uses competition ranking (joint placing): equal points share rank and trophy.

import { prisma } from "@/lib/db/prisma";
import { assignCompetitionRanksBy } from "@/lib/domain/scoring";
import type { LeaderboardEntry } from "@/lib/domain/types";

export interface LeaderboardOptions {
  /** Restrict to a single stage (e.g. the group stage). */
  stageId?: string;
  /** Restrict to a single knockout round, matched against the externalRef prefix. */
  roundPrefix?: string;
  /** With stageId: exclude matches whose externalRef round prefix is in this list. */
  excludeRoundPrefixes?: string[];
}

type RawEntry = Omit<LeaderboardEntry, "rank" | "trophy">;

/**
 * Aggregate per-user points and green/amber/red tier counts, optionally scoped to a
 * single stage. The startingScore baseline is only folded into totalPoints for the
 * overall view (no stageId) - per-stage boards show computed points only.
 */
async function computeRawEntries(
  tournamentId: string,
  options: LeaderboardOptions
): Promise<RawEntry[]> {
  const participations = await prisma.tournamentParticipation.findMany({
    where: { tournamentId, isActive: true },
    include: { user: true },
  });

  if (participations.length === 0) return [];

  // Filter predictions to the tournament, or to a specific stage / knockout round.
  const scoped = Boolean(options.stageId || options.roundPrefix);
  const matchFilter = options.roundPrefix
    ? { externalRef: { startsWith: `${options.roundPrefix}::` }, stage: { tournamentId } }
    : options.stageId
    ? {
        stageId: options.stageId,
        stage: { tournamentId },
        ...(options.excludeRoundPrefixes?.length
          ? {
              NOT: options.excludeRoundPrefixes.map((p) => ({
                externalRef: { startsWith: `${p}::` },
              })),
            }
          : {}),
      }
    : { stage: { tournamentId } };

  // Aggregate scored predictions per user
  const scoredPredictions = await prisma.prediction.groupBy({
    by: ["userId"],
    where: { match: matchFilter, awardedPoints: { not: null } },
    _sum: { awardedPoints: true },
  });

  // Count by tier (green/amber/red) per user
  const tierCounts = await prisma.prediction.groupBy({
    by: ["userId", "scoreTier"],
    where: { match: matchFilter, scoreTier: { not: null } },
    _count: { scoreTier: true },
  });

  // Build lookup maps
  const pointsMap = new Map(
    scoredPredictions.map((r) => [r.userId, r._sum.awardedPoints ?? 0])
  );

  const tierMap = new Map<string, { green: number; amber: number; red: number }>();
  for (const tc of tierCounts) {
    if (!tc.userId || !tc.scoreTier) continue;
    const existing = tierMap.get(tc.userId) ?? { green: 0, amber: 0, red: 0 };
    if (tc.scoreTier === "ExactScore") existing.green += tc._count.scoreTier;
    else if (tc.scoreTier === "CorrectResult") existing.amber += tc._count.scoreTier;
    else if (tc.scoreTier === "Wrong") existing.red += tc._count.scoreTier;
    tierMap.set(tc.userId, existing);
  }

  return participations.map((p) => {
    const computedPoints = pointsMap.get(p.userId) ?? 0;
    const tiers = tierMap.get(p.userId) ?? { green: 0, amber: 0, red: 0 };
    // Baseline only counts on the overall board, not per-stage / per-round.
    const base = scoped ? 0 : p.startingScore;
    return {
      userId: p.userId,
      displayName: p.displayName ?? p.user.displayName ?? p.user.fullName,
      startingScore: p.startingScore,
      computedPoints,
      totalPoints: base + computedPoints,
      greenCount: tiers.green,
      amberCount: tiers.amber,
      redCount: tiers.red,
    };
  });
}

/** Leaderboard ranked by total points (joint placing). */
export async function getLeaderboard(
  tournamentId: string,
  options: LeaderboardOptions = {}
): Promise<LeaderboardEntry[]> {
  const raw = await computeRawEntries(tournamentId, options);
  return assignCompetitionRanksBy(raw, (e) => e.totalPoints) as LeaderboardEntry[];
}

/** Leaderboard ranked by number of perfect (exact-score) guesses. */
export async function getPerfectScoreLeaderboard(
  tournamentId: string,
  options: LeaderboardOptions = {}
): Promise<LeaderboardEntry[]> {
  const raw = await computeRawEntries(tournamentId, options);
  // Pre-sort by total points so players tied on perfect guesses display in a
  // sensible sub-order (stable sort preserves it through the rank-by-green pass).
  raw.sort((a, b) => b.totalPoints - a.totalPoints);
  return assignCompetitionRanksBy(raw, (e) => e.greenCount) as LeaderboardEntry[];
}

// Pretty labels for the knockout round slugs encoded in Match.externalRef.
const ROUND_LABELS: Record<string, string> = {
  "round-of-32": "Round of 32",
  "round-of-16": "Round of 16",
  "quarter-final": "Quarter-finals",
  "semi-final": "Semi-finals",
  "match-for-third-place": "Third place",
  final: "Final",
};

function roundLabel(slug: string): string {
  return (
    ROUND_LABELS[slug] ??
    slug
      .split("-")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ")
  );
}

export interface LeaderboardPhase {
  key: string; // URL param value, e.g. "stage:<id>" or "round:round-of-16"
  label: string;
  options: LeaderboardOptions;
}

/**
 * Ordered, filterable phases for the leaderboard tabs: each non-knockout stage as a
 * single phase, and the knockout stage expanded into its rounds (derived from the
 * match externalRef prefixes, ordered by earliest kickoff).
 */
export async function getLeaderboardPhases(tournamentId: string): Promise<LeaderboardPhase[]> {
  const stages = await prisma.stage.findMany({
    where: { tournamentId },
    orderBy: { ordinal: "asc" },
    select: { id: true, name: true, kind: true },
  });

  const phases: LeaderboardPhase[] = [];
  for (const stage of stages) {
    if (stage.kind !== "Knockout") {
      phases.push({ key: `stage:${stage.id}`, label: stage.name, options: { stageId: stage.id } });
      continue;
    }

    // Rounds broken out into their own tabs (and therefore excluded from the
    // combined Knockout Stage board, so each match is counted in exactly one tab).
    const BROKEN_OUT_ROUNDS = ["quarter-final", "semi-final", "match-for-third-place", "final"];

    // Combined "Knockout Stage" board = the early rounds only (Round of 32, Round of 16).
    phases.push({
      key: `stage:${stage.id}`,
      label: stage.name,
      options: { stageId: stage.id, excludeRoundPrefixes: BROKEN_OUT_ROUNDS },
    });

    // Then a tab per broken-out round that exists, ordered by earliest kickoff.
    const broken = new Set(BROKEN_OUT_ROUNDS);
    const matches = await prisma.match.findMany({
      where: { stageId: stage.id },
      select: { externalRef: true, kickoffUtc: true },
    });
    const minKickBySlug = new Map<string, number>();
    for (const m of matches) {
      const slug = (m.externalRef ?? "").split("::")[0];
      if (!slug || !broken.has(slug)) continue;
      const k = m.kickoffUtc ? m.kickoffUtc.getTime() : Number.MAX_SAFE_INTEGER;
      minKickBySlug.set(slug, Math.min(minKickBySlug.get(slug) ?? Number.MAX_SAFE_INTEGER, k));
    }
    const slugs = [...minKickBySlug.entries()].sort((a, b) => a[1] - b[1]).map(([slug]) => slug);
    for (const slug of slugs) {
      phases.push({ key: `round:${slug}`, label: roundLabel(slug), options: { roundPrefix: slug } });
    }
  }
  return phases;
}

/**
 * Get a player's predictions for a specific tournament with scoring information.
 * Used on the "my predictions" and match detail pages.
 */
export async function getUserPredictions(userId: string, tournamentId: string) {
  return prisma.prediction.findMany({
    where: {
      userId,
      match: { stage: { tournamentId } },
    },
    include: {
      match: {
        include: {
          homeTeam: true,
          awayTeam: true,
          result: true,
          stage: { include: { tournament: true } },
          group: true,
        },
      },
      predictedAdvancingTeam: true,
    },
    orderBy: { match: { kickoffUtc: "asc" } },
  });
}
