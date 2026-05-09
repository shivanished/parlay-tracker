import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getUser } from "@/lib/supabase/server";

interface LegUpdate {
  id: string;
  status: string;
  finalStatValue?: number;
  targetStatValue?: number;
  statLabel?: string;
  gameHomeTeam?: string;
  gameAwayTeam?: string;
  gameHomeScore?: number;
  gameAwayScore?: number;
  gamePeriod?: string;
  gameCompleted?: boolean;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const parlay = await prisma.parlay.findUnique({ where: { id } });
    if (!parlay || parlay.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { legs } = (await req.json()) as { legs: LegUpdate[] };

    if (!legs || legs.length === 0) {
      return NextResponse.json({ error: "legs required" }, { status: 400 });
    }

    const finalStatuses = ["won", "lost", "push"];
    const allFinal = legs.every((l) => finalStatuses.includes(l.status));
    if (!allFinal) {
      return NextResponse.json({ error: "All legs must have final status" }, { status: 400 });
    }

    await Promise.all(
      legs.map((leg) =>
        prisma.leg.update({
          where: { id: leg.id },
          data: {
            status: leg.status,
            finalStatValue: leg.finalStatValue ?? null,
            targetStatValue: leg.targetStatValue ?? null,
            statLabel: leg.statLabel ?? null,
            gameHomeTeam: leg.gameHomeTeam ?? null,
            gameAwayTeam: leg.gameAwayTeam ?? null,
            gameHomeScore: leg.gameHomeScore ?? null,
            gameAwayScore: leg.gameAwayScore ?? null,
            gamePeriod: leg.gamePeriod ?? null,
            gameCompleted: leg.gameCompleted ?? null,
          },
        })
      )
    );

    const anyLost = legs.some((l) => l.status === "lost");
    const parlayStatus = anyLost ? "lost" : "won";

    await prisma.parlay.update({
      where: { id },
      data: { status: parlayStatus },
    });

    logger.info("Parlay finalized", { id, status: parlayStatus, legs: legs.length });

    return NextResponse.json({ ok: true, status: parlayStatus });
  } catch (err) {
    logger.error("Failed to finalize parlay", { id, error: String(err) });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
