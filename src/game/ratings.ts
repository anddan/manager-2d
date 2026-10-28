// Overall rating, market value and wage levels. Everything that turns
// attributes into a single number lives here.
import {geared} from "./gear";
import {clubSlots} from "./constants";
import {clamp} from "./rng";
import type {Attribute, Club, GameState, Player, Position, SquadRole} from "./types";

/** How much each attribute counts per position. Each row sums to 1. */
export const POSITION_WEIGHTS: Record<Position, Partial<Record<Attribute, number>>> = {
  GK: {goalkeeping: 0.62, vision: 0.12, physical: 0.1, passing: 0.08, pace: 0.04, stamina: 0.04},
  CB: {defending: 0.38, physical: 0.2, pace: 0.1, vision: 0.12, passing: 0.1, stamina: 0.05, technique: 0.05},
  FB: {defending: 0.25, pace: 0.22, stamina: 0.15, passing: 0.14, physical: 0.08, technique: 0.08, vision: 0.08},
  DM: {defending: 0.26, passing: 0.2, vision: 0.18, physical: 0.14, stamina: 0.12, technique: 0.1},
  CM: {passing: 0.26, vision: 0.2, technique: 0.16, stamina: 0.14, defending: 0.1, physical: 0.08, finishing: 0.06},
  AM: {vision: 0.22, technique: 0.24, passing: 0.2, finishing: 0.16, pace: 0.1, stamina: 0.08},
  W: {pace: 0.26, technique: 0.24, passing: 0.14, finishing: 0.14, stamina: 0.12, vision: 0.1},
  ST: {finishing: 0.38, pace: 0.18, technique: 0.14, physical: 0.14, vision: 0.1, stamina: 0.06},
};

/** Positions a player can cover with a small penalty. */
const RELATED: Record<Position, Position[]> = {
  GK: [],
  CB: ["DM", "FB"],
  FB: ["W", "CB"],
  DM: ["CB", "CM"],
  CM: ["DM", "AM"],
  AM: ["CM", "W", "ST"],
  W: ["FB", "AM", "ST"],
  ST: ["AM", "W"],
};

/** Weighted attribute sum for a position, 1..100. */
export function ratingAt(player: Player, pos: Position): number {
  const weights = POSITION_WEIGHTS[pos];
  let sum = 0;
  for (const [attr, w] of Object.entries(weights) as [Attribute, number][]) {
    sum += player.attrs[attr] * w;
  }
  return sum;
}

/** The player's overall at their own position, rounded. */
export function overall(player: Player): number {
  return Math.round(ratingAt(player, player.position));
}

/** 1 at their own position, less elsewhere. */
export function familiarity(player: Player, pos: Position): number {
  if (player.position === pos) return 1;
  if (RELATED[player.position].includes(pos)) return 0.92;
  if (pos === "GK" || player.position === "GK") return 0.35;
  return 0.78;
}

/** Rating in a slot today, after condition, form and mood. */
/** How much form moves a player: ±18 % between the worst and the best form. */
export const FORM_EFFECT = 0.18;

export function effectiveRating(player: Player, pos: Position): number {
  // With their boots (or gloves) on: the bonus counts on the day, not in their own rating.
  const base = ratingAt(geared(player), pos) * familiarity(player, pos);
  const fitness = 0.75 + 0.25 * (player.fitness / 100);
  // Form counts a lot: from 18 % below their level in bad form to 18 % above in top form (none at average).
  const form = 1 + FORM_EFFECT * (player.form / 50 - 1);
  const morale = 0.95 + 0.1 * (player.morale / 100);
  const sharpness = 0.95 + 0.05 * (player.sharpness / 100);
  // Unhappy players don't give everything.
  const attitude = player.happiness < 30 ? 0.95 : 1;
  return base * fitness * form * morale * sharpness * attitude;
}

