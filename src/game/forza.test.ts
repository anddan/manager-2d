// "Forza!": the manager fires up the team for a while (free once a match, then for energy).
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {FORZA, forzaLift, simulateMatch} from "./match";
import {Rng} from "./rng";
import type {MatchCommand} from "./types";

describe("Forza!", () => {
  const game = newGame("Forza", 3, 11);
  const fixture = game.fixtures.find((f) => f.homeId === game.userClubId)!;

  it("counts every shout, but not one on top of one that's still going", () => {
    const commands: MatchCommand[] = [{minute: 10, type: "forza"}, {minute: 15, type: "forza"}, {minute: 40, type: "forza"}, {minute: 70, type: "forza"}];
    const r = simulateMatch(structuredClone(game), new Rng(3), fixture, false, {}, commands, "home");
    // Minute 15 is still inside the first one's ten minutes.
    expect(r.events.filter((e) => e.type === "instruction" && e.note === "forza").map((e) => e.minute)).toEqual([10, 40, 70]);
  });

  it("only counts for the managed side", () => {
    const r = simulateMatch(structuredClone(game), new Rng(3), fixture, false, {}, [{minute: 10, type: "forza"}]);
    expect(r.events.some((e) => e.note === "forza")).toBe(false);
  });

  it("lifts the team a little, for ten minutes from when it's shouted", () => {
    expect(FORZA.boost).toBeGreaterThan(1);
    expect(FORZA.boost).toBeLessThanOrEqual(1.25);
    const until = 10 + FORZA.minutes;
    expect(forzaLift(until, 10)).toBe(FORZA.boost);
    expect(forzaLift(until, until - 1)).toBe(FORZA.boost);
    expect(forzaLift(until, until)).toBe(1);
    expect(forzaLift(0, 5)).toBe(1);
  });

  it("puts nearly every shot on target while it lasts", () => {
    let shots = 0;
    let onTarget = 0;
    for (let seed = 1; seed <= 40; seed++) {
      // Fired up the whole match, a shout every ten minutes.
      const commands: MatchCommand[] = Array.from({length: 10}, (_, i) => ({minute: 1 + i * 10, type: "forza" as const}));
      const r = simulateMatch(structuredClone(game), new Rng(seed), fixture, false, {}, commands, "home");
      shots += r.shots[0];
      onTarget += r.onTarget[0];
    }
    expect(onTarget / shots).toBeGreaterThan(0.85);
  });

  it("lets the opponent fire up in big matches when they're not ahead, once", () => {
    const g = structuredClone(game);
    // A clash at the top: the opponent's name makes it a big match.
    const away = g.clubs[fixture.awayId];
    away.reputation = g.clubs[fixture.homeId].reputation + 60;
    let fired = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const r = simulateMatch(structuredClone(g), new Rng(seed), fixture, false, {}, [], "home");
      const theirs = r.events.filter((e) => e.note === "forzaRival");
      expect(theirs.length).toBeLessThanOrEqual(1);
      for (const e of theirs) {
        expect(e.side).toBe("away");
        expect(e.minute).toBeGreaterThanOrEqual(55);
      }
      fired += theirs.length;
    }
    expect(fired).toBeGreaterThan(0);
  });
});
