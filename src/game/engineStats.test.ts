// The engine against real football. Plays a few hundred matches (without the replay, so it is quick) in two different leagues and checks that
// what comes out looks like football: goals, shots, cards, home advantage, that the better side wins more often, and that the chances are
// worth what they score. If a change to the engine throws these off, this is where it shows.
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {simulateMatch} from "./match";
import {overall} from "./ratings";
import {Rng} from "./rng";
import type {GameState} from "./types";

interface Stats {
  n: number;
  goals: number;
  shots: number;
  onTarget: number;
  xg: number;
  homeWins: number;
  draws: number;
  yellows: number;
  reds: number;
  penalties: number;
  corners: number;
  freekicks: number;
  fiveOrMore: number;
  /** Win rate of the stronger side (by the best eleven's rating) when it is clearly stronger. */
  strongWins: number;
  strongGames: number;
}

function measure(game: GameState, count: number, seedBase: number): Stats {
  const s: Stats = {n: 0, goals: 0, shots: 0, onTarget: 0, xg: 0, homeWins: 0, draws: 0, yellows: 0, reds: 0, penalties: 0, corners: 0, freekicks: 0, fiveOrMore: 0, strongWins: 0, strongGames: 0};
  const strength = (clubId: string) => {
    const top = Object.values(game.players).filter((p) => p.clubId === clubId).map((p) => overall(p)).sort((a, b) => b - a).slice(0, 14);
    return top.reduce((a, b) => a + b, 0) / Math.max(1, top.length);
  };
  for (let i = 0; i < count; i++) {
    const fx = game.fixtures[i % game.fixtures.length];
    const r = simulateMatch(structuredClone(game), new Rng(seedBase + i), fx, false);
    s.n++;
    const g = r.homeGoals + r.awayGoals;
    s.goals += g;
    if (g >= 5) s.fiveOrMore++;
    s.shots += (r.shots?.[0] ?? 0) + (r.shots?.[1] ?? 0);
    s.onTarget += (r.onTarget?.[0] ?? 0) + (r.onTarget?.[1] ?? 0);
    s.xg += (r.xg?.[0] ?? 0) + (r.xg?.[1] ?? 0);
    if (r.homeGoals > r.awayGoals) s.homeWins++;
    if (r.homeGoals === r.awayGoals) s.draws++;
    for (const e of r.events) {
      if (e.type === "yellow") s.yellows++;
      if (e.type === "red") s.reds++;
      if (e.type === "penalty") s.penalties++;
      if (e.type === "corner") s.corners++;
      if (e.type === "freekick") s.freekicks++;
    }
    // A clearly stronger side: the home side 3+ points better, or the away side 3+ points better.
    const hs = strength(fx.homeId);
    const as = strength(fx.awayId);
    if (Math.abs(hs - as) >= 3) {
      s.strongGames++;
      const homeStronger = hs > as;
      if (r.homeGoals !== r.awayGoals && (r.homeGoals > r.awayGoals) === homeStronger) s.strongWins++;
    }
  }
  return s;
}

const per = (x: number, n: number) => x / n;

describe("the engine against real football", () => {
  // Two different leagues: the balance must not depend on how strong the league is.
  const leagues: [string, GameState][] = [["league A", newGame("Stats", 2, 9)], ["league B", newGame("Stats", 6, 1234)]];

  for (const [name, game] of leagues) {
    const stats = measure(game, 240, 1000);
    const n = stats.n;
    const line = `${name}: goals ${per(stats.goals, n).toFixed(2)}, shots ${per(stats.shots, n).toFixed(1)}, on target ${per(stats.onTarget, n).toFixed(1)}, xG ${per(stats.xg, n).toFixed(2)}, home ${per(stats.homeWins, n).toFixed(2)} draw ${per(stats.draws, n).toFixed(2)}, yellows ${per(stats.yellows, n).toFixed(2)}, reds ${per(stats.reds, n).toFixed(2)}, penalties ${per(stats.penalties, n).toFixed(2)}, corners ${per(stats.corners, n).toFixed(1)}, freekicks ${per(stats.freekicks, n).toFixed(1)}, 5+ goals ${per(stats.fiveOrMore, n).toFixed(3)}, stronger side wins ${per(stats.strongWins, Math.max(1, stats.strongGames)).toFixed(2)} of ${stats.strongGames}`;

    it(`${name}: ${line}`, () => {
      console.log(line);
      // About 2.7 goals a match in the big leagues.
      expect(per(stats.goals, n)).toBeGreaterThan(2.4);
      expect(per(stats.goals, n)).toBeLessThan(3.2);
      // About 25 shots in a match, a few of them from corners and free kicks (not counted here): 18-25 from open play, 7-9 of them on target.
      expect(per(stats.shots, n)).toBeGreaterThan(18);
      expect(per(stats.shots, n)).toBeLessThan(26);
      expect(per(stats.onTarget, n)).toBeGreaterThan(6.5);
      expect(per(stats.onTarget, n)).toBeLessThan(10);
      expect(stats.onTarget / stats.shots).toBeGreaterThan(0.3);
      expect(stats.onTarget / stats.shots).toBeLessThan(0.45);
      // The chances are worth what they score (expected goals of the shots in open play against all the goals, which include penalties,
      // free kicks and corners, about a fifth of them).
      expect(stats.goals / stats.xg).toBeGreaterThan(1.0);
      expect(stats.goals / stats.xg).toBeLessThan(1.5);
      // The home side wins about 44 % and about a quarter are draws.
      expect(per(stats.homeWins, n)).toBeGreaterThan(0.36);
      expect(per(stats.homeWins, n)).toBeLessThan(0.52);
      expect(per(stats.draws, n)).toBeGreaterThan(0.18);
      expect(per(stats.draws, n)).toBeLessThan(0.32);
      // Cards and penalties.
      expect(per(stats.yellows, n)).toBeGreaterThan(2.6);
      expect(per(stats.yellows, n)).toBeLessThan(4.6);
      expect(per(stats.reds, n)).toBeLessThan(0.28);
      expect(per(stats.penalties, n)).toBeGreaterThan(0.15);
      expect(per(stats.penalties, n)).toBeLessThan(0.4);
      // Set pieces come often enough to play, not as often as in a real match (the ones the manager takes over stop the game).
      expect(per(stats.corners, n)).toBeGreaterThan(4);
      expect(per(stats.freekicks, n)).toBeGreaterThan(0.8);
      // Not too many high-scoring matches.
      expect(per(stats.fiveOrMore, n)).toBeLessThan(0.19);
      // The better side wins more often, but a good deal is left to chance.
      if (stats.strongGames >= 20) {
        const rate = stats.strongWins / stats.strongGames;
        expect(rate).toBeGreaterThan(0.5);
        expect(rate).toBeLessThan(0.85);
      }
    }, 300000);
  }
});
