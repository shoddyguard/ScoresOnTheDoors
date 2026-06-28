// Server-side prediction lock enforcement.
// This is the single authority for "can this user edit this prediction?"
// Both UI (cosmetic disabling) and server actions/route handlers call canEditPrediction().
// The server action re-checks at execution time - this defends against stale UI, clock skew,
// and any crafted direct requests.

import { DateTime } from "luxon";
import { prisma } from "@/lib/db/prisma";

export interface CanEditResult {
  allowed: boolean;
  reason: string;
}

/**
 * Determine whether a given user may edit their prediction for a match.
 *
 * Lock rule: a match locks at 00:00 on its match day in the tournament's timezone
 * (default Europe/London), UNLESS an active PredictionLockOverride is in place.
 *
 * Override scopes: Global (whole tournament) > Match > User > UserMatch.
 * Any single active, non-expired override covering this (match, user) allows editing.
 */
export async function canEditPrediction(
  userId: string,
  matchId: string
): Promise<CanEditResult> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      stage: {
        include: { tournament: true },
      },
    },
  });

  if (!match) {
    return { allowed: false, reason: "Match not found" };
  }

  const { tournament } = match.stage;

  // Check for active lock overrides covering this (match, user).
  // An active override always beats any other lock rule.
  const now = new Date();
  const activeOverride = await prisma.predictionLockOverride.findFirst({
    where: {
      isActive: true,
      tournamentId: tournament.id,
      AND: [
        {
          // Scope: must cover this match+user combination
          OR: [
            { scope: "Global" },
            { scope: "Match", matchId },
            { scope: "User", userId },
            { scope: "UserMatch", matchId, userId },
          ],
        },
        {
          // Expiry: must not be expired
          OR: [
            { unlockedUntil: null },
            { unlockedUntil: { gt: now } },
          ],
        },
      ],
    },
  });

  if (activeOverride) {
    return {
      allowed: true,
      reason: `Admin unlock: ${activeOverride.reason ?? "no reason given"}`,
    };
  }

  // Global tournament lock: admin can lock the whole tournament (e.g. after it ends)
  if (!tournament.lockEnabledGlobally) {
    return { allowed: false, reason: "Tournament is globally locked by admin" };
  }

  // Time-based lock: 00:00 on match day in tournament timezone
  if (!match.matchDateLocal) {
    // No date set - treat as editable (placeholder match without a date)
    return { allowed: true, reason: "No match date set (placeholder)" };
  }

  const tz = tournament.timeZoneId;
  let lockInstant: DateTime;
  try {
    lockInstant = DateTime.fromISO(match.matchDateLocal, { zone: tz }).startOf("day");
  } catch {
    return { allowed: true, reason: "Could not parse match date - treating as editable" };
  }

  const nowDt = DateTime.utc();
  if (nowDt >= lockInstant.toUTC()) {
    return {
      allowed: false,
      reason: `Locked at 00:00 on ${match.matchDateLocal} (${tz})`,
    };
  }

  return { allowed: true, reason: "Editable" };
}

/**
 * Compute the UTC lock instant for a match. Useful for displaying countdowns.
 * Returns null if the match has no date or the date cannot be parsed.
 */
export function computeLockInstant(
  matchDateLocal: string | null,
  tournamentTimeZoneId: string
): DateTime | null {
  if (!matchDateLocal) return null;
  try {
    return DateTime.fromISO(matchDateLocal, { zone: tournamentTimeZoneId })
      .startOf("day")
      .toUTC();
  } catch {
    return null;
  }
}

/**
 * Compute the match's calendar date in the tournament's timezone from a UTC kickoff.
 * This is stored as matchDateLocal on the Match and used for the lock calculation.
 */
export function deriveMatchDateLocal(
  kickoffUtc: Date,
  tournamentTimeZoneId: string
): string {
  return DateTime.fromJSDate(kickoffUtc)
    .setZone(tournamentTimeZoneId)
    .toISODate()!;
}
