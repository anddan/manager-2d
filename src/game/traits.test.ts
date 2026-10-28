// Traits: a few per cent, from the player and nothing else.
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {effectiveRating} from "./ratings";
import {TRAITS, hasTrait, traitsOf} from "./traits";

describe("traits", () => {
  it("are the same every time, one or two at most, and fit the position", () => {
    const g = newGame("Traits", 3, 3);
    const players = Object.values(g.players);
    const counts = [0, 0, 0];
    for (const p of players) {
      const a = traitsOf(p);
      expect(traitsOf({...p})).toEqual(a);
      expect(a.length).toBeLessThanOrEqual(2);
      expect(new Set(a).size).toBe(a.length);
      counts[a.length]++;
      if (a.includes("poacher")) expect(["ST", "W", "AM"]).toContain(p.position);
    }
    // Mostly none or one; every trait turns up somewhere.
    expect(counts[0] / players.length).toBeGreaterThan(0.25);
    expect(counts[2] / players.length).toBeLessThan(0.3);
    for (const t of TRAITS) expect(players.some((p) => hasTrait(p, t)), t).toBe(true);
  }, 30_000);

  it("move a rating only a few per cent", () => {
    const g = newGame("Traits", 3, 3);
    const steady = Object.values(g.players).find((p) => hasTrait(p, "steady"))!;
    steady.form = 100;
    const withTrait = effectiveRating(steady, steady.position);
    const plain = effectiveRating({...steady, id: "someone-else-without", lookId: "zzz-nobody-1"} as typeof steady, steady.position);
    expect(Math.abs(withTrait - plain) / plain).toBeLessThan(0.06);
  }, 30_000);

  it("keep the legends' own", () => {
    expect(traitsOf({id: "legend-leon-dani", position: "ST"})).toEqual(["cool", "poacher"]);
  });
});
