import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateParlayOdds, calculatePayout } from "@/lib/probability";
import { resolveTeamAbbr } from "@/lib/team-matcher";
import { fetchNBAScoreboard, findGameForTeam } from "@/lib/espn";
import { logger } from "@/lib/logger";

export async function GET() {
  logger.request("GET", "/api/parlays");
  try {
    const parlays = await prisma.parlay.findMany({
      include: { legs: true },
      orderBy: { createdAt: "desc" },
    });
    logger.info("Fetched parlays", { count: parlays.length });
    return NextResponse.json(parlays);
  } catch (err) {
    logger.error("Failed to fetch parlays", { error: String(err) });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
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
  logger.request("POST", "/api/parlays");
  try {
    const body = await req.json();
    const { legs, wagerAmount } = body as {
      legs: LegInput[];
      wagerAmount?: number;
    };

    if (!legs || legs.length === 0) {
      logger.warn("Create parlay rejected: no legs");
      return NextResponse.json({ error: "At least one leg required" }, { status: 400 });
    }

    // Try to match each leg to an ESPN event
    let scores: Awaited<ReturnType<typeof fetchNBAScoreboard>> = [];
    try {
      scores = await fetchNBAScoreboard();
    } catch (err) {
      logger.warn("ESPN scoreboard fetch failed during create", { error: String(err) });
    }

    const legsWithEvents = legs.map((leg) => {
      const teamAbbr = resolveTeamAbbr(leg.team);
      let espnEventId: string | null = null;
      if (teamAbbr && scores.length > 0) {
        const game = findGameForTeam(scores, teamAbbr);
        if (game) espnEventId = game.espnEventId;
      }
      logger.info("Leg matched", { team: leg.team, teamAbbr, espnEventId });
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

    logger.info("Parlay created", { id: parlay.id, legs: parlay.legs.length, totalOdds });
    return NextResponse.json(parlay, { status: 201 });
  } catch (err) {
    logger.error("Failed to create parlay", { error: String(err) });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
