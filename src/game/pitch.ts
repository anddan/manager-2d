// Where players stand on the pitch. Shared by the match engine (to place
// passes) and the match viewer (to move the dots), so both agree.
//
// Coordinates are 0..100 on both axes from the home side's view: x runs from
// the home goal (0) to the away goal (100).
import type {Slot} from "./constants";
import {clamp} from "./rng";
import type {Side} from "./types";

export interface Point {
  x: number;
  y: number;
}

/** How far the ball is up the pitch from this side's point of view, 0..100. */
export function progressFor(side: Side, x: number): number {
  return side === "home" ? x : 100 - x;
}

/** Converts a point from a side's own view (attacking towards 100) to home view. */
export function fromSide(side: Side, depth: number, width: number): Point {
  return side === "home" ? {x: depth, y: width} : {x: 100 - depth, y: 100 - width};
}

/**
 * The spot a slot holds right now. The team moves up with the ball, spreads
 * wide when it has it and squeezes towards the ball when defending.
 */
export function teamSpot(slot: Slot, side: Side, ball: Point, inPossession: boolean): Point {
  const progress = progressFor(side, ball.x);
  const ballWidth = side === "home" ? ball.y : 100 - ball.y;
  let depth: number;
  let width: number;
  if (slot.pos === "GK") {
    depth = 4 + Math.max(0, progress - 50) * 0.1;
    width = 50 + (ballWidth - 50) * 0.15;
  } else if (inPossession) {
    depth = 10 + slot.x * 0.72 + (progress - 50) * 0.45;
    width = slot.y + (ballWidth - 50) * 0.18;
  } else {
    depth = 6 + slot.x * 0.62 + (progress - 50) * 0.32;
    width = 50 + (slot.y - 50) * 0.78 + (ballWidth - 50) * 0.25;
  }
  return fromSide(side, clamp(depth, 2, 96), clamp(width, 4, 96));
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
