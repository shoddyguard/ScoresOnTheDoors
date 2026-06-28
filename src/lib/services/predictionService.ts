// Prediction CRUD + scoring.
// All write paths go through this service so lock enforcement is centralised.
// Server actions call this AFTER re-checking canEditPrediction (belt-and-suspenders).

import { prisma } from "@/lib/db/prisma";
import { canEditPrediction } from "./lockService";
import { scoreOnePrediction } from "@/lib/domain/scoring";
import type { PredictionSource, StageKind, ScoringConfig } from "@/lib/domain/types";

export interface UpsertPredictionInput {
  userId: string;
  matchId: string;
  homeGoals: number;
  awayGoals: number;
  predictedAdvancingTeamId?: string | null;
  submittedVia?: PredictionSource;
  /** When true, skips the lock check entirely (admin back-entry via CSV import). */
  bypassLock?: boolean;
}

export interface UpsertPredictionResult {
  prediction: { id: string; awardedPoints: number | null; scoreTier: string | null };
  wasLocked: boolean;
}

/**
 * Create or update a prediction.
 * Enforces the lock rule server-side.
 * If a Result already exists for the match, scores the prediction immediately.
 */
export async function upsertPrediction(
  input: UpsertPredictionInput
): Promise<UpsertPredictionResult> {
  const { userId, matchId, homeGoals, awayGoals, predictedAdvancingTeamId, submittedVia = "Web", bypassLock = false } = input;

  // Server-side lock check (always, even if UI already checked).
  // bypassLock=true is used by the CSV import path (admin back-entry).
  if (!bypassLock) {
    const lockResult = await canEditPrediction(userId, matchId);
    if (!lockResult.allowed) {
      return { prediction: { id: "", awardedPoints: null, scoreTier: null }, wasLocked: true };
    }
  }

  // Get match + stage + result (for immediate scoring if result exists)
  const match = await prisma.match.findUniqueOrThrow({
    where: { id: matchId },
    include: {
      stage: { include: { tournament: true } },
      result: true,
    },
  });

  const config: ScoringConfig = {
    pointsExactScore: match.stage.tournament.pointsExactScore,
    pointsCorrectResult: match.stage.tournament.pointsCorrectResult,
  };

  // Calculate points if result exists
  let awardedPoints: number | null = null;
  let scoreTier: string | null = null;
  let scoredAgainstResultVersion: number | null = null;

  if (match.result) {
    const output = scoreOnePrediction(
      { homeGoals, awayGoals, predictedAdvancingTeamId },
      {
        homeGoals90: match.result.homeGoals90,
        awayGoals90: match.result.awayGoals90,
        advancingTeamId: match.result.advancingTeamId,
      },
      match.stage.kind as StageKind,
      config
    );
    awardedPoints = output.points;
    scoreTier = output.tier;
    scoredAgainstResultVersion = match.result.version;
  }

  const prediction = await prisma.prediction.upsert({
    where: { matchId_userId: { matchId, userId } },
    create: {
      matchId,
      userId,
      homeGoals,
      awayGoals,
      predictedAdvancingTeamId,
      submittedVia,
      awardedPoints,
      scoreTier,
      scoredAgainstResultVersion,
    },
    update: {
      homeGoals,
      awayGoals,
      predictedAdvancingTeamId,
      submittedVia,
      awardedPoints,
      scoreTier,
      scoredAgainstResultVersion,
      version: { increment: 1 },
    },
  });

  return { prediction, wasLocked: false };
}

/**
 * (Re)score all predictions for a match after a result is created or updated.
 * Idempotent: calling multiple times with the same result produces the same output.
 * Called by syncService and admin result-override flow.
 */
export async function rescorePredictionsForMatch(matchId: string): Promise<number> {
  const match = await prisma.match.findUniqueOrThrow({
    where: { id: matchId },
    include: {
      stage: { include: { tournament: true } },
      result: true,
      predictions: true,
    },
  });

  if (!match.result) return 0;

  const config: ScoringConfig = {
    pointsExactScore: match.stage.tournament.pointsExactScore,
    pointsCorrectResult: match.stage.tournament.pointsCorrectResult,
  };

  let count = 0;
  for (const pred of match.predictions) {
    const output = scoreOnePrediction(
      {
        homeGoals: pred.homeGoals,
        awayGoals: pred.awayGoals,
        predictedAdvancingTeamId: pred.predictedAdvancingTeamId,
      },
      {
        homeGoals90: match.result.homeGoals90,
        awayGoals90: match.result.awayGoals90,
        advancingTeamId: match.result.advancingTeamId,
      },
      match.stage.kind as StageKind,
      config
    );

    await prisma.prediction.update({
      where: { id: pred.id },
      data: {
        awardedPoints: output.points,
        scoreTier: output.tier,
        scoredAgainstResultVersion: match.result.version,
        version: { increment: 1 },
      },
    });
    count++;
  }

  return count;
}

/** Get all predictions for a match, grouped by user (for the match detail page). */
export async function getMatchPredictions(matchId: string, revealAfterKickoff = true) {
  const match = await prisma.match.findUniqueOrThrow({
    where: { id: matchId },
    include: { result: true, stage: { include: { tournament: true } } },
  });

  // Only reveal predictions after the match is locked (kickoff passed)
  // so players can't see each other's choices before the match
  const isLocked = match.status !== "Scheduled";

  if (!isLocked && revealAfterKickoff) {
    return [];
  }

  return prisma.prediction.findMany({
    where: { matchId },
    include: {
      user: { select: { id: true, fullName: true, displayName: true } },
      predictedAdvancingTeam: { select: { id: true, name: true } },
    },
    orderBy: { awardedPoints: "desc" },
  });
}
