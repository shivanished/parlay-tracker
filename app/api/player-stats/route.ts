import { NextRequest, NextResponse } from "next/server";
import { fetchBoxScore } from "@/lib/espn";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const eventIds = req.nextUrl.searchParams.get("eventIds");
  if (!eventIds) {
    return NextResponse.json({ error: "eventIds required" }, { status: 400 });
  }

  const ids = [...new Set(eventIds.split(",").filter(Boolean))];

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

    return NextResponse.json(playersByEvent);
  } catch (err) {
    logger.error("Player stats fetch failed", { error: String(err), eventIds: ids });
    return NextResponse.json(
      { error: "Failed to fetch player stats" },
      { status: 502 }
    );
  }
}
