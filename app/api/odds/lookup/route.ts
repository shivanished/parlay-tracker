import { NextRequest, NextResponse } from "next/server";
import { resolveTeamAbbr } from "@/lib/team-matcher";
import { fetchNBAScoreboard, findGameForTeam } from "@/lib/espn";
import { lookupOdds } from "@/lib/odds-api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { team, opponent, betType, line, player, stat, gameDate } = body as {
      team: string;
      opponent: string;
      betType: string;
      line: string;
      player?: string;
      stat?: string;
      gameDate?: string;
    };

    if (!team || !betType) {
      return NextResponse.json({ odds: null });
    }

    // Resolve team to ESPN abbreviation
    const teamAbbr = resolveTeamAbbr(team);
    if (!teamAbbr) {
      return NextResponse.json({ odds: null });
    }

    const odds = await lookupOdds({
      betType,
      team: teamAbbr,
      opponent,
      line: line || "",
      player,
      stat,
      gameDate,
    });

    return NextResponse.json({ odds });
  } catch {
    return NextResponse.json({ odds: null });
  }
}
