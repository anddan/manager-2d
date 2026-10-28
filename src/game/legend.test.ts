// Léon Dani: only for diamonds, 99 overall, once per game.
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {LEGEND_ID, LEGEND_PRICE_DIAMONDS, buyLegend, legendOwned} from "./legend";
import {overall} from "./ratings";

describe("the legend card", () => {
  it("isn't in the world until bought", () => {
    const g = newGame("L", 3, 1);
    expect(legendOwned(g)).toBe(false);
    expect(g.players[LEGEND_ID]).toBeUndefined();
  });

  it("needs enough diamonds", () => {
    const g = newGame("L", 3, 1);
    g.monetization.diamonds = LEGEND_PRICE_DIAMONDS - 1;
    expect(buyLegend(g)).toBe("shop.notEnoughDiamonds");
    expect(legendOwned(g)).toBe(false);
  });

  it("joins the user's club as a 99 for the diamonds, and only once", () => {
    const g = newGame("L", 3, 1);
    g.monetization.diamonds = LEGEND_PRICE_DIAMONDS + 20;
    expect(buyLegend(g)).toBeNull();
    const leon = g.players[LEGEND_ID];
    expect(`${leon.firstName} ${leon.lastName}`).toBe("Léon Dani");
    expect(leon.clubId).toBe(g.userClubId);
    expect(overall(leon)).toBe(99);
    expect(g.monetization.diamonds).toBe(20);
    expect(buyLegend(g)).toBe("shop.legendOwned");
  });
});

describe("Theo Bergqvist and the secret legend", () => {
  it("sells Theo once, a 99 like Léon, for 1000", async () => {
    const {THEO_ID} = await import("./legend");
    const g = newGame("L", 3, 1);
    g.monetization.diamonds = 2000;
    expect(buyLegend(g, THEO_ID)).toBeNull();
    expect(`${g.players[THEO_ID].firstName} ${g.players[THEO_ID].lastName}`).toBe("Theo Bergqvist");
    expect(overall(g.players[THEO_ID])).toBe(99);
    expect(g.monetization.diamonds).toBe(1000);
    expect(buyLegend(g, THEO_ID)).toBe("shop.legendOwned");
  });

  it("draws someone new each time for the secret one", async () => {
    const {buySecretLegend} = await import("./legend");
    const {Rng} = await import("./rng");
    const g = newGame("L", 3, 1);
    g.monetization.diamonds = 2000;
    const a = buySecretLegend(g, new Rng(1));
    const b = buySecretLegend(g, new Rng(2));
    expect("playerId" in a && "playerId" in b).toBe(true);
    if (!("playerId" in a) || !("playerId" in b)) return;
    expect(a.playerId).not.toBe(b.playerId);
    for (const id of [a.playerId, b.playerId]) {
      expect(g.players[id].clubId).toBe(g.userClubId);
      expect(overall(g.players[id])).toBeGreaterThanOrEqual(88);
    }
    expect(g.monetization.diamonds).toBe(0);
    expect(buySecretLegend(g, new Rng(3))).toEqual({error: "shop.notEnoughDiamonds"});
  });
});
