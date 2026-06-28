import { prisma } from "@/lib/db/prisma";
import SyncButton from "@/components/admin/SyncButton";

export default async function SyncPage() {
  const tournament = await prisma.tournament.findFirst({ where: { isActive: true } });
  const logs = tournament
    ? await prisma.syncLog.findMany({
        where: { tournamentId: tournament.id },
        orderBy: { startedAt: "desc" },
        take: 20,
      })
    : [];

  return (
    <div className="space-y-6">
      <h1>OpenFootball Sync</h1>

      {tournament ? (
        <>
          <div className="card p-5">
            <p className="text-sm text-gray-600 mb-3">
              Feed URL:{" "}
              <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                {tournament.openFootballUrl ?? "not set"}
              </code>
            </p>
            <SyncButton tournamentId={tournament.id} />
          </div>

          <h2 className="text-lg font-semibold">Sync History</h2>
          <div className="card overflow-hidden">
            <table className="table-auto w-full">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Trigger</th>
                  <th className="text-right">Created</th>
                  <th className="text-right">Updated</th>
                  <th className="text-right">Results</th>
                  <th className="text-right">Skipped</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="text-xs">
                      {new Date(log.startedAt).toLocaleString("en-GB")}
                    </td>
                    <td className="text-xs">{log.trigger}</td>
                    <td className="text-right">{log.matchesCreated}</td>
                    <td className="text-right">{log.matchesUpdated}</td>
                    <td className="text-right">{log.resultsApplied}</td>
                    <td className="text-right">{log.overridesSkipped}</td>
                    <td>
                      <span
                        className={`text-xs font-medium ${
                          log.outcome === "Success"
                            ? "text-green-700"
                            : log.outcome === "Error"
                            ? "text-red-700"
                            : "text-amber-700"
                        }`}
                      >
                        {log.outcome ?? "Running…"}
                      </span>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-gray-400 py-4">
                      No syncs yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-gray-500">No active tournament.</p>
      )}
    </div>
  );
}
