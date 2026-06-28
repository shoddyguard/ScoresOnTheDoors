import { prisma } from "@/lib/db/prisma";
import RecomputeButton from "@/components/admin/RecomputeButton";

export default async function RecomputePage() {
  const tournament = await prisma.tournament.findFirst({ where: { isActive: true } });

  return (
    <div className="space-y-6">
      <h1>Recompute Scores</h1>
      <p className="text-sm text-gray-600">
        Force-recompute all prediction scores for the active tournament. Use this after
        correcting a result override or if scores look wrong.
      </p>
      <div className="card p-6">
        {tournament ? (
          <RecomputeButton tournamentId={tournament.id} />
        ) : (
          <p className="text-gray-500">No active tournament.</p>
        )}
      </div>
    </div>
  );
}
