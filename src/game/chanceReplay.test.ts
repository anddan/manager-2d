// The replay draws each shot the way the engine decided it: a header comes from a cross, a ball in behind sets a forward free, a long shot
// is taken from outside the box and a close-range one from inside it.
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {simulateMatch} from "./match";
import {progressFor} from "./pitch";
import {Rng} from "./rng";
import type {Frame} from "./types";

describe("a chance is drawn as it was decided", () => {
  const game = newGame("Chances", 2, 9);
  const kinds: Record<string, {n: number; ok: number}> = {};
  const note = (kind: string, ok: boolean) => {
    const k = (kinds[kind] ??= {n: 0, ok: 0});
    k.n++;
    if (ok) k.ok++;
  };
  let shots = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const r = simulateMatch(structuredClone(game), new Rng(seed), game.fixtures[seed % game.fixtures.length], true);
    r.frames.forEach((f: Frame, i: number) => {
      if (!f.chance) return;
      shots++;
      const strike = r.frames[i - 1];
      const before = r.frames[i - 2];
      if (!strike) return;
      const depth = progressFor(strike.possession, strike.x);
      switch (f.chance) {
        case "header":
          // Met from a cross (or, with the ball already in front of goal, a header all the same from close in).
          note("header", strike.flight === "cross" || depth >= 85);
          break;
        case "cutback":
          note("cutback", strike.flight === "cross" || before?.flight === "cross" || depth >= 84);
          break;
        case "through":
          note("through", strike.flight === "through" || before?.flight === "through" || r.frames[i - 3]?.flight === "through" || depth >= 82);
          break;
        case "long":
          note("long", depth < 82);
          break;
        case "close":
          note("close", depth >= 88);
          break;
        case "box":
          note("box", depth >= 76 && depth <= 95);
          break;
      }
    });
  }

  it("has shots of every kind", () => {
    console.log("chances", shots, JSON.stringify(kinds));
    expect(shots).toBeGreaterThan(600);
    for (const kind of ["header", "cutback", "through", "long", "close", "box"]) expect(kinds[kind]?.n ?? 0).toBeGreaterThan(15);
    // Roughly a quarter to a third are from distance, headers about one in eight.
    const share = (k: string) => (kinds[k]?.n ?? 0) / shots;
    expect(share("long")).toBeGreaterThan(0.18);
    expect(share("long")).toBeLessThan(0.42);
    expect(share("header")).toBeGreaterThan(0.06);
    expect(share("header")).toBeLessThan(0.26);
  });

  it("draws each kind from where and how it should be", () => {
    // (A long shot is drawn from distance unless the ball already was deep in their half when the minute began: then it is taken from where it is.)
    for (const [kind, min] of [["header", 0.8], ["cutback", 0.7], ["through", 0.65], ["long", 0.8], ["close", 0.85], ["box", 0.9]] as const) {
      const k = kinds[kind];
      expect(k, kind).toBeDefined();
      expect(k.ok / k.n, `${kind}: ${k.ok} of ${k.n}`).toBeGreaterThanOrEqual(min);
    }
  });
});
