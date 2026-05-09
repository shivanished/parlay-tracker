import { prisma } from "@/lib/db";
import { ParlayCard } from "@/components/ParlayCard";
import { ParlayWithLegs } from "@/lib/types";
import { getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getUser();
  if (!user) redirect("/login");

  const parlays = await prisma.parlay.findMany({
    where: { userId: user.id },
    include: { legs: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6">
      <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-4">
        Active Parlays
      </h2>

      {parlays.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg mb-2">No parlays yet</p>
          <p className="text-sm">
            Create your first parlay to start tracking
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
    </div>
  );
}
