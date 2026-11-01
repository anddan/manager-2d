import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {Rng} from "./rng";
import {acceptNational, nationalSquad, nationalWeek, nations, offerNational, tournamentOf, FRIENDLY_WEEKS, TOURNAMENT_WEEKS} from "./national";

describe("national team", () => {
  it("has the World Cup every fourth year and the Euros two years after it", () => {
    expect([1, 2, 3, 4, 5, 6, 8].map(tournamentOf)).toEqual([null, "ec", null, "wc", null, "ec", "wc"]);
  });

  it("offers a country, picks its best players and plays a friendly and a tournament", () => {
    const g = newGame("Nat", 3, 51);
    const rng = new Rng(7);
    const field = nations(g);
    expect(field.length).toBeGreaterThan(3);
    offerNational(g, rng);
    expect(g.inbox[0].key).toBe("msg.nationalOffer");
    acceptNational(g, field[0].code);
    const squad = nationalSquad(g, field[0].code, "4-3-3");
    expect(squad.lineup.filter(Boolean).length).toBe(11);
    expect(squad.lineup.every((id) => !id || g.players[id].nationality === field[0].code)).toBe(true);
    g.season = 4;
    g.week = FRIENDLY_WEEKS[0];
    nationalWeek(g, rng);
    expect(g.national!.results).toHaveLength(1);
    for (const w of TOURNAMENT_WEEKS) {
      g.week = w;
      nationalWeek(g, rng);
    }
    const t = g.national!.tournament!;
    // 32 countries in eight groups of four, and a champion after the last week.
    expect(t.groups).toHaveLength(8);
    expect(new Set(t.groups.flat()).size).toBe(32);
    expect(t.groups.every((grp) => grp.length === 4)).toBe(true);
    expect(t.champion).toBeTruthy();
    // Three group matches, and then as many knockout matches as we kept winning (at most four).
    const played = g.national!.results.filter((r) => r.what !== "friendly");
    expect(played.length).toBeGreaterThanOrEqual(3);
    expect(played.length).toBeLessThanOrEqual(7);
    expect(played.filter((r) => r.what.endsWith(".g"))).toHaveLength(3);
  });
});

describe("a national match played live", () => {
  it("is set up like a club match, and everything is put back afterwards", async () => {
    const {LiveMatch} = await import("./live");
    const {dueNationalMatch, startNationalMatch, finishNationalMatch} = await import("./national");
    const g = newGame("Live", 3, 61);
    const rng = new Rng(9);
    const field = nations(g);
    acceptNational(g, field[0].code);
    const realClub = g.userClubId;
    const players = Object.keys(g.players).length;
    const clubs = Object.keys(g.clubs).length;
    g.season = 4;
    g.week = FRIENDLY_WEEKS[0];
    expect(dueNationalMatch(g)).not.toBeNull();
    expect(startNationalMatch(g, rng)).toBeNull();
    expect(g.userClubId).toBe(`nat:${field[0].code}`);
    expect(g.liveMatch).toBeTruthy();
    const live = new LiveMatch(g);
    live.playOut();
    g.liveMatch!.commands = live.allCommands();
    finishNationalMatch(g, rng);
    expect(g.userClubId).toBe(realClub);
    expect(g.liveMatch).toBeNull();
    expect(g.nationalMatch).toBeUndefined();
    expect(Object.keys(g.clubs)).toHaveLength(clubs);
    expect(Object.keys(g.players)).toHaveLength(players);
    expect(g.national!.results).toHaveLength(1);
    // Played already: nothing more due this week, and the week's processing doesn't play it again.
    expect(dueNationalMatch(g)).toBeNull();
    nationalWeek(g, rng);
    expect(g.national!.results).toHaveLength(1);
  });
});
