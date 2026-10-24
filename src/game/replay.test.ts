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
    let cutOut = 0;
    for (const r of reports) {
      r.frames.forEach((f, i) => {
        const next = r.frames[i + 1];
        const depth = (x: number, side: string) => (side === "home" ? x : 100 - x);
        const atByline = f.kind === "dribble" && depth(f.x, f.possession) > 88 && (f.y < 12 || f.y > 88);
        if (!atByline || !next || depth(next.x, f.possession) < 83 || next.y < 30 || next.y > 70) return;
        // Met by an attacker, or headed away / claimed by the keeper.
        if (next.kind === "pass" && next.possession === f.possession) crosses++;
        else if ((next.kind === "tackle" || next.kind === "save") && next.possession !== f.possession) cutOut++;
      });
    }
    expect(crosses).toBeGreaterThan(1);
    expect(cutOut).toBeGreaterThan(3);
    expect(crosses + cutOut).toBeGreaterThan(6);
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

  it("plays every kick-off back to a teammate", () => {
    for (const r of reports) {
      r.frames.forEach((f, i) => {
        if (f.kind !== "kickoff") return;
        const next = r.frames[i + 1];
        if (!next) return;
        expect(next.kind).toBe("pass");
        expect(next.possession).toBe(f.possession);
        expect(next.playerId).not.toBe(f.playerId);
        // Backwards, into their own half, and kept: the other side doesn't win it straight back.
        expect(f.possession === "home" ? next.x : 100 - next.x).toBeLessThan(50);
        if (r.frames[i + 2]) expect(r.frames[i + 2].possession).toBe(f.possession);
      });
    }
  });

  it("never leaves an attacker free in front of goal without a shot", () => {
    // A touch by the attacking side in the box is followed by a shot, or the
    // defence (or keeper) getting it, or a cross / ball out, never a pass back out.
    let inBox = 0;
    for (const r of reports) {
      r.frames.forEach((f, i) => {
        const next = r.frames[i + 1];
        if (!f.playerId || !next || ["save", "tackle", "goalkick", "throwin", "setpiece", "kickoff"].includes(f.kind ?? "")) return;
        const depth = (x: number) => (f.possession === "home" ? x : 100 - x);
        if (depth(f.x) < 84 || f.y < 20 || f.y > 80) return;
        inBox++;
        const backOut = next.possession === f.possession && next.kind === "pass" && depth(next.x) < 70;
        expect(backOut).toBe(false);
      });
    }
    expect(inBox).toBeGreaterThan(30);
  });

  it("lets the keeper keep the ball after a save and play it out", () => {
    let saves = 0;
    for (const r of reports) {
      r.frames.forEach((f, i) => {
        const next = r.frames[i + 1];
        if (f.kind !== "save" || !next || next.kind === "kickoff") return; // Half-time can come first.
        // Walks it to the edge of the box, then plays it to a teammate who keeps it.
        expect(next.kind).toBe("dribble");
        expect(next.playerId).toBe(f.playerId);
        const out = r.frames[i + 2];
        if (!out) return;
        expect(out.kind).toBe("pass");
        expect(out.possession).toBe(f.possession);
        // Not dropped at their feet: well away from the keeper.
        expect(Math.hypot(out.x - next.x, out.y - next.y)).toBeGreaterThan(8);
        if (r.frames[i + 3]) expect(r.frames[i + 3].possession).toBe(f.possession);
        saves++;
      });
    }
    expect(saves).toBeGreaterThan(5);
  });

  it("mixes in through balls, long balls and crosses", () => {
    const count = (flight: string) => reports.reduce((n, r) => n + r.frames.filter((f) => f.flight === flight).length, 0);
    expect(count("through")).toBeGreaterThan(10);
    expect(count("long")).toBeGreaterThan(10);
    expect(count("cross")).toBeGreaterThan(5);
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
