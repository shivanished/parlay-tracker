"use client";

export function ProbabilityGauge({ probability }: { probability: number }) {
  const pct = Math.round(probability * 100);
  const circumference = 2 * Math.PI * 45;
  const dashOffset = circumference - (probability * circumference);

  const color =
    pct >= 50
      ? "text-positive"
      : pct >= 25
        ? "text-yellow-500"
        : "text-negative";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={`${color} transition-all duration-700`}
        />
      </svg>
      <span className="absolute text-lg font-bold font-mono tabular-nums">{pct}%</span>
    </div>
  );
}
