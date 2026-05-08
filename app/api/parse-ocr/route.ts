import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { logger } from "@/lib/logger";
import { fetchNBAScoreboard, fetchBoxScore } from "@/lib/espn";
import {
  fetchGameOddsFromESPN,
  findGameOddsForTeam,
  extractOddsForBet,
  lookupOdds,
  getPropType,
} from "@/lib/odds-api";
import { resolveTeamAbbr } from "@/lib/team-matcher";
import { parseStatFromLine } from "@/lib/bet-evaluator";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const SYSTEM_PROMPT = `You are parsing OCR text extracted from a sportsbook parlay screenshot. Extract every bet leg you can find.

For each leg, return:
- player: player name if it's a player prop, empty string for team bets
- team: team name if visible in context, empty string if unknown. Do NOT guess teams from player names — leave blank if not shown in OCR text
- opponent: opposing team if visible, empty string otherwise
- betType: one of "spread", "moneyline", "over_under", "player_prop"
- line: the bet line exactly as shown (e.g. "1+ threes", "-3.5", "O 220.5", "15+ points")
- stat: for player props, the stat category (e.g. "threes", "points", "rebounds", "assists", "steals", "blocks"). null for non-prop bets
- odds: American odds as integer (e.g. -110, +150). Use 0 if not visible in the text
- confidence: 0.0 to 1.0 — how confident you are this leg was correctly parsed. 1.0 = clearly visible and unambiguous. 0.7 = partially visible or inferred. 0.3 = guessing
- gameDate: ISO date string (YYYY-MM-DD) if a date is visible in the text, null otherwise

IMPORTANT: For team names, ONLY use what's explicitly in the OCR text (like game headers "@ Team A at Team B"). Do NOT infer teams from your knowledge of player rosters — your roster data may be outdated due to trades.

Common OCR patterns:
- "Cade Cunningham: 1+ threes" → player_prop, player="Cade Cunningham", line="1+ threes", stat="threes", team="" (no team shown)
- "Lakers -3.5 (-110)" → spread, team="Lakers", line="-3.5", odds=-110
- "Over 220.5 (-110)" → over_under, line="O 220.5"
- Lines showing current stats like "5 points" below a leg are live updates, NOT bet legs — skip them
- Lines like "@ Los Angeles L at Oklahoma City" are game matchup headers, NOT legs — use them to infer team/opponent for surrounding legs`;

const responseSchema = {
  type: "json_schema" as const,
  json_schema: {
    name: "parsed_legs",
    strict: true,
    schema: {
      type: "object",
      properties: {
        legs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              player: { type: "string" },
              team: { type: "string" },
              opponent: { type: "string" },
              betType: { type: "string", enum: ["spread", "moneyline", "over_under", "player_prop"] },
              line: { type: "string" },
              stat: { type: ["string", "null"] },
              odds: { type: "number" },
              confidence: { type: "number" },
              gameDate: { type: ["string", "null"] },
            },
            required: ["player", "team", "opponent", "betType", "line", "stat", "odds", "confidence", "gameDate"],
            additionalProperties: false,
          },
        },
      },
      required: ["legs"],
      additionalProperties: false,
    },
  },
};

interface ParsedLeg {
  player: string;
  team: string;
  opponent: string;
  betType: string;
  line: string;
  stat: string | null;
  odds: number;
  confidence: number;
  gameDate: string | null;
}

