import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import ScoreChip from "@/components/ScoreChip";
import { TeamName } from "@/components/TeamFlag";
import { notFound } from "next/navigation";
import type { ScoreTier } from "@/lib/domain/types";

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      homeTeam: true,
      awayTeam: true,
      result: { include: { advancingTeam: true } },
      stage: { include: { tournament: true } },
      group: true,
      predictions: {
        include: {
          user: { select: { id: true, fullName: true, displayName: true } },
          predictedAdvancingTeam: { select: { id: true, name: true } },
        },
        orderBy: { awardedPoints: "desc" },
      },
    },
  });

  if (!match) notFound();

  // Predictions are only revealed after the match is finished
  const showPredictions = match.status === "Finished";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Match header */}
      <div className="card p-6 mb-6 text-center">
        <p className="text-xs text-gray-500 mb-2">
          {match.stage.name}
          {match.group && <> · {match.group.name}</>}
        </p>
        <div className="flex items-center justify-center gap-6 text-xl font-bold text-gray-900">
          <TeamName name={match.homeTeam?.name} placeholder={match.homePlaceholder} />
          {match.result ? (
            <span className="text-3xl font-black">
              {match.result.homeGoals90}–{match.result.awayGoals90}
            </span>
          ) : (
            <span className="text-2xl text-gray-400">vs</span>
          )}
          <TeamName name={match.awayTeam?.name} placeholder={match.awayPlaceholder} />
        </div>
        {match.result?.homePens != null && (
          <p className="text-sm text-gray-500 mt-1">
            Penalties: {match.result.homePens}–{match.result.awayPens}
            {match.result.advancingTeam && (
              <> · <TeamName name={match.result.advancingTeam.name} /> advance</>
            )}
          </p>
        )}
        {!match.result && (
          <p className="text-sm text-gray-400 mt-2">Match not yet played</p>
        )}
      </div>

      {/* Predictions */}
      <h2 className="mb-4">Predictions</h2>
      {!showPredictions ? (
        <div className="card p-6 text-center text-gray-500">
          <p>Predictions will be revealed once the match kicks off. 🔒</p>
        </div>
      ) : match.predictions.length === 0 ? (
        <div className="card p-6 text-center text-gray-500">
          <p>No predictions were entered for this match.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="table-auto w-full">
            <thead>
              <tr>
                <th>Player</th>
                <th className="text-center">Prediction</th>
                {match.stage.kind === "Knockout" && <th>Advances</th>}
                <th className="text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {match.predictions.map((pred) => {
                const isMe = pred.userId === user.id;
                return (
                  <tr key={pred.id} className={isMe ? "bg-blue-50" : ""}>
                    <td>
                      <span className={isMe ? "font-semibold text-blue-700" : ""}>
                        {pred.user.displayName ?? pred.user.fullName}
                        {isMe && " (you)"}
                      </span>
                    </td>
                    <td className="text-center">
                      <ScoreChip
                        tier={pred.scoreTier as ScoreTier | undefined}
                        points={pred.awardedPoints}
                        homeGoals={pred.homeGoals}
                        awayGoals={pred.awayGoals}
                      />
                    </td>
                    {match.stage.kind === "Knockout" && (
                      <td className="text-sm text-gray-600">
                        {pred.predictedAdvancingTeam ? (
                          <TeamName name={pred.predictedAdvancingTeam.name} />
                        ) : (
                          "-"
                        )}
                      </td>
                    )}
                    <td className="text-right font-semibold">
                      {pred.awardedPoints != null ? (
                        <span
                          className={
                            pred.awardedPoints === 2
                              ? "text-green-700"
                              : pred.awardedPoints === 1
                              ? "text-amber-700"
                              : "text-red-600"
                          }
                        >
                          +{pred.awardedPoints}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
