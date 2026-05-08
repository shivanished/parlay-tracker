"use client";

import { Badge } from "@/components/ui/badge";
import { LegStatus } from "@/lib/types";

const statusConfig: Record<
  LegStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "bg-gray-100 text-gray-700 border-gray-200",
  },
  winning: {
    label: "Winning",
    className: "bg-green-100 text-green-700 border-green-200 animate-pulse",
  },
  losing: {
    label: "Losing",
    className: "bg-red-100 text-red-700 border-red-200 animate-pulse",
  },
  won: {
    label: "Won",
    className: "bg-green-500 text-white border-green-600",
  },
  lost: {
    label: "Lost",
    className: "bg-red-500 text-white border-red-600",
  },
  push: {
    label: "Push",
    className: "bg-yellow-100 text-yellow-700 border-yellow-200",
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
