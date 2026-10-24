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

  it("restarts with a goal kick or throw-in by the other side after the ball goes out", () => {
    let goalKicks = 0;
    let throwIns = 0;
    for (const r of reports) {
      r.frames.forEach((f, i) => {
        const next = r.frames[i + 1];
        // Half-time comes first; a corner (the set piece by the attacking side) is its own restart.
        if (f.kind !== "out" || !next || next.kind === "kickoff" || next.kind === "setpiece") return;
        expect(["goalkick", "throwin"]).toContain(next.kind);
        expect(next.possession).not.toBe(f.possession);
        if (next.kind === "goalkick") {
          goalKicks++;
          // In the six-yard box, by the keeper.
          expect(next.x < 10 || next.x > 90).toBe(true);
          expect(game.players[next.playerId!].position).toBe("GK");
        } else {
          throwIns++;
          expect(next.y <= 1 || next.y >= 99).toBe(true);
        }
        // Then played on to a teammate.
        expect(r.frames[i + 2]?.possession).toBe(next.possession);
      });
    }
    expect(goalKicks).toBeGreaterThan(5);
    expect(throwIns).toBeGreaterThan(20);
  });

  it("brings the ball to where a set piece is taken before it's taken", () => {
    let checked = 0;
    for (const r of reports) {
      r.frames.forEach((f, i) => {
        if (f.kind !== "setpiece") return;
        const prev = r.frames[i - 1];
        // Out for a corner on that side, or the foul right by the spot.
        expect(Math.hypot(prev.x - f.x, prev.y - f.y)).toBeLessThan(40);
        const depth = f.possession === "home" ? prev.x : 100 - prev.x;
        expect(depth).toBeGreaterThan(65);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(5);
  });

  it("has wingers going down the line and crossing into the box", () => {
    let crosses = 0;
    for (const r of reports) {
      r.frames.forEach((f, i) => {
        const next = r.frames[i + 1];
        const depth = (x: number, side: string) => (side === "home" ? x : 100 - x);
        const atByline = f.kind === "dribble" && depth(f.x, f.possession) > 88 && (f.y < 12 || f.y > 88);
        if (atByline && next?.kind === "pass" && next.possession === f.possession && depth(next.x, next.possession) > 83 && next.y > 30 && next.y < 70) crosses++;
      });
    }
    expect(crosses).toBeGreaterThan(5);
  });

  it("sometimes rules a goal out, and then it doesn't count", () => {
    const rng2 = new Rng(77);
    let goals = 0;
    let ruledOut = 0;
    for (let k = 0; k < 60; k++) {
      const r = simulateMatch(game, rng2, game.fixtures[k % game.fixtures.length], true);
      const goalEvents = r.events.filter((e) => e.type === "goal");
      const disallowed = r.events.filter((e) => e.type === "disallowed");
      // The score is the goals that stood; each ruled-out goal is a ball in the net in the replay.
      expect(r.homeGoals + r.awayGoals).toBe(goalEvents.length);
      expect(r.frames.filter((f) => f.kind === "nogoal").length).toBe(disallowed.length);
      for (const e of disallowed) expect(["offside", "foul", "handball"]).toContain(e.note);
      goals += goalEvents.length;
      ruledOut += disallowed.length;
    }
    const share = ruledOut / (goals + ruledOut);
    expect(share).toBeGreaterThan(0.02);
    expect(share).toBeLessThan(0.15);
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
