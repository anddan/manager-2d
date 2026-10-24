// New worlds: men's, women's and mixed leagues get the right players.
import {describe, expect, it} from "vitest";
import {WORLD_CLASS_PER_POSITION, newGame} from "./generate";
import {leagueClubs} from "./helpers";
import {LEAGUES} from "./leagues";
import {NATIONALITIES} from "./names";
import {overall} from "./ratings";
import {POSITIONS} from "./types";

describe("leagues", () => {
  for (const league of LEAGUES) {
    it(`builds ${league.name} with its clubs and mostly home players`, () => {
      const g = newGame("L", 3, 5, undefined, "men", league.id);
      expect(g.leagueId).toBe(league.id);
      expect(g.leagueName).toBe(league.name);
      expect(leagueClubs(g).map((c) => c.name)).toEqual(league.clubs.map((c) => c.name));
      expect(g.fixtures.length).toBeGreaterThan(0);
      if (league.home) {
        const players = Object.values(g.players).filter((p) => !p.clubId || !g.clubs[p.clubId].guest);
        const share = players.filter((p) => p.nationality === league.home).length / players.length;
        expect(share).toBeGreaterThan(0.5);
      }
    });
  }
});

describe("players' gender", () => {
  it("makes a men's league by default, as before", () => {
    const players = Object.values(newGame("M", 3, 5).players);
    expect(players.every((p) => p.gender === undefined)).toBe(true);
    expect(players.every((p) => NATIONALITIES[p.nationality].first.includes(p.firstName))).toBe(true);
  });

  it("makes only women, with women's names, in a women's league", () => {
    const g = newGame("W", 3, 5, undefined, "women");
    const players = Object.values(g.players);
    expect(g.playersGender).toBe("women");
    expect(players.every((p) => p.gender === "f")).toBe(true);
    expect(players.every((p) => NATIONALITIES[p.nationality].female.includes(p.firstName))).toBe(true);
  });

  it("mixes about half and half in a mixed league", () => {
    const players = Object.values(newGame("X", 3, 5, undefined, "mix").players);
    const share = players.filter((p) => p.gender === "f").length / players.length;
    expect(share).toBeGreaterThan(0.4);
    expect(share).toBeLessThan(0.6);
  });
});

describe("world-class players", () => {
  it("are on the market at every position, rated 97–99, and only there", () => {
    const g = newGame("W", 3, 5);
    const best = Object.values(g.players).filter((p) => overall(p) >= 97);
    for (const p of best) expect(p.clubId).toBeNull();
    for (const pos of POSITIONS) {
      const here = best.filter((p) => p.position === pos);
      expect(here.length).toBe(WORLD_CLASS_PER_POSITION);
      for (const p of here) expect(overall(p)).toBeLessThanOrEqual(99);
    }
  });
});
