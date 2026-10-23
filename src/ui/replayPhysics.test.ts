// Plays a whole replay through the viewer's movement code.
import {describe, expect, it} from "vitest";
import {FORMATIONS} from "../game/constants";
import {newGame} from "../game/generate";
import {simulateMatch} from "../game/match";
import {Rng} from "../game/rng";
import {advance, snap, type Ctx} from "./MatchViewer";

describe("replay movement", () => {
  const game = newGame("Physics", 2, 9);
  const report = simulateMatch(game, new Rng(3), game.fixtures[0], true);
  const ctx: Ctx = {
    report,
    frames: report.frames,
    slots: {home: FORMATIONS[report.formations.home], away: FORMATIONS[report.formations.away]},
    players: game.players,
  };

  // Step like the animation does (~60 fps at 2x) and record each player's top speed.
  let scene = snap(ctx, 0);
  const topSeen: Record<string, number> = {};
  for (let t = 0.03; t <= 90; t += 0.03) {
    scene = advance(scene, Math.min(90, t), ctx);
    for (const [id, b] of Object.entries(scene.bodies)) {
      topSeen[id] = Math.max(topSeen[id] ?? 0, Math.hypot(b.vx, b.vy));
      expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true);
      expect(b.x).toBeGreaterThan(-1);
      expect(b.x).toBeLessThan(101);
    }
  }

  it("keeps everyone and the ball on the pitch", () => {
    expect(Number.isFinite(scene.ball.x)).toBe(true);
    expect(Object.keys(scene.bodies).length).toBeGreaterThanOrEqual(18);
  });

  it("lets quick players run faster than slow ones", () => {
    const outfield = Object.keys(topSeen)
      .map((id) => game.players[id])
      .filter((p) => p.position !== "GK" && topSeen[p.id] > 0);
    const byPace = outfield.sort((a, b) => b.attrs.pace - a.attrs.pace);
    const fast = byPace.slice(0, 4).reduce((s, p) => s + topSeen[p.id], 0) / 4;
    const slow = byPace.slice(-4).reduce((s, p) => s + topSeen[p.id], 0) / 4;
    console.log("top speed, fastest four vs slowest four:", fast.toFixed(1), slow.toFixed(1));
    expect(fast).toBeGreaterThan(slow * 1.1);
  });
});
