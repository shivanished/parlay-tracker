import { logger } from "./logger";
import { ESPN_NBA_SCOREBOARD } from "./constants";

// ── Types ────────────────────────────────────────────────────────────

export interface GameOdds {
  espnEventId: string;
  homeTeam: string;
  awayTeam: string;
  spread: { homeLine: number; homeOdds: number; awayOdds: number };
  moneyline: { homeOdds: number; awayOdds: number };
  overUnder: { line: number; overOdds: number; underOdds: number };
}

interface ESPNOddsProvider {
  provider: { id: string; name: string };
  spread: number;
  overUnder: number;
  homeTeamOdds: { favorite: boolean };
  awayTeamOdds: { favorite: boolean };
  moneyline?: {
    home: { close: { odds: string } };
    away: { close: { odds: string } };
  };
  pointSpread?: {
    home: { close: { line: string; odds: string } };
    away: { close: { line: string; odds: string } };
  };
  total?: {
    over: { close: { odds: string } };
    under: { close: { odds: string } };
  };
}

// ── In-memory cache ──────────────────────────────────────────────────

const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

// ── ESPN Game Odds ───────────────────────────────────────────────────

function parseOdds(str: string): number {
  return parseInt(str.replace("+", "")) || -110;
}

/**
 * Fetch game-level odds (spread, moneyline, over/under) from ESPN scoreboard.
 * Returns a map of espnEventId → GameOdds for all games with odds data.
 */
export async function fetchGameOddsFromESPN(
  date?: string
): Promise<Map<string, GameOdds>> {
  const cacheKey = `espn-odds-${date || "today"}`;
  const cached = getCached<Map<string, GameOdds>>(cacheKey);
  if (cached) return cached;

  const url = new URL(ESPN_NBA_SCOREBOARD);
  if (date) url.searchParams.set("dates", date);

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      logger.warn("ESPN scoreboard error", { status: res.status });
      return new Map();
    }

    const data = await res.json();
    const result = new Map<string, GameOdds>();

    for (const event of data.events || []) {
      const comp = event.competitions?.[0];
      if (!comp) continue;

      // Odds can be on event.odds or competition.odds
      const oddsArr: ESPNOddsProvider[] = comp.odds || event.odds || [];
      if (oddsArr.length === 0) continue;

      const odds = oddsArr[0]; // First provider (usually DraftKings)
      if (!odds.moneyline && !odds.pointSpread) continue;

      const home = comp.competitors?.find(
        (c: { homeAway: string }) => c.homeAway === "home"
      );
      const away = comp.competitors?.find(
        (c: { homeAway: string }) => c.homeAway === "away"
      );
      if (!home || !away) continue;

      const gameOdds: GameOdds = {
        espnEventId: event.id,
        homeTeam: home.team.abbreviation,
        awayTeam: away.team.abbreviation,
        spread: {
          homeLine: parseFloat(odds.pointSpread?.home?.close?.line || "0"),
          homeOdds: parseOdds(odds.pointSpread?.home?.close?.odds || "-110"),
          awayOdds: parseOdds(odds.pointSpread?.away?.close?.odds || "-110"),
        },
        moneyline: {
          homeOdds: parseOdds(odds.moneyline?.home?.close?.odds || "-110"),
          awayOdds: parseOdds(odds.moneyline?.away?.close?.odds || "-110"),
        },
        overUnder: {
          line: odds.overUnder || 0,
          overOdds: parseOdds(odds.total?.over?.close?.odds || "-110"),
          underOdds: parseOdds(odds.total?.under?.close?.odds || "-110"),
        },
      };

      result.set(event.id, gameOdds);
    }

    setCache(cacheKey, result);
    return result;
  } catch (err) {
    logger.warn("ESPN odds fetch failed", { error: String(err) });
    return new Map();
  }
}

/**
 * Find game-level odds for a specific team from ESPN data.
 */
export function findGameOddsForTeam(
  oddsMap: Map<string, GameOdds>,
  teamAbbr: string
): GameOdds | null {
  for (const odds of oddsMap.values()) {
    if (odds.homeTeam === teamAbbr || odds.awayTeam === teamAbbr) {
      return odds;
    }
  }
  return null;
}

/**
 * Extract the specific odds value for a bet type + team from GameOdds.
 */
export function extractOddsForBet(
  gameOdds: GameOdds,
  teamAbbr: string,
  betType: string,
  line: string
): number | null {
  const isHome = gameOdds.homeTeam === teamAbbr;

  switch (betType) {
    case "spread":
      return isHome ? gameOdds.spread.homeOdds : gameOdds.spread.awayOdds;

    case "moneyline":
      return isHome ? gameOdds.moneyline.homeOdds : gameOdds.moneyline.awayOdds;

    case "over_under": {
      const lower = line.toLowerCase();
      if (lower.startsWith("o") || lower.includes("over")) {
        return gameOdds.overUnder.overOdds;
      }
      if (lower.startsWith("u") || lower.includes("under")) {
        return gameOdds.overUnder.underOdds;
      }
      // Default to over if just a number
      return gameOdds.overUnder.overOdds;
    }

    default:
      return null;
  }
}

// ── BALLDONTLIE Player Props ─────────────────────────────────────────

const BDL_BASE = "https://api.balldontlie.io";

// Map stat names to BALLDONTLIE prop_type values
const STAT_TO_PROP_TYPE: Record<string, string> = {
  points: "points",
  threes: "threes",
  "3-pointers": "threes",
  "3pm": "threes",
  rebounds: "rebounds",
  assists: "assists",
  steals: "steals",
  blocks: "blocks",
};

export function getPropType(stat: string | null): string | null {
  if (!stat) return null;
  return STAT_TO_PROP_TYPE[stat.toLowerCase()] || null;
}

