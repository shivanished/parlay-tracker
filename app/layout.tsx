import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
            <Link
              href="/new"
              className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              + New Parlay
            </Link>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
