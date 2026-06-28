import { prisma } from "@/lib/db/prisma";
import MatchResultForm from "@/components/admin/MatchResultForm";
import { TeamName } from "@/components/TeamFlag";

export default async function MatchesPage() {
  const tournament = await prisma.tournament.findFirst({ where: { isActive: true } });
  if (!tournament) return <p className="text-gray-500">No active tournament.</p>;

  const matches = await prisma.match.findMany({
    where: { stage: { tournamentId: tournament.id } },
    include: {
      homeTeam: true,
      awayTeam: true,
      result: true,
      stage: true,
      group: true,
    },
    orderBy: { kickoffUtc: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1>Matches</h1>
      <p className="text-sm text-gray-600">
        Override results here. Manual overrides are never clobbered by the auto-sync.
      </p>

      <div className="space-y-3">
        {matches.map((match) => (
          <div key={match.id} className="card p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <TeamName name={match.homeTeam?.name} placeholder={match.homePlaceholder} />
                  <span className="text-gray-400">vs</span>
                  <TeamName name={match.awayTeam?.name} placeholder={match.awayPlaceholder} />
                  {match.result?.isManualOverride && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Manual</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {match.stage.name}
                  {match.group && <> · {match.group.name}</>}
                  {" · "}{match.matchDateLocal ?? "TBD"}
                </p>
                {match.result && (
                  <p className="text-xs text-gray-600 mt-0.5">
                    Current result: {match.result.homeGoals90}–{match.result.awayGoals90}
                  </p>
                )}
              </div>
              <MatchResultForm
                matchId={match.id}
                stageKind={match.stage.kind as "Group" | "Knockout"}
                homeTeam={match.homeTeam ? { id: match.homeTeam.id, name: match.homeTeam.name } : null}
                awayTeam={match.awayTeam ? { id: match.awayTeam.id, name: match.awayTeam.name } : null}
                currentResult={match.result ? { homeGoals90: match.result.homeGoals90, awayGoals90: match.result.awayGoals90 } : undefined}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
