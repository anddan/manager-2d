// The stadium: locked until the league is won, then stands, kiosks and a shop to build.
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {STAND_SEATS, ensureStadium, itemTakings, kioskTakings, setItemPrice, shopTakings, stadiumCapacity, startBuild, weeklyStadium} from "./stadium";
import type {Fixture} from "./types";

describe("stadium", () => {
  it("stays locked until the club has won the league", () => {
    const g = newGame("Arena", 3, 5);
    expect(startBuild(g, "north")).toBe("stadium.locked");
    g.history.push({season: g.season, championId: g.userClubId, userPosition: 1});
    expect(startBuild(g, "north")).toBeNull();
  });

  it("builds one thing at a time, paid up front, and opens it when the weeks are up", () => {
    const g = newGame("Arena", 3, 5);
    g.history.push({season: g.season, championId: g.userClubId, userPosition: 1});
    const club = g.clubs[g.userClubId];
    club.cash = 50_000_000;
    const before = club.capacity;
    expect(startBuild(g, "north")).toBeNull();
    expect(club.cash).toBeLessThan(50_000_000);
    expect(startBuild(g, "kiosks")).toBe("stadium.busy");
    weeklyStadium(g, []);
    weeklyStadium(g, []);
    expect(club.capacity).toBe(before);
    weeklyStadium(g, []);
    expect(club.capacity).toBe(before + STAND_SEATS.north);
    expect(stadiumCapacity(ensureStadium(club))).toBe(club.capacity);
    expect(g.inbox.some((m) => m.key === "msg.stadiumBuilt")).toBe(true);
  });

  it("says no when the club can't afford it", () => {
    const g = newGame("Arena", 3, 5);
    g.history.push({season: g.season, championId: g.userClubId, userPosition: 1});
    g.clubs[g.userClubId].cash = 1000;
    expect(startBuild(g, "south")).toBe("stadium.noMoney");
  });

  it("brings in money from the kiosks at a home match and from the shop every week", () => {
    const g = newGame("Arena", 3, 5);
    const club = g.clubs[g.userClubId];
    const st = ensureStadium(club);
    st.kiosks = 2;
    st.shop = 1;
    const home: Fixture = {id: "x", round: 1, homeId: club.id, awayId: "other", played: true, homeGoals: 1, awayGoals: 0, attendance: 20_000};
    const lines = () => g.finance.current.matchday ?? 0;
    const start = lines();
    weeklyStadium(g, [home]);
    expect(lines() - start).toBe(kioskTakings(st, 20_000) + shopTakings(st));
    // At fair prices: about 1.5 € a fan per kiosk level, and some 25 000 a week from a first shop.
    expect(kioskTakings(st, 20_000)).toBe(Math.round(20_000 * 0.4 * 4) + Math.round(20_000 * 0.4 * 3));
    expect(shopTakings(st)).toBe(1200 * 15 + 150 * 60);
  });

  it("brings in most a little above the fair price, and little when far too dear", () => {
    const g = newGame("Arena", 3, 5);
    const st = ensureStadium(g.clubs[g.userClubId]);
    st.kiosks = 1;
    const at = (price: number) => {
      setItemPrice(g, "hotdog", price);
      return itemTakings(st, "hotdog", 20_000);
    };
    expect(at(5)).toBeGreaterThan(at(4));
    expect(at(5)).toBeGreaterThan(at(8));
    expect(at(12)).toBe(0);
    setItemPrice(g, "hotdog", 1000);
    expect(st.prices?.hotdog).toBe(12);
  });
});
