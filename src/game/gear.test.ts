// Boots and gloves: bought into the bag, worn for a bonus on the day (not in the player's own rating).
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {buyGear, equipGear, sellGear, unequipGear} from "./gear";
import {effectiveRating, overall} from "./ratings";
import {completeTransfer, quickSaleOffer, quickSell} from "./transfers";

describe("boots and gloves", () => {
  it("lift the player on the day, not their own rating", () => {
    const g = newGame("Gear", 3, 11);
    const p = Object.values(g.players).find((x) => x.clubId === g.userClubId && x.position === "ST")!;
    const before = effectiveRating(p, "ST");
    const ovr = overall(p);
    g.monetization.diamonds = 1000;
    expect(buyGear(g, {kind: "shooting", tier: "gold"})).toBeNull();
    expect(g.gearBag).toHaveLength(1);
    expect(equipGear(g, p.id, 0)).toBeNull();
    expect(g.gearBag).toHaveLength(0);
    expect(effectiveRating(g.players[p.id], "ST")).toBeGreaterThan(before);
    expect(overall(g.players[p.id])).toBe(ovr);
    unequipGear(g, p.id);
    expect(g.players[p.id].gear).toBeUndefined();
    expect(g.gearBag).toHaveLength(1);
  });

  it("gloves only for keepers, and a sold player leaves his boots behind", () => {
    const g = newGame("Gear", 3, 12);
    const keeper = Object.values(g.players).find((x) => x.clubId === g.userClubId && x.position === "GK")!;
    const outfield = Object.values(g.players).find((x) => x.clubId === g.userClubId && x.position !== "GK")!;
    g.clubs[g.userClubId].cash = 10_000_000;
    buyGear(g, {kind: "gloves", tier: "common"});
    expect(equipGear(g, outfield.id, 0)).toBe("gear.noFit");
    expect(equipGear(g, keeper.id, 0)).toBeNull();
    buyGear(g, {kind: "speed", tier: "silver"});
    equipGear(g, outfield.id, 0);
    const other = Object.keys(g.clubs).find((id) => id !== g.userClubId && !g.clubs[id].guest)!;
    completeTransfer(g, outfield.id, other, 1_000_000);
    expect(g.players[outfield.id].gear).toBeUndefined();
    expect(g.gearBag).toEqual([{kind: "speed", tier: "silver"}]);
  });

  it("shin guards are worn beside boots, by keepers too", () => {
    const g = newGame("Gear", 3, 14);
    const keeper = Object.values(g.players).find((x) => x.clubId === g.userClubId && x.position === "GK")!;
    g.clubs[g.userClubId].cash = 10_000_000;
    buyGear(g, {kind: "gloves", tier: "common"});
    buyGear(g, {kind: "shin", tier: "silver"});
    expect(equipGear(g, keeper.id, 0)).toBeNull();
    expect(equipGear(g, keeper.id, 0)).toBeNull();
    expect(g.players[keeper.id].gear?.kind).toBe("gloves");
    expect(g.players[keeper.id].shin?.kind).toBe("shin");
    unequipGear(g, keeper.id, "shin");
    expect(g.players[keeper.id].shin).toBeUndefined();
    expect(g.players[keeper.id].gear?.kind).toBe("gloves");
    expect(g.gearBag).toEqual([{kind: "shin", tier: "silver"}]);
  });

  it("sells back for half, in what it cost", () => {
    const g = newGame("Gear", 3, 15);
    g.clubs[g.userClubId].cash = 10_000_000;
    g.monetization.diamonds = 100;
    buyGear(g, {kind: "speed", tier: "silver"});
    buyGear(g, {kind: "speed", tier: "gold"});
    expect(sellGear(g, 0)).toBeNull();
    expect(g.clubs[g.userClubId].cash).toBe(10_000_000 - 750_000 + 375_000);
    expect(sellGear(g, 0)).toBeNull();
    expect(g.monetization.diamonds).toBe(100 - 40 + 20);
    expect(g.gearBag).toEqual([]);
  });

  it("comes back to the bag when the player is sold quickly", () => {
    const g = newGame("Gear", 3, 13);
    const p = Object.values(g.players).find((x) => x.clubId === g.userClubId && x.position === "CM")!;
    g.clubs[g.userClubId].cash = 10_000_000;
    buyGear(g, {kind: "technique", tier: "common"});
    equipGear(g, p.id, 0);
    if (!quickSaleOffer(g, p.id)) return;
    quickSell(g, p.id);
    expect(g.players[p.id].clubId).not.toBe(g.userClubId);
    expect(g.gearBag).toEqual([{kind: "technique", tier: "common"}]);
  });
});
