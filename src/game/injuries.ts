// What a player is injured with: a kind picked from how long it lasts (and where it happened),
// kept with the injury so the profile can say what it is and how long they're out. Picked from the
// player and the date, not from dice, so adding it changes no match.
import type {Player} from "./types";

export type InjurySource = "match" | "training";

/** Kinds by how bad they are: a knock, a strain or a tear, something serious. */
export const INJURY_KINDS = {
  light: ["bruise", "tightness", "knock"],
  medium: ["ankle", "hamstring", "calf"],
  heavy: ["knee", "foot", "thigh"],
} as const;

export interface Injury {
  kind: string;
  /** How many weeks it was to begin with. */
  total: number;
  source: InjurySource;
}

function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Sets an injury of `weeks` on a player, with its kind. */
export function injure(p: Player, weeks: number, source: InjurySource, salt: number): void {
  p.injuryWeeks = weeks;
  const pool = weeks <= 2 ? INJURY_KINDS.light : weeks <= 5 ? INJURY_KINDS.medium : INJURY_KINDS.heavy;
  p.injury = {kind: pool[hash(`${p.id}:${weeks}:${salt}`) % pool.length], total: weeks, source};
}