// Keep backward-compat alias
export const getMarketKey = getPropType;

interface BDLGame {
  id: number;
  home_team: { abbreviation: string };
  visitor_team: { abbreviation: string };
}

interface BDLPlayerProp {
  player_id: number;
  player?: { first_name: string; last_name: string };
  prop_type: string;
  line_value: string;
  market: {
    type: string;
    over_odds?: number;
    under_odds?: number;
    odds?: number;
  };
}

/**
 * Find a BALLDONTLIE game ID by team abbreviation and date.
 */
async function findBDLGameId(
  teamAbbr: string,
  date: string
): Promise<number | null> {
  const apiKey = process.env.BALLDONTLIE_API_KEY;
  if (!apiKey) return null;

  const cacheKey = `bdl-games-${date}`;
  let games = getCached<BDLGame[]>(cacheKey);

  if (!games) {
    try {
      const res = await fetch(
        `${BDL_BASE}/v1/games?dates[]=${date}`,
        { headers: { Authorization: apiKey } }
      );
      if (!res.ok) {
        logger.warn("BALLDONTLIE games error", { status: res.status });
        return null;
      }
      const data = await res.json();
      games = data.data || [];
      setCache(cacheKey, games);
    } catch (err) {
      logger.warn("BALLDONTLIE games fetch failed", { error: String(err) });
      return null;
    }
  }

  // ESPN uses slightly different abbreviations than BDL in some cases
  const normalize = (abbr: string) => {
    const map: Record<string, string> = {
      GS: "GSW", SA: "SAS", NO: "NOP", NY: "NYK", UTAH: "UTA", WSH: "WAS",
    };
    return map[abbr] || abbr;
  };

  const bdlAbbr = normalize(teamAbbr);
  const game = games!.find(
    (g) =>
      g.home_team.abbreviation === bdlAbbr ||
      g.visitor_team.abbreviation === bdlAbbr
  );

  return game?.id || null;
}

/**
 * Fetch player prop odds from BALLDONTLIE.
 */
export async function fetchPlayerPropOdds(
  gameId: number,
  propType: string
): Promise<BDLPlayerProp[]> {
  const apiKey = process.env.BALLDONTLIE_API_KEY;
  if (!apiKey) {
    logger.warn("BALLDONTLIE_API_KEY not set, skipping prop odds lookup");
    return [];
  }

  const cacheKey = `bdl-props-${gameId}-${propType}`;
  const cached = getCached<BDLPlayerProp[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `${BDL_BASE}/v2/odds/player_props?game_id=${gameId}&prop_type=${propType}`,
      { headers: { Authorization: apiKey } }
    );
    if (!res.ok) {
      logger.warn("BALLDONTLIE props error", { status: res.status, gameId, propType });
      return [];
    }
    const data = await res.json();
    const props: BDLPlayerProp[] = data.data || [];
    setCache(cacheKey, props);
    return props;
  } catch (err) {
    logger.warn("BALLDONTLIE props fetch failed", { error: String(err) });
    return [];
  }
}

/**
 * Find odds for a specific player prop.
 */
export function findPlayerOdds(
  props: BDLPlayerProp[],
  playerName: string,
  line: number
): number | null {
  const nameLower = playerName.toLowerCase();

  for (const prop of props) {
    const propLine = parseFloat(prop.line_value);
    if (propLine !== line) continue;

    // Match by player name if available in response
    if (prop.player) {
      const fullName =
        `${prop.player.first_name} ${prop.player.last_name}`.toLowerCase();
      if (fullName !== nameLower) continue;
    }

    if (prop.market.type === "over_under" && prop.market.over_odds != null) {
      return prop.market.over_odds;
    }
    if (prop.market.odds != null) {
      return prop.market.odds;
    }
  }

  return null;
}

// ── Unified Lookup ───────────────────────────────────────────────────

export interface OddsLookupParams {
  betType: string;
  team: string; // ESPN abbreviation
  opponent: string;
  line: string;
  player?: string;
  stat?: string;
  gameDate?: string; // YYYY-MM-DD
}

/**
 * Main entry point: look up odds for any bet type.
 * Returns American odds integer or null.
 */
export async function lookupOdds(
  params: OddsLookupParams
): Promise<number | null> {
  const { betType, team, line } = params;

  // Game-level bets: use ESPN
  if (betType === "spread" || betType === "moneyline" || betType === "over_under") {
    const dateParam = params.gameDate?.replace(/-/g, "");
    const oddsMap = await fetchGameOddsFromESPN(dateParam);
    const gameOdds = findGameOddsForTeam(oddsMap, team);

    if (gameOdds) {
      const odds = extractOddsForBet(gameOdds, team, betType, line);
      if (odds !== null) {
        logger.info("Found ESPN odds", { team, betType, line, odds });
        return odds;
      }
    }
    return null;
  }

  // Player props: use BALLDONTLIE
  if (betType === "prop" || betType === "player_prop") {
    if (!params.player || !params.stat) return null;

    const propType = getPropType(params.stat);
    if (!propType) return null;

    const date = params.gameDate || new Date().toISOString().split("T")[0];
    const gameId = await findBDLGameId(team, date);
    if (!gameId) return null;

    const parseTarget = (l: string): number => {
      const match = l.match(/([\d.]+)/);
      return match ? parseFloat(match[1]) : 0;
    };

    const props = await fetchPlayerPropOdds(gameId, propType);
    const odds = findPlayerOdds(props, params.player, parseTarget(line));

    if (odds !== null) {
      logger.info("Found BALLDONTLIE odds", {
        player: params.player,
        stat: params.stat,
        line,
        odds,
      });
      return odds;
    }
    return null;
  }

  return null;
}
