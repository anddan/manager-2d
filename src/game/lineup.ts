// Team selection: the AI's picks and checks on the user's lineup.
import {BENCH_SIZE, clubSlots, type Slot} from "./constants";
import {effectiveRating} from "./ratings";
import type {Club, GameState, Player, Position} from "./types";

export function isAvailable(p: Player): boolean {
  return p.injuryWeeks === 0 && p.suspension === 0;
}

/** Positions that can stand in for each other when there is nobody in the right one. */
export const NEIGHBOURS: Record<Position, Position[]> = {
  GK: [],
  CB: ["FB", "DM"],
  FB: ["CB", "W"],
  DM: ["CM", "CB"],
  CM: ["DM", "AM"],
  AM: ["CM", "W", "ST"],
  W: ["AM", "FB", "ST"],
  ST: ["W", "AM"],
};

/** The three lines (and the keeper): a forward can play out wide, a holder in midfield, without losing much. */
const LINE: Record<Position, "gk" | "back" | "mid" | "front"> = {GK: "gk", CB: "back", FB: "back", DM: "mid", CM: "mid", AM: "mid", W: "front", ST: "front"};

/** How well a player fits a place, on top of the rating there: in the same line fully, a neighbour a little less, another line much less, a keeper only in goal. */
function suitability(p: Player, pos: Position): number {
  if (p.position === pos) return 1;
  if (pos === "GK" || p.position === "GK") return 0.05;
  // Same line: a small step down, so it only happens when the other is clearly the better pick.
  if (LINE[p.position] === LINE[pos]) return 0.95;
  if (NEIGHBOURS[pos].includes(p.position)) return 0.88;
  return 0.6;
}

/**
 * The assignment of players to places with the highest total (the Hungarian method): rows are the
 * places, columns the players (with as many empty ones as there are places, so a short squad leaves
 * places empty). Returns each place's column.
 */
function bestAssignment(score: number[][]): number[] {
  const n = score.length;
  const m = score[0]?.length ?? 0;
  const INF = 1e9;
  const u = new Array(n + 1).fill(0);
  const v = new Array(m + 1).fill(0);
  const p = new Array(m + 1).fill(0);
  const way = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(m + 1).fill(INF);
    const used = new Array(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF;
      let j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = -score[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const out = new Array(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) out[p[j] - 1] = j - 1;
  return out;
}

/** Best available eleven for the slots, plus a bench with a keeper if possible. */
export function pickBestLineup(
  state: GameState,
  club: Club,
  slots: Slot[]
): {lineup: string[]; bench: string[]} {
  const pool = Object.values(state.players).filter((p) => p.clubId === club.id && isAvailable(p));
  const used = new Set<string>();
  const lineup: string[] = new Array(slots.length).fill("");
  // Every place weighed against every player at once: a 100 forward on the bench plays out wide
  // before a 58 winger does, and a good holder plays in central midfield before a weak one.
  const score = slots.map((slot) => [...pool.map((p) => effectiveRating(p, slot.pos) * suitability(p, slot.pos)), ...slots.map(() => 0)]);
  const chosen = bestAssignment(score);
  chosen.forEach((col, i) => {
    if (col >= 0 && col < pool.length) {
      lineup[i] = pool[col].id;
      used.add(pool[col].id);
    }
  });
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
