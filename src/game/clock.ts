// The match clock. The engine counts minutes straight through, added time
// included: with 2 minutes added to the first half, minutes 46 and 47 are
// 45+1 and 45+2, and the second half kicks off in minute 48. These helpers
// turn that running count into what a scoreboard shows.
import type {MatchReport} from "./types";

export function addedTime(report: Pick<MatchReport, "added">): [number, number] {
  return report.added ?? [0, 0];
}

/** Running minute the first half ends on. */
export function halfTimeAt(report: Pick<MatchReport, "added">): number {
  return 45 + addedTime(report)[0];
}

/** Running minute the match ends on. Grows when the second half's added time is decided. */
export function matchLength(report: Pick<MatchReport, "added">): number {
  const [first, second] = addedTime(report);
  return 90 + first + second;
}

/** Scoreboard minute for a running time: {minute: 45, extra: 2} is 45+2. */
export function clockParts(report: Pick<MatchReport, "added">, t: number): {minute: number; extra: number} {
  const n = Math.max(0, Math.ceil(t - 1e-9));
  const half = halfTimeAt(report);
  if (t <= half + 1e-9) return n <= 45 ? {minute: n, extra: 0} : {minute: 45, extra: n - 45};
  const second = n - addedTime(report)[0];
  return second <= 90 ? {minute: second, extra: 0} : {minute: 90, extra: second - 90};
}

/** "45+2'" or "67'". */
export function clockLabel(report: Pick<MatchReport, "added">, t: number): string {
  const {minute, extra} = clockParts(report, t);
  return extra > 0 ? `${minute}+${extra}'` : `${minute}'`;
}

/** Added time to show on the board while it's being played, else 0. */
export function boardAt(report: Pick<MatchReport, "added">, t: number): number {
  const [first, second] = addedTime(report);
  const {minute, extra} = clockParts(report, t);
  if (minute === 45 && (extra > 0 || t > 44.5) && t <= halfTimeAt(report)) return first;
  if (minute === 90 && (extra > 0 || t > 89.5 + first)) return second;
  return 0;
}
