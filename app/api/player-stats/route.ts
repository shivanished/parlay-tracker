import { NextRequest, NextResponse } from "next/server";
import { fetchBoxScore } from "@/lib/espn";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const eventIds = req.nextUrl.searchParams.get("eventIds");
  if (!eventIds) {
    return NextResponse.json({ error: "eventIds required" }, { status: 400 });
  }

  const ids = [...new Set(eventIds.split(",").filter(Boolean))];
  logger.request("GET", "/api/player-stats", { eventIds: ids });

  try {
    const results = await Promise.all(
      ids.map(async (id) => {
        const players = await fetchBoxScore(id);
        return { eventId: id, players };
      })
    );

    const playersByEvent: Record<string, Awaited<ReturnType<typeof fetchBoxScore>>> = {};
    for (const r of results) {
      playersByEvent[r.eventId] = r.players;
    }

    logger.info("Player stats fetched", {
      events: ids.length,
      totalPlayers: Object.values(playersByEvent).flat().length,
    });

    return NextResponse.json(playersByEvent);
  } catch (err) {
    logger.error("Player stats fetch failed", { error: String(err) });
    return NextResponse.json(
      { error: "Failed to fetch player stats" },
      { status: 502 }
    );
  }
}
