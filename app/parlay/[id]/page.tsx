import { prisma } from "@/lib/db";
import { ParlayDetail } from "@/components/ParlayDetail";
import { ParlayWithLegs } from "@/lib/types";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ParlayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const parlay = await prisma.parlay.findUnique({
    where: { id },
    include: { legs: true },
  });

  if (!parlay || parlay.userId !== user.id) notFound();

  const data: ParlayWithLegs = {
    ...parlay,
    createdAt: parlay.createdAt.toISOString(),
    status: parlay.status as ParlayWithLegs["status"],
    legs: parlay.legs.map((l) => ({
      ...l,
      betType: l.betType as ParlayWithLegs["legs"][0]["betType"],
      status: l.status as ParlayWithLegs["legs"][0]["status"],
      score: undefined,
      finalStatValue: l.finalStatValue,
      targetStatValue: l.targetStatValue,
      statLabel: l.statLabel,
      gameHomeTeam: l.gameHomeTeam,
      gameAwayTeam: l.gameAwayTeam,
      gameHomeScore: l.gameHomeScore,
      gameAwayScore: l.gameAwayScore,
      gamePeriod: l.gamePeriod,
      gameCompleted: l.gameCompleted,
    })),
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-4">
        <Link href="/">
          <Button variant="ghost" size="sm">
            &larr; All Parlays
          </Button>
        </Link>
      </div>
      <ParlayDetail parlay={data} />
    </div>
  );
}
