// Plays whole seasons without a user at the wheel and checks the numbers
// stay football-shaped: goals, growth, money and squad sizes.
import {describe, expect, it} from "vitest";
import {SEASON_WEEKS} from "./constants";
import {newGame} from "./generate";
import {overall, wageBill} from "./ratings";
import {Rng} from "./rng";
import {advanceWeek} from "./week";
import type {GameState} from "./types";

/** Plays a season; returns goals per match, counted before fixtures reset. */
function playSeason(state: GameState, rng: Rng): number {
  let goalsPerMatch = 0;
  for (let i = 0; i < SEASON_WEEKS; i++) {
    if (i === SEASON_WEEKS - 1) {
      const played = state.fixtures.filter((f) => f.played);
      goalsPerMatch = played.reduce((s, f) => s + f.homeGoals + f.awayGoals, 0) / played.length;
    }
    const result = advanceWeek(state, rng, Date.now(), {useEnergy: false});
    expect(result.ok).toBe(true);
  }
  return goalsPerMatch;
}

describe("a simulated season", () => {
  const state = newGame("Test", 6, 1234);
  const rng = new Rng(99);
  const startCash = Object.values(state.clubs).map((c) => c.cash);
  const youngsters = Object.values(state.players)
    .filter((p) => p.clubId && p.age <= 20 && p.potential - overall(p) >= 10)
    .map((p) => ({id: p.id, start: overall(p)}));
  const goalsPerMatch = playSeason(state, rng);

  it("finishes and starts the next season", () => {
    expect(state.history).toHaveLength(1);
    expect(state.week).toBe(1);
    expect(state.fixtures.every((f) => !f.played)).toBe(true);
  });

  it("has a realistic number of goals", () => {
    console.log("goals per match", goalsPerMatch.toFixed(2));
    expect(goalsPerMatch).toBeGreaterThan(2);
    expect(goalsPerMatch).toBeLessThan(3.6);
  });

  it("develops young talents, but not too fast", () => {
    const gains = youngsters
      .filter(({id}) => state.players[id])
      .map(({id, start}) => overall(state.players[id]) - start);
    const avg = gains.reduce((s, g) => s + g, 0) / gains.length;
    console.log("youth growth per season", avg.toFixed(2), "max", Math.max(...gains));
    expect(avg).toBeGreaterThan(1.5);
    expect(avg).toBeLessThan(8);
  });

  it("keeps clubs solvent but not swimming in money", () => {
    const change = Object.values(state.clubs).map((c, i) => c.cash - startCash[i]);
    console.log("cash change per club", change.map((c) => Math.round(c / 1000) + "k").join(" "));
    console.log("wage bills", Object.values(state.clubs).map((c) => Math.round(wageBill(state, c.id) / 1000) + "k").join(" "));
    expect(Object.values(state.clubs).filter((c) => c.cash < -3_000_000).length).toBeLessThanOrEqual(2);
  });

  it("keeps squads at a playable size", () => {
    for (const club of Object.values(state.clubs)) {
      const size = Object.values(state.players).filter((p) => p.clubId === club.id).length;
      expect(size).toBeGreaterThanOrEqual(16);
    }
  });

  it("can play a second season", () => {
    const goals = playSeason(state, rng);
    console.log("season 2 goals per match", goals.toFixed(2));
    expect(state.history).toHaveLength(2);
  }, 60_000);
});
