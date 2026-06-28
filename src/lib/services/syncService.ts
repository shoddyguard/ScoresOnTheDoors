// OpenFootball sync service.
// Fetches fixtures + results, upserts matches, applies results, and rescores predictions.
// Override protection: matches with isManualOverride=true are never overwritten by sync.
// Placeholder resolution: W##/L## tokens resolve to real teams as the tournament progresses.
// Concurrency: all sync runs (scheduled + manual) are serialised via a Mutex.

import { Mutex } from "async-mutex";
import { prisma } from "@/lib/db/prisma";
import { fetchFeed } from "@/lib/openfootball/client";
import { mapFeedMatch, isPlaceholder } from "@/lib/openfootball/mapper";
import { rescorePredictionsForMatch } from "./predictionService";
import type { Tournament, Team, Group } from "@prisma/client";

const syncMutex = new Mutex();

// ---------------------------------------------------------------------------
// Background scheduler
// ---------------------------------------------------------------------------

export function startSyncScheduler(): void {
  const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

  const runScheduled = async () => {
    if (syncMutex.isLocked()) {
      console.log("[sync] Skipping - previous sync still running");
      return;
    }
    const release = await syncMutex.acquire();
    try {
      const tournaments = await prisma.tournament.findMany({
        where: { isActive: true, openFootballUrl: { not: null } },
      });
      for (const t of tournaments) {
        await runSync(t, "Scheduled").catch((err) =>
          console.error(`[sync] Error for tournament ${t.slug}:`, err)
        );
      }
    } finally {
      release();
    }
  };

  // setInterval avoids the node-cron dependency (which uses child_process/path
  // and confuses the Next.js webpack bundler). Timer is unref'd so it does not
  // keep the process alive if Next.js shuts down cleanly.
  setInterval(runScheduled, INTERVAL_MS).unref();
  console.log("[sync] Scheduler started (every 30 minutes via setInterval)");
}

// ---------------------------------------------------------------------------
// Manual sync trigger (for the admin "sync now" button)
// ---------------------------------------------------------------------------

export async function triggerManualSync(tournamentId: string): Promise<string> {
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
  });

  if (!tournament.openFootballUrl) {
    throw new Error("No feed URL configured for this tournament");
  }

  if (syncMutex.isLocked()) {
    throw new Error("Sync already in progress - please wait");
  }

  const release = await syncMutex.acquire();
  try {
    const log = await runSync(tournament, "Manual");
    return log.id;
  } finally {
    release();
  }
}

// ---------------------------------------------------------------------------
// Core sync logic
// ---------------------------------------------------------------------------

async function runSync(tournament: Tournament, trigger: "Scheduled" | "Manual") {
  if (!tournament.openFootballUrl) throw new Error("No feed URL");

  // Create a sync log to track progress
  const syncLog = await prisma.syncLog.create({
    data: { tournamentId: tournament.id, trigger },
  });

  const stats = {
    matchesCreated: 0,
    matchesUpdated: 0,
    resultsApplied: 0,
    overridesSkipped: 0,
    placeholdersResolved: 0,
    predictionsRescored: 0,
  };
  const errors: string[] = [];

  try {
    const feed = await fetchFeed(tournament.openFootballUrl);

    // Pre-load all teams for this tournament (name + alias matching is done in JS)
    const allTeams = await prisma.team.findMany({ where: { tournamentId: tournament.id } });
    const teamCache = buildTeamCache(allTeams);

    // Pre-load all groups for this tournament
    const allGroups = await prisma.group.findMany({ where: { tournamentId: tournament.id } });
    const groupCache = buildGroupCache(allGroups);

    // Find or create the group and knockout stages
    const groupStage = await prisma.stage.findFirst({
      where: { tournamentId: tournament.id, kind: "Group" },
    });
    const knockoutStage = await prisma.stage.findFirst({
      where: { tournamentId: tournament.id, kind: "Knockout" },
    });

    for (const feedMatch of feed.matches) {
      const label = feedMatch.num
        ? `#${feedMatch.num}`
        : `${feedMatch.team1} vs ${feedMatch.team2}`;

      try {
        const mapped = mapFeedMatch(feedMatch, tournament.timeZoneId);

        const isKnockout = feedMatch.num !== undefined && feedMatch.num !== null && !feedMatch.group;
        const stage = isKnockout ? knockoutStage : groupStage;
        if (!stage) continue; // Stage not set up - skip

        await upsertMatch(tournament.id, stage.id, mapped, teamCache, groupCache, stats);
      } catch (err) {
        errors.push(`Match ${label}: ${String(err)}`);
      }
    }

    // Placeholder resolution loop (W## → real team)
    let resolved = 1;
    while (resolved > 0) {
      resolved = await resolvePlaceholders(tournament.id, teamCache, stats);
    }

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        completedAt: new Date(),
        ...stats,
        outcome: errors.length === 0 ? "Success" : "Partial",
        messageJson: errors.length > 0 ? JSON.stringify(errors) : null,
      },
    });
  } catch (err) {
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        completedAt: new Date(),
        outcome: "Error",
        messageJson: JSON.stringify([String(err)]),
      },
    });
    throw err;
  }

  return syncLog;
}

