// The guide for new players: which step they're on, and a first match picked
// to show off the game (a penalty to take, and a win).
import {simulateMatch} from "./match";
import {Rng} from "./rng";
import type {Fixture, GameState, Side} from "./types";

/** The guide's steps, in order (the UI has the words and what moves each one on). */
export const TUTORIAL_STEPS = ["welcome", "tactics", "bestXI", "lineup", "formation", "play", "match", "orders", "setpieces", "zoom", "talk", "daily"] as const;
export type TutorialStep = (typeof TUTORIAL_STEPS)[number];

export interface Tutorial {
  /** Index into TUTORIAL_STEPS; past the end means done. */
  step: number;
  /** The first match has been picked (only once). */
  firstMatch?: boolean;
}

/** Moves the guide on from a step (only if it's on that step). */
export function tutorialNext(state: GameState, from: TutorialStep): void {
  const t = state.tutorial;
  if (t && TUTORIAL_STEPS[t.step] === from) t.step++;
}

export function tutorialSkip(state: GameState): void {
  if (state.tutorial) state.tutorial.step = TUTORIAL_STEPS.length;
}

/**
 * A seed for the guide's first match: one where the user's side gets a
 * penalty and wins (with the computer taking it; the user may do better or
 * worse). Tried on copies, so nothing in the game changes. Falls back to the
 * seed given if none of the tries works out.
 */
export function tutorialMatchSeed(state: GameState, fixture: Fixture, side: Side, fallback: number): number {
  for (let k = 0; k < 60; k++) {
    const seed = (fallback + k * 7919) % (2 ** 31 - 1) || 1;
    const r = simulateMatch(structuredClone(state), new Rng(seed), fixture, false, {}, [], side);
    const ours = side === "home" ? r.homeGoals : r.awayGoals;
    const theirs = side === "home" ? r.awayGoals : r.homeGoals;
    const penalty = r.setPieces?.some((sp) => sp.side === side && sp.kind === "penalty");
    if (penalty && ours > theirs) return seed;
  }
  return fallback;
}
