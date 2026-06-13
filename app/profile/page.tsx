import { prisma } from "@/lib/db";
import { getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function ProfilePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const meta = user.user_metadata ?? {};
  const fullName: string | undefined = meta.full_name ?? meta.name;
  const avatarUrl: string | undefined = meta.avatar_url ?? meta.picture;
  const provider = user.app_metadata?.provider ?? "email";

  const parlays = await prisma.parlay.findMany({
    where: { userId: user.id },
    select: { status: true, wagerAmount: true },
  });

  const total = parlays.length;
  const won = parlays.filter((p) => p.status === "won").length;
  const lost = parlays.filter((p) => p.status === "lost").length;
  const active = parlays.filter((p) => p.status === "active").length;
  const wagered = parlays.reduce((sum, p) => sum + (p.wagerAmount ?? 0), 0);

  const stats = [
    { label: "Total", value: total },
    { label: "Active", value: active },
    { label: "Won", value: won },
    { label: "Lost", value: lost },
  ];

  const initial = (fullName ?? user.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-6 font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Profile
      </h2>

      <div className="flex items-center gap-4 rounded-lg border border-border bg-surface p-5">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="h-16 w-16 rounded-full border border-border object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-secondary text-xl font-semibold text-foreground">
            {initial}
          </div>
        )}
        <div className="min-w-0">
          {fullName && (
            <p className="truncate text-lg font-semibold text-foreground">
              {fullName}
            </p>
          )}
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Signed in with <span className="capitalize">{provider}</span>
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <p className="text-2xl font-semibold text-foreground">{s.value}</p>
            <p className="mt-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface p-5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Total wagered</span>
          <span className="font-medium text-foreground">
            ${wagered.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Member since</span>
          <span className="font-medium text-foreground">
            {formatDate(user.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}