// ---------------------------------------------------------------------------
// Match upsert
// ---------------------------------------------------------------------------

async function upsertMatch(
  tournamentId: string,
  stageId: string,
  mapped: ReturnType<typeof mapFeedMatch>,
  teamCache: Map<string, Team>,
  groupCache: Map<string, Group>,
  stats: SyncStats
) {
  // Auto-create teams from the feed (skips placeholders like W##/L##)
  const home = await findOrCreateTeam(tournamentId, mapped.team1Name, teamCache);
  const away = await findOrCreateTeam(tournamentId, mapped.team2Name, teamCache);

  const homeIsPlaceholder = isPlaceholder(mapped.team1Name);
  const awayIsPlaceholder = isPlaceholder(mapped.team2Name);

  // Auto-create groups for group-stage matches
  const group = mapped.groupName
    ? await findOrCreateGroup(tournamentId, mapped.groupName, groupCache)
    : null;

  // Find the existing match record (if any)
  const existingMatch = mapped.externalNum
    ? await prisma.match.findUnique({ where: { stageId_externalNum: { stageId, externalNum: mapped.externalNum } } })
    : await prisma.match.findUnique({ where: { stageId_externalRef: { stageId, externalRef: mapped.externalRef } } });

  const sharedMatchData = {
    externalNum: mapped.externalNum,
    externalRef: mapped.externalRef,
    kickoffUtc: mapped.kickoffUtc ?? undefined,
    matchDateLocal: mapped.matchDateLocal,
    venue: mapped.venue,
    status: mapped.hasResult ? "Finished" : "Scheduled",
  };

  let matchId: string;

  if (!existingMatch) {
    // First insert: write everything including placeholders as-is
    const created = await prisma.match.create({
      data: {
        stageId,
        ...sharedMatchData,
        homeTeamId: home?.id ?? null,
        awayTeamId: away?.id ?? null,
        homePlaceholder: homeIsPlaceholder ? mapped.team1Name : null,
        awayPlaceholder: awayIsPlaceholder ? mapped.team2Name : null,
        groupId: group?.id ?? null,
      },
    });
    matchId = created.id;
    stats.matchesCreated++;
  } else {
    // No-clobber UPDATE: never overwrite a resolved team/group with null or a placeholder.
    // If home/away resolved this pass, update the ID and clear the placeholder.
    // If they were already resolved in a prior sync, leave those fields alone.
    // If still unresolved, update the placeholder string in case it changed.
    type MatchPatch = {
      homeTeamId?: string | null;
      homePlaceholder?: string | null;
      awayTeamId?: string | null;
      awayPlaceholder?: string | null;
      groupId?: string | null;
    };
    const patch: MatchPatch = {};

    if (home) {
      patch.homeTeamId = home.id;
      patch.homePlaceholder = null;
    } else if (!existingMatch.homeTeamId) {
      patch.homeTeamId = null;
      patch.homePlaceholder = homeIsPlaceholder
        ? mapped.team1Name
        : (existingMatch.homePlaceholder ?? null);
    }
    // else: existingMatch.homeTeamId already set and no new real team -- leave it alone

    if (away) {
      patch.awayTeamId = away.id;
      patch.awayPlaceholder = null;
    } else if (!existingMatch.awayTeamId) {
      patch.awayTeamId = null;
      patch.awayPlaceholder = awayIsPlaceholder
        ? mapped.team2Name
        : (existingMatch.awayPlaceholder ?? null);
    }
    // else: existingMatch.awayTeamId already set and no new real team -- leave it alone

    if (group) {
      patch.groupId = group.id;
    }
    // else if existingMatch.groupId is set: leave it alone

    await prisma.match.update({
      where: { id: existingMatch.id },
      data: { ...sharedMatchData, ...patch },
    });
    matchId = existingMatch.id;
    stats.matchesUpdated++;

    // Track placeholder resolution
    if (existingMatch.homePlaceholder && home) stats.placeholdersResolved++;
    if (existingMatch.awayPlaceholder && away) stats.placeholdersResolved++;
  }

  // Upsert GroupTeam memberships so group standings can be computed
  if (group) {
    if (home) {
      await prisma.groupTeam.upsert({
        where: { groupId_teamId: { groupId: group.id, teamId: home.id } },
        create: { groupId: group.id, teamId: home.id },
        update: {},
      });
    }
    if (away) {
      await prisma.groupTeam.upsert({
        where: { groupId_teamId: { groupId: group.id, teamId: away.id } },
        create: { groupId: group.id, teamId: away.id },
        update: {},
      });
    }
  }

  // Apply result (if any) - never overwrite a manual override
  if (mapped.hasResult) {
    await upsertResult(matchId, mapped, teamCache, stats);
  }
}