// Look up players in today's ESPN box scores to get accurate team info
async function enrichWithESPNRosters(legs: ParsedLeg[]): Promise<ParsedLeg[]> {
  const playerLegs = legs.filter((l) => l.betType === "player_prop" && l.player);
  if (playerLegs.length === 0) return legs;

  // Fetch today's scoreboard
  let games;
  try {
    games = await fetchNBAScoreboard();
  } catch {
    logger.warn("Could not fetch scoreboard for roster enrichment");
    return legs;
  }

  if (games.length === 0) return legs;

  // Fetch box scores for all games
  const allPlayers: { playerName: string; team: string; opponent: string; eventId: string }[] = [];

  await Promise.all(
    games.map(async (game) => {
      try {
        const boxScore = await fetchBoxScore(game.espnEventId);
        for (const p of boxScore) {
          // Determine which team this player is on by checking if their name
          // appears — we need the team abbr. The fetchBoxScore doesn't return team info per player.
          // We'll use the ESPN summary API directly for team mapping.
          allPlayers.push({
            playerName: p.playerName,
            team: "", // filled below
            opponent: "",
            eventId: game.espnEventId,
          });
        }
      } catch {
        // skip this game
      }
    })
  );

  // Need team info per player — refetch with team context
  const playerTeamMap = new Map<string, { team: string; opponent: string; eventId: string }>();

  await Promise.all(
    games.map(async (game) => {
      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${game.espnEventId}`;
        const res = await fetch(url, { next: { revalidate: 0 } });
        if (!res.ok) return;
        const data = await res.json();

        const boxPlayers = data?.boxscore?.players;
        if (!boxPlayers) return;

        for (const teamBlock of boxPlayers) {
          const teamName = teamBlock.team?.displayName || "";
          const teamAbbr = teamBlock.team?.abbreviation || "";
          const opponentAbbr = game.homeTeam === teamAbbr ? game.awayTeam : game.homeTeam;

          for (const athlete of teamBlock.statistics?.[0]?.athletes || []) {
            const name = athlete.athlete?.displayName;
            if (name) {
              playerTeamMap.set(name.toLowerCase(), {
                team: teamName,
                opponent: opponentAbbr,
                eventId: game.espnEventId,
              });
            }
          }
        }
      } catch {
        // skip
      }
    })
  );

  // Enrich legs with accurate team data
  return legs.map((leg) => {
    if (leg.betType !== "player_prop" || !leg.player) return leg;

    const match = playerTeamMap.get(leg.player.toLowerCase());
    if (match) {
      const changed = match.team !== leg.team;
      if (changed) {
        logger.info("Corrected player team", {
          player: leg.player,
          from: leg.team || "(empty)",
          to: match.team,
        });
      }
      return {
        ...leg,
        team: match.team,
        opponent: match.opponent,
      };
    } else {
      logger.warn("Player not found in today's box scores", {
        player: leg.player,
        aiTeam: leg.team,
        gamesChecked: games.length,
      });
    }

    return leg;
  });
}

// Look up real pre-game odds for legs that don't have them from the screenshot
async function enrichWithRealOdds(legs: ParsedLeg[]): Promise<ParsedLeg[]> {
  // Only enrich legs with missing/default odds
  const needsOdds = legs.filter(
    (l) => l.odds === 0 || l.odds === -110
  );
  if (needsOdds.length === 0) return legs;

  // Pre-fetch ESPN game odds for game-level bets
  const hasGameBets = needsOdds.some(
    (l) => l.betType === "spread" || l.betType === "moneyline" || l.betType === "over_under"
  );
  const espnOddsMap = hasGameBets ? await fetchGameOddsFromESPN() : new Map();

  // Enrich each leg
  return Promise.all(
    legs.map(async (leg) => {
      if (leg.odds !== 0 && leg.odds !== -110) return leg;

      const teamAbbr = resolveTeamAbbr(leg.team);

      // Game-level bets: use ESPN scoreboard odds
      if (leg.betType === "spread" || leg.betType === "moneyline" || leg.betType === "over_under") {
        if (!teamAbbr) return leg;

        const gameOdds = findGameOddsForTeam(espnOddsMap, teamAbbr);
        if (gameOdds) {
          const realOdds = extractOddsForBet(gameOdds, teamAbbr, leg.betType, leg.line);
          if (realOdds !== null) {
            logger.info("Found ESPN odds", { team: leg.team, betType: leg.betType, odds: realOdds });
            return { ...leg, odds: realOdds };
          }
        }
        return leg;
      }

      // Player props: use BALLDONTLIE
      if (leg.betType === "player_prop" && leg.player) {
        const { statKey } = parseStatFromLine(leg.line);
        const realOdds = await lookupOdds({
          betType: "prop",
          team: teamAbbr || "",
          opponent: leg.opponent,
          line: leg.line,
          player: leg.player,
          stat: statKey || undefined,
          gameDate: leg.gameDate || undefined,
        });

        if (realOdds !== null) {
          logger.info("Found BALLDONTLIE odds", { player: leg.player, line: leg.line, odds: realOdds });
          return { ...leg, odds: realOdds };
        }
      }

      return leg;
    })
  );
}

export async function POST(req: NextRequest) {
  logger.request("POST", "/api/parse-ocr");

  if (!process.env.OPENAI_API_KEY) {
    logger.error("OPENAI_API_KEY not set");
    return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
  }

  try {
    const { ocrText } = await req.json();

    if (!ocrText || typeof ocrText !== "string") {
      return NextResponse.json({ error: "ocrText required" }, { status: 400 });
    }

    logger.info("Parsing OCR text", { length: ocrText.length, lines: ocrText.split("\n").filter(Boolean).length });

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      response_format: responseSchema,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Parse these bet legs from OCR text:\n\n${ocrText}` },
      ],
      temperature: 0.1,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      logger.error("Empty response from OpenAI");
      return NextResponse.json({ error: "AI returned empty response" }, { status: 502 });
    }

    const parsed = JSON.parse(content);
    logger.info("AI parsed", {
      legs: parsed.legs.length,
      tokens: completion.usage?.total_tokens,
    });

    // Enrich with real ESPN roster data
    const enrichedLegs = await enrichWithESPNRosters(parsed.legs);

    // Look up real odds for legs missing them
    const legsWithOdds = await enrichWithRealOdds(enrichedLegs);

    return NextResponse.json({ legs: legsWithOdds, rawText: ocrText });
  } catch (err) {
    logger.error("OCR parse failed", { error: String(err) });
    return NextResponse.json(
      { error: "Failed to parse OCR text", detail: String(err) },
      { status: 500 }
    );
  }
}
