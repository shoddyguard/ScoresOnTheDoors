import type { ScoreTier } from "@/lib/domain/types";

interface ScoreChipProps {
  tier: ScoreTier | null | undefined;
  points: number | null | undefined;
  homeGoals: number;
  awayGoals: number;
  className?: string;
}

export default function ScoreChip({ tier, points, homeGoals, awayGoals, className = "" }: ScoreChipProps) {
  if (tier == null || points == null) {
    return (
      <span className={`score-chip-pending ${className}`}>
        {homeGoals}–{awayGoals}
      </span>
    );
  }

  const chipClass =
    tier === "ExactScore"
      ? "score-chip-green"
      : tier === "CorrectResult"
      ? "score-chip-amber"
      : "score-chip-red";

  return (
    <span className={`${chipClass} ${className}`} title={`+${points} pts`}>
      {homeGoals}–{awayGoals}
    </span>
  );
}
