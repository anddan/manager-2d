// The manager's level and title: XP for what they do, a small random present for every level, a bigger one for every new title (once), and a
// manager the players listen to. There are 100 levels and ten titles: "no title" to begin with, then one every tenth level (the first,
// "Rookie", at level 10), the last, "Sir", at level 100.
import {describe, expect, it} from "vitest";
import {MANAGER_TITLES, MAX_LEVEL, TITLE_COUNT, addManagerXp, levelGift, levelOf, managerAuthority, managerLevel, managerStanding, matchXp, offerRange, seasonXp, titleOf, transferXp, xpAtLevel} from "./manager";
import {newGame} from "./generate";
import {forzaLift, FORZA} from "./match";
import {albumKeys, albumProgress, albumTitles, claimItem, claimable, ownedKeys} from "./album";

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

  it("has ten titles: none to begin with, then a new one every tenth level, and the last twenty levels after the one before", () => {
    expect(TITLE_COUNT).toBe(10);
    expect(MANAGER_TITLES.map((t) => t.level)).toEqual([1, 10, 20, 30, 40, 50, 60, 70, 80, 100]);
    expect(titleOf(1)).toBe(1);
    expect(titleOf(9)).toBe(1);
    expect(titleOf(10)).toBe(2);
    expect(titleOf(79)).toBe(8);
    expect(titleOf(80)).toBe(9);
    expect(titleOf(99)).toBe(9);
    expect(titleOf(100)).toBe(10);
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

  it("gives a random present for every level, the same for the same level, and shows the level up", () => {
    const seen = new Set<string>();
    for (let lv = 2; lv <= 100; lv++) {
      const a = levelGift(lv, 12345);
      expect(a).toEqual(levelGift(lv, 12345));
      expect(a.n).toBeGreaterThan(0);
      seen.add(a.kind);
    }
    expect([...seen].sort()).toEqual(["diamonds", "energy", "money"]);
    const g = newGame("Up", 2, 9);
    const before = g.monetization.diamonds + g.clubs[g.userClubId].cash;
    addManagerXp(g, xpAtLevel(4));
    expect(managerLevel(g)).toBe(4);
    // One screen for the levels that came together, with a present for each.
    const last = g.celebrations?.[g.celebrations.length - 1];
    expect(last?.kind).toBe("level");
    if (last?.kind === "level") {
      expect(last.level).toBe(4);
      expect(last.gifts).toHaveLength(3);
      expect(last.title).toBeUndefined();
    }
    expect(g.monetization.diamonds + g.clubs[g.userClubId].cash).toBeGreaterThan(before);
  });

  it("has the nine titles in the album: reached by level, opened once for the present, and part of everything there is to collect", () => {
    const g = newGame("Lvl", 2, 9);
    const total = albumKeys().length;
    expect(albumTitles()).toEqual(["title:2", "title:3", "title:4", "title:5", "title:6", "title:7", "title:8", "title:9", "title:10"]);
    expect(albumKeys().filter((k) => k.startsWith("title:"))).toHaveLength(9);
    expect(albumProgress(g).total).toBe(total);
    expect(managerLevel(g)).toBe(1);
    // Level 9 is still the first title ("no title"): nothing to collect.
    addManagerXp(g, xpAtLevel(9));
    expect(ownedKeys(g).has("title:2")).toBe(false);
    expect(claimable(g).filter((k) => k.startsWith("title:"))).toEqual([]);
    // Level 10: "Rookie" is reached and can be opened.
    addManagerXp(g, xpAtLevel(10) - xpAtLevel(9));
    expect(ownedKeys(g).has("title:2")).toBe(true);
    expect(claimable(g)).toContain("title:2");
    const diamonds = g.monetization.diamonds;
    expect(claimItem(g, "title:2")).toBe(MANAGER_TITLES[1].reward?.diamonds);
    expect(g.monetization.diamonds).toBe(diamonds + (MANAGER_TITLES[1].reward?.diamonds ?? 0));
    // ...only once.
    expect(claimItem(g, "title:2")).toBe(0);
    expect(claimable(g)).not.toContain("title:2");
    // A title with money as its present pays money.
    addManagerXp(g, xpAtLevel(30) - xpAtLevel(10));
    expect(claimable(g)).toEqual(expect.arrayContaining(["title:3", "title:4"]));
    const cash = g.clubs[g.userClubId].cash;
    claimItem(g, "title:4");
    expect(g.clubs[g.userClubId].cash).toBe(cash + (MANAGER_TITLES[3].reward?.money ?? 0));
    // The king (everything in the album) needs the top title too.
    expect(albumKeys().filter((k) => k !== "rare:king")).toContain("title:10");
    // And how far it is to the next level and the next title.
    const st = managerStanding(g);
    expect(st.share).toBeGreaterThanOrEqual(0);
    expect(st.share).toBeLessThan(1);
    expect(st.title).toBe(4);
    expect(st.next).toEqual({title: 5, level: 40});
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
