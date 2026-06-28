import { prisma } from "@/lib/db/prisma";
import { deactivateLockOverride } from "@/app/actions/admin";
import CreateLockOverrideForm from "@/components/admin/CreateLockOverrideForm";

export default async function LocksPage() {
  const tournament = await prisma.tournament.findFirst({ where: { isActive: true } });
  if (!tournament) return <p className="text-gray-500">No active tournament.</p>;

  const overrides = await prisma.predictionLockOverride.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const users = await prisma.user.findMany({ where: { role: "Player" }, orderBy: { fullName: "asc" } });
  const matches = await prisma.match.findMany({
    where: { stage: { tournamentId: tournament.id } },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { kickoffUtc: "asc" },
  });

  return (
    <div className="space-y-8">
      <h1>Lock Overrides</h1>
      <p className="text-sm text-gray-600">
        Use overrides to allow players to enter predictions for past matches (catch-up).
        An active override always beats the time lock.
      </p>

      <CreateLockOverrideForm
        tournamentId={tournament.id}
        users={users.map(u => ({ id: u.id, name: u.displayName ?? u.fullName }))}
        matches={matches.map(m => ({
          id: m.id,
          label: `${m.homeTeam?.name ?? m.homePlaceholder ?? "TBD"} vs ${m.awayTeam?.name ?? m.awayPlaceholder ?? "TBD"} (${m.matchDateLocal ?? "TBD"})`,
        }))}
      />

      <h2>Active overrides</h2>
      <div className="card overflow-hidden">
        <table className="table-auto w-full">
          <thead>
            <tr>
              <th>Scope</th>
              <th>Details</th>
              <th>Reason</th>
              <th>Expires</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {overrides.map((o) => (
              <tr key={o.id} className={!o.isActive ? "opacity-40" : ""}>
                <td className="text-xs font-medium">{o.scope}</td>
                <td className="text-xs text-gray-600">{o.matchId ? `Match: ${o.matchId.slice(-6)}` : ""}{o.userId ? `User: ${o.userId.slice(-6)}` : ""}</td>
                <td className="text-xs">{o.reason ?? "-"}</td>
                <td className="text-xs">{o.unlockedUntil ? new Date(o.unlockedUntil).toLocaleString("en-GB") : "Never"}</td>
                <td>
                  <span className={`text-xs ${o.isActive ? "text-green-600" : "text-gray-400"}`}>
                    {o.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  {o.isActive && (
                    <form action={async () => {
                      "use server";
                      await deactivateLockOverride(o.id);
                    }}>
                      <button type="submit" className="text-xs text-red-600 hover:underline">
                        Deactivate
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {overrides.length === 0 && (
              <tr><td colSpan={6} className="text-center text-gray-400 py-4">No overrides</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
