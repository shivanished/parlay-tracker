import { NextRequest, NextResponse } from "next/server";
import { fetchNBAScoreboard } from "@/lib/espn";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") || undefined;

  try {
    const scores = await fetchNBAScoreboard(date);
    return NextResponse.json(scores);
  } catch (err) {
    logger.error("ESPN scoreboard fetch failed", { error: String(err), date });
    return NextResponse.json(
      { error: "Failed to fetch scores", detail: String(err) },
      { status: 502 }
    );
  }
}
