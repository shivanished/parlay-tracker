import Link from "next/link";
import { prisma } from "@/lib/db";
import { ParlayCard } from "@/components/ParlayCard";
import { Button } from "@/components/ui/button";
import { ParlayWithLegs } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const parlays = await prisma.parlay.findMany({
    include: { legs: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="max-w-2xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Parlay Tracker</h1>
        <Link href="/new">
          <Button>+ New Parlay</Button>
        </Link>
      </div>

      {parlays.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg mb-2">No parlays yet</p>
          <p className="text-sm">
            Create your first parlay to start tracking
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {parlays.map((parlay) => (
            <ParlayCard
              key={parlay.id}
              parlay={
                {
                  ...parlay,
                  createdAt: parlay.createdAt.toISOString(),
                  status: parlay.status,
                  legs: parlay.legs.map((l) => ({
                    ...l,
                    score: undefined,
                  })),
                } as ParlayWithLegs
              }
            />
          ))}
        </div>
      )}
    </main>
  );
}
