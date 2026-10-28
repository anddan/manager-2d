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
export const SHOP_MAX = 3;
const SHOP_COST = [500_000, 900_000, 1_400_000];
/**
 * What the kiosks and the club shop sell, each at a price the manager sets (a fair one to start).
 * The dearer it is, the fewer buy: just above fair brings in the most, far above it next to nothing.
 */
export const SALE_ITEMS = ["hotdog", "drink", "scarf", "shirt"] as const;
export type SaleItem = (typeof SALE_ITEMS)[number];
export const ITEM_FAIR: Record<SaleItem, number> = {hotdog: 4, drink: 3, scarf: 15, shirt: 60};
export const ITEM_PART: Record<SaleItem, "kiosks" | "shop"> = {hotdog: "kiosks", drink: "kiosks", scarf: "shop", shirt: "shop"};
/** Of the fans at a home match, the share buying each kiosk item (at a fair price), by kiosk level. */
const KIOSK_SHARE = [0, 0.22, 0.4, 0.58];
/** Shirts and scarves sold a week (at a fair price), by shop level. */
const SHOP_BUYERS: Record<"scarf" | "shirt", number[]> = {scarf: [0, 1200, 2200, 3200], shirt: [0, 150, 350, 550]};

export function itemPrice(st: StadiumState, item: SaleItem): number {
  return st.prices?.[item] ?? ITEM_FAIR[item];
}

/** How many buy at a price, against how many would at a fair one (1 at fair, 0 at 2.7 times it). */
export function priceDemand(item: SaleItem, price: number): number {
  return Math.max(0, Math.min(1.6, 1.6 - (0.6 * price) / ITEM_FAIR[item]));
}

/** What one item brings in: at the kiosks per home match (from the crowd), at the shop per week. */
export function itemTakings(st: StadiumState, item: SaleItem, attendance: number, level = ITEM_PART[item] === "kiosks" ? st.kiosks : st.shop): number {
  const price = itemPrice(st, item);
  const buyers = ITEM_PART[item] === "kiosks" ? attendance * (KIOSK_SHARE[level] ?? 0) : SHOP_BUYERS[item as "scarf" | "shirt"][level] ?? 0;
  return Math.round(buyers * priceDemand(item, price) * price);
}

/** The kiosks' takings at a home match. */
export function kioskTakings(st: StadiumState, attendance: number, level = st.kiosks): number {
  return itemTakings(st, "hotdog", attendance, level) + itemTakings(st, "drink", attendance, level);
}

/** The shop's takings for a week. */
export function shopTakings(st: StadiumState, level = st.shop): number {
  return itemTakings(st, "scarf", 0, level) + itemTakings(st, "shirt", 0, level);
}

/** Sets an item's price (from a fifth of fair up to three times it). */
export function setItemPrice(state: GameState, item: SaleItem, price: number): void {
  const st = ensureStadium(state.clubs[state.userClubId]);
  const fair = ITEM_FAIR[item];
  st.prices = {...st.prices, [item]: Math.max(Math.ceil(fair / 5), Math.min(fair * 3, Math.round(price)))};
}

/** How long each kind of project takes, in weeks. */
export const BUILD_WEEKS = {stand: 3, kiosks: 1, shop: 2};

export interface StadiumState {
  stands: Record<Stand, number>;
  kiosks: number;
  shop: number;
  /** The capacity before any building. */
  base: number;
  /** The kiosks' and the shop's prices (missing: a fair one). */
  prices?: Partial<Record<SaleItem, number>>;
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
  if (home && st.kiosks > 0) book(state, club.id, "matchday", kioskTakings(st, home.attendance ?? 0));
  if (st.shop > 0) book(state, club.id, "matchday", shopTakings(st));
}
