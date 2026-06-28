/**
 * Dev seed - run via: npm run db:reset (force-resets DB then runs this)
 *
 * Creates a minimal shell, then live-syncs from OpenFootball to populate
 * all teams/groups/fixtures/results, then adds demo predictions so all three
 * colour tiers (green/amber/red) appear on the leaderboard.
 *
 * Requires network access (fetches from raw.githubusercontent.com).
 *
 * Produces:
 *   - 3 users: bob (Admin), alice, charlie (all password: wc2026test)
 *   - Tournament + 2 stages (Group Stage, Knockout Stage)
 *   - Participations: alice=0, bob=0, charlie=5 (startingScore demo)
 *   - All 48 teams / 12 groups / 104 fixtures + results from the feed
 *   - Demo predictions on up to 8 finished group matches + 1 knockout match
 *     so alice > bob > charlie on the leaderboard before the knock-out rounds
 *
 * NOTE: Predictions are written directly (bypasses lock service).
 *       Past-match predictions are marked submittedVia="AdminBackEntry".
 */

import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";
import { triggerManualSync } from "@/lib/services/syncService";
import { rescorePredictionsForMatch } from "@/lib/services/predictionService";

async function main() {
  console.log("🌱 Seeding ScoresOnTheDoors database...\n");

  const passwordHash = await bcrypt.hash("wc2026test", 12);

  // ---------------------------------------------------------------------------
  // Users (all password: wc2026test)
  // ---------------------------------------------------------------------------
  const alice = await prisma.user.create({
    data: {
      username: "alice",
      email: "alice@scoresonthedoors.local",
      passwordHash,
      fullName: "Alice Smith",
      displayName: "Alice",
      role: "Player",
    },
  });

  const bob = await prisma.user.create({
    data: {
      username: "bob",
      email: "bob@scoresonthedoors.local",
      passwordHash,
      fullName: "Bob Jones",
      displayName: "Bob",
      role: "Admin",
    },
  });

  const charlie = await prisma.user.create({
    data: {
      username: "charlie",
      email: "charlie@scoresonthedoors.local",
      passwordHash,
      fullName: "Charlie Brown",
      displayName: "Charlie",
      role: "Player",
    },
  });

  console.log("✅ Created 3 users (bob as Admin, alice and charlie as Players - all password: wc2026test)");

  // ---------------------------------------------------------------------------
  // Tournament
  // ---------------------------------------------------------------------------
  const tournament = await prisma.tournament.create({
    data: {
      name: "FIFA World Cup 2026",
      slug: "wc2026",
      timeZoneId: "Europe/London",
      openFootballUrl:
        "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json",
      isActive: true,
      lockEnabledGlobally: true,
      pointsExactScore: 2,
      pointsCorrectResult: 1,
    },
  });

  // ---------------------------------------------------------------------------
  // Stages
  // ---------------------------------------------------------------------------
  await prisma.stage.create({
    data: {
      tournamentId: tournament.id,
      name: "Group Stage",
      kind: "Group",
      ordinal: 1,
    },
  });

  await prisma.stage.create({
    data: {
      tournamentId: tournament.id,
      name: "Knockout Stage",
      kind: "Knockout",
      ordinal: 2,
    },
  });

  // ---------------------------------------------------------------------------
  // Participations (players only; charlie gets a starting score for demo)
  // ---------------------------------------------------------------------------
  await prisma.tournamentParticipation.createMany({
    data: [
      { tournamentId: tournament.id, userId: alice.id, startingScore: 0 },
      { tournamentId: tournament.id, userId: bob.id, startingScore: 0 },
      { tournamentId: tournament.id, userId: charlie.id, startingScore: 5 },
    ],
  });

  console.log("✅ Created tournament, 2 stages, and participations (charlie has startingScore: 5)");

  // ---------------------------------------------------------------------------
  // Live sync: creates all 48 teams, 12 groups, 104 fixtures + results
  // ---------------------------------------------------------------------------
  console.log("\n⏳ Running live sync from OpenFootball (requires network)...");
  await triggerManualSync(tournament.id);
  console.log("✅ Sync complete\n");

  // ---------------------------------------------------------------------------
  // Demo predictions on real finished matches
  //
  // Strategy (guarantees deterministic tiers regardless of exact feed scores):
  //   alice:   exact 90-min score        -> GREEN  (2 pts)
  //   bob:     same outcome, diff score  -> AMBER  (1 pt)
  //   charlie: opposite outcome          -> RED    (0 pts)
  //
  // After creating predictions, rescorePredictionsForMatch() applies the real
  // scoring domain logic so points/tiers are computed correctly.
  // ---------------------------------------------------------------------------

  // Finished group matches (up to 8 for a healthy leaderboard spread)
  const finishedGroupMatches = await prisma.match.findMany({
    where: {
      stage: { tournamentId: tournament.id, kind: "Group" },
      status: "Finished",
      homeTeamId: { not: null },
      awayTeamId: { not: null },
    },
    include: { result: true },
    orderBy: { kickoffUtc: "asc" },
    take: 8,
  });

  let groupPredCount = 0;

  for (const match of finishedGroupMatches) {
    if (!match.result) continue;
    const h = match.result.homeGoals90;
    const a = match.result.awayGoals90;

    // alice: exact score (guaranteed GREEN)
    await prisma.prediction.create({
      data: {
        matchId: match.id,
        userId: alice.id,
        homeGoals: h,
        awayGoals: a,
        submittedVia: "AdminBackEntry",
      },
    });

    // bob: same outcome, different scoreline (guaranteed AMBER)
    // Home win: (h+1, a); away win: (h, a+1); draw: (h+1, a+1)
    const [bH, bA] =
      h > a ? [h + 1, a] : a > h ? [h, a + 1] : [h + 1, a + 1];
    await prisma.prediction.create({
      data: {
        matchId: match.id,
        userId: bob.id,
        homeGoals: bH,
        awayGoals: bA,
        submittedVia: "AdminBackEntry",
      },
    });

    // charlie: wrong outcome (guaranteed RED)
    // Predict an away win for any home win or draw; a home win for any away win
    const [cH, cA] = h >= a ? [0, 1] : [1, 0];
    await prisma.prediction.create({
      data: {
        matchId: match.id,
        userId: charlie.id,
        homeGoals: cH,
        awayGoals: cA,
        submittedVia: "AdminBackEntry",
      },
    });

    await rescorePredictionsForMatch(match.id);
    groupPredCount++;
  }

  console.log(`✅ Created demo predictions for ${groupPredCount} finished group matches`);

  // Finished knockout match (demonstrates the "exact 90-min beats wrong advancer" family rule)
  const finishedKnockoutMatch = await prisma.match.findFirst({
    where: {
      stage: { tournamentId: tournament.id, kind: "Knockout" },
      status: "Finished",
      homeTeamId: { not: null },
      awayTeamId: { not: null },
      result: { advancingTeamId: { not: null } },
    },
    include: { result: true },
    orderBy: { kickoffUtc: "asc" },
  });

  if (finishedKnockoutMatch?.result?.advancingTeamId) {
    const { homeGoals90: h, awayGoals90: a, advancingTeamId } =
      finishedKnockoutMatch.result;
    const nonAdvancingTeamId =
      advancingTeamId === finishedKnockoutMatch.homeTeamId
        ? finishedKnockoutMatch.awayTeamId
        : finishedKnockoutMatch.homeTeamId;

    // alice: exact 90-min score + wrong advancer -> GREEN
    // (exact 90-min score is the top tier regardless of advancer pick)
    await prisma.prediction.create({
      data: {
        matchId: finishedKnockoutMatch.id,
        userId: alice.id,
        homeGoals: h,
        awayGoals: a,
        predictedAdvancingTeamId: nonAdvancingTeamId,
        submittedVia: "AdminBackEntry",
      },
    });

    // bob: wrong score + correct advancer -> AMBER
    await prisma.prediction.create({
      data: {
        matchId: finishedKnockoutMatch.id,
        userId: bob.id,
        homeGoals: h + 1,
        awayGoals: Math.max(0, a - 1),
        predictedAdvancingTeamId: advancingTeamId,
        submittedVia: "AdminBackEntry",
      },
    });

    // charlie: wrong score + wrong advancer -> RED
    await prisma.prediction.create({
      data: {
        matchId: finishedKnockoutMatch.id,
        userId: charlie.id,
        homeGoals: Math.max(0, h - 1),
        awayGoals: a + 1,
        predictedAdvancingTeamId: nonAdvancingTeamId,
        submittedVia: "AdminBackEntry",
      },
    });

    await rescorePredictionsForMatch(finishedKnockoutMatch.id);
    console.log("✅ Created demo predictions for 1 finished knockout match");
  } else {
    console.log("ℹ️  No finished knockout match yet - knockout demo predictions skipped");
  }

  console.log("\n✅ Seed complete! Login with username/password (all use: wc2026test):");
  console.log("   bob (Admin) | alice | charlie");
  console.log("\n   Expected leaderboard: alice (green-heavy) > bob (amber-heavy) > charlie (red + startingScore 5)");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
