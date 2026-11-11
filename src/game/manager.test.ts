// The manager's level and title: XP for what they do, a present for every new title (once), and a manager the players listen to.
// There are 100 levels and nine titles: one every tenth level (from level 20), the last, "Sir", at level 100.
import {describe, expect, it} from "vitest";
import {MANAGER_TITLES, MAX_LEVEL, TITLE_COUNT, addManagerXp, levelOf, managerAuthority, managerLevel, managerStanding, matchXp, offerRange, seasonXp, titleOf, transferXp, xpAtLevel} from "./manager";
import {newGame} from "./generate";
import {forzaLift, FORZA} from "./match";

describe("the manager's level", () => {
  it("starts at level 1 and goes up with XP, a hundred levels in all, a little harder for each", () => {
    expect(levelOf(0)).toBe(1);
    expect(levelOf(xpAtLevel(2) - 1)).toBe(1);
    expect(levelOf(xpAtLevel(2))).toBe(2);
    expect(levelOf(xpAtLevel(MAX_LEVEL))).toBe(MAX_LEVEL);
    expect(levelOf(100_000_000)).toBe(MAX_LEVEL);
    expect(MAX_LEVEL).toBe(100);
    for (let lv = 3; lv <= MAX_LEVEL; lv++) expect(xpAtLevel(lv) - xpAtLevel(lv - 1)).toBeGreaterThan(xpAtLevel(lv - 1) - xpAtLevel(lv - 2));
    // Every level is reached by its own amount (no rounding trouble at the edges).
    for (let lv = 1; lv <= MAX_LEVEL; lv++) expect(levelOf(xpAtLevel(lv))).toBe(lv);
  });

  it("has nine titles: a new one every tenth level, and the last twenty levels after the one before", () => {
    expect(TITLE_COUNT).toBe(9);
    expect(MANAGER_TITLES.map((t) => t.level)).toEqual([1, 20, 30, 40, 50, 60, 70, 80, 100]);
    expect(titleOf(1)).toBe(1);
    expect(titleOf(19)).toBe(1);
    expect(titleOf(20)).toBe(2);
    expect(titleOf(79)).toBe(7);
    expect(titleOf(80)).toBe(8);
    expect(titleOf(99)).toBe(8);
    expect(titleOf(100)).toBe(9);
    // It is hard: the second title takes about two seasons of winning, the last a very long career.
    expect(xpAtLevel(20)).toBe(1805);
    // "Sir" is 100 000 XP.
    expect(xpAtLevel(100)).toBe(100_000);
    expect(xpAtLevel(50)).toBeGreaterThan(xpAtLevel(20) * 5);
  });

  it("gives XP for what is done: a win more than a draw, a cup tie and a tournament more than a league match", () => {
    expect(matchXp(2, 0)).toBeGreaterThan(matchXp(1, 1));
    expect(matchXp(1, 1)).toBeGreaterThan(matchXp(0, 1));
    expect(matchXp(1, 0, "cup")).toBeGreaterThan(matchXp(1, 0, "league"));
    expect(matchXp(1, 0, "friendly")).toBeLessThan(matchXp(1, 0, "league"));
    expect(transferXp(20_000_000)).toBeGreaterThan(transferXp(500_000));
    expect(seasonXp(1, true)).toBeGreaterThan(seasonXp(1, false));
    expect(seasonXp(1, false)).toBeGreaterThan(seasonXp(8, false));
  });

  it("pays the present for a new title at once, and only once; levels in between pay nothing", () => {
    const g = newGame("Lvl", 2, 9);
    const diamonds = g.monetization.diamonds;
    const cash = g.clubs[g.userClubId].cash;
    expect(managerLevel(g)).toBe(1);
    // Level 19 is still the first title.
    addManagerXp(g, xpAtLevel(19));
    expect(managerLevel(g)).toBe(19);
    expect(g.monetization.diamonds).toBe(diamonds);
    // Level 20: the second title.
    addManagerXp(g, xpAtLevel(20) - xpAtLevel(19));
    expect(managerLevel(g)).toBe(20);
    expect(g.monetization.diamonds).toBe(diamonds + (MANAGER_TITLES[1].reward?.diamonds ?? 0));
    // A rise of several titles at once pays them all.
    addManagerXp(g, xpAtLevel(50) - xpAtLevel(20));
    expect(managerLevel(g)).toBe(50);
    const paidMoney = (MANAGER_TITLES[2].reward?.money ?? 0) + (MANAGER_TITLES[4].reward?.money ?? 0);
    expect(g.clubs[g.userClubId].cash).toBe(cash + paidMoney);
    expect(g.manager?.claimed).toEqual(expect.arrayContaining([2, 3, 4, 5]));
    // More XP on the same title pays nothing more.
    const now = g.monetization.diamonds;
    const money = g.clubs[g.userClubId].cash;
    addManagerXp(g, 1);
    expect(g.monetization.diamonds).toBe(now);
    expect(g.clubs[g.userClubId].cash).toBe(money);
    // And how far it is to the next level and the next title.
    const st = managerStanding(g);
    expect(st.share).toBeGreaterThanOrEqual(0);
    expect(st.share).toBeLessThan(1);
    expect(st.title).toBe(5);
    expect(st.next).toEqual({title: 6, level: 60});
  });

  it("makes the players listen more to a better manager (Forza bites harder)", () => {
    expect(forzaLift(20, 10)).toBe(FORZA.boost);
    expect(forzaLift(20, 10, 1)).toBeGreaterThan(forzaLift(20, 10, 0.5));
    expect(forzaLift(20, 10, 0.5)).toBeGreaterThan(FORZA.boost);
    expect(forzaLift(20, 25, 1)).toBe(1);
    const g = newGame("Auth", 2, 9);
    expect(managerAuthority(g)).toBe(0);
    addManagerXp(g, xpAtLevel(MAX_LEVEL));
    expect(managerAuthority(g)).toBe(1);
    expect(managerStanding(g).next).toBeNull();
  });

  it("is asked by better countries the higher the level", () => {
    expect(offerRange(1)[0]).toBeGreaterThan(offerRange(50)[0]);
    expect(offerRange(50)[0]).toBeGreaterThan(offerRange(70)[0]);
    expect(offerRange(MAX_LEVEL)[0]).toBe(0);
  });
});
