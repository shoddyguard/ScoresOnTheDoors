// CSV import service for bulk-entering player predictions.
// The pure parser (parsePredictionCsv) is separated from the DB orchestrator
// (importPredictionsFromCsv) so it can be unit-tested without a database.

import { parse } from "csv-parse/sync";
import { prisma } from "@/lib/db/prisma";
import { buildTeamCache, findTeam } from "./syncService";
import { upsertPrediction, rescorePredictionsForMatch } from "./predictionService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RowError {
  /** 1-based data row number (0 = header/structural error). */
  row: number;
  message: string;
}

export interface ParsedRow {
  rowNum: number;
  username: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  homeGoals: number;
  awayGoals: number;
  /** May be empty string when not provided (allowed for group matches / decisive scores). */
  advancingTeam: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: RowError[];
}

export interface ImportSummary {
  /** Total data rows seen (successfully parsed rows + parse-time row errors). */
  total: number;
  /** Rows written to the database. */
  imported: number;
  /** Rows skipped due to errors. */
  skipped: number;
  /** All errors (parse errors + DB-resolution errors), in row order. */
  errors: RowError[];
}

// ---------------------------------------------------------------------------
// Pure parser
// ---------------------------------------------------------------------------

const REQUIRED_COLUMNS = [
  "username",
  "home_team",
  "away_team",
  "date",
  "home_goals",
  "away_goals",
];

/**
 * Parse and validate a prediction CSV string.
 * Returns valid rows ready for DB processing and a list of row-level errors.
 * Pure function - no Prisma access.
 */
export function parsePredictionCsv(csvText: string): ParseResult {
  let records: Record<string, string>[];
  try {
    records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];
  } catch (e: unknown) {
    return {
      rows: [],
      errors: [
        {
          row: 0,
          message: `CSV parse error: ${e instanceof Error ? e.message : String(e)}`,
        },
      ],
    };
  }

  if (records.length === 0) {
    return { rows: [], errors: [] };
  }

  // Verify all required columns are present
  const headers = Object.keys(records[0]);
  const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [{ row: 0, message: `Missing required column(s): ${missing.join(", ")}` }],
    };
  }

  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    const rowNum = i + 1; // 1-based

    const username = rec["username"] ?? "";
    const homeTeam = rec["home_team"] ?? "";
    const awayTeam = rec["away_team"] ?? "";
    const date = rec["date"] ?? "";
    const homeGoalsRaw = rec["home_goals"] ?? "";
    const awayGoalsRaw = rec["away_goals"] ?? "";
    const advancingTeam = rec["advancing_team"] ?? "";

    if (!username) {
      errors.push({ row: rowNum, message: "username is required" });
      continue;
    }
    if (!homeTeam) {
      errors.push({ row: rowNum, message: "home_team is required" });
      continue;
    }
    if (!awayTeam) {
      errors.push({ row: rowNum, message: "away_team is required" });
      continue;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push({ row: rowNum, message: `date "${date}" must be in YYYY-MM-DD format` });
      continue;
    }

    const homeGoals = Number(homeGoalsRaw);
    if (homeGoalsRaw === "" || !Number.isInteger(homeGoals) || homeGoals < 0 || homeGoals > 20) {
      errors.push({
        row: rowNum,
        message: `home_goals "${homeGoalsRaw}" must be a whole number between 0 and 20`,
      });
      continue;
    }

    const awayGoals = Number(awayGoalsRaw);
    if (awayGoalsRaw === "" || !Number.isInteger(awayGoals) || awayGoals < 0 || awayGoals > 20) {
      errors.push({
        row: rowNum,
        message: `away_goals "${awayGoalsRaw}" must be a whole number between 0 and 20`,
      });
      continue;
    }

    rows.push({ rowNum, username, homeTeam, awayTeam, date, homeGoals, awayGoals, advancingTeam });
  }

  return { rows, errors };
}

// ---------------------------------------------------------------------------
// DB orchestrator
// ---------------------------------------------------------------------------

/**
 * Import predictions from a CSV string into the active tournament.
 * Bypasses prediction locks (admin back-entry).
 * Idempotent: re-importing the same rows overwrites previous values.
 */
