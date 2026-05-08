import { NextRequest, NextResponse } from "next/server";
import { fetchNBAScoreboard } from "@/lib/espn";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") || undefined;

  try {
    const scores = await fetchNBAScoreboard(date);
    return NextResponse.json(scores);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch scores", detail: String(err) },
      { status: 502 }
    );
  }
}
