// The new match engine (tick.ts), a few matches played all the way through: it must run to the end without trouble, give the same match for
// the same seed (whether or not the replay frames are kept), and hand the match view frames that it can follow.
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {simulateMatch} from "./match";
import {Rng} from "./rng";

describe("the tick engine", () => {
  const game = newGame("Tick", 2, 9);
  const play = (seed: number, frames: boolean) => simulateMatch(structuredClone(game), new Rng(seed), game.fixtures[seed % game.fixtures.length], frames, {}, [], undefined, "tick");

  it("plays whole matches with goals, cards, set pieces and statistics", () => {
    let goals = 0;
    let fouls = 0;
    for (const seed of [1, 2, 3, 4]) {
      const r = play(seed, true);
      goals += r.homeGoals + r.awayGoals;
      fouls += r.stats?.fouls?.[0] ?? 0;
      expect(r.events.some((e) => e.type === "fulltime")).toBe(true);
      expect(r.shots![0] + r.shots![1]).toBeGreaterThan(5);
      expect(r.possessionHome).toBeGreaterThan(20);
      expect(r.possessionHome).toBeLessThan(80);
      for (const id of Object.keys(r.ratings)) {
        expect(r.ratings[id]).toBeGreaterThanOrEqual(3);
        expect(r.ratings[id]).toBeLessThanOrEqual(10);
      }
    }
    expect(goals).toBeGreaterThan(3);
    expect(fouls).toBeGreaterThan(0);
  }, 120000);

  it("gives the same match whether or not the frames are kept", () => {
    const a = play(7, true);
    const b = play(7, false);
    const c = play(8, false);
    expect([a.homeGoals, a.awayGoals, a.shots, a.events.length]).toEqual([b.homeGoals, b.awayGoals, b.shots, b.events.length]);
    expect(a.events.length === c.events.length && a.homeGoals === c.homeGoals && a.shots![0] === c.shots![0]).toBe(false);
  }, 120000);

  it("hands the match view frames in time order, on the pitch, with the kick-off first", () => {
    const r = play(5, true);
    expect(r.frames.length).toBeGreaterThan(100);
    expect(r.frames[0].kind).toBe("kickoff");
    let last = -1;
    for (const f of r.frames) {
      expect(f.minute).toBeGreaterThanOrEqual(last);
      last = f.minute;
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.x).toBeLessThanOrEqual(100);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeLessThanOrEqual(100);
      // A ball is only played up to head height (and a header is not at the feet).
      if (f.air !== undefined) {
        expect(f.air).toBeGreaterThanOrEqual(0.6);
        expect(f.air).toBeLessThanOrEqual(2.5);
      }
    }
    // A goal is followed by a kick-off.
    r.frames.forEach((f, i) => {
      if (f.kind !== "goal") return;
      const next = r.frames[i + 1];
      if (next) expect(["kickoff", "setpiece"]).toContain(next.kind);
    });
  }, 120000);
});

describe("the manager's own live match with the tick engine", () => {
  it("is played through with the manager taking set pieces, and counts as it showed", async () => {
    const {LiveMatch} = await import("./live");
    const {ENGINE} = await import("./match");
    const {finishWeek, startWeek} = await import("./week");
    ENGINE.mode = "tick";
    try {
      const g = structuredClone(newGame("TickLive", 5, 31));
      const rng = new Rng(4);
      for (let week = 0; week < 40; week++) {
        const started = startWeek(g, rng, Date.now(), {useEnergy: false});
        if (!started.ok) throw new Error(started.reason);
        if (!started.live) {
          finishWeek(g, rng);
          continue;
        }
        expect(g.liveMatch?.engine).toBe("tick");
        const live = new LiveMatch(g);
        live.manualSubs = false; // as in the app by default: the assistant makes the tactical changes, also when it is counted
        let answered = 0;
        for (let guard = 0; guard < 500 && !live.done; guard++) {
          live.advanceTo(Infinity);
          if (live.pending) {
            const sp = live.pending;
            const input = live.role(sp) === "shooter" ? {aim: {x: -0.6, y: 0.5}, target: "far" as const} : {dive: 0.5};
            g.liveMatch!.inputs[sp.index] = input;
            live.answer(input);
            answered++;
          } else if (live.stop) {
            live.continue();
          }
        }
        expect(live.done).toBe(true);
        g.liveMatch!.commands = live.allCommands();
        const counted = finishWeek(g, rng)!;
        expect([counted.homeGoals, counted.awayGoals]).toEqual([live.report.homeGoals, live.report.awayGoals]);
        expect(live.report.frames.length).toBeGreaterThan(50);
        void answered;
        return;
      }
      throw new Error("No live match in 40 weeks");
    } finally {
      ENGINE.mode = "minute";
    }
  }, 240000);
});
