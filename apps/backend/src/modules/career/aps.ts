/**
 * South African Admission Point Score (APS) helpers.
 * Each subject percentage maps to a 1–7 achievement level; APS is the sum of the
 * best six subjects (the common university convention).
 */
export function apsPointsFor(percent: number): number {
  if (percent >= 80) return 7;
  if (percent >= 70) return 6;
  if (percent >= 60) return 5;
  if (percent >= 50) return 4;
  if (percent >= 40) return 3;
  if (percent >= 30) return 2;
  return 1;
}

export function computeAps(marks: Array<{ percent: number }>): number {
  return marks
    .map((m) => apsPointsFor(m.percent))
    .sort((a, b) => b - a)
    .slice(0, 6)
    .reduce((sum, p) => sum + p, 0);
}