// ---------------------------------------------------------------------------
// Result upsert (with override protection)
// ---------------------------------------------------------------------------

async function upsertResult(
  matchId: string,
  mapped: ReturnType<typeof mapFeedMatch>,
  teamCache: Map<string, Team>,
  stats: SyncStats
) {
  const existing = await prisma.result.findUnique({ where: { matchId } });

  // CRITICAL: Never overwrite a manual override
  if (existing?.isManualOverride) {
    stats.overridesSkipped++;
    return;
  }

  // Derive advancing team ID (for knockout matches)
  let advancingTeamId: string | null = null;
  if (mapped.advancing === "home") {
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    advancingTeamId = match?.homeTeamId ?? null;
  } else if (mapped.advancing === "away") {
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    advancingTeamId = match?.awayTeamId ?? null;
  }

  const resultData = {
    homeGoals90: mapped.homeGoals90!,
    awayGoals90: mapped.awayGoals90!,
    homeGoalsET: mapped.homeGoalsET,
    awayGoalsET: mapped.awayGoalsET,
    homePens: mapped.homePens,
    awayPens: mapped.awayPens,
    advancingTeamId,
    source: "OpenFootball",
    confirmedAt: new Date(),
  };

  if (!existing) {
    await prisma.result.create({ data: { matchId, ...resultData } });
    stats.resultsApplied++;
  } else {
    await prisma.result.update({
      where: { matchId },
      data: { ...resultData, version: { increment: 1 } },
    });
    stats.resultsApplied++;
  }

  // Rescore all predictions for this match
  const rescored = await rescorePredictionsForMatch(matchId);
  stats.predictionsRescored += rescored;
}

// ---------------------------------------------------------------------------
// Placeholder resolution (W## / L## → real teams after bracket draws)
// ---------------------------------------------------------------------------

async function resolvePlaceholders(
  tournamentId: string,
  teamCache: Map<string, Team>,
  stats: SyncStats
): Promise<number> {
  const matches = await prisma.match.findMany({
    where: {
      stage: { tournamentId },
      OR: [
        { homeTeamId: null, homePlaceholder: { not: null } },
        { awayTeamId: null, awayPlaceholder: { not: null } },
      ],
    },
  });

  let resolved = 0;

  for (const match of matches) {
    let homeTeamId = match.homeTeamId;
    let awayTeamId = match.awayTeamId;
    let updated = false;

    // Try to resolve W##/L## by looking up the referenced match result
    if (!homeTeamId && match.homePlaceholder) {
      const team = await resolveToken(match.homePlaceholder, tournamentId);
      if (team) {
        homeTeamId = team.id;
        updated = true;
      } else {
        // Try direct team name match (for "Winner Group A" style strings)
        const t = findTeam(teamCache, match.homePlaceholder);
        if (t) { homeTeamId = t.id; updated = true; }
      }
    }

    if (!awayTeamId && match.awayPlaceholder) {
      const team = await resolveToken(match.awayPlaceholder, tournamentId);
      if (team) {
        awayTeamId = team.id;
        updated = true;
      } else {
        const t = findTeam(teamCache, match.awayPlaceholder);
        if (t) { awayTeamId = t.id; updated = true; }
      }
    }

    if (updated) {
      await prisma.match.update({
        where: { id: match.id },
        data: {
          homeTeamId,
          awayTeamId,
          homePlaceholder: homeTeamId ? null : match.homePlaceholder,
          awayPlaceholder: awayTeamId ? null : match.awayPlaceholder,
        },
      });
      resolved++;
      stats.placeholdersResolved++;
    }
  }

  return resolved;
}

