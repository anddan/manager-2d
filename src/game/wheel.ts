// The lucky wheel: one free spin a calendar day (and one more for watching a video). It stops on one of
// twelve places: club money, diamonds, a player pack or a piece of kit. The prize is paid out at once;
// a pack that finds the squad full pays its price in diamonds instead.
import {collectGear} from "./album";
import {PLAYER_PACKS, openPack, type PlayerPackId} from "./packs";
import {rollGearPack, type GearItem} from "./gear";
import {book} from "./helpers";
import type {Rng} from "./rng";
import type {GameState} from "./types";

export type WheelPrize =
  | {kind: "money"; amount: number}
  | {kind: "diamonds"; amount: number}
  | {kind: "pack"; pack: PlayerPackId}
  | {kind: "kit"; gold?: boolean; special?: boolean};

export interface WheelPlace {
  prize: WheelPrize;
  /** How often it comes up, against the others. */
  weight: number;
}

/** The twelve places, in order round the wheel (the rare ones spread out). */
export const WHEEL: WheelPlace[] = [
  {prize: {kind: "money", amount: 250_000}, weight: 16},
  {prize: {kind: "diamonds", amount: 10}, weight: 18},
  {prize: {kind: "pack", pack: "bronze"}, weight: 12},
  {prize: {kind: "kit"}, weight: 12},
  {prize: {kind: "money", amount: 1_000_000}, weight: 10},
  {prize: {kind: "diamonds", amount: 25}, weight: 9},
  {prize: {kind: "pack", pack: "silver"}, weight: 6},
  {prize: {kind: "kit", gold: true}, weight: 4},
  {prize: {kind: "diamonds", amount: 60}, weight: 3},
  {prize: {kind: "pack", pack: "gold"}, weight: 3},
  {prize: {kind: "money", amount: 5_000_000}, weight: 2},
  {prize: {kind: "pack", pack: "special"}, weight: 1},
];

/** The spins of a day: one free, one more for a video. */
export const WHEEL_FREE = 1;
export const WHEEL_VIDEO = 1;

export interface WheelState {
  day: string;
  used: number;
}

/** What is left today: a free spin, a spin for a video. */
export function wheelStatus(state: GameState, today: string): {free: boolean; video: boolean} {
  const used = state.wheel?.day === today ? state.wheel.used : 0;
  return {free: used < WHEEL_FREE, video: used >= WHEEL_FREE && used < WHEEL_FREE + WHEEL_VIDEO};
}

/** What a prize gave. */
export interface PrizeResult {
  prize: WheelPrize;
  /** A new player from a pack. */
  playerId?: string;
  gear?: GearItem;
  /** A pack that found the squad full: its price in diamonds instead. */
  diamonds?: number;
}

export interface WheelResult extends PrizeResult {
  index: number;
}

/** Pays a prize out at once: money, diamonds, a piece of kit in the bag, or a pack opened (its price in diamonds if the squad is full). */
export function grantPrize(state: GameState, rng: Rng, prize: WheelPrize, category: "wheel" | "reward" = "wheel"): PrizeResult {
  const m = state.monetization;
  if (prize.kind === "money") {
    book(state, state.userClubId, category, prize.amount);
    return {prize};
  }
  if (prize.kind === "diamonds") {
    m.diamonds += prize.amount;
    return {prize};
  }
  if (prize.kind === "kit") {
    const item = rollGearPack(rng);
    if (prize.special) item.tier = "special";
    else if (prize.gold && (item.tier === "common" || item.tier === "silver")) item.tier = "gold";
    (state.gearBag ??= []).push(item);
    collectGear(state, item);
    return {prize, gear: item};
  }
  // A pack is on the house: give its price, then open it (the price stays as diamonds if there is no room).
  const price = PLAYER_PACKS[prize.pack].price;
  m.diamonds += price;
  const res = openPack(state, rng, prize.pack);
  if ("error" in res) return {prize, diamonds: price};
  return {prize, playerId: res.playerId, gear: res.gear};
}

/** Spins the wheel. `video`: this is the extra spin for a video. An error key if there is none left. */
export function spinWheel(state: GameState, rng: Rng, today: string, video: boolean): WheelResult | {error: string} {
  const status = wheelStatus(state, today);
  if (!(video ? status.video : status.free)) return {error: "wheel.none"};
  state.wheel = {day: today, used: (state.wheel?.day === today ? state.wheel.used : 0) + 1};
  const index = WHEEL.indexOf(rng.weighted(WHEEL, (w) => w.weight));
  return {index, ...grantPrize(state, rng, WHEEL[index].prize)};
}
