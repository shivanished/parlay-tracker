import { GameScore } from "./types";
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

export function findGameForTeam(
  scores: GameScore[],
  teamAbbr: string
): GameScore | undefined {
  return scores.find(
    (g) => g.homeTeam === teamAbbr || g.awayTeam === teamAbbr
  );
}