/**
 * Resolve a W## or L## token to a Team by looking up the referenced match's result.
 */
async function resolveToken(token: string, tournamentId: string): Promise<Team | null> {
  const m = token.match(/^([WL])(\d+)$/);
  if (!m) return null;

  const [, type, numStr] = m;
  const num = parseInt(numStr, 10);

  const match = await prisma.match.findFirst({
    where: {
      externalNum: num,
      stage: { tournamentId },
    },
    include: {
      result: { include: { advancingTeam: true } },
      homeTeam: true,
      awayTeam: true,
    },
  });

  if (!match?.result) return null;

  if (type === "W") {
    return match.result.advancingTeam ?? null;
  }
  // L## = the losing team (the non-advancing side)
  if (match.result.advancingTeamId === match.homeTeamId) {
    return match.awayTeam;
  }
  return match.homeTeam;
}

// ---------------------------------------------------------------------------
// Team and group cache helpers
// ---------------------------------------------------------------------------

/**
 * Look up a team by name in the cache. If not found and the name is not a
 * placeholder token (W##/L##, "Winner...", etc.), auto-create the team in the
 * DB and add it to the cache so subsequent feed matches resolve it immediately.
 */
async function findOrCreateTeam(
  tournamentId: string,
  name: string,
  cache: Map<string, Team>
): Promise<Team | undefined> {
  if (isPlaceholder(name)) return undefined;
  const key = name.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  // Upsert on the unique (tournamentId, name) key - safe to call concurrently
  const team = await prisma.team.upsert({
    where: { tournamentId_name: { tournamentId, name } },
    create: { tournamentId, name, aliasesJson: "[]" },
    update: {},
  });
  cache.set(key, team);
  return team;
}

export function buildTeamCache(teams: Team[]): Map<string, Team> {
  const cache = new Map<string, Team>();
  for (const team of teams) {
    cache.set(team.name.toLowerCase(), team);
    const aliases: string[] = JSON.parse(team.aliasesJson);
    for (const alias of aliases) {
      cache.set(alias.toLowerCase(), team);
    }
  }
  return cache;
}

export function findTeam(cache: Map<string, Team>, name: string): Team | undefined {
  return cache.get(name.toLowerCase());
}

function buildGroupCache(groups: Group[]): Map<string, Group> {
  const cache = new Map<string, Group>();
  for (const group of groups) {
    cache.set(group.name.toLowerCase(), group);
  }
  return cache;
}

/**
 * Look up a group by name in the cache. If not found, auto-create it with an
 * ordinal derived from the trailing letter ("Group A" -> 1, ..., "Group L" -> 12).
 */
async function findOrCreateGroup(
  tournamentId: string,
  groupName: string,
  cache: Map<string, Group>
): Promise<Group> {
  const key = groupName.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  // Derive ordinal from trailing letter: A=1, B=2, ..., L=12
  const letterMatch = groupName.match(/([A-L])$/i);
  const ordinal = letterMatch
    ? letterMatch[1].toUpperCase().charCodeAt(0) - 64
    : 99;

  const group = await prisma.group.upsert({
    where: { tournamentId_name: { tournamentId, name: groupName } },
    create: { tournamentId, name: groupName, ordinal },
    update: {},
  });
  cache.set(key, group);
  return group;
}

// Shape of the stats object returned by sync operations.
interface SyncStats {
  matchesCreated: number;
  matchesUpdated: number;
  resultsApplied: number;
  overridesSkipped: number;
  placeholdersResolved: number;
  predictionsRescored: number;
}
