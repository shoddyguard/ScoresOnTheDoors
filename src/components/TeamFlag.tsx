import { teamCountryCode } from "@/lib/teams/countryCodes";

interface TeamFlagProps {
  name?: string | null;
  className?: string;
}

/** Renders a country flag for a team name, or nothing if the name has no code. */
export function TeamFlag({ name, className = "" }: TeamFlagProps) {
  const code = name ? teamCountryCode(name) : null;
  if (!code) return null;
  return (
    <span
      className={`fi fi-${code} shrink-0 rounded-[2px] ${className}`}
      role="img"
      aria-label={`${name} flag`}
    />
  );
}

interface TeamNameProps {
  name?: string | null;
  placeholder?: string | null;
  className?: string;
}

/**
 * Team flag + name inline, with the standard `name ?? placeholder ?? "TBD"`
 * fallback. Drop-in replacement for the inline team-name spans across the app.
 */
export function TeamName({ name, placeholder, className = "" }: TeamNameProps) {
  const label = name ?? placeholder ?? "TBD";
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <TeamFlag name={name} />
      <span>{label}</span>
    </span>
  );
}

export default TeamFlag;
