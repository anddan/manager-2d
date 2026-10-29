// A well-timed shot is more exact (the timing bar), a poorly timed one less; nothing else changes.
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {Rng} from "./rng";
import {resolveSetPiece, timingFactor, type SetPiece} from "./setpieces";

describe("timing a shot", () => {
  it("halves the spread for a perfect shot and widens it for a poor one", () => {
    expect(timingFactor(1)).toBeCloseTo(0.5);
    expect(timingFactor(0)).toBeCloseTo(1.5);
    expect(timingFactor(undefined)).toBe(1);
  });

  it("puts the ball closer to the aim the better it was timed", () => {
    const g = newGame("Timing", 3, 5);
    const players = Object.values(g.players).filter((p) => p.clubId === g.userClubId);
    const taker = players.find((p) => p.position === "ST")!;
    const keeper = players.find((p) => p.position === "GK")!;
    const sp: SetPiece = {index: 0, kind: "penalty", minute: 10, side: "home", takerId: taker.id, wallSide: 1, spot: {x: 90, y: 50}};
    const aim = {x: 0.5, y: 0.4};
    let good = 0;
    let poor = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const a = resolveSetPiece(new Rng(seed), sp, {aim, timing: 1}, taker, keeper).shot;
      const b = resolveSetPiece(new Rng(seed), sp, {aim, timing: 0}, taker, keeper).shot;
      good += Math.hypot(a.x - aim.x, a.y - aim.y);
      poor += Math.hypot(b.x - aim.x, b.y - aim.y);
    }
    expect(good).toBeLessThan(poor * 0.5);
  });
});
