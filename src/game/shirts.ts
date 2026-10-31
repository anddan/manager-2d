// Shirt numbers: every player has their own, and no two players of a club share one. Some players
// have a number they want (a favourite); a player who doesn't get it is a little unhappy.
import {overall} from "./ratings";
import type {GameState, Player, Position} from "./types";

/** The numbers usual for a position, best first. */
const USUAL: Record<Position, number[]> = {
  GK: [1, 12, 13, 22, 23],
  CB: [4, 5, 15, 2, 3, 24],
  FB: [2, 3, 12, 14, 15, 25],
  DM: [6, 4, 14, 8, 16],
  CM: [8, 6, 10, 14, 16, 18],
  AM: [10, 8, 7, 14, 17, 20],
  W: [7, 11, 17, 19, 21, 16],
  ST: [9, 10, 11, 18, 19, 20],
};

/** A number from an id, the same every time (no random numbers are used, so old saves fill in the same way). */
function hash(id: string): number {
  let h = 7;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  // Mixed well, so ids that follow each other don't give numbers that follow each other.
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** The number a player wants, if they care: about four in ten do, mostly a usual one for their position. */
export function wishFor(p: Player): number | undefined {
  const h = hash(p.id);
  if (h % 100 >= 40) return undefined;
  const usual = USUAL[p.position];
  // Mostly a usual number; now and then a lucky one of their own.
  return (h >>> 8) % 5 === 0 ? 2 + ((h >>> 12) % 98) : usual[(h >>> 4) % Math.min(3, usual.length)];
}

/** Whose number it is in a club (not counting `exceptId`). */
export function shirtHolder(state: GameState, clubId: string, n: number, exceptId?: string): Player | undefined {
  return Object.values(state.players).find((p) => p.clubId === clubId && p.shirt === n && p.id !== exceptId);
}

/**
 * Makes sure every player in a club has a number of their own: those who have one keep it (the first
 * keeps it if two share), the rest get the one they want if it is free, else a usual one for their position.
 */
export function fixShirts(state: GameState): void {
  const byClub = new Map<string, Player[]>();
  for (const p of Object.values(state.players)) {
    if (!p.clubId) continue;
    if (p.wantShirt === undefined && p.wishSet !== true) {
      p.wantShirt = wishFor(p);
      p.wishSet = true;
    }
    (byClub.get(p.clubId) ?? byClub.set(p.clubId, []).get(p.clubId)!).push(p);
  }
  for (const players of byClub.values()) {
    const taken = new Set<number>();
    const loose: Player[] = [];
    for (const p of [...players].sort((a, b) => a.id.localeCompare(b.id, undefined, {numeric: true}))) {
      if (p.shirt !== undefined && Number.isInteger(p.shirt) && p.shirt >= 1 && p.shirt <= 99 && !taken.has(p.shirt)) taken.add(p.shirt);
      else loose.push(p);
    }
    // The best players choose first.
    loose.sort((a, b) => overall(b) - overall(a));
    for (const p of loose) {
      const options = [p.wantShirt, ...USUAL[p.position], ...Array.from({length: 98}, (_, i) => i + 2), 1];
      const n = options.find((x): x is number => x !== undefined && x >= 1 && x <= 99 && !taken.has(x))!;
      p.shirt = n;
      taken.add(n);
    }
  }
}

/** Gives a player a number; if someone else in the club has it, they swap. An error key, or null. */
export function setShirt(state: GameState, playerId: string, n: number): string | null {
  const p = state.players[playerId];
  if (!p?.clubId || !Number.isInteger(n) || n < 1 || n > 99) return "shirt.bad";
  const other = shirtHolder(state, p.clubId, n, p.id);
  if (other && p.shirt !== undefined) other.shirt = p.shirt;
  p.shirt = n;
  return null;
}
