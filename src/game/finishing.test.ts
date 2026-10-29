// The build-up leads to whoever takes the shot: a player standing free in front of goal doesn't
// play it back to someone else (it used to happen in about 7 % of shots), and it never changes the result.
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {simulateMatch} from "./match";
import {progressFor} from "./pitch";
import {Rng} from "./rng";

describe("finishing", () => {
  it("rarely has a free player in front of goal pass it back to the shooter", () => {
    let shots = 0;
    let backPasses = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const g = newGame("Finish", 3, seed);
      const fixture = g.fixtures.find((f) => !f.played)!;
      const frames = simulateMatch(g, new Rng(seed), fixture, true).frames ?? [];
      for (let i = 2; i < frames.length; i++) {
        if (!["goal", "save", "out", "nogoal"].includes(frames[i].kind ?? "")) continue;
        shots++;
        for (let j = i - 1; j >= Math.max(1, i - 3); j--) {
          if (frames[j].kind !== "pass") continue;
          const before = frames[j - 1];
          if (!before || before.possession !== frames[j].possession || !before.playerId || before.playerId === frames[j].playerId) break;
          const side = frames[j].possession!;
          const width = side === "home" ? before.y : 100 - before.y;
          if (frames[j].flight !== "cross" && progressFor(side, before.x) > 74 && width > 22 && width < 78 && progressFor(side, frames[j].x) < progressFor(side, before.x) - 1) backPasses++;
          break;
        }
      }
    }
    expect(shots).toBeGreaterThan(500);
    expect(backPasses).toBe(0);
  }, 120_000);

  it("gives the same result whether or not the match is drawn", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const g = newGame("Same", 3, seed);
      const fixture = g.fixtures.find((f) => !f.played)!;
      const a = simulateMatch(structuredClone(g), new Rng(seed), fixture, false);
      const b = simulateMatch(structuredClone(g), new Rng(seed), fixture, true);
      expect([b.homeGoals, b.awayGoals]).toEqual([a.homeGoals, a.awayGoals]);
      expect(b.events.map((e) => `${e.minute}${e.type}${e.playerId ?? ""}`)).toEqual(a.events.map((e) => `${e.minute}${e.type}${e.playerId ?? ""}`));
    }
  }, 120_000);
});
