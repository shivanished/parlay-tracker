import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getUser } from "@/lib/supabase/server";
import { AuthButton } from "@/components/AuthButton";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Parlay Tracker",
  description: "Track your parlays in real-time with live scores",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getUser();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-dvh flex flex-col bg-background text-foreground">
        <header className="sticky top-0 z-50 h-14 border-b border-border bg-surface/80 backdrop-blur-md">
          <div className="flex h-full items-center justify-between px-6">
            <Link href="/" className="flex items-center gap-1.5">
              <span className="font-mono text-sm font-bold tracking-widest text-foreground">
                PARLAY
              </span>
              <span className="font-mono text-sm tracking-widest text-muted-foreground">
                TRACKER
              </span>
            </Link>
            <div className="flex items-center gap-2">
              {user && (
                <Link
                  href="/new"
                  aria-label="New parlay"
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Link>
              )}
              <AuthButton email={user?.email} />
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
