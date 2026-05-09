"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function AuthButton({ email }: { email?: string }) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (!email) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground hidden sm:inline">
        {email}
      </span>
      <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-xs">
        Sign Out
      </Button>
    </div>
  );
}
