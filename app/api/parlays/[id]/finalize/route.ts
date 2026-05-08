import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

interface LegUpdate {
  id: string;
  status: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { legs } = (await req.json()) as { legs: LegUpdate[] };

    if (!legs || legs.length === 0) {
      return NextResponse.json({ error: "legs required" }, { status: 400 });
    }

    // Validate all statuses are final
    const finalStatuses = ["won", "lost", "push"];
    const allFinal = legs.every((l) => finalStatuses.includes(l.status));
    if (!allFinal) {
      return NextResponse.json({ error: "All legs must have final status" }, { status: 400 });
    }

    // Update each leg
    await Promise.all(
      legs.map((leg) =>
        prisma.leg.update({
          where: { id: leg.id },
          data: { status: leg.status },
        })
      )
    );

    // Determine parlay status
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
