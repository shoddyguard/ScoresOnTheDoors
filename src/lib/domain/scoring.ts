// Pure, idempotent scoring engine.
// No Prisma imports - takes plain data in, returns plain data out.
// All business-logic decisions live here and are covered by scoring.test.ts.

import type { StageKind, ScoreTier, ScoringConfig } from "./types";

export interface PredictionInput {
  homeGoals: number;
  awayGoals: number;
  predictedAdvancingTeamId?: string | null;
}

export interface ResultInput {
  homeGoals90: number;
  awayGoals90: number;
  advancingTeamId?: string | null;
}

export interface ScoringOutput {
  points: number;
  tier: ScoreTier;
}

/**
 * Score a single prediction against a known result.
 *
 * Rules (confirmed with the family):
 * 1. Exact 90-min score -> 2 pts (green). Applies to ALL match types.
 *    For knockouts: green does NOT require the correct advancing team.
 * 2. Otherwise, "correct result":
 *    - Group: predicted 90-min outcome (H/D/A) matches actual 90-min outcome -> 1 pt (amber).
 *    - Knockout: predictedAdvancingTeamId matches advancingTeamId -> 1 pt (amber).
 * 3. Otherwise 0 pts (red).
 */
export function scoreOnePrediction(
  prediction: PredictionInput,
  result: ResultInput,
  stageKind: StageKind,
  config: ScoringConfig
): ScoringOutput {
  const { homeGoals, awayGoals, predictedAdvancingTeamId } = prediction;
  const { homeGoals90, awayGoals90, advancingTeamId } = result;

  // --- Step 1: Exact 90-min score (all match types) ---
  if (homeGoals === homeGoals90 && awayGoals === awayGoals90) {
    return { points: config.pointsExactScore, tier: "ExactScore" };
  }

  // --- Step 2: Correct result (strategy depends on stage kind) ---
  if (stageKind === "Group") {
    const predictedOutcome = outcome90(homeGoals, awayGoals);
    const actualOutcome = outcome90(homeGoals90, awayGoals90);
    if (predictedOutcome === actualOutcome) {
      return { points: config.pointsCorrectResult, tier: "CorrectResult" };
    }
  } else {
    // Knockout: correct = predicted advancing team matches actual
    if (
      predictedAdvancingTeamId &&
      advancingTeamId &&
      predictedAdvancingTeamId === advancingTeamId
    ) {
      return { points: config.pointsCorrectResult, tier: "CorrectResult" };
    }
  }

  // --- Step 3: Wrong ---
  return { points: 0, tier: "Wrong" };
}

type Outcome90 = "Home" | "Draw" | "Away";

function outcome90(homeGoals: number, awayGoals: number): Outcome90 {
  if (homeGoals > awayGoals) return "Home";
  if (homeGoals < awayGoals) return "Away";
  return "Draw";
}

/**
 * Compute the competition ranking (joint placing) for entries, ranked by a numeric
 * value selector. Equal values share rank; the next rank increments by the count of
 * tied players. Input order is preserved within ties (stable sort), so callers can
 * pre-sort by a tiebreak.
 *
 * e.g. values [10, 10, 8, 7] -> ranks [1, 1, 3, 4]
 * Trophies: rank 1 = gold, rank 2 = silver, rank 3 = bronze.
 */
export function assignCompetitionRanksBy<T>(
  entries: T[],
  getValue: (entry: T) => number
): Array<T & { rank: number; trophy: "gold" | "silver" | "bronze" | null }> {
  const sorted = [...entries].sort((a, b) => getValue(b) - getValue(a));
  let rank = 1;
  return sorted.map((entry, i) => {
    if (i > 0 && getValue(sorted[i]) < getValue(sorted[i - 1])) {
      rank = i + 1;
    }
    return {
      ...entry,
      rank,
      trophy:
        rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : null,
    };
  });
}

/**
 * Competition ranking by total points. Thin wrapper over assignCompetitionRanksBy.
 */
export function assignCompetitionRanks<T extends { totalPoints: number }>(
  entries: T[]
): Array<T & { rank: number; trophy: "gold" | "silver" | "bronze" | null }> {
  return assignCompetitionRanksBy(entries, (e) => e.totalPoints);
}

/**
 * Derive which team advances from an OpenFootball score object.
 * Convention: penalties (p) > extra-time (et) > full-time (ft).
 * Returns "home" | "away" or null if no result yet.
 */
export function deriveAdvancing(score: {
  ft?: [number, number] | null;
  et?: [number, number] | null;
  p?: [number, number] | null;
}): "home" | "away" | null {
  const decisive = score.p ?? score.et ?? score.ft;
  if (!decisive) return null;
  const [h, a] = decisive;
  if (h > a) return "home";
  if (a > h) return "away";
  // Should not happen in a valid result, but be defensive
  return null;
}
