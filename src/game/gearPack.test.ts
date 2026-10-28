// The kit pack: a random piece with a perk; mostly small perks, now and then a big one.
import {describe, expect, it} from "vitest";
import {GEAR_PACK, gearBonus, openGearPack, rollGearPack} from "./gear";
import {newGame} from "./generate";
import {Rng} from "./rng";

describe("the kit pack", () => {
  it("costs diamonds and puts a perked piece in the bag", () => {
    const g = newGame("Gus", 1, 81);
    g.monetization.diamonds = GEAR_PACK.price;
    const item = openGearPack(g, new Rng(5));
    expect(typeof item).toBe("object");
    expect(g.monetization.diamonds).toBe(0);
    expect(g.gearBag?.at(-1)).toEqual(item);
    expect(openGearPack(g, new Rng(6))).toBe("shop.notEnoughDiamonds");
  }, 30_000);

  it("sometimes beats the best piece in the shop", () => {
    const items = Array.from({length: 2000}, (_, i) => rollGearPack(new Rng(i)));
    const best = (it: ReturnType<typeof rollGearPack>) => Math.max(...Object.values(gearBonus(it)));
    expect(items.every((it) => it.perk && it.perk.n >= 1)).toBe(true);
    expect(items.filter((it) => (it.perk?.n ?? 0) <= 2).length).toBeGreaterThan(1000);
    // A special shop pair lifts +5 (gloves +10): a pack piece goes past that now and then.
    expect(items.some((it) => it.kind !== "gloves" && best(it) > 5)).toBe(true);
  });
});