export async function importPredictionsFromCsv(csvText: string): Promise<ImportSummary> {
  // 1. Load active tournament with its teams
  const tournament = await prisma.tournament.findFirst({
    where: { isActive: true },
    include: { teams: true },
  });
  if (!tournament) {
    throw new Error("No active tournament found. Activate a tournament before importing.");
  }

  // 2. Build team cache (alias-aware, case-insensitive) and user map
  const teamCache = buildTeamCache(tournament.teams);
  const users = await prisma.user.findMany({ select: { id: true, username: true } });
  const userMap = new Map<string, string>(); // lowercase username -> userId
  for (const u of users) {
    userMap.set(u.username.toLowerCase(), u.id);
  }

  // 3. Parse and validate CSV structure
  const { rows, errors: parseErrors } = parsePredictionCsv(csvText);
  const allErrors: RowError[] = [...parseErrors];

  // Row-level parse errors count as skipped rows
  const parseSkipped = parseErrors.filter((e) => e.row > 0).length;
  let dbSkipped = 0;
  let imported = 0;
  const affectedMatchIds = new Set<string>();

  // 4. Process each valid row
  for (const row of rows) {
    // Resolve user (case-insensitive username lookup)
    const userId = userMap.get(row.username.toLowerCase());
    if (!userId) {
      allErrors.push({ row: row.rowNum, message: `Unknown username "${row.username}"` });
      dbSkipped++;
      continue;
    }

    // Resolve home team
    const homeTeam = findTeam(teamCache, row.homeTeam);
    if (!homeTeam) {
      allErrors.push({ row: row.rowNum, message: `Unknown team "${row.homeTeam}" (home_team)` });
      dbSkipped++;
      continue;
    }

    // Resolve away team
    const awayTeam = findTeam(teamCache, row.awayTeam);
    if (!awayTeam) {
      allErrors.push({ row: row.rowNum, message: `Unknown team "${row.awayTeam}" (away_team)` });
      dbSkipped++;
      continue;
    }

    // Resolve match by teams + date
    const matches = await prisma.match.findMany({
      where: {
        stage: { tournamentId: tournament.id },
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        matchDateLocal: row.date,
      },
      include: { stage: true },
    });

    if (matches.length === 0) {
      // Check reversed home/away to give a more useful error
      const reversedCount = await prisma.match.count({
        where: {
          stage: { tournamentId: tournament.id },
          homeTeamId: awayTeam.id,
          awayTeamId: homeTeam.id,
          matchDateLocal: row.date,
        },
      });
      if (reversedCount > 0) {
        allErrors.push({
          row: row.rowNum,
          message: `Fixture found but with home/away reversed: try "${row.awayTeam}" vs "${row.homeTeam}" on ${row.date}`,
        });
      } else {
        allErrors.push({
          row: row.rowNum,
          message: `No match found for "${row.homeTeam}" vs "${row.awayTeam}" on ${row.date}`,
        });
      }
      dbSkipped++;
      continue;
    }

    if (matches.length > 1) {
      allErrors.push({
        row: row.rowNum,
        message: `Ambiguous: ${matches.length} matches for "${row.homeTeam}" vs "${row.awayTeam}" on ${row.date}`,
      });
      dbSkipped++;
      continue;
    }

    const match = matches[0];
    const isKnockout = match.stage.kind === "Knockout";

    // Resolve advancing team for knockout matches
    let predictedAdvancingTeamId: string | null = null;
    if (isKnockout) {
      if (row.advancingTeam) {
        // Explicit advancing_team given: resolve and validate it plays in this fixture
        const advTeam = findTeam(teamCache, row.advancingTeam);
        if (!advTeam) {
          allErrors.push({
            row: row.rowNum,
            message: `Unknown advancing_team "${row.advancingTeam}"`,
          });
          dbSkipped++;
          continue;
        }
        if (advTeam.id !== homeTeam.id && advTeam.id !== awayTeam.id) {
          allErrors.push({
            row: row.rowNum,
            message: `advancing_team "${row.advancingTeam}" is not playing in this fixture`,
          });
          dbSkipped++;
          continue;
        }
        predictedAdvancingTeamId = advTeam.id;
      } else {
        // Derive from the predicted score
        if (row.homeGoals > row.awayGoals) {
          predictedAdvancingTeamId = homeTeam.id;
        } else if (row.awayGoals > row.homeGoals) {
          predictedAdvancingTeamId = awayTeam.id;
        } else {
          // Predicted draw: advancing_team is required (cannot be derived)
          allErrors.push({
            row: row.rowNum,
            message: `advancing_team is required for knockout matches when the predicted score is a draw (${row.homeGoals}-${row.awayGoals})`,
          });
          dbSkipped++;
          continue;
        }
      }
    }
    // Group matches: predictedAdvancingTeamId stays null

    // 5. Upsert prediction, bypassing the prediction lock (admin back-entry)
    await upsertPrediction({
      userId,
      matchId: match.id,
      homeGoals: row.homeGoals,
      awayGoals: row.awayGoals,
      predictedAdvancingTeamId,
      submittedVia: "CsvImport",
      bypassLock: true,
    });

    affectedMatchIds.add(match.id);
    imported++;
  }

  // 6. Rescore affected matches (idempotent; no-op if no result exists yet)
  for (const matchId of affectedMatchIds) {
    await rescorePredictionsForMatch(matchId);
  }

  return {
    total: rows.length + parseSkipped,
    imported,
    skipped: parseSkipped + dbSkipped,
    errors: allErrors,
  };
}
