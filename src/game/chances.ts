// What a shot is worth. Every chance has a kind and a place on the pitch, and how likely it is to go in (its xG, expected goals) follows from
// those: from how far out, at what angle to the goal, and how it came about (a header is harder than a shot with the foot, a ball in
// behind that leaves the forward alone with the keeper is easier). The match engine decides the shot first, from the situation, and what comes
// of it from this number and the shooter and keeper; the replay then draws the shot from where the chance was.
import type {Position} from "./types";
import {clamp, type Rng} from "./rng";

export type ChanceKind = "close" | "box" | "cutback" | "through" | "header" | "long";

export interface Chance {
  kind: ChanceKind;
  /** Where it is struck from, in the attacking side's own view: depth 100 is the goal line, width 50 the middle. */
  depth: number;
  width: number;
  /** How likely it is to be a goal for an average shooter against an average keeper. */
  xg: number;
}

/** The pitch is 105 x 68 m; depth and width run 0..100. The goal is 7.32 m wide. */
const LENGTH = 105;
const WIDTH = 68;
const POST = 3.66;

/** The distance (m) and the angle (radians) the goal is seen at from a place on the pitch. */
export function goalView(depth: number, width: number): {dist: number; angle: number} {
  const dx = Math.max(0.5, (100 - depth) * (LENGTH / 100));
  const dy = (width - 50) * (WIDTH / 100);
  const angle = Math.abs(Math.atan2(POST - dy, dx) - Math.atan2(-POST - dy, dx));
  return {dist: Math.hypot(dx, dy), angle};
}

const KIND_FACTOR: Record<ChanceKind, number> = {close: 1, box: 1, cutback: 1.3, through: 2.3, header: 0.58, long: 1};

/** xG of a shot from a place, by how it came about (fitted so that 6 m straight on is about 0.35, the penalty spot about 0.13 and 25 m about 0.025). */
export function chanceXg(kind: ChanceKind, depth: number, width: number): number {
  const {dist, angle} = goalView(depth, width);
  const logit = -0.99 - 0.118 * dist + 1.0 * angle;
  const base = 1 / (1 + Math.exp(-logit));
  return clamp(base * KIND_FACTOR[kind], 0.005, 0.85);
}

const RANGES: Record<ChanceKind, {depth: [number, number]; width: [number, number]}> = {
  close: {depth: [93, 98], width: [41, 59]},
  box: {depth: [84, 93], width: [28, 72]},
  cutback: {depth: [85, 91], width: [36, 64]},
  through: {depth: [83, 91], width: [34, 66]},
  header: {depth: [88, 95], width: [37, 63]},
  long: {depth: [63, 77], width: [24, 76]},
};

/**
 * The chance a shot comes from. `ratio` is the attack's strength against the defence it meets (above 1 the side makes better chances: fewer
 * from distance, more of them from close in and in behind), `pos` the shooter's position (a striker is in the box, a midfielder shoots from
 * further out and a defender mostly heads it in).
 */
export function pickChance(rng: Rng, ratio: number, pos: Position | undefined, style = 0): Chance {
  const r = clamp(ratio, 0.6, 1.8);
  const striker = pos === "ST";
  const wide = pos === "W" || pos === "AM";
  const back = pos === "CB" || pos === "FB" || pos === "DM";
  // Telling a side to shoot more means more tries from distance; less, only the clear chances.
  const longBias = style > 0 ? 1.35 : style < 0 ? 0.7 : 1;
  const weights: Record<ChanceKind, number> = {
    long: 29 * longBias * (striker ? 0.5 : back ? 1.9 : pos === "CM" ? 1.3 : 1) / r ** 0.9,
    box: 34,
    header: 14 * (striker ? 1.4 : back ? 1.6 : 1),
    cutback: 7 * r ** 0.5 * (wide ? 1.4 : striker ? 0.8 : 1),
    through: 7 * r ** 0.8 * (striker ? 1.7 : wide ? 1.1 : 0.6),
    close: 6 * r ** 0.7 * (striker ? 1.8 : back ? 0.4 : 1),
  };
  const kinds = Object.keys(weights) as ChanceKind[];
  const kind = rng.weighted(kinds, (k) => weights[k]);
  const range = RANGES[kind];
  const depth = rng.range(range.depth[0], range.depth[1]);
  const width = rng.range(range.width[0], range.width[1]);
  return {kind, depth, width, xg: chanceXg(kind, depth, width)};
}
