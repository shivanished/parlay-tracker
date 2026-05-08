import { NBA_TEAMS } from "./constants";

export function resolveTeamAbbr(input: string): string | null {
  const normalized = input.trim().toLowerCase();

  // Direct lookup
  if (NBA_TEAMS[normalized]) return NBA_TEAMS[normalized];

  // Try removing common prefixes like "the"
  const withoutThe = normalized.replace(/^the\s+/, "");
  if (NBA_TEAMS[withoutThe]) return NBA_TEAMS[withoutThe];

  // Partial match — find key that starts with or contains input
  for (const [key, abbr] of Object.entries(NBA_TEAMS)) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return abbr;
    }
  }

  return null;
}
