// The weekly spending package.
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {Rng} from "./rng";
import {SPEND_TIERS, addSpending, claimSpending, openTiers, spendingOf, weekStart} from "./spending";

describe("weekly spending package", () => {
  it("starts the week on Monday", () => {
    expect(weekStart("2026-11-02")).toBe("2026-11-02");
    expect(weekStart("2026-11-08")).toBe("2026-11-02");
    expect(weekStart("2026-11-09")).toBe("2026-11-09");
  });

  it("counts diamonds and club money as points, and starts over in a new week", () => {
    const g = newGame("Spend", 3, 4);
    addSpending(g, "2026-11-02", 30, 2_000_000);
    expect(spendingOf(g, "2026-11-02").points).toBe(50);
    expect(spendingOf(g, "2026-11-09").points).toBe(0);
  });

  it("opens a level at its points and lets one reward be picked, once", () => {
    const g = newGame("Spend", 3, 4);
    const week = "2026-11-02";
    expect(openTiers(g, week)).toEqual([]);
    addSpending(g, week, SPEND_TIERS[1].points, 0);
    expect(openTiers(g, week)).toEqual([0, 1]);
    const diamonds = g.monetization.diamonds;
    const res = claimSpending(g, new Rng(1), week, 0, 1);
    expect("error" in res).toBe(false);
    expect(g.monetization.diamonds).toBe(diamonds + 15);
    expect(openTiers(g, week)).toEqual([1]);
    expect("error" in claimSpending(g, new Rng(2), week, 0, 0)).toBe(true);
    expect("error" in claimSpending(g, new Rng(3), week, 3, 0)).toBe(true);
  });
});
