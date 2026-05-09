"use client";

import { Badge } from "@/components/ui/badge";
import { LegStatus } from "@/lib/types";

const statusConfig: Record<
  LegStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "bg-white/5 text-muted-foreground border-white/10",
  },
  winning: {
    label: "Winning",
    className: "bg-positive-muted text-positive border-positive/30 animate-pulse",
  },
  losing: {
    label: "Losing",
    className: "bg-negative-muted text-negative border-negative/30 animate-pulse",
  },
  won: {
    label: "Won",
    className: "bg-positive/20 text-positive border-positive/40",
  },
  lost: {
    label: "Lost",
    className: "bg-negative/20 text-negative border-negative/40",
  },
  push: {
    label: "Push",
    className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  },
};

export function StatusBadge({ status }: { status: LegStatus }) {
  const config = statusConfig[status] || statusConfig.pending;
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
