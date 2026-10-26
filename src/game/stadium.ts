// The stadium: unlocked once the club has won the league. Four stands to build
// up (more seats), kiosks (fans spend at home matches) and a club shop (money
// every week). One project at a time, and each takes a few weeks.
import {addMessage, book} from "./helpers";
import type {Club, Fixture, GameState} from "./types";

export const STANDS = ["north", "south", "west", "east"] as const;
export type Stand = (typeof STANDS)[number];
export type StadiumPart = Stand | "kiosks" | "shop";

/** Seats each level of a stand adds: the long sides hold more than the ends. */
export const STAND_SEATS: Record<Stand, number> = {north: 3000, south: 3000, west: 2000, east: 2000};
export const STAND_MAX = 5;
/** Per seat; each level up costs more than the last. */
const SEAT_COST = 200;
export const KIOSK_MAX = 3;
const KIOSK_COST = [300_000, 550_000, 900_000];
/** What each fan spends at the kiosks per level, at a home match. */
export const KIOSK_SPEND = 1.5;
export const SHOP_MAX = 3;
const SHOP_COST = [500_000, 900_000, 1_400_000];
/** The club shop's takings each week, by level. */
export const SHOP_WEEKLY = [0, 25_000, 55_000, 90_000];
/** How long each kind of project takes, in weeks. */
export const BUILD_WEEKS = {stand: 3, kiosks: 1, shop: 2};

export interface StadiumState {
  stands: Record<Stand, number>;
  kiosks: number;
  shop: number;
  /** The capacity before any building. */
  base: number;
  /** What's being built, and how many weeks are left. */
  project?: {part: StadiumPart; weeksLeft: number};
}

/** The stadium page opens once the club has won the league. */
export function stadiumUnlocked(state: GameState): boolean {
  return state.history.some((h) => h.championId === state.userClubId);
}

export function ensureStadium(club: Club): StadiumState {
  club.stadium ??= {stands: {north: 0, south: 0, west: 0, east: 0}, kiosks: 0, shop: 0, base: club.capacity};
  return club.stadium;
}

export function stadiumCapacity(st: StadiumState): number {
  return st.base + STANDS.reduce((n, s) => n + st.stands[s] * STAND_SEATS[s], 0);
}

export function isStand(part: StadiumPart): part is Stand {
  return (STANDS as readonly string[]).includes(part);
}

export function partLevel(st: StadiumState, part: StadiumPart): number {
  return isStand(part) ? st.stands[part] : part === "kiosks" ? st.kiosks : st.shop;
}

export function partMax(part: StadiumPart): number {
  return isStand(part) ? STAND_MAX : part === "kiosks" ? KIOSK_MAX : SHOP_MAX;
}

/** What the next level of a part costs (undefined at the top). */
export function upgradeCost(st: StadiumState, part: StadiumPart): number | undefined {
  const level = partLevel(st, part);
  if (level >= partMax(part)) return undefined;
  if (isStand(part)) return STAND_SEATS[part] * SEAT_COST * (1 + level * 0.5);
  return (part === "kiosks" ? KIOSK_COST : SHOP_COST)[level];
}

export function buildWeeks(part: StadiumPart): number {
  return isStand(part) ? BUILD_WEEKS.stand : BUILD_WEEKS[part];
}

/** Starts building the next level of a part, paid now. An error key if it can't. */
export function startBuild(state: GameState, part: StadiumPart): string | null {
  if (!stadiumUnlocked(state)) return "stadium.locked";
  const club = state.clubs[state.userClubId];
  const st = ensureStadium(club);
  if (st.project) return "stadium.busy";
  const cost = upgradeCost(st, part);
  if (cost === undefined) return "stadium.max";
  if (club.cash < cost) return "stadium.noMoney";
  book(state, club.id, "construction", -cost);
  st.project = {part, weeksLeft: buildWeeks(part)};
  return null;
}

/**
 * A week at the stadium: building goes on (and opens when done), the kiosks
 * take money at a home match, and the shop every week. Before the week's
 * finances are closed.
 */
export function weeklyStadium(state: GameState, played: Fixture[]): void {
  const club = state.clubs[state.userClubId];
  const st = club.stadium;
  if (!st) return;
  if (st.project && --st.project.weeksLeft <= 0) {
    const part = st.project.part;
    if (isStand(part)) st.stands[part]++;
    else if (part === "kiosks") st.kiosks++;
    else st.shop++;
    st.project = undefined;
    club.capacity = stadiumCapacity(st);
    addMessage(state, {kind: "news", key: "msg.stadiumBuilt", params: {part: `stadium.part.${part}`, capacity: club.capacity}});
  }
  const home = played.find((f) => f.homeId === club.id && f.played);
  if (home && st.kiosks > 0) book(state, club.id, "matchday", Math.round((home.attendance ?? 0) * KIOSK_SPEND * st.kiosks));
  if (st.shop > 0) book(state, club.id, "matchday", SHOP_WEEKLY[st.shop]);
}
