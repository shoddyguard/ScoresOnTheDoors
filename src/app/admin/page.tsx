import { prisma } from "@/lib/db/prisma";
import CreateTournamentForm from "@/components/admin/CreateTournamentForm";

export default async function AdminDashboard() {
  const tournament = await prisma.tournament.findFirst({ where: { isActive: true } });

  const lastSync = tournament
    ? await prisma.syncLog.findFirst({
        where: { tournamentId: tournament.id },
        orderBy: { startedAt: "desc" },
      })
    : null;

  const unresolvedMatches = tournament
    ? await prisma.match.count({
        where: {
          stage: { tournamentId: tournament.id },
          OR: [
            { homeTeamId: null, homePlaceholder: { not: null } },
            { awayTeamId: null, awayPlaceholder: { not: null } },
          ],
        },
      })
    : 0;

  const playerCount = tournament
    ? await prisma.tournamentParticipation.count({
        where: { tournamentId: tournament.id, isActive: true },
      })
    : 0;

  const pendingPredictions = tournament
    ? await prisma.prediction.count({
        where: {
          match: { stage: { tournamentId: tournament.id }, status: "Finished" },
          awardedPoints: null,
        },
      })
    : 0;

  return (
    <div className="space-y-6">
      <h1>Admin Dashboard</h1>

      {!tournament && (
        <div className="space-y-4">
          <div className="card p-6 text-amber-700 bg-amber-50 border-amber-200">
            No active tournament found. Create one to get started.
          </div>
          <CreateTournamentForm />
        </div>
      )}

      {tournament && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-blue-700">{playerCount}</div>
              <p className="text-xs text-gray-500">Players</p>
            </div>
            <div className="card p-4 text-center">
              <div className={`text-2xl font-bold ${unresolvedMatches > 0 ? "text-amber-600" : "text-green-600"}`}>
                {unresolvedMatches}
              </div>
              <p className="text-xs text-gray-500">Undecided knockout matches</p>
            </div>
            <div className="card p-4 text-center">
              <div className={`text-2xl font-bold ${pendingPredictions > 0 ? "text-amber-600" : "text-green-600"}`}>
                {pendingPredictions}
              </div>
              <p className="text-xs text-gray-500">Unscored predictions</p>
            </div>
            <div className="card p-4 text-center">
              <div className={`text-xs font-medium ${lastSync?.outcome === "Success" ? "text-green-600" : lastSync?.outcome === "Error" ? "text-red-600" : "text-gray-500"}`}>
                {lastSync?.outcome ?? "Never synced"}
              </div>
              <p className="text-xs text-gray-500 mt-1">Last sync</p>
            </div>
          </div>

          {lastSync && (
            <div className="card p-4">
              <p className="text-xs text-gray-500">
                Last sync: {new Date(lastSync.startedAt).toLocaleString("en-GB")} ({lastSync.trigger}) -{" "}
                {lastSync.matchesCreated} created, {lastSync.matchesUpdated} updated,{" "}
                {lastSync.resultsApplied} results, {lastSync.overridesSkipped} overrides skipped
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
