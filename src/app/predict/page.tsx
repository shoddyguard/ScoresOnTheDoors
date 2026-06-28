// Predictions page: shows all matches grouped by stage with inline prediction entry.
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { canEditPrediction } from "@/lib/services/lockService";
import ScoreChip from "@/components/ScoreChip";
import PredictionForm from "@/components/forms/PredictionForm";
import { TeamName } from "@/components/TeamFlag";
import type { ScoreTier } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

export default async function PredictPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const tournament = await prisma.tournament.findFirst({ where: { isActive: true } });
  if (!tournament) return <div className="p-8 text-gray-500">No active tournament.</div>;

  const stages = await prisma.stage.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { ordinal: "asc" },
    include: {
      matches: {
        where: { homeTeamId: { not: null }, awayTeamId: { not: null } },
        orderBy: { kickoffUtc: "asc" },
        include: {
          homeTeam: true,
          awayTeam: true,
          result: true,
          predictions: { where: { userId: user.id } },
          group: true,
        },
      },
    },
  });

  // Precompute editable status for all matches
  const editableMap = new Map<string, boolean>();
  for (const stage of stages) {
    for (const match of stage.matches) {
      const { allowed } = await canEditPrediction(user.id, match.id);
      editableMap.set(match.id, allowed);
    }
  }

  const formatDate = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "TBD";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">
      <h1>My Predictions</h1>

      {stages.filter((s) => s.matches.length > 0).map((stage) => (
        <section key={stage.id}>
          <h2 className="mb-4 pb-2 border-b border-gray-200">{stage.name}</h2>
          <div className="space-y-3">
            {stage.matches.map((match) => {
              const myPrediction = match.predictions[0];
              const canEdit = editableMap.get(match.id) ?? false;
              const isFinished = match.status === "Finished";

              return (
                <div key={match.id} className="card p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    {/* Match info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 text-sm font-medium text-gray-900">
                        <TeamName name={match.homeTeam?.name} placeholder={match.homePlaceholder} />
                        <span className="text-gray-400">vs</span>
                        <TeamName name={match.awayTeam?.name} placeholder={match.awayPlaceholder} />
                        {isFinished && match.result && (
                          <span className="ml-2 text-xs font-normal text-gray-500">
                            Result: {match.result.homeGoals90}–{match.result.awayGoals90}
                            {match.result.homePens != null && (
                              <> (pens {match.result.homePens}–{match.result.awayPens})</>
                            )}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {match.group?.name && <>{match.group.name} · </>}
                        {formatDate(match.kickoffUtc)}
                        {!canEdit && !isFinished && (
                          <span className="ml-2 text-amber-600">🔒 Locked</span>
                        )}
                      </p>
                    </div>

                    {/* Prediction area */}
                    <div className="sm:text-right">
                      {canEdit ? (
                        <PredictionForm
                          matchId={match.id}
                          stageKind={stage.kind as "Group" | "Knockout"}
                          homeTeam={match.homeTeam ? { id: match.homeTeam.id, name: match.homeTeam.name } : null}
                          awayTeam={match.awayTeam ? { id: match.awayTeam.id, name: match.awayTeam.name } : null}
                          existing={myPrediction ? {
                            homeGoals: myPrediction.homeGoals,
                            awayGoals: myPrediction.awayGoals,
                            predictedAdvancingTeamId: myPrediction.predictedAdvancingTeamId,
                          } : undefined}
                        />
                      ) : myPrediction ? (
                        <ScoreChip
                          tier={myPrediction.scoreTier as ScoreTier | undefined}
                          points={myPrediction.awardedPoints}
                          homeGoals={myPrediction.homeGoals}
                          awayGoals={myPrediction.awayGoals}
                        />
                      ) : (
                        <span className="text-xs text-gray-400 italic">No prediction</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
