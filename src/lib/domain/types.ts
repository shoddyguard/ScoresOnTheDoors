// Core domain types for ScoresOnTheDoors.
// These are string-union types (not enums) because Prisma + SQLite stores them as strings.

export type StageKind = "Group" | "Knockout";
export type MatchStatus = "Scheduled" | "Live" | "Finished" | "Abandoned" | "Cancelled";
export type ScoreTier = "ExactScore" | "CorrectResult" | "Wrong";
export type UserRole = "Admin" | "Player";
export type PredictionSource = "Web" | "CsvImport" | "AdminBackEntry";
export type LockOverrideScope = "Global" | "Match" | "User" | "UserMatch";
export type ResultSource = "OpenFootball" | "ManualOverride";
export type SyncTrigger = "Scheduled" | "Manual";

export interface ScoringConfig {
  pointsExactScore: number;
  pointsCorrectResult: number;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  startingScore: number;
  computedPoints: number;
  totalPoints: number;
  greenCount: number;
  amberCount: number;
  redCount: number;
  rank: number;
  trophy: "gold" | "silver" | "bronze" | null;
}

// Represents the advancing-team derivation from an OpenFootball score object.
// p > et > ft by convention.
export interface AdvancementDerivation {
  advancingHomeTeam: boolean; // true = home, false = away
}
