// The zones view: how long the ball has been in each third, from the team's own side.
import {describe, expect, it} from "vitest";
import type {Frame} from "../game/types";
import {zoneColor, zoneShares} from "./ZonePanel";

const f = (minute: number, x: number): Frame => ({minute, x, y: 50, possession: "home"});

describe("zoneShares", () => {
  it("adds up to 100 and follows where the ball was and for how long", () => {
    // Home attacks towards x = 100: 10 minutes in its own third, 10 in the middle, 20 in the opponent's.
    const frames = [f(0, 10), f(10, 50), f(20, 90)];
    expect(zoneShares(frames, "home", 40)).toEqual([25, 25, 50]);
    const shares = zoneShares(frames, "home", 33);
    expect(shares[0] + shares[1] + shares[2]).toBe(100);
  });

  it("turns round for the away side (it attacks towards x = 0)", () => {
    const frames = [f(0, 90), f(10, 10)];
    expect(zoneShares(frames, "away", 20)).toEqual([50, 0, 50]);
  });

  it("is all zero before anything has happened", () => {
    expect(zoneShares([], "home", 5)).toEqual([0, 0, 0]);
    expect(zoneShares([f(3, 50)], "home", 2)).toEqual([0, 0, 0]);
  });

  it("goes from light grey to dark grey", () => {
    expect(zoneColor(0).opacity).toBeLessThan(zoneColor(60).opacity);
    // About a quarter: the pitch still shows almost green.
    expect(zoneColor(25).opacity).toBeLessThan(0.15);
    expect(zoneColor(0).fill).toBe("rgb(209 213 219)");
    expect(zoneColor(60).fill).toBe("rgb(31 41 55)");
  });
});

describe("possessionShares", () => {
  it("shares the time between the teams", async () => {
    const {possessionShares} = await import("./ZonePanel");
    const frames: Frame[] = [{minute: 0, x: 50, y: 50, possession: "home"}, {minute: 6, x: 50, y: 50, possession: "away"}];
    expect(possessionShares(frames, 10)).toEqual([60, 40]);
    expect(possessionShares([], 10)).toEqual([0, 0]);
  });
});

describe("matchStats", () => {
  it("counts shots, shots on target and corners for each side up to a time", async () => {
    const {matchStats} = await import("./ZonePanel");
    const events = [
      {minute: 5, type: "goal", side: "home"}, {minute: 10, type: "saved", side: "away"}, {minute: 12, type: "missed", side: "home"},
      {minute: 20, type: "blocked", side: "away"}, {minute: 22, type: "corner", side: "home"}, {minute: 80, type: "goal", side: "away"},
    ] as never;
    const early = matchStats(events, 30);
    expect(early.shots).toEqual([2, 2]);
    expect(early.onTarget).toEqual([1, 1]);
    expect(early.corners).toEqual([1, 0]);
    expect(matchStats(events, 90).shots).toEqual([2, 3]);
  });
});

describe("playerMarks", () => {
  it("counts goals, assists and cards per player up to a time", async () => {
    const {playerMarks} = await import("./ZonePanel");
    const events = [
      {minute: 10, type: "goal", side: "home", playerId: "a", otherId: "b"}, {minute: 20, type: "yellow", side: "home", playerId: "b"},
      {minute: 30, type: "goal", side: "home", playerId: "a"}, {minute: 85, type: "red", side: "home", playerId: "a"},
    ] as never;
    expect(playerMarks(events, 40)).toEqual({a: {goals: 2, assists: 0, yellow: 0, red: 0}, b: {goals: 0, assists: 1, yellow: 1, red: 0}});
    expect(playerMarks(events, 90).a.red).toBe(1);
  });
});
