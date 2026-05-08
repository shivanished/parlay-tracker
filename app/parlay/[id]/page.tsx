import { prisma } from "@/lib/db";
import { ParlayDetail } from "@/components/ParlayDetail";
import { ParlayWithLegs } from "@/lib/types";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ParlayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parlay = await prisma.parlay.findUnique({
    where: { id },
    include: { legs: true },
  });

  if (!parlay) notFound();

  const data: ParlayWithLegs = {
    ...parlay,
    createdAt: parlay.createdAt.toISOString(),
    status: parlay.status as ParlayWithLegs["status"],
    legs: parlay.legs.map((l) => ({
      ...l,
      betType: l.betType as ParlayWithLegs["legs"][0]["betType"],
      status: l.status as ParlayWithLegs["legs"][0]["status"],
      score: undefined,
    })),
  };

  return (
    <main className="max-w-2xl mx-auto p-6">
      <div className="mb-4">
        <Link href="/">
          <Button variant="ghost" size="sm">
            &larr; All Parlays
          </Button>
        </Link>
      </div>
      <ParlayDetail parlay={data} />
    </main>
  );
}
