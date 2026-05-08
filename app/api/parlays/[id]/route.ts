import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const parlay = await prisma.parlay.findUnique({
      where: { id },
      include: { legs: true },
    });

    if (!parlay) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(parlay);
  } catch (err) {
    logger.error("Failed to fetch parlay", { id, error: String(err) });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await prisma.parlay.delete({ where: { id } });
    logger.info("Parlay deleted", { id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("Failed to delete parlay", { id, error: String(err) });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
