// Dashboard page showing player rank, upcoming matches, and recent predictions.
import { getCurrentUser } from "@/lib/auth/session";
import { getLeaderboard } from "@/lib/services/leaderboardService";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import ScoreChip from "@/components/ScoreChip";
import TrophyIcon from "@/components/TrophyIcon";
import { TeamName } from "@/components/TeamFlag";
import type { ScoreTier } from "@/lib/domain/types";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  // Get the active tournament
  const tournament = await prisma.tournament.findFirst({
    where: { isActive: true },
  });

  if (!tournament) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center space-y-3">
        <p className="text-gray-500">No active tournament found.</p>
        {user.role === "Admin" ? (
          <Link href="/admin" className="btn-primary inline-flex">Go to Admin to create one</Link>
        ) : (
          <p className="text-sm text-gray-400">Check back once an administrator sets one up.</p>
        )}
      </div>
    );
  }

  // Get leaderboard to find this player's rank
  const leaderboard = await getLeaderboard(tournament.id);
  const myEntry = leaderboard.find((e) => e.userId === user.id);

  // Get upcoming matches the user hasn't predicted yet
  const now = new Date();
  const upcomingMatches = await prisma.match.findMany({
    where: {
      stage: { tournamentId: tournament.id },
      status: "Scheduled",
      kickoffUtc: { gte: now },
      homeTeamId: { not: null },
      awayTeamId: { not: null },
      predictions: { none: { userId: user.id } },
    },
    include: { homeTeam: true, awayTeam: true, stage: true },
    orderBy: { kickoffUtc: "asc" },
    take: 5,
  });

  // Get recent scored predictions
  const recentPredictions = await prisma.prediction.findMany({
    where: {
      userId: user.id,
      match: { stage: { tournamentId: tournament.id } },
      awardedPoints: { not: null },
    },
    include: {
      match: {
        include: { homeTeam: true, awayTeam: true },
      },
    },
    orderBy: { match: { kickoffUtc: "desc" } },
    take: 5,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Tournament header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">⚽ {tournament.name}</h1>
        <p className="text-gray-500 mt-1">Welcome back, {user.name ?? "Player"}!</p>
      </div>

      {/* Stats row */}
      {myEntry && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <TrophyIcon trophy={myEntry.trophy} />
              <span className="text-2xl font-bold text-gray-900">#{myEntry.rank}</span>
            </div>
            <p className="text-xs text-gray-500">Your rank</p>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-blue-700">{myEntry.totalPoints}</div>
            <p className="text-xs text-gray-500">Total points</p>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-green-700">{myEntry.greenCount}</div>
            <p className="text-xs text-gray-500">Exact scores 🟢</p>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-amber-700">{myEntry.amberCount}</div>
            <p className="text-xs text-gray-500">Correct results 🟡</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upcoming predictions */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Predictions needed</h2>
            <Link href="/predict" className="text-sm text-blue-600 hover:text-blue-800">
              View all →
            </Link>
          </div>
          {upcomingMatches.length === 0 ? (
            <p className="text-gray-500 text-sm">All caught up! 🎉</p>
          ) : (
            <div className="space-y-3">
              {upcomingMatches.map((match) => (
                <div key={match.id} className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-1.5 text-gray-700">
                    <TeamName name={match.homeTeam?.name} placeholder={match.homePlaceholder} />
                    <span className="text-gray-400">vs</span>
                    <TeamName name={match.awayTeam?.name} placeholder={match.awayPlaceholder} />
                  </span>
                  <Link
                    href={"/predict?match=" + match.id}
                    className="text-xs btn-primary py-1 px-3"
                  >
                    Predict
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent results */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent results</h2>
          </div>
          {recentPredictions.length === 0 ? (
            <p className="text-gray-500 text-sm">No scored predictions yet.</p>
          ) : (
            <div className="space-y-3">
              {recentPredictions.map((pred) => (
                <div key={pred.id} className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-1.5 text-gray-700">
                    <TeamName name={pred.match.homeTeam?.name} />
                    <span className="text-gray-400">vs</span>
                    <TeamName name={pred.match.awayTeam?.name} />
                  </span>
                  <ScoreChip
                    tier={pred.scoreTier as ScoreTier}
                    points={pred.awardedPoints}
                    homeGoals={pred.homeGoals}
                    awayGoals={pred.awayGoals}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
