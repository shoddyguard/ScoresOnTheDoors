import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getLeaderboard,
  getPerfectScoreLeaderboard,
  getLeaderboardPhases,
} from "@/lib/services/leaderboardService";
import { prisma } from "@/lib/db/prisma";
import LeaderboardTable from "@/components/LeaderboardTable";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ phase?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const tournament = await prisma.tournament.findFirst({ where: { isActive: true } });
  if (!tournament) return <div className="p-8 text-gray-500">No active tournament.</div>;

  // Phases: Overall + group stage + each knockout round (R32, R16, QF, SF, ...).
  const phases = await getLeaderboardPhases(tournament.id);

  // Resolve the selected phase from the query param; else Overall.
  const { phase: phaseParam } = await searchParams;
  const selected = phases.find((p) => p.key === phaseParam) ?? null;
  const isOverall = selected === null;
  const options = selected?.options ?? {};

  const [pointsBoard, perfectBoard] = await Promise.all([
    getLeaderboard(tournament.id, options),
    getPerfectScoreLeaderboard(tournament.id, options),
  ]);

  const tabClass = (active: boolean) =>
    active ? "btn-primary text-xs" : "btn-secondary text-xs";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="mb-2">🏆 Leaderboard</h1>
      <p className="text-gray-500 text-sm mb-6">{tournament.name}</p>

      {/* Phase tabs (Overall / Group / each knockout round) */}
      <div className="flex gap-2 flex-wrap mb-8">
        <Link href="/leaderboard" className={tabClass(isOverall)}>
          Overall
        </Link>
        {phases.map((p) => (
          <Link
            key={p.key}
            href={`/leaderboard?phase=${encodeURIComponent(p.key)}`}
            className={tabClass(selected?.key === p.key)}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {/* Points board */}
      <h2 className="mb-3">
        Points
        {!isOverall && <span className="text-gray-400 font-normal"> · {selected.label}</span>}
      </h2>
      <LeaderboardTable
        entries={pointsBoard}
        currentUserId={user.id}
        variant="points"
        showBase={isOverall}
      />

      {/* Perfect-scores board */}
      <h2 className="mt-10 mb-3">
        Most perfect scores
        {!isOverall && <span className="text-gray-400 font-normal"> · {selected.label}</span>}
      </h2>
      <LeaderboardTable
        entries={perfectBoard}
        currentUserId={user.id}
        variant="perfect"
      />

      <p className="text-xs text-gray-400 mt-6">
        🟢 Exact score (+2) · 🟡 Correct result (+1) · 🔴 Wrong (0)
        {isOverall && <> · Base = starting score</>}
        {!isOverall && <> · Per-phase points exclude the starting score</>}
      </p>
    </div>
  );
}
