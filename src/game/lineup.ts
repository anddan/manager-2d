// Team selection: the AI's picks and checks on the user's lineup.
import {BENCH_SIZE, clubSlots, type Slot} from "./constants";
import {effectiveRating} from "./ratings";
import type {Club, GameState, Player, Position} from "./types";

export function isAvailable(p: Player): boolean {
  return p.injuryWeeks === 0 && p.suspension === 0;
}

/** Positions that can stand in for each other when there is nobody in the right one. */
const NEIGHBOURS: Record<Position, Position[]> = {
  GK: [],
  CB: ["FB", "DM"],
  FB: ["CB", "W"],
  DM: ["CM", "CB"],
  CM: ["DM", "AM"],
  AM: ["CM", "W", "ST"],
  W: ["AM", "FB", "ST"],
  ST: ["W", "AM"],
};

// Fill the hardest slots first so a lone keeper isn't used as a striker.
const SLOT_ORDER: Position[] = ["GK", "CB", "ST", "DM", "FB", "CM", "AM", "W"];

/** Best available eleven for the slots, plus a bench with a keeper if possible. */
export function pickBestLineup(
  state: GameState,
  club: Club,
  slots: Slot[]
): {lineup: string[]; bench: string[]} {
  const pool = Object.values(state.players).filter((p) => p.clubId === club.id && isAvailable(p));
  const used = new Set<string>();
  const lineup: string[] = new Array(slots.length).fill("");
  const order = slots
    .map((slot, i) => ({slot, i}))
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot.pos) - SLOT_ORDER.indexOf(b.slot.pos));
  // Three rounds over the whole eleven: players in their own position first, then a neighbouring
  // one (a centre-back at full-back, a holder in central midfield...), and only then anyone left.
  // So a midfielder only plays at the back when there is no defender to put there.
  const fits: ((p: Player, pos: Position) => boolean)[] = [
    (p, pos) => p.position === pos,
    (p, pos) => NEIGHBOURS[pos].includes(p.position),
    () => true,
  ];
  for (const fit of fits) {
    for (const {slot, i} of order) {
      if (lineup[i]) continue;
      let best: Player | undefined;
      let bestScore = -1;
      for (const p of pool) {
        if (used.has(p.id) || !fit(p, slot.pos)) continue;
        const score = effectiveRating(p, slot.pos);
        if (score > bestScore) {
          bestScore = score;
          best = p;
        }
      }
      if (best) {
        used.add(best.id);
        lineup[i] = best.id;
      }
    }
  }
  const rest = pool
    .filter((p) => !used.has(p.id))
    .sort((a, b) => effectiveRating(b, b.position) - effectiveRating(a, a.position));
  // One keeper on the bench is enough; the rest are outfield players (more
  // keepers only if there aren't enough of them).
  const bench: string[] = [];
  const keeper = rest.find((p) => p.position === "GK");
  if (keeper) bench.push(keeper.id);
  for (const p of [...rest.filter((p) => p.position !== "GK"), ...rest.filter((p) => p.position === "GK")]) {
    if (bench.length >= BENCH_SIZE) break;
    if (!bench.includes(p.id)) bench.push(p.id);
  }
  return {lineup, bench};
}

/** Problems with a lineup: empty slots or unavailable players. */
export function lineupProblems(state: GameState, club: Club): string[] {
  const slots = clubSlots(club);
  const problems: string[] = [];
  for (let i = 0; i < slots.length; i++) {
    const p = state.players[club.lineup[i]];
    if (!p || p.clubId !== club.id || !isAvailable(p)) problems.push(club.lineup[i] ?? "");
  }
  return problems;
}

/** Keeps the user's choices where possible and fills gaps with the best available. */
export function repairLineup(state: GameState, club: Club): boolean {
  const slots = clubSlots(club);
  const valid = (id: string | undefined) => {
    const p = id ? state.players[id] : undefined;
    return !!p && p.clubId === club.id && isAvailable(p);
  };
  let changed = false;
  const lineup = slots.map((_, i) => (valid(club.lineup[i]) ? club.lineup[i] : ""));
  // No duplicates.
  const seen = new Set<string>();
  for (let i = 0; i < lineup.length; i++) {
    if (lineup[i] && seen.has(lineup[i])) lineup[i] = "";
    if (lineup[i]) seen.add(lineup[i]);
  }
  if (lineup.some((id) => !id)) {
    const best = pickBestLineup(state, club, slots);
    const pool = best.lineup.concat(best.bench).filter((id) => !seen.has(id));
    for (let i = 0; i < lineup.length; i++) {
      if (lineup[i]) continue;
      // Prefer the best pick for this slot, else any free player.
      const candidate = !seen.has(best.lineup[i]) && best.lineup[i] ? best.lineup[i] : pool.find((id) => !seen.has(id));
      if (candidate) {
        lineup[i] = candidate;
        seen.add(candidate);
        changed = true;
      }
    }
  }
  const bench = club.bench.filter((id) => valid(id) && !seen.has(id));
  if (bench.length !== club.bench.length) changed = true;
  if (bench.length < BENCH_SIZE) {
    const extra = Object.values(state.players)
      .filter((p) => p.clubId === club.id && isAvailable(p) && !seen.has(p.id) && !bench.includes(p.id))
      .sort((a, b) => effectiveRating(b, b.position) - effectiveRating(a, a.position));
    for (const p of extra) {
      if (bench.length >= BENCH_SIZE) break;
      bench.push(p.id);
      changed = true;
    }
  }
  club.lineup = lineup;
  club.bench = bench;
  return changed;
}
