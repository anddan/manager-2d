// The Champions Cup: 16 clubs from every league, four groups of four and then
// a knockout, played through the season's cup weeks to a winner, and kept
// apart from the league.
import {describe, expect, it} from "vitest";
import {CUP_FROM_LEAGUE, CUP_GROUP_DAYS, CUP_GROUPS, CUP_SIZE, CUP_WEEKS, SEASON_WEEKS} from "./constants";
import {groupTable, shootout, shootoutOver} from "./cup";
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
    // Four groups of four, everyone playing everyone once: six games a group, two each matchday.
    expect(cup.groups).toHaveLength(CUP_GROUPS);
    expect(new Set(cup.groups.flat()).size).toBe(CUP_SIZE);
    expect(cup.fixtures).toHaveLength(CUP_GROUPS * 6);
    for (let g = 0; g < CUP_GROUPS; g++) {
      for (const a of cup.groups[g]) for (const b of cup.groups[g]) {
        if (a === b) continue;
        expect(cup.fixtures.filter((f) => f.group === g && ((f.homeId === a && f.awayId === b) || (f.homeId === b && f.awayId === a)))).toHaveLength(1);
      }
      for (let day = 0; day < CUP_GROUP_DAYS; day++) expect(cup.fixtures.filter((f) => f.group === g && f.stage === day)).toHaveLength(2);
    }
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
    let checkedBracket = false;
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
      // After the last matchday: the group winners and runners-up, crossed over, in the quarter-finals.
      if (week === CUP_WEEKS[CUP_GROUP_DAYS - 1]) {
        const quarters = g.cup!.fixtures.filter((f) => f.stage === CUP_GROUP_DAYS).sort((a, b) => a.slot! - b.slot!);
        expect(quarters).toHaveLength(4);
        const top = (group: number, place: number) => groupTable(g, group)[place].clubId;
        expect([quarters[0].homeId, quarters[0].awayId]).toEqual([top(0, 0), top(1, 1)]);
        expect([quarters[1].homeId, quarters[1].awayId]).toEqual([top(1, 0), top(0, 1)]);
        expect([quarters[2].homeId, quarters[2].awayId]).toEqual([top(2, 0), top(3, 1)]);
        expect([quarters[3].homeId, quarters[3].awayId]).toEqual([top(3, 0), top(2, 1)]);
        checkedBracket = true;
      }
    }
    // 24 group games, then 4 + 2 + 1. (The last week rolled over into a new season and a new cup.)
    expect(cupMatches).toBe(31);
    expect(checkedBracket).toBe(true);
    expect(g.history[0].season).toBe(g.season - 1);
    // Last season's league is complete; guests never played in it.
    expect(g.fixtures.every((f) => !g.clubs[f.homeId]?.guest && !g.clubs[f.awayId]?.guest)).toBe(true);
    // New season: last year's guests are gone, with their players, and new ones are in.
    for (const id of firstGuests) expect(g.clubs[id]).toBeUndefined();
    expect(Object.values(g.players).some((p) => p.clubId && !g.clubs[p.clubId])).toBe(false);
    expect(g.cup!.season).toBe(g.season);
    expect(g.cup!.fixtures.every((f) => !f.played)).toBe(true);
  }, 120000);

  it("ends a shoot-out as soon as it's decided", () => {
    expect(shootoutOver([3, 0], [3, 3])).toBe(true); // 3–0 with two each left: can't catch up.
    expect(shootoutOver([3, 1], [3, 3])).toBe(false);
    expect(shootoutOver([4, 4], [5, 5])).toBe(false); // Level after five: sudden death.
    expect(shootoutOver([5, 4], [6, 5])).toBe(false); // Home scored, away still to kick.
    expect(shootoutOver([5, 4], [6, 6])).toBe(true);
    expect(shootoutOver([4, 3], [5, 4])).toBe(false); // Away can still level with their fifth.
    expect(shootoutOver([4, 2], [5, 4])).toBe(true); // Now they can't.
  });

  it("settles level ties on penalties", () => {
    const r = new Rng(9);
    for (let i = 0; i < 200; i++) {
      const [h, a] = shootout(r, 70, 70);
      expect(h).not.toBe(a);
    }
  });
});
