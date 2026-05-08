import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateParlayOdds, calculatePayout } from "@/lib/probability";
import { resolveTeamAbbr } from "@/lib/team-matcher";
import { fetchNBAScoreboard, findGameForTeam } from "@/lib/espn";

export async function GET() {
  const parlays = await prisma.parlay.findMany({
    include: { legs: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(parlays);
}

interface LegInput {
  team: string;
  opponent: string;
  league?: string;
  betType: string;
  line: string;
  odds: number;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { legs, wagerAmount } = body as {
    legs: LegInput[];
    wagerAmount?: number;
  };

  if (!legs || legs.length === 0) {
    return NextResponse.json({ error: "At least one leg required" }, { status: 400 });
  }

  // Try to match each leg to an ESPN event
  let scores: Awaited<ReturnType<typeof fetchNBAScoreboard>> = [];
  try {
    scores = await fetchNBAScoreboard();
  } catch {
    // keep empty
  }

  const legsWithEvents = legs.map((leg) => {
    const teamAbbr = resolveTeamAbbr(leg.team);
    let espnEventId: string | null = null;
    if (teamAbbr && scores.length > 0) {
      const game = findGameForTeam(scores, teamAbbr);
      if (game) espnEventId = game.espnEventId;
    }
    return { ...leg, espnEventId };
  });

  const totalOdds = calculateParlayOdds(legs);
  const potentialPayout = wagerAmount
    ? calculatePayout(wagerAmount, legs)
    : null;

  const parlay = await prisma.parlay.create({
    data: {
      wagerAmount: wagerAmount || null,
      totalOdds,
      potentialPayout,
      legs: {
        create: legsWithEvents.map((leg) => ({
          team: leg.team,
          opponent: leg.opponent,
          league: leg.league || "NBA",
          betType: leg.betType,
          line: leg.line,
          odds: leg.odds,
          espnEventId: leg.espnEventId,
        })),
      },
    },
    include: { legs: true },
  });

  return NextResponse.json(parlay, { status: 201 });
}
