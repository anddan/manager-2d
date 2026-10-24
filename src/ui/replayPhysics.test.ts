// Plays a whole replay through the viewer's movement code.
import {describe, expect, it} from "vitest";
import {FORMATIONS} from "../game/constants";
import {newGame} from "../game/generate";
import {simulateMatch} from "../game/match";
import {Rng} from "../game/rng";
import {advance, buildOverrides, fullTimeStages, restartTouch, snap, type Ctx, type Scene} from "./MatchViewer";

/** Distance from p to the segment a-b. */
function segmentDistance(p: {x: number; y: number}, a: {x: number; y: number}, b: {x: number; y: number}): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const k = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + dx * k), p.y - (a.y + dy * k));
}

describe("replay movement", () => {
  const game = newGame("Physics", 2, 9);
  // A match with goals in it (the checks below look at goals); tried on copies, then played for real.
  const seed = [3, 4, 5, 6, 7, 8, 9, 10].find((n) => {
    const r = simulateMatch(structuredClone(game), new Rng(n), game.fixtures[0], true);
    return r.homeGoals + r.awayGoals > 0;
  })!;
  const report = simulateMatch(game, new Rng(seed), game.fixtures[0], true);
  const ctx: Ctx = {
    report,
    frames: report.frames,
    slots: {home: FORMATIONS[report.formations.home], away: FORMATIONS[report.formations.away]},
    players: game.players,
  };

  // Step like the animation does (~60 fps at 2x) and record each player's top speed.
  // With the same set-piece and kick-off positions as the viewer.
  const dyn = {overrides: buildOverrides(ctx, report.setPieces ?? []), push: {}};
  let scene = snap(ctx, 0, dyn);
  const topSeen: Record<string, number> = {};
  let ballJumps = 0;
  let turnsInSpace = 0;
  let turns = 0;
  let heading: {x: number; y: number} | null = null;
  for (let t = 0.03; t <= 90; t += 0.03) {
    // Like the viewer, play stops at goals, half-time and set pieces: everyone
    // lines up and the ball is placed (centre spot, or the set-piece spot), then play on.
    const restart = (f: (typeof report.frames)[number]) => ["goal", "setpiece", "kickoff", "goalkick", "throwin"].includes(f.kind ?? "");
    if (report.frames.some((f) => restart(f) && f.minute > t - 0.03 && f.minute <= t)) {
      scene = snap(ctx, t, dyn);
      heading = null;
      continue;
    }
    const before = scene.ball;
    scene = advance(scene, Math.min(90, t), ctx, dyn);
    // A sharp change of direction must happen at a player or at a spot it was struck to (a shot, out of play).
    const move = {x: scene.ball.x - before.x, y: scene.ball.y - before.y};
    const len = Math.hypot(move.x, move.y);
    if (len > 0.3) {
      if (heading && (heading.x * move.x + heading.y * move.y) / len < Math.cos(Math.PI / 4)) {
        turns++;
        // Within a stride and a reach: the player plays it on while both are moving during the step.
        // The turn happens somewhere in the step (a first-time pass can arrive and leave within it).
        const atPlayer = Object.values(scene.bodies).some((b) => Math.min(Math.hypot(b.x - before.x, b.y - before.y), Math.hypot(b.x - scene.ball.x, b.y - scene.ball.y)) < 6);
        const atSpot = report.frames.some((f) => !f.playerId && Math.hypot(f.x - before.x, f.y - before.y) < 2);
        if (!atPlayer && !atSpot) turnsInSpace++;
      }
      heading = {x: move.x / len, y: move.y / len};
    }
    if (len > 20) ballJumps++;
    for (const [id, b] of Object.entries(scene.bodies)) {
      topSeen[id] = Math.max(topSeen[id] ?? 0, Math.hypot(b.vx, b.vy));
      expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true);
      expect(b.x).toBeGreaterThan(-1);
      expect(b.x).toBeLessThan(101);
    }
  }

  it("moves the ball smoothly from touch to touch, never jumping", () => {
    expect(ballJumps).toBe(0);
  });

  it("only turns the ball at a player or where it was struck to", () => {
    console.log("ball turns", turns, "in open space", turnsInSpace);
    expect(turns).toBeGreaterThan(50);
    expect(turnsInSpace).toBe(0);
  });

  it("puts a scored ball in the back of the net and leaves it there until the kick-off", () => {
    // Played through like the viewer: lined up at every restart except goals, which play on.
    const goals = report.frames.map((f, i) => ({f, i})).filter(({f}) => f.kind === "goal");
    expect(goals.length).toBeGreaterThan(0);
    const restarts = ["setpiece", "kickoff", "goalkick", "throwin"];
    let s = snap(ctx, 0, dyn);
    const arrived = new Map<number, number>();
    // To the end of the match, added time included.
    const end = report.frames[report.frames.length - 1].minute + 0.5;
    for (let t = 0.02; t <= end; t += 0.02) {
      if (report.frames.some((f) => restarts.includes(f.kind ?? "") && f.minute > t - 0.02 && f.minute <= t)) {
        s = snap(ctx, t, dyn);
        continue;
      }
      s = advance(s, t, ctx, dyn);
      for (const {f, i} of goals) {
        const kickoff = report.frames[i + 1];
        const behindLine = s.ball.x > 100.5 || s.ball.x < -0.5;
        // When it got into the net (the first step it has)...
        if (s.reached >= i && !arrived.has(i)) arrived.set(i, t - f.minute);
        // ...and once in, it stays in until play restarts.
        if (s.reached >= i && s.reached < i + 1 && t < (kickoff?.minute ?? Infinity)) expect(behindLine).toBe(true);
      }
    }
    // Every goal in the net within the wait the viewer allows before it stops for the celebration.
    for (const {i} of goals) expect(arrived.get(i)).toBeLessThanOrEqual(0.4);
  });

  it("has attackers in the box when a cross comes in", () => {
    // Over several matches, since one match may have only a cross or two.
    let total = 0;
    let count = 0;
    for (const seed of [3, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]) {
      const r = simulateMatch(game, new Rng(seed), game.fixtures[seed % 7], true);
      const c: Ctx = {report: r, frames: r.frames, slots: {home: FORMATIONS[r.formations.home], away: FORMATIONS[r.formations.away]}, players: game.players};
      const d = {overrides: buildOverrides(c, r.setPieces ?? []), push: {}};
      const restarts = ["goal", "setpiece", "kickoff", "goalkick", "throwin"];
      const crosses = r.frames.filter((f, i) => {
        const prev = r.frames[i - 1];
        const depth = (x: number) => (prev?.possession === "home" ? x : 100 - x);
        // Met by an attacker, or cut out by the defence where it lands.
        const cross = (f.kind === "pass" || f.kind === "tackle" || f.kind === "save") && prev?.kind === "dribble" && depth(prev.x) > 88 && (prev.y < 12 || prev.y > 88);
        // From settled play: after a restart (a goal kick sends everyone back towards halfway) nobody
        // can sprint 40 m into the box in time for a quick cross.
        const settled = !r.frames.some((g) => restarts.includes(g.kind ?? "") && g.minute <= f.minute && g.minute > f.minute - 2);
        return cross && settled;
      });
      // Played through like the viewer, lining up at restarts; counted as each cross comes in
      // (most there at once while it's in the air, before anyone gets to it).
      let s = snap(c, 0, d);
      for (const cross of crosses) {
        const k = r.frames.indexOf(cross);
        const side = r.frames[k - 1].possession;
        const team = side === "home" ? r.lineups.home : r.lineups.away;
        let most = 0;
        for (let t = s.time + 0.02; t < cross.minute; t += 0.02) {
          if (r.frames.some((f) => restarts.includes(f.kind ?? "") && f.minute > t - 0.02 && f.minute <= t)) s = snap(c, t, d);
          else s = advance(s, t, c, d);
          if (s.reached !== k - 1 || !s.flying) continue;
          most = Math.max(most, Object.entries(s.bodies).filter(([id, b]) => {
            if (!team.includes(id)) return false;
            const depth = side === "home" ? b.x : 100 - b.x;
            return depth > 82 && b.y > 20 && b.y < 80;
          }).length);
        }
        total += most;
        count++;
      }
    }
    expect(count).toBeGreaterThan(10);
    console.log("attackers in the box at crosses", (total / count).toFixed(1), "over", count, "crosses");
    // The striker, often with a winger or attacking midfielder, while the ball is in the air.
    expect(total / count).toBeGreaterThanOrEqual(1.0);
  }, 30000);

  it("shoots from in and around the box, not from far out", () => {
    // Played through like the viewer; noted where the ball is when it gets to the touch a shot is struck from.
    const restarts = ["goal", "setpiece", "kickoff", "goalkick", "throwin"];
    const shots = ["goal", "nogoal", "save"];
    let s = snap(ctx, 0, dyn);
    const from: number[] = [];
    const seen = new Set<number>();
    const end = report.frames[report.frames.length - 1].minute;
    for (let t = 0.02; t <= end; t += 0.02) {
      if (report.frames.some((f) => restarts.includes(f.kind ?? "") && f.minute > t - 0.02 && f.minute <= t)) {
        s = snap(ctx, t, dyn);
        continue;
      }
      s = advance(s, t, ctx, dyn);
      const touch = report.frames[s.reached];
      const next = report.frames[s.reached + 1];
      if (touch && next && !seen.has(s.reached) && ["pass", "dribble"].includes(touch.kind ?? "") && shots.includes(next.kind ?? "")) {
        seen.add(s.reached);
        // From the shooting side (a save is the keeper's touch).
        from.push(touch.possession === "home" ? s.ball.x : 100 - s.ball.x);
      }
    }
    expect(from.length).toBeGreaterThan(3);
    const far = from.filter((d) => d < 65).length;
    console.log("shots", from.length, "from beyond 35 m:", far, "depths", from.map((d) => d.toFixed(0)).join(" "));
    expect(far).toBe(0);
  });

  it("stops for goals, set pieces and restarts only with the ball there", () => {
    // Like the viewer: each stop waits (up to two minutes) for the ball to get
    // to its touch: in the net, out of play, the foul.
    let forced = 0;
    const misses: string[] = [];
    let stopsSeen = 0;
    for (const seed of [3, 11, 12, 13]) {
      const r = simulateMatch(game, new Rng(seed), game.fixtures[seed % 7], true);
      const c: Ctx = {report: r, frames: r.frames, slots: {home: FORMATIONS[r.formations.home], away: FORMATIONS[r.formations.away]}, players: game.players};
      const d = {overrides: buildOverrides(c, r.setPieces ?? []), push: {}};
      const stops = r.frames
        .map((f, i) => ({f, i, wait: f.kind === "goal" || f.kind === "nogoal" ? i : i - 1}))
        .filter(({f}) => ["goal", "nogoal", "setpiece", "goalkick", "throwin"].includes(f.kind ?? ""));
      let s = snap(c, 0, d);
      for (const stop of stops) {
        if (stop.f.minute < s.time) continue;
        for (let guard = 0; guard < 20000; guard++) {
          const ready = s.reached >= stop.wait;
          if (s.time >= stop.f.minute - 1e-6 && (ready || s.time >= stop.f.minute + 2 - 1e-6)) break;
          const next = Math.min(ready ? stop.f.minute : stop.f.minute + 2, s.time + 1 / 72);
          s = advance(s, next, c, d);
        }
        stopsSeen++;
        if (s.reached < stop.wait) forced++;
        // Where the ball should be: in the net for a goal, else at the touch before (out of play, the foul).
        // Or on its way from there to where play restarts (brought back for the goal kick, to the corner flag).
        const at = r.frames[stop.wait];
        const goal = stop.f.kind === "goal" || stop.f.kind === "nogoal";
        const from = goal ? {x: at.x > 50 ? 101.8 : -1.8, y: at.y} : {x: at.x, y: at.y};
        const to = goal ? from : {x: stop.f.x, y: stop.f.y};
        const gap = segmentDistance(s.ball, from, to);
        if (gap > 4) misses.push(`${stop.f.kind} ${stop.f.minute.toFixed(1)}: ${gap.toFixed(0)} away`);
        // Then everyone lines up and the ball is placed, as the viewer does.
        s = snap(c, Math.max(s.time, stop.f.minute) + 0.001, d);
      }
    }
    console.log("stops", stopsSeen, "before the ball got there:", forced, misses.join(", "));
    expect(stopsSeen).toBeGreaterThan(40);
    expect(forced).toBe(0);
    expect(misses).toEqual([]);
  }, 30000);

  it("restarts from the taker's feet, even when the stop came late", () => {
    // Like the match screen: play waited a while for the ball, everyone lined
    // up, the ball was placed; then the keeper / thrower / kicker plays it on.
    let checked = 0;
    const bad: string[] = [];
    for (const seed of [3, 11]) {
      const r = simulateMatch(game, new Rng(seed), game.fixtures[seed % 7], true);
      const c: Ctx = {report: r, frames: r.frames, slots: {home: FORMATIONS[r.formations.home], away: FORMATIONS[r.formations.away]}, players: game.players};
      const d = {overrides: buildOverrides(c, r.setPieces ?? []), push: {}};
      r.frames.forEach((f, i) => {
        if (!["goalkick", "throwin", "kickoff"].includes(f.kind ?? "") || !r.frames[i + 2] || i === 0) return;
        const pause = f.kind === "kickoff" ? {kind: "goal", time: f.minute - 0.01, frameIndex: i - 1} : {kind: "restart", time: f.minute, frameIndex: i - 1};
        // Late: the clock is already past the next touch.
        const late = r.frames[i + 1].minute + 0.05;
        const lined = snap(c, f.minute + 0.001, d);
        const k = restartTouch(r.frames, pause, i + 1);
        expect(k).toBe(i);
        let s: Scene = {...lined, time: late, ball: {x: f.x, y: f.y}, reached: k, flying: false};
        let left = false;
        for (let step = 0; step < 400 && s.reached <= i; step++) {
          const before = s;
          s = advance(s, s.time + 1 / 72, c, d);
          if (!left && !before.flying && s.flying && before.reached === i) {
            left = true;
            const taker = before.bodies[f.playerId!];
            if (Math.hypot(taker.x - before.ball.x, taker.y - before.ball.y) > 2.5) bad.push(`${f.kind} ${f.minute.toFixed(1)}`);
          }
        }
        if (!left) bad.push(`${f.kind} ${f.minute.toFixed(1)} never played`);
        // And it went to the teammate it was meant for.
        expect(r.frames[s.reached].possession).toBe(f.possession);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(20);
    expect(bad).toEqual([]);
  }, 30000);

  it("at full time sends the winners to their fans, then everyone off down the tunnel", () => {
    const r = simulateMatch(game, new Rng(3), game.fixtures[3], true);
    const c: Ctx = {report: r, frames: r.frames, slots: {home: FORMATIONS[r.formations.home], away: FORMATIONS[r.formations.away]}, players: game.players};
    const end = snap(c, 95, {overrides: [], push: {}});
    const [mob, thank, off] = fullTimeStages(c, 95, "away", end.bodies);
    const inTunnel = (p: {x: number; y: number}) => Math.abs(p.x - 50) < 2 && p.y > 100;
    for (const id of r.lineups.away.filter((id) => off.targets[id])) {
      // Mob each other, then in front of the away fans behind the right-hand goal, then off.
      expect(Math.hypot(mob.targets[id].x - 62, mob.targets[id].y - 50)).toBeLessThan(5);
      expect(thank.targets[id].x).toBeGreaterThan(95);
      expect(inTunnel(off.targets[id])).toBe(true);
    }
    // The losers go off while the winners thank their fans.
    for (const id of r.lineups.home.filter((id) => off.targets[id])) expect(inTunnel(thank.targets[id])).toBe(true);
    // A few seconds with the fans.
    expect(thank.until - mob.until).toBeGreaterThanOrEqual(3000);
    // A draw: both just walk off down the tunnel, without the stop at the fans.
    const draw = fullTimeStages(c, 95, null, end.bodies);
    expect(draw[1].until).toBe(draw[0].until);
    expect([...r.lineups.home, ...r.lineups.away].filter((id) => draw[2].targets[id]).every((id) => inTunnel(draw[2].targets[id]))).toBe(true);
  });

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
