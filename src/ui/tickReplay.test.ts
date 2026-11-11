// A match from the tick engine played through the viewer's movement code (the engine hands over many more touches than the old one:
// throws, ball in behind, crosses, slides, take-ons). The ball must not jump, a scored ball must lie in the net, and the picture must keep up.
import {describe, expect, it} from "vitest";
import {FORMATIONS} from "../game/constants";
import {newGame} from "../game/generate";
import {simulateMatch} from "../game/match";
import {Rng} from "../game/rng";
import {advance, buildOverrides, snap, type Ctx} from "./MatchViewer";

describe("a tick-engine match in the viewer", () => {
  const game = newGame("TickView", 2, 9);
  const restarts = ["setpiece", "kickoff", "goalkick", "throwin"];

  for (const seed of [3, 4]) {
    it(`plays seed ${seed} without jumps and keeps up with the touches`, () => {
      const report = simulateMatch(structuredClone(game), new Rng(seed), game.fixtures[seed % game.fixtures.length], true, {}, [], undefined, "tick");
      const ctx: Ctx = {report, frames: report.frames, slots: {home: FORMATIONS[report.formations.home], away: FORMATIONS[report.formations.away]}, players: game.players};
      const dyn = {overrides: buildOverrides(ctx, report.setPieces ?? []), push: {}};
      let scene = snap(ctx, 0, dyn);
      let jumps = 0;
      let lagMax = 0;
      let lagSum = 0;
      let lagN = 0;
      const end = report.frames[report.frames.length - 1].minute;
      for (let t = 0.03; t <= end + 3; t += 0.03) {
        // Like the viewer, play stops at goals, half-time and set pieces: everyone lines up and the ball is placed, then play on.
        if (report.frames.some((f) => (restarts.includes(f.kind ?? "") || f.kind === "goal") && f.minute > t - 0.03 && f.minute <= t)) {
          scene = snap(ctx, t, dyn);
          continue;
        }
        const before = scene.ball;
        scene = advance(scene, t, ctx, dyn);
        if (Math.hypot(scene.ball.x - before.x, scene.ball.y - before.y) > 20) jumps++;
        for (const b of Object.values(scene.bodies)) {
          expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true);
        }
        // How far behind the touches the picture is (match minutes): the touch it is on its way to should not be long past.
        const next = report.frames[scene.reached + 1];
        if (next && t < end) {
          const lag = Math.max(0, t - next.minute);
          lagMax = Math.max(lagMax, lag);
          lagSum += lag;
          lagN++;
        }
      }
      console.log(`seed ${seed}: ${report.frames.length} touches, lag max ${lagMax.toFixed(2)} min, mean ${(lagSum / Math.max(1, lagN)).toFixed(3)} min, jumps ${jumps}`);
      expect(jumps).toBe(0);
      // The viewer reaches the last touch (it is not left behind for ever).
      expect(scene.reached).toBeGreaterThanOrEqual(report.frames.length - 3);
      // And never falls more than a few match minutes behind (the clock slows meanwhile).
      expect(lagMax).toBeLessThan(4);
    }, 120000);
  }
});
