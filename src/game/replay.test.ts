// The replay must tell the same story as the result: the ball goes between
// teammates, possession changes through a tackle, and every goal is in it.
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {simulateMatch} from "./match";
import {Rng} from "./rng";

describe("match replay", () => {
  const game = newGame("Replay", 3, 77);
  const rng = new Rng(5);
  const reports = game.fixtures.slice(0, 7).map((f) => simulateMatch(game, rng, f, true));

  it("is in time order and inside the pitch", () => {
    for (const r of reports) {
      for (let i = 1; i < r.frames.length; i++) expect(r.frames[i].minute).toBeGreaterThanOrEqual(r.frames[i - 1].minute);
      for (const f of r.frames) {
        expect(f.x).toBeGreaterThanOrEqual(0);
        expect(f.x).toBeLessThanOrEqual(100);
        expect(f.y).toBeGreaterThanOrEqual(0);
        expect(f.y).toBeLessThanOrEqual(100);
      }
    }
  });

  it("only lets the side in possession touch the ball", () => {
    for (const r of reports) {
      for (const f of r.frames) {
        if (!f.playerId) continue;
        const club = f.possession === "home" ? r.homeId : r.awayId;
        expect(game.players[f.playerId].clubId).toBe(club);
      }
    }
  });

  it("passes to someone else and wins the ball back with a tackle", () => {
    for (const r of reports) {
      for (let i = 1; i < r.frames.length; i++) {
        const prev = r.frames[i - 1];
        const cur = r.frames[i];
        if (cur.kind === "pass" && prev.playerId && prev.possession === cur.possession && prev.kind !== "out") {
          expect(cur.playerId).not.toBe(prev.playerId);
        }
        if (prev.playerId && cur.playerId && prev.possession !== cur.possession) {
          expect(["tackle", "save", "kickoff", "pass"]).toContain(cur.kind);
        }
      }
    }
  });

  it("shows every goal", () => {
    for (const r of reports) {
      const inReplay = r.frames.filter((f) => f.kind === "goal").length;
      expect(inReplay).toBe(r.homeGoals + r.awayGoals);
    }
  });

  it("doesn't change results compared to not recording", () => {
    const fixture = game.fixtures[10];
    const seed = new Rng(123);
    const copy = structuredClone(game);
    const watched = simulateMatch(game, new Rng(seed.state), fixture, true);
    const unwatched = simulateMatch(copy, new Rng(seed.state), copy.fixtures[10], false);
    expect([watched.homeGoals, watched.awayGoals]).toEqual([unwatched.homeGoals, unwatched.awayGoals]);
    expect(unwatched.frames).toHaveLength(0);
  });
});
