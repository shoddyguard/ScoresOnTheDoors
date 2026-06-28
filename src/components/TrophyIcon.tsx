interface TrophyIconProps {
  trophy: "gold" | "silver" | "bronze" | null;
  className?: string;
}

export default function TrophyIcon({ trophy, className = "" }: TrophyIconProps) {
  if (!trophy) return null;
  const emoji = trophy === "gold" ? "🥇" : trophy === "silver" ? "🥈" : "🥉";
  return (
    <span className={className} role="img" aria-label={trophy + " trophy"}>
      {emoji}
    </span>
  );
}
