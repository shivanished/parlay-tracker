export function americanToImplied(odds: number): number {
  if (odds < 0) return Math.abs(odds) / (Math.abs(odds) + 100);
  return 100 / (odds + 100);
}

export function americanToDecimal(odds: number): number {
  if (odds < 0) return 1 + 100 / Math.abs(odds);
  return 1 + odds / 100;
}

export function parlayProbability(
  legs: { odds: number; status: string }[]
): number {
  return legs.reduce((p, leg) => {
    if (leg.status === "won" || leg.status === "push") return p * 1.0;
    if (leg.status === "lost") return p * 0.0;
    return p * americanToImplied(leg.odds);
  }, 1.0);
}

export function calculateParlayOdds(legs: { odds: number }[]): number {
  const decimalOdds = legs.reduce(
    (acc, leg) => acc * americanToDecimal(leg.odds),
    1
  );
  // Convert back to American
  if (decimalOdds >= 2) return Math.round((decimalOdds - 1) * 100);
  return Math.round(-100 / (decimalOdds - 1));
}

export function calculatePayout(
  wager: number,
  legs: { odds: number }[]
): number {
  const decimalOdds = legs.reduce(
    (acc, leg) => acc * americanToDecimal(leg.odds),
    1
  );
  return Math.round(wager * decimalOdds * 100) / 100;
}
