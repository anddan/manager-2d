// Penalties and free kicks near the box. These are the moments the user can
// take over: aim the shot, or pick which way the keeper dives.
//
// Goal coordinates, seen from the taker: x runs from the left post (-1) to the
// right post (1), y from the ground (0) to the crossbar (1). Outside that is a miss.
import {clamp, type Rng} from "./rng";
import type {Player, Side} from "./types";

/** Per minute, scaled by how much the attack dominates. About 0.25 penalties a match. */
export const PENALTY_RATE = 0.0028;
/** About 0.7 dangerous free kicks a match. */
export const FREEKICK_RATE = 0.0075;

export type SetPieceKind = "penalty" | "freekick";

export interface Aim {
  x: number;
  y: number;
}

/** What the user chose. Missing parts are decided automatically. */
export interface SetPieceInput {
  aim?: Aim;
  dive?: number;
}

export interface SetPiece {
  /** Order within the match, used to store the user's input. */
  index: number;
  kind: SetPieceKind;
  minute: number;
  side: Side;
  takerId: string;
  keeperId?: string;
  /** Which side of the goal the wall covers on free kicks: -1 left, 1 right. */
  wallSide: -1 | 1;
}

export type SetPieceResult = "goal" | "saved" | "missed" | "blocked";

export interface SetPieceOutcome {
  result: SetPieceResult;
  /** Where the ball actually went. */
  shot: Aim;
  /** Where the keeper went. */
  dive: number;
}

/** The part of the goal mouth the wall covers, on the wall side. */
export const WALL = {inner: 0.1, outer: 0.85, height: 0.6};

/** Composite shooting skill for a kind of set piece, 1..100. */
export function takerSkill(p: Player, kind: SetPieceKind): number {
  const a = p.attrs;
  return kind === "penalty"
    ? a.finishing * 0.6 + a.technique * 0.2 + a.vision * 0.2
    : a.technique * 0.5 + a.finishing * 0.3 + a.passing * 0.2;
}

/** How far a shot strays from the aim (standard deviation in goal units). */
export function shotSpread(p: Player, kind: SetPieceKind): number {
  const skill = takerSkill(p, kind);
  return kind === "penalty" ? 0.07 + (100 - skill) * 0.0035 : 0.14 + (100 - skill) * 0.005;
}

/** How far the keeper reaches from where they dive, in goal units. */
export function keeperReach(keeper: Player | undefined, kind: SetPieceKind): number {
  const gk = keeper?.attrs.goalkeeping ?? 20;
  return (kind === "penalty" ? 0.2 : 0.3) + (gk / 100) * 0.3;
}

/** The best taker on the pitch for this kind of set piece. */
export function pickTaker(players: Player[], kind: SetPieceKind): Player | undefined {
  return players
    .filter((p) => p.position !== "GK")
    .sort((a, b) => takerSkill(b, kind) - takerSkill(a, kind))[0];
}

/**
 * Resolves a set piece. Every call draws the same random numbers whatever the
 * input, so the user's choice doesn't reshuffle the rest of the match.
 */
export function resolveSetPiece(
  rng: Rng,
  sp: SetPiece,
  input: SetPieceInput | null,
  taker: Player,
  keeper: Player | undefined
): SetPieceOutcome {
  const noiseX = rng.normal();
  const noiseY = rng.normal();
  const corner = rng.next();
  const height = rng.next();
  const guess = rng.next();
  const save = rng.next();

  // The computer's aim: corners mostly, around the wall on free kicks.
  let autoAim: Aim;
  if (sp.kind === "penalty") {
    autoAim = corner < 0.15
      ? {x: (corner - 0.075) * 2.5, y: 0.2 + height * 0.5}
      : {x: (corner < 0.575 ? -1 : 1) * (0.45 + height * 0.4), y: 0.1 + height * 0.65};
  } else if (corner < 0.35) {
    // Over the wall into the near side.
    autoAim = {x: sp.wallSide * (0.35 + corner), y: 0.68 + height * 0.25};
  } else {
    autoAim = {x: -sp.wallSide * (0.3 + (corner - 0.35) * 0.8), y: 0.3 + height * 0.5};
  }
  const aim = input?.aim ?? autoAim;

  const spread = shotSpread(taker, sp.kind);
  const shot: Aim = {x: aim.x + noiseX * spread, y: Math.max(0.02, aim.y + noiseY * spread * 0.8)};

  // Penalty keepers guess; on free kicks they see it coming and react.
  const gk = keeper?.attrs.goalkeeping ?? 20;
  const autoDive = sp.kind === "penalty"
    ? guess < 0.42 ? -0.6 : guess < 0.84 ? 0.6 : 0
    : shot.x + (guess - 0.5) * 2 * (0.25 + (1 - gk / 100) * 0.5);
  const dive = clamp(input?.dive ?? autoDive, -1.2, 1.2);

  if (Math.abs(shot.x) > 1 || shot.y > 1) return {result: "missed", shot, dive};
  if (sp.kind === "freekick") {
    const inWall = shot.x * sp.wallSide >= WALL.inner && shot.x * sp.wallSide <= WALL.outer;
    if (inWall && shot.y < WALL.height) return {result: "blocked", shot, dive};
  }

  let reach = keeperReach(keeper, sp.kind);
  if (shot.y > 0.7) reach *= 0.85;
  const gap = Math.abs(shot.x - dive);
  let pSave = 0.02;
  if (gap < reach) {
    // Shots right in the corners are hard to keep out even when guessed.
    const cornerFactor = clamp(1 - Math.max(0, Math.abs(shot.x) - 0.75) * 1.5, 0.3, 1);
    // Penalties are struck harder from closer, so even a right guess often isn't enough.
    const hands = (sp.kind === "penalty" ? 0.3 : 0.62) + gk / 250;
    pSave = (1 - gap / reach) ** 0.8 * hands * cornerFactor;
  }
  // A low shot down the middle hits the keeper's legs even when they dive.
  if (Math.abs(shot.x) < 0.3 && shot.y < 0.4) pSave = Math.max(pSave, 0.35);
  return {result: save < pSave ? "saved" : "goal", shot, dive};
}
