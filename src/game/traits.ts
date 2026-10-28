// Traits: a few small quirks a player has, one or two (or none) each. Subtle on purpose: a few
// per cent in the match, never the thing that decides it. They come from the player's id and
// position, not from dice and not from anything stored, so every player (in older saves too) has
// the same ones every time, and adding them touches nothing else.
import type {Player, Position} from "./types";

export const TRAITS = ["poacher", "playmaker", "cool", "engine", "fragile", "steady", "late"] as const;
export type Trait = (typeof TRAITS)[number];

/** Where each is found (null: anywhere), and how common it is. */
const FITS: Record<Trait, {at: Position[] | null; weight: number}> = {
  poacher: {at: ["ST", "W", "AM"], weight: 3},
  playmaker: {at: ["CM", "AM", "DM", "W"], weight: 3},
  cool: {at: ["ST", "AM", "W", "CM"], weight: 2.5},
  engine: {at: ["CM", "DM", "FB", "W"], weight: 3},
  fragile: {at: null, weight: 1.2},
  steady: {at: null, weight: 2},
  late: {at: null, weight: 1.5},
};

/** The hand-made legends. */
const FIXED: Record<string, Trait[]> = {
  "legend-leon-dani": ["cool", "poacher"],
  "legend-theo-bergqvist": ["playmaker", "cool"],
};

function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

const memo = new Map<string, Trait[]>();

export function traitsOf(p: Pick<Player, "id" | "lookId" | "position">): Trait[] {
  const id = p.lookId ?? p.id;
  const key = `${id}|${p.position}`;
  const known = memo.get(key);
  if (known) return known;
  let out: Trait[];
  if (FIXED[id]) out = FIXED[id];
  else {
    const roll = hash(id + ":n") % 100;
    const count = roll < 35 ? 0 : roll < 80 ? 1 : 2;
    out = [];
    for (let i = 0; i < count; i++) {
      const pool = TRAITS.filter((t) => !out.includes(t) && (FITS[t].at === null || FITS[t].at!.includes(p.position)));
      const total = pool.reduce((s, t) => s + FITS[t].weight, 0);
      let x = (hash(`${id}:t${i}`) % 10_000) / 10_000 * total;
      const pick = pool.find((t) => (x -= FITS[t].weight) < 0) ?? pool[pool.length - 1];
      if (pick) out.push(pick);
    }
  }
  memo.set(key, out);
  return out;
}

export const hasTrait = (p: Pick<Player, "id" | "lookId" | "position">, t: Trait): boolean => traitsOf(p).includes(t);
