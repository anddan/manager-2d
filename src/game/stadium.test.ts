// The stadium: locked until the league is won, then stands, kiosks and a shop to build.
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {KIOSK_SPEND, SHOP_WEEKLY, STAND_SEATS, ensureStadium, stadiumCapacity, startBuild, weeklyStadium} from "./stadium";
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
    expect(lines() - start).toBe(20_000 * KIOSK_SPEND * 2 + SHOP_WEEKLY[1]);
  });
});
