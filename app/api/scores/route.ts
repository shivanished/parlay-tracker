import { NextRequest, NextResponse } from "next/server";
import { fetchNBAScoreboard } from "@/lib/espn";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") || undefined;
  logger.request("GET", "/api/scores", { date });

  try {
    const scores = await fetchNBAScoreboard(date);
    logger.info("Scores fetched", { games: scores.length, liveGames: scores.filter(s => s.isLive).length });
    return NextResponse.json(scores);
  } catch (err) {
    logger.error("ESPN scoreboard fetch failed", { error: String(err), date });
    return NextResponse.json(
      { error: "Failed to fetch scores", detail: String(err) },
      { status: 502 }
    );
  }
}
