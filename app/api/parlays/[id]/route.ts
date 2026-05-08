import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const parlay = await prisma.parlay.findUnique({
    where: { id },
    include: { legs: true },
  });

  if (!parlay) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(parlay);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.parlay.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
