// A player can always be sold, whatever the price, and several can be sold at once.
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {quickSaleOffer, quickSellMany, quickSell} from "./transfers";
import {clubPlayers} from "./ratings";

describe("quick sale", () => {
  it("still finds a buyer when no club can pay a fair price", () => {
    const g = newGame("Sell", 3, 31);
    for (const c of Object.values(g.clubs)) if (c.id !== g.userClubId) c.transferBudget = 0;
    const p = clubPlayers(g, g.userClubId)[0];
    const offer = quickSaleOffer(g, p.id);
    expect(offer).not.toBeNull();
    expect(offer!.fee).toBe(0);
    expect(quickSell(g, p.id)).toBeNull();
    expect(g.players[p.id].clubId).not.toBe(g.userClubId);
  });

  it("sells several at once, each at the best offer then", () => {
    const g = newGame("Sell", 3, 32);
    const ids = clubPlayers(g, g.userClubId).slice(0, 3).map((p) => p.id);
    const before = g.clubs[g.userClubId].cash;
    const r = quickSellMany(g, ids);
    expect(r.failed).toEqual([]);
    expect(r.sold).toHaveLength(3);
    for (const id of ids) expect(g.players[id].clubId).not.toBe(g.userClubId);
    expect(g.clubs[g.userClubId].cash).toBeGreaterThanOrEqual(before);
  });
});
