import { GameScore, PlayerStat } from "./types";
import { ESPN_NBA_SCOREBOARD } from "./constants";

interface ESPNCompetitor {
  team: { abbreviation: string; displayName: string };
  score: string;
  homeAway: "home" | "away";
}

interface ESPNEvent {
  id: string;
  competitions: {
    competitors: ESPNCompetitor[];
    status: {
      type: { completed: boolean; description: string };
      period: number;
      displayClock: string;
    };
  }[];
}

interface ESPNResponse {
  events: ESPNEvent[];
}

export async function fetchNBAScoreboard(
  date?: string
): Promise<GameScore[]> {
  const url = new URL(ESPN_NBA_SCOREBOARD);
  if (date) url.searchParams.set("dates", date);

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`ESPN API error: ${res.status}`);

  const data: ESPNResponse = await res.json();

  return data.events.map((event) => {
    const comp = event.competitions[0];
    const home = comp.competitors.find((c) => c.homeAway === "home")!;
    const away = comp.competitors.find((c) => c.homeAway === "away")!;
    const status = comp.status;

    return {
      homeTeam: home.team.abbreviation,
      awayTeam: away.team.abbreviation,
      homeScore: parseInt(home.score) || 0,
      awayScore: parseInt(away.score) || 0,
      period: `Q${status.period}`,
      clock: status.displayClock,
      isLive:
        !status.type.completed &&
        status.type.description !== "Scheduled",
      isComplete: status.type.completed,
      espnEventId: event.id,
    };
  });
}

export async function fetchBoxScore(
  eventId: string
): Promise<PlayerStat[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${eventId}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) return [];

  const data = await res.json();
  const players: PlayerStat[] = [];

  // ESPN boxScore structure: boxScore.players[teamIdx].statistics[0].athletes[]
  const boxScore = data?.boxscore;
  if (!boxScore?.players) return [];

  for (const teamBlock of boxScore.players) {
    const teamAbbr: string = teamBlock.team?.abbreviation || "";
    const statHeaders: string[] = teamBlock.statistics?.[0]?.labels || [];
    const ptsIdx = statHeaders.indexOf("PTS");
    const rebIdx = statHeaders.indexOf("REB");
    const astIdx = statHeaders.indexOf("AST");
    const stlIdx = statHeaders.indexOf("STL");
    const blkIdx = statHeaders.indexOf("BLK");
    const toIdx = statHeaders.indexOf("TO");
    const threeIdx = statHeaders.indexOf("3PM");
    const threeAltIdx = threeIdx === -1 ? statHeaders.indexOf("3PT") : threeIdx;

    for (const athlete of teamBlock.statistics?.[0]?.athletes || []) {
      const stats: string[] = athlete.stats || [];
      const name = athlete.athlete?.displayName || "";
      if (!name || stats.length === 0) continue;

      players.push({
        playerName: name,
        teamAbbr,
        points: parseInt(stats[ptsIdx]) || 0,
        rebounds: parseInt(stats[rebIdx]) || 0,
        assists: parseInt(stats[astIdx]) || 0,
        threes: parseInt(stats[threeAltIdx >= 0 ? threeAltIdx : 0]) || 0,
        steals: parseInt(stats[stlIdx]) || 0,
        blocks: parseInt(stats[blkIdx]) || 0,
        turnovers: parseInt(stats[toIdx]) || 0,
      });
    }
  }

  return players;
}

export function findGameForTeam(
  scores: GameScore[],
  teamAbbr: string
): GameScore | undefined {
  return scores.find(
    (g) => g.homeTeam === teamAbbr || g.awayTeam === teamAbbr
  );
}