/** 13990 -> 14000: values and wages look nicer rounded. */
function roundNice(n: number): number {
  if (n >= 1_000_000) return Math.round(n / 50_000) * 50_000;
  if (n >= 100_000) return Math.round(n / 5_000) * 5_000;
  if (n >= 10_000) return Math.round(n / 500) * 500;
  return Math.round(n / 50) * 50;
}

/** Market value from quality, age, potential and contract. */
export function marketValue(player: Player, season: number): number {
  const ovr = overall(player);
  let value = 200_000 * Math.exp(0.12 * (ovr - 50));
  const room = Math.max(0, player.potential - ovr);
  if (player.age <= 23) value *= 1 + room * 0.035 * ((24 - player.age) / 6 + 0.5);
  if (player.age > 29) value *= Math.max(0.2, 1 - 0.13 * (player.age - 29));
  const yearsLeft = player.contract.expiresSeason - season;
  if (player.clubId) {
    if (yearsLeft <= 0) value *= 0.55;
    else if (yearsLeft === 1) value *= 0.85;
  }
  value *= 0.9 + 0.2 * (player.form / 100);
  return roundNice(Math.max(10_000, value));
}

/** What a player of this level expects to earn per week. */
export function expectedWage(player: Player): number {
  const ovr = overall(player);
  let wage = 1_600 * Math.exp(0.1 * (ovr - 50));
  if (player.age <= 20) wage *= 0.7;
  if (player.age >= 32) wage *= 0.85;
  return roundNice(Math.max(500, wage));
}

export function clubPlayers(state: GameState, clubId: string): Player[] {
  return Object.values(state.players).filter((p) => p.clubId === clubId);
}

/** Weekly wages the club pays, counting loan splits. */
export function wageBill(state: GameState, clubId: string): number {
  let total = 0;
  for (const p of Object.values(state.players)) {
    if (p.clubId === clubId) total += p.contract.wage * (p.loan ? p.loan.wageShare : 1);
    else if (p.loan?.parentClubId === clubId) total += p.contract.wage * (1 - p.loan.wageShare);
  }
  return Math.round(total);
}

/** The role a player's level earns them in this squad. */
export function deservedRole(state: GameState, player: Player, club: Club): SquadRole {
  const squad = clubPlayers(state, club.id).filter((p) => p.id !== player.id);
  const ovr = overall(player);
  const better = squad.filter((p) => overall(p) > ovr).length;
  if (player.age <= 19 && ovr < 58) return "youth";
  if (better < 11) return "key";
  if (better < 17) return "rotation";
  return "reserve";
}

/** Average overall of the best eleven, a quick club strength. */
export function clubStrength(state: GameState, clubId: string): number {
  const best = clubPlayers(state, clubId)
    .map(overall)
    .sort((a, b) => b - a)
    .slice(0, 11);
  if (best.length === 0) return 0;
  return best.reduce((s, n) => s + n, 0) / best.length;
}

/**
 * The team's overall: the starting eleven's rating in the slots they play,
 * like a player's OVR for the whole side. Falls back to the best eleven when
 * the lineup isn't complete.
 */
export function teamOvr(state: GameState, clubId: string): number {
  const club = state.clubs[clubId];
  const slots = clubSlots(club);
  const ratings = club.lineup
    .map((id, i) => {
      const p = state.players[id];
      // As shown on each player in the line-up: today's rating there (form, fitness, kit…).
      return p && p.clubId === clubId && slots[i] ? effectiveRating(p, slots[i].pos) : null;
    })
    .filter((r): r is number => r !== null);
  // The average over all eleven places on the pitch: an empty place counts as 0.
  return slots.length ? Math.round(ratings.reduce((s, n) => s + n, 0) / slots.length) : 0;
}

/** Club standing compared to the rest, used for attendance and transfer pull. */
export function reputationGap(a: Club, b: Club): number {
  return clamp(a.reputation - b.reputation, -50, 50);
}
