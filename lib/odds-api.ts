import { logger } from "./logger";

const BASE_URL = "https://api.the-odds-api.com/v4";

interface OddsOutcome {
  name: string;
  price: number;
  point?: number;
  description?: string;
}

interface OddsMarket {
  key: string;
  outcomes: OddsOutcome[];
}

interface OddsBookmaker {
  key: string;
  title: string;
  markets: OddsMarket[];
}

interface OddsEvent {
  id: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
}

// Fetch player prop odds for NBA
export async function fetchPlayerPropOdds(
  market: string // e.g. "player_points", "player_threes", "player_rebounds"
): Promise<OddsEvent[]> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    logger.warn("ODDS_API_KEY not set, skipping odds lookup");
    return [];
  }

  const url = `${BASE_URL}/sports/basketball_nba/events?apiKey=${apiKey}&markets=${market}&regions=us&oddsFormat=american`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } }); // cache 1 hour
    if (!res.ok) {
      logger.warn("Odds API error", { status: res.status, market });
      return [];
    }
    return await res.json();
  } catch (err) {
    logger.warn("Odds API fetch failed", { error: String(err), market });
    return [];
  }
}

// Map stat names to Odds API market keys
const STAT_TO_MARKET: Record<string, string> = {
  points: "player_points",
  threes: "player_threes",
  rebounds: "player_rebounds",
  assists: "player_assists",
  steals: "player_steals",
  blocks: "player_blocks",
};

export function getMarketKey(stat: string | null): string | null {
  if (!stat) return null;
  return STAT_TO_MARKET[stat.toLowerCase()] || null;
}

// Find odds for a specific player + stat from event data
export function findPlayerOdds(
  events: OddsEvent[],
  playerName: string,
  line: number
): number | null {
  for (const event of events) {
    for (const book of event.bookmakers) {
      for (const market of book.markets) {
        for (const outcome of market.outcomes) {
          if (
            outcome.description?.toLowerCase() === playerName.toLowerCase() &&
            outcome.name === "Over" &&
            outcome.point === line
          ) {
            return outcome.price;
          }
        }
      }
    }
  }
  return null;
}
