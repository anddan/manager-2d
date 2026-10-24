// Player packs: the price in diamonds, a player of the pack's level in the squad.
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {DIAMOND_PACK, PLAYER_PACKS, PLAYER_PACK_IDS, openDiamondPack, openPack, pickFromPack} from "./packs";
import {overall} from "./ratings";
import {Rng} from "./rng";
import {QUICK_SALE_SHARE, quickSaleOffer, quickSell} from "./transfers";

describe("player packs", () => {
  it("costs the pack's diamonds and adds a player of its level to the squad", () => {
    for (const id of PLAYER_PACK_IDS) {
      const g = newGame("Packs", 3, 4);
      g.monetization.diamonds = 1000;
      // Room in the squad.
      for (const p of Object.values(g.players).filter((x) => x.clubId === g.userClubId).slice(0, 6)) p.clubId = null;
      const rng = new Rng(9);
      for (let i = 0; i < 5; i++) {
        const before = g.monetization.diamonds;
        const res = openPack(g, rng, id);
        if (!("playerId" in res)) throw new Error(res.error);
        const p = g.players[res.playerId];
        expect(p.clubId).toBe(g.userClubId);
        expect(g.monetization.diamonds).toBe(before - PLAYER_PACKS[id].price);
        // Within the pack's range (give or take a point of rounding).
        expect(overall(p)).toBeGreaterThanOrEqual(PLAYER_PACKS[id].min - 1);
        expect(overall(p)).toBeLessThanOrEqual(PLAYER_PACKS[id].max + 1);
      }
    }
  });

  it("can't be opened without the diamonds, and costs nothing then", () => {
    const g = newGame("Packs", 3, 4);
    g.monetization.diamonds = 10;
    const players = Object.keys(g.players).length;
    expect(openPack(g, new Rng(1), "bronze")).toEqual({error: "shop.notEnoughDiamonds"});
    expect(g.monetization.diamonds).toBe(10);
    expect(Object.keys(g.players)).toHaveLength(players);
  });
});

describe("selling at once", () => {
  it("sells to the club that pays most, for less than the value, with the money in the bank", () => {
    const g = newGame("Sell", 3, 4);
    const p = Object.values(g.players).find((x) => x.clubId === g.userClubId && x.position === "CM")!;
    const cash = g.clubs[g.userClubId].cash;
    const offer = quickSaleOffer(g, p.id)!;
    expect(offer).not.toBeNull();
    expect(offer.fee).toBeLessThanOrEqual(p.value * QUICK_SALE_SHARE + 10_000);
    expect(quickSell(g, p.id)).toBeNull();
    expect(g.players[p.id].clubId).toBe(offer.clubId);
    expect(g.clubs[g.userClubId].cash).toBe(cash + offer.fee);
    // Not ours any more: can't be sold again.
    expect(quickSaleOffer(g, p.id)).toBeNull();
  });
});

describe("the diamond pack", () => {
  it("costs club money, offers four players of 80–98, and the one picked joins", () => {
    const g = newGame("Diamond", 3, 4);
    const club = g.clubs[g.userClubId];
    club.cash = 20_000_000;
    for (const p of Object.values(g.players).filter((x) => x.clubId === g.userClubId).slice(0, 3)) p.clubId = null;
    const res = openDiamondPack(g, new Rng(5));
    if (!("playerIds" in res)) throw new Error(res.error);
    expect(res.playerIds).toHaveLength(DIAMOND_PACK.choices);
    expect(club.cash).toBe(20_000_000 - DIAMOND_PACK.price);
    for (const id of res.playerIds) {
      expect(overall(g.players[id])).toBeGreaterThanOrEqual(DIAMOND_PACK.min - 1);
      expect(overall(g.players[id])).toBeLessThanOrEqual(DIAMOND_PACK.max + 1);
    }
    // Opening again before picking shows the same four, for free.
    expect(openDiamondPack(g, new Rng(6))).toEqual(res);
    expect(club.cash).toBe(20_000_000 - DIAMOND_PACK.price);
    const [pick, ...rest] = res.playerIds;
    expect(pickFromPack(g, pick)).toBe(true);
    expect(g.players[pick].clubId).toBe(g.userClubId);
    for (const id of rest) expect(g.players[id]).toBeUndefined();
    expect(g.packChoice).toBeUndefined();
  });

  it("can't be bought without the money", () => {
    const g = newGame("Diamond", 3, 4);
    g.clubs[g.userClubId].cash = 5_000_000;
    expect(openDiamondPack(g, new Rng(5))).toEqual({error: "pack.noMoney"});
    expect(g.clubs[g.userClubId].cash).toBe(5_000_000);
  });
});
