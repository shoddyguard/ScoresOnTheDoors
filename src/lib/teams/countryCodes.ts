// Maps a team's full name to an ISO 3166-1 alpha-2 country code (lowercase) for
// rendering flags via the `flag-icons` package (CSS class `fi fi-<code>`).
//
// The OpenFootball feed gives team names only (no codes), so this lookup is the
// single source of flag codes. Keys are NORMALISED names (see `normalise`), so the
// table is diacritic/-case-insensitive. Unknown names (knockout placeholders like
// "Winner Group A", "TBD", or anything unmapped) return null -> no flag.

// Normalise a name for lookup: strip diacritics, lowercase, collapse whitespace.
// e.g. "Curaçao" -> "curacao", "  Côte d'Ivoire " -> "cote d'ivoire".
function normalise(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// Keyed by normalised name. Covers the 48 seeded WC2026 teams plus aliases for the
// alternative spellings other feed versions / qualifiers may use.
const NAME_TO_CODE: Record<string, string> = {
  // --- Current 48 seeded teams ---
  algeria: "dz",
  argentina: "ar",
  australia: "au",
  austria: "at",
  belgium: "be",
  "bosnia & herzegovina": "ba",
  brazil: "br",
  canada: "ca",
  "cape verde": "cv",
  colombia: "co",
  croatia: "hr",
  curacao: "cw",
  "czech republic": "cz",
  "dr congo": "cd",
  ecuador: "ec",
  egypt: "eg",
  england: "gb-eng",
  france: "fr",
  germany: "de",
  ghana: "gh",
  haiti: "ht",
  iran: "ir",
  iraq: "iq",
  "ivory coast": "ci",
  japan: "jp",
  jordan: "jo",
  mexico: "mx",
  morocco: "ma",
  netherlands: "nl",
  "new zealand": "nz",
  norway: "no",
  panama: "pa",
  paraguay: "py",
  portugal: "pt",
  qatar: "qa",
  "saudi arabia": "sa",
  scotland: "gb-sct",
  senegal: "sn",
  "south africa": "za",
  "south korea": "kr",
  spain: "es",
  sweden: "se",
  switzerland: "ch",
  tunisia: "tn",
  turkey: "tr",
  usa: "us",
  uruguay: "uy",
  uzbekistan: "uz",

  // --- Aliases / alternative spellings for resilience across feed versions ---
  "bosnia and herzegovina": "ba",
  "cabo verde": "cv",
  czechia: "cz",
  "congo dr": "cd",
  "dr_congo": "cd",
  "democratic republic of the congo": "cd",
  "cote d'ivoire": "ci",
  "korea republic": "kr",
  "korea dpr": "kp",
  "north korea": "kp",
  "ir iran": "ir",
  "united states": "us",
  turkiye: "tr",
  wales: "gb-wls",
  "northern ireland": "gb-nir",
  ireland: "ie",
  "republic of ireland": "ie",
  "north macedonia": "mk",
  "united arab emirates": "ae",
  "costa rica": "cr",
  "el salvador": "sv",
  nigeria: "ng",
  cameroon: "cm",
  poland: "pl",
  serbia: "rs",
  denmark: "dk",
  greece: "gr",
  italy: "it",
  romania: "ro",
  hungary: "hu",
  ukraine: "ua",
  china: "cn",
  "china pr": "cn",
  thailand: "th",
  "new caledonia": "nc",
  bolivia: "bo",
  chile: "cl",
  peru: "pe",
  venezuela: "ve",
  honduras: "hn",
  jamaica: "jm",
};

/** Returns the ISO alpha-2 (lowercase) flag code for a team name, or null. */
export function teamCountryCode(name: string | null | undefined): string | null {
  if (!name) return null;
  return NAME_TO_CODE[normalise(name)] ?? null;
}
