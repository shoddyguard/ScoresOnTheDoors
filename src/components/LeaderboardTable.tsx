import TrophyIcon from "@/components/TrophyIcon";
import type { LeaderboardEntry } from "@/lib/domain/types";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentUserId: string;
  /** "points" = full points board; "perfect" = ranked by exact-score guesses. */
  variant: "points" | "perfect";
  /** Show the starting-score "Base" column (overall points board only). */
  showBase?: boolean;
}

export default function LeaderboardTable({
  entries,
  currentUserId,
  variant,
  showBase = false,
}: LeaderboardTableProps) {
  const isPerfect = variant === "perfect";

  return (
    <div className="card overflow-hidden">
      <table className="table-auto w-full">
        <thead>
          <tr>
            <th className="w-12">Rank</th>
            <th>Player</th>
            {isPerfect ? (
              <th className="text-center">🟢 Perfect</th>
            ) : (
              <>
                <th className="text-center">🟢</th>
                <th className="text-center">🟡</th>
                <th className="text-center">🔴</th>
                {showBase && <th className="text-right">Base</th>}
                <th className="text-right">Total</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isMe = entry.userId === currentUserId;
            return (
              <tr key={entry.userId} className={isMe ? "bg-blue-50" : ""}>
                <td className="text-center font-medium">
                  {entry.trophy ? (
                    <TrophyIcon trophy={entry.trophy} />
                  ) : (
                    <span className="text-gray-500">{entry.rank}</span>
                  )}
                </td>
                <td>
                  <span className={isMe ? "font-semibold text-blue-700" : ""}>
                    {entry.displayName}
                    {isMe && <span className="ml-1 text-xs text-blue-500">(you)</span>}
                  </span>
                </td>
                {isPerfect ? (
                  <td className="text-center font-bold text-green-700">{entry.greenCount}</td>
                ) : (
                  <>
                    <td className="text-center text-green-700">{entry.greenCount}</td>
                    <td className="text-center text-amber-700">{entry.amberCount}</td>
                    <td className="text-center text-red-500">{entry.redCount}</td>
                    {showBase && (
                      <td className="text-right text-gray-500 text-sm">+{entry.startingScore}</td>
                    )}
                    <td className="text-right font-bold text-blue-700">{entry.totalPoints}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
