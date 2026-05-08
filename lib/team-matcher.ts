import { NBA_TEAMS } from "./constants";

export function resolveTeamAbbr(input: string): string | null {
  let normalized = input.trim().toLowerCase();

  // Extract team from "Player Name (Team Name)" format
  const parenMatch = normalized.match(/\(([^)]+)\)/);
  if (parenMatch) {
    normalized = parenMatch[1].trim();
  }

  // Direct lookup
  if (NBA_TEAMS[normalized]) return NBA_TEAMS[normalized];

  // Try removing common prefixes like "the"
  const withoutThe = normalized.replace(/^the\s+/, "");
  if (NBA_TEAMS[withoutThe]) return NBA_TEAMS[withoutThe];

  // Try each word individually (handles "Los Angeles Lakers" → "lakers")
  const words = normalized.split(/\s+/);
  for (const word of words) {
    if (word.length >= 3 && NBA_TEAMS[word]) {
      return NBA_TEAMS[word];
    }
  }

  // Exact substring match — only match full dictionary keys, not substrings
  for (const [key, abbr] of Object.entries(NBA_TEAMS)) {
    // Only match if the key is a full word/phrase within the input
    if (key.length >= 3 && normalized.includes(key)) {
      return abbr;
    }
  }

  return null;
}
