// The weekly spending packages: the more diamonds and club money are spent in a week, the more levels of the
// package open up, and each level lets the manager pick one reward from a few (a pack, kit, diamonds or money).
// A point is a diamond spent, or 100 000 of club money. It starts again every Monday.
import type {Rng} from "./rng";
import {grantPrize, type PrizeResult, type WheelPrize} from "./wheel";
import type {GameState} from "./types";

export interface SpendTier {
  /** The points needed this week. */
  points: number;
  /** What can be picked from. */
  choices: WheelPrize[];
}

export const SPEND_TIERS: SpendTier[] = [
  {points: 50, choices: [{kind: "pack", pack: "bronze"}, {kind: "diamonds", amount: 15}, {kind: "money", amount: 500_000}]},
  {points: 200, choices: [{kind: "pack", pack: "silver"}, {kind: "kit"}, {kind: "diamonds", amount: 40}, {kind: "money", amount: 2_000_000}]},
  {points: 400, choices: [{kind: "pack", pack: "gold"}, {kind: "kit", gold: true}, {kind: "diamonds", amount: 100}, {kind: "money", amount: 6_000_000}]},
  {points: 1000, choices: [{kind: "pack", pack: "special"}, {kind: "kit", special: true}, {kind: "diamonds", amount: 250}, {kind: "money", amount: 20_000_000}]},
];

/** Club money per point. */
export const MONEY_PER_POINT = 100_000;

export interface Spending {
  /** The Monday (YYYY-MM-DD) of the week these are for. */
  week: string;
  points: number;
  /** Levels already picked from. */
  claimed: number[];
  /** What was picked at each level (the place in its list of choices). */
  picks?: Record<number, number>;
}

/** The Monday of the week a day (YYYY-MM-DD) is in. */
export function weekStart(day: string): string {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export const thisWeek = (): string => weekStart(new Date().toISOString().slice(0, 10));

/** This week's spending (a fresh one if the last was another week); nothing is changed. */
export function spendingOf(state: GameState, week: string): Spending {
  return state.spending?.week === week ? state.spending : {week, points: 0, claimed: []};
}

/** Counts what was just spent towards this week's package. */
export function addSpending(state: GameState, week: string, diamonds: number, money: number): void {
  const add = Math.max(0, diamonds) + Math.floor(Math.max(0, money) / MONEY_PER_POINT);
  if (add <= 0) return;
  const s = spendingOf(state, week);
  state.spending = {...s, points: s.points + add};
}

/** The levels open and not picked from yet. */
export function openTiers(state: GameState, week: string): number[] {
  const s = spendingOf(state, week);
  return SPEND_TIERS.flatMap((tier, i) => (s.points >= tier.points && !s.claimed.includes(i) ? [i] : []));
}

/** Picks a reward from a level. An error key if the level isn't open. */
export function claimSpending(state: GameState, rng: Rng, week: string, tier: number, choice: number): PrizeResult | {error: string} {
  const prize = SPEND_TIERS[tier]?.choices[choice];
  if (!prize || !openTiers(state, week).includes(tier)) return {error: "spend.notOpen"};
  const s = spendingOf(state, week);
  state.spending = {...s, claimed: [...s.claimed, tier], picks: {...s.picks, [tier]: choice}};
  return grantPrize(state, rng, prize, "reward");
}
