// Maps OpenFootball feed matches to ScoresOnTheDoors domain entities.
// Pure functions - no DB calls; used by syncService.

import { DateTime } from "luxon";
import { deriveAdvancing } from "@/lib/domain/scoring";
import type { FeedMatch } from "./feedSchema";

export interface MappedMatch {
  externalNum: number | null;
  externalRef: string;
  round: string;
  date: string; // "YYYY-MM-DD"
  kickoffUtc: Date | null;
  matchDateLocal: string | null; // "YYYY-MM-DD" in tournament TZ
  team1Name: string;
  team2Name: string;
  venue: string | null;
  groupName: string | null;
  hasResult: boolean;
  homeGoals90: number | null;
  awayGoals90: number | null;
  homeGoalsET: number | null;
  awayGoalsET: number | null;
  homePens: number | null;
  awayPens: number | null;
  advancing: "home" | "away" | null;
}

/**
 * Map a single OpenFootball match to our intermediate domain format.
 * tournamentTimeZoneId is used to compute matchDateLocal from the kickoff.
 */
export function mapFeedMatch(
  feedMatch: FeedMatch,
  tournamentTimeZoneId: string
): MappedMatch {
  const kickoffUtc = parseKickoffUtc(feedMatch.date, feedMatch.time ?? null);
  const matchDateLocal = deriveMatchDateLocal(feedMatch.date, kickoffUtc, tournamentTimeZoneId);

  const score = feedMatch.score;
  const ft = score?.ft ?? null;
  const et = score?.et ?? null;
  const p = score?.p ?? null;

  const hasResult = ft !== null;
  const advancing = hasResult ? deriveAdvancing({ ft, et, p }) : null;

  return {
    externalNum: feedMatch.num ?? null,
    externalRef: makeExternalRef(feedMatch.round, feedMatch.date, feedMatch.team1, feedMatch.team2),
    round: feedMatch.round,
    date: feedMatch.date,
    kickoffUtc,
    matchDateLocal,
    team1Name: feedMatch.team1,
    team2Name: feedMatch.team2,
    venue: feedMatch.ground ?? null,
    groupName: feedMatch.group ?? null,
    hasResult,
    homeGoals90: ft ? ft[0] : null,
    awayGoals90: ft ? ft[1] : null,
    homeGoalsET: et ? et[0] : null,
    awayGoalsET: et ? et[1] : null,
    homePens: p ? p[0] : null,
    awayPens: p ? p[1] : null,
    advancing,
  };
}

/**
 * Derive the team name's "placeholder" status.
 * W## = winner of match num ##; L## = loser of match num ##;
 * anything else is a real team name.
 */
export function isPlaceholder(teamName: string): boolean {
  return /^[WL]\d+$/.test(teamName) || teamName.includes("Group") || teamName.includes("Winner") || teamName.includes("Runner");
}

/**
 * Composite natural key for group matches (which have no stable num).
 * Format is stable for a given round+date+teams combination.
 */
export function makeExternalRef(round: string, date: string, team1: string, team2: string): string {
  const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return `${normalise(round)}::${date}::${normalise(team1)}::${normalise(team2)}`;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parse the OpenFootball time string ("HH:MM UTC-N") + date into a UTC DateTime.
 * Returns null if the time string is missing or unparseable - the caller uses
 * the date field alone for locking (so a parse failure is non-fatal).
 */
function parseKickoffUtc(dateStr: string, timeStr: string | null): Date | null {
  if (!timeStr) return null;

  // Match "12:00 UTC-7" or "12:00 UTC+5:30" or "12:00 UTC+0"
  const m = timeStr.match(/^(\d{2}:\d{2})\s+UTC([+-]\d+(?::\d+)?)\s*$/);
  if (!m) return null;

  const [, timeOfDay, offsetRaw] = m;
  const offsetHours = parseFloat(offsetRaw);
  const absH = Math.abs(offsetHours);
  const h = Math.floor(absH);
  const min = Math.round((absH - h) * 60);
  const sign = offsetHours >= 0 ? "+" : "-";
  const isoOffset = `${sign}${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;

  try {
    const dt = DateTime.fromISO(`${dateStr}T${timeOfDay}:00${isoOffset}`);
    return dt.isValid ? dt.toUTC().toJSDate() : null;
  } catch {
    return null;
  }
}

/**
 * The lock rule uses a calendar date, not a timestamp.
 * Prefer deriving it from the kickoff (already in UTC) converted to tournament TZ.
 * Fall back to the raw date field from the feed if kickoff parsing failed.
 */
function deriveMatchDateLocal(
  feedDate: string,
  kickoffUtc: Date | null,
  tournamentTimeZoneId: string
): string | null {
  if (kickoffUtc) {
    try {
      const dt = DateTime.fromJSDate(kickoffUtc).setZone(tournamentTimeZoneId);
      return dt.toISODate(); // "YYYY-MM-DD"
    } catch {
      /* fall through */
    }
  }
  // Use the raw date from the feed as a fallback (it's the venue-local date, close enough)
  return feedDate;
}
