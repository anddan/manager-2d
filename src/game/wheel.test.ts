// The lucky wheel and the collector album.
import {describe, expect, it} from "vitest";
import {albumOwned, albumProgress, collectGift} from "./album";
import {newGame} from "./generate";
import {Rng} from "./rng";
import {WHEEL, spinWheel, wheelStatus} from "./wheel";

describe("lucky wheel", () => {
  it("gives one free spin a day and one more for a video", () => {
    const g = newGame("Wheel", 3, 4);
    expect(wheelStatus(g, "2026-11-03")).toEqual({free: true, video: false});
    expect("error" in spinWheel(g, new Rng(1), "2026-11-03", false)).toBe(false);
    expect(wheelStatus(g, "2026-11-03")).toEqual({free: false, video: true});
    expect(spinWheel(g, new Rng(2), "2026-11-03", false)).toEqual({error: "wheel.none"});
    expect("error" in spinWheel(g, new Rng(3), "2026-11-03", true)).toBe(false);
    expect(wheelStatus(g, "2026-11-03")).toEqual({free: false, video: false});
    // A new day, a new spin.
    expect(wheelStatus(g, "2026-11-04").free).toBe(true);
  });

  it("pays out what it stops on", () => {
    const g = newGame("Wheel", 3, 4);
    for (let seed = 1; seed < 40; seed++) {
      g.wheel = undefined;
      const cash = g.clubs[g.userClubId].cash;
      const diamonds = g.monetization.diamonds;
      const bag = g.gearBag?.length ?? 0;
      const res = spinWheel(g, new Rng(seed), "2026-11-03", false);
      if ("error" in res) throw new Error(res.error);
      const prize = WHEEL[res.index].prize;
      if (prize.kind === "money") expect(g.clubs[g.userClubId].cash).toBe(cash + prize.amount);
      if (prize.kind === "diamonds") expect(g.monetization.diamonds).toBe(diamonds + prize.amount);
      if (prize.kind === "kit") expect(g.gearBag!.length).toBe(bag + 1);
      if (prize.kind === "pack") expect(res.playerId ? g.players[res.playerId].clubId : "full").toBe(res.playerId ? g.userClubId : "full");
    }
  });
});

describe("collector album", () => {
  it("remembers presents given and counts what is had", () => {
    const g = newGame("Album", 3, 4);
    const before = albumProgress(g).have;
    collectGift(g, "sportsCar:blue");
    collectGift(g, "sportsCar:blue");
    expect(albumOwned(g).gifts.has("sportsCar:blue")).toBe(true);
    expect(albumProgress(g).have).toBe(before + 1);
  });
});
