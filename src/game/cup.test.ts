// The Champions Cup: 16 clubs from every league, played through the season's
// cup weeks to a winner, and kept apart from the league.
import {describe, expect, it} from "vitest";
import {CUP_FROM_LEAGUE, CUP_SIZE, CUP_WEEKS, SEASON_WEEKS} from "./constants";
import {shootout} from "./cup";
import {newGame} from "./generate";
import {currentRound, leagueClubs} from "./helpers";
import {standings} from "./league";
import {Rng} from "./rng";
import {advanceWeek} from "./week";

describe("Champions Cup", () => {
  const g = newGame("Cup", 6, 21);
  const rng = new Rng(3);

  it("starts with the league's top clubs, the manager and guests from the other leagues", () => {
    const cup = g.cup!;
    expect(cup.clubIds).toHaveLength(CUP_SIZE);
    expect(new Set(cup.clubIds).size).toBe(CUP_SIZE);
    // Club 6 isn't top four by reputation: it's in on a first-season wildcard.
    expect(cup.clubIds).toContain(g.userClubId);
    const home = cup.clubIds.filter((id) => !g.clubs[id].guest);
    expect(home).toHaveLength(CUP_FROM_LEAGUE);
    const countries = new Set(cup.clubIds.filter((id) => g.clubs[id].guest).map((id) => g.clubs[id].country));
    expect(countries.size).toBeGreaterThanOrEqual(4);
    expect(cup.fixtures).toHaveLength(CUP_SIZE / 2);
    // Guests are not in the league.
    expect(standings(g)).toHaveLength(leagueClubs(g).length);
    expect(standings(g).some((r) => r.club.guest)).toBe(false);
  });

  it("has no league games in cup weeks, and every league round still gets played", () => {
    const rounds = new Set<number>();
    for (let week = 1; week <= SEASON_WEEKS; week++) {
      const r = currentRound({...g, week});
      if (CUP_WEEKS.includes(week)) expect(r).toBeNull();
      if (r !== null) rounds.add(r);
    }
    expect(rounds.size).toBe(Math.max(...g.fixtures.map((f) => f.round)));
  });

  it("is played to a winner over the season, then starts again with new guests", () => {
    const firstGuests = Object.values(g.clubs).filter((c) => c.guest).map((c) => c.id);
    let cupMatches = 0;
    for (let week = 1; week <= SEASON_WEEKS; week++) {
      const before = g.cup!.fixtures.filter((f) => f.played).length;
      const res = advanceWeek(g, rng, Date.now(), {useEnergy: false});
      expect(res.ok).toBe(true);
      if (week === SEASON_WEEKS) break;
      cupMatches += g.cup!.fixtures.filter((f) => f.played).length - before;
      if (CUP_WEEKS.includes(week)) expect(g.cup!.fixtures.filter((f) => f.played).length).toBeGreaterThan(before);
      else expect(g.cup!.fixtures.filter((f) => f.played).length).toBe(before);
    }
    // 8 + 4 + 2 + 1 matches. (The last week rolled over into a new season and a new cup.)
    expect(cupMatches).toBe(15);
    expect(g.history[0].season).toBe(g.season - 1);
    // Last season's league is complete; guests never played in it.
    expect(g.fixtures.every((f) => !g.clubs[f.homeId]?.guest && !g.clubs[f.awayId]?.guest)).toBe(true);
    // New season: last year's guests are gone, with their players, and new ones are in.
    for (const id of firstGuests) expect(g.clubs[id]).toBeUndefined();
    expect(Object.values(g.players).some((p) => p.clubId && !g.clubs[p.clubId])).toBe(false);
    expect(g.cup!.season).toBe(g.season);
    expect(g.cup!.fixtures.every((f) => !f.played)).toBe(true);
  }, 120000);

  it("settles level ties on penalties", () => {
    const r = new Rng(9);
    for (let i = 0; i < 200; i++) {
      const [h, a] = shootout(r, 70, 70);
      expect(h).not.toBe(a);
    }
  });
});
