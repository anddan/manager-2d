// Plays back a match from the touches the engine recorded (passes, dribbles,
// tackles, shots). Stored matches are replays; the user's match this week is
// live: it stops at set pieces for the user to take, and the manager can tap
// a player to shout instructions or bring on a substitute.
//
// Every player moves on their own:
// - the player about to receive the ball runs to meet it,
// - the nearest defender presses the ball,
// - everyone else holds their spot in the team's shape, which shifts with the ball.
// Top speed comes from pace and drops late in the game for players with low
// stamina, so quick players visibly get there first. Sprinting players leave a trail.
// Goals stop play for a celebration and a kick-off from the centre spot;
// penalties, free kicks and corners stop play while the players line up.
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {FORMATIONS, type Slot} from "../game/constants";
import {LiveMatch} from "../game/live";
import {distance, fromSide, kickoffSpot, progressFor, teamSpot, type Point} from "../game/pitch";
import {overall} from "../game/ratings";
import {aerial, type SetPiece, type SetPieceInput, type SetPieceOutcome} from "../game/setpieces";
import {
  INSTRUCTIONS,
  type Frame,
  type GameState,
  type InstructionKey,
  type InstructionLevel,
  type MatchEvent,
  type MatchReport,
  type Side,
} from "../game/types";
import {finishWeek} from "../game/week";
import {useT} from "../i18n";
import {useGame, useGameState} from "../store";
import {Bar, Modal, PosBadge} from "./common";
import {SetPieceView} from "./SetPieceView";

const SPEEDS = [1, 2, 4, 8];
/** Real milliseconds per match minute at 1x. */
const MS_PER_MINUTE = 1200;
/** Physics step in match minutes. */
const STEP = 0.02;
/** Share of the gap between touches that the carrier keeps the ball. */
const HOLD = 0.3;
const GOAL_PAUSE_MS = 2800;
const SETUP_PAUSE_MS = 1700;
const SHOUT_MS = 3200;
const CORNERS_KEY = "manager2d.manualCorners";

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  sprint: boolean;
}

export interface Scene {
  time: number;
  ball: Point;
  bodies: Record<string, Body>;
}

export interface Ctx {
  report: MatchReport;
  frames: Frame[];
  slots: Record<Side, Slot[]>;
  players: GameState["players"];
}

/** Fixed positions for a stretch of play: kick-offs and set pieces. */
interface Override {
  from: number;
  to: number;
  targets: Record<string, Point>;
}

/** Things that change during playback and steer movement. */
export interface Dyn {
  overrides: Override[];
  /** "Push forward" (+1) or "stay back" (-1) per player. */
  push: Record<string, number>;
}

const NO_DYN: Dyn = {overrides: [], push: {}};

/** Who is on the pitch in which slot at minute t. */
function onPitchAt(report: MatchReport, side: Side, t: number): Map<number, string> {
  const lineup = side === "home" ? report.lineups.home : report.lineups.away;
  const slots = new Map<number, string>();
  lineup.forEach((id, i) => {
    if (id && report.ratings[id] !== undefined) slots.set(i, id);
  });
  const subbedOut = new Set(report.events.filter((e) => e.type === "sub").map((e) => e.playerId));
  for (const e of report.events) {
    if (e.minute > t || e.side !== side || !e.playerId) continue;
    const slot = [...slots.entries()].find(([, id]) => id === e.playerId)?.[0];
    if (slot === undefined) continue;
    if (e.type === "sub" && e.otherId) slots.set(slot, e.otherId);
    if (e.type === "red" || (e.type === "injury" && !subbedOut.has(e.playerId))) slots.delete(slot);
  }
  return slots;
}

/** Index of the last touch at or before t, or -1. */
function touchIndex(frames: Frame[], t: number): number {
  let lo = 0;
  let hi = frames.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].minute <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/** Top running speed in pitch units per match minute. */
function topSpeed(ctx: Ctx, id: string, t: number): number {
  const p = ctx.players[id];
  if (!p) return 20;
  const tiring = 1 - (t / 90) * (1 - p.attrs.stamina / 100) * 0.35;
  // Pace 40 -> ~19, pace 85 -> ~32 units a minute: a clear gap on screen.
  return (8 + p.attrs.pace * 0.28) * tiring;
}

/** A small personal drift so nobody stands perfectly still. */
function wander(id: string, t: number): Point {
  const h = [...id].reduce((s, c) => s + c.charCodeAt(0), 0);
  return {x: Math.sin(t * 0.8 + h) * 2.5, y: Math.cos(t * 0.6 + h * 1.7) * 3};
}

/** Kick-off: everyone in their own half, the taker on the centre spot. */
function kickoffTargets(ctx: Ctx, t: number, kickerId?: string): Record<string, Point> {
  const targets: Record<string, Point> = {};
  for (const side of ["home", "away"] as const) {
    for (const [slot, id] of onPitchAt(ctx.report, side, t)) targets[id] = kickoffSpot(ctx.slots[side][slot], side);
  }
  if (kickerId) targets[kickerId] = {x: 50, y: 50};
  return targets;
}

/**
 * Where everyone stands for a set piece, worked out in the attacking side's
 * view (attacking towards 100) and converted at the end.
 */
function setupTargets(ctx: Ctx, sp: SetPiece, t: number): Record<string, Point> {
  const att = sp.side;
  const def: Side = att === "home" ? "away" : "home";
  const at = (depth: number, width: number) => fromSide(att, depth, width);
  const spotDepth = progressFor(att, sp.spot.x);
  const spotWidth = att === "home" ? sp.spot.y : 100 - sp.spot.y;
  const targets: Record<string, Point> = {};
  const attackers: string[] = [];
  const defenders: string[] = [];
  for (const [side, list] of [[att, attackers], [def, defenders]] as const) {
    for (const [slot, id] of onPitchAt(ctx.report, side, t)) {
      if (ctx.slots[side][slot].pos === "GK") {
        // Defending keeper on the line; the other keeper stays home.
        targets[id] = side === def ? at(99.4, 50) : at(5, 50);
      } else if (id !== sp.takerId) {
        list.push(id);
      }
    }
  }
  targets[sp.takerId] = at(spotDepth - 1.5, spotWidth);
  const byAir = (ids: string[]) => ids.slice().sort((a, b) => aerial(ctx.players[b]) - aerial(ctx.players[a]));

  if (sp.kind === "penalty") {
    // Everyone else outside the box, around the edge.
    const edge = [24, 76, 32, 68, 38, 62, 28, 72, 44, 56, 35, 65, 41, 59, 30, 70, 47, 53, 26, 74];
    [...attackers, ...defenders].forEach((id, i) => {
      // Staggered, so it looks like a crowd waiting at the edge rather than a line.
      targets[id] = at(82.5 - (i % 3) * 2.4 - (i >= 12 ? 3 : 0), edge[i % edge.length]);
    });
    return targets;
  }

  // Defenders stay goal side of the attacker they mark.
  const mark = (pairs: {depth: number; width: number}[], extraAttackers: number) => {
    const runners = byAir(attackers).slice(0, pairs.length);
    runners.forEach((id, i) => (targets[id] = at(pairs[i].depth, pairs[i].width)));
    const markers = defenders.filter((id) => !targets[id]).slice(0, runners.length);
    markers.forEach((id, i) => (targets[id] = at(pairs[i].depth + 1.6, pairs[i].width + 1)));
    // The rest: a couple stay back for the counter, the others hold the edge of the box.
    attackers.filter((id) => !targets[id]).forEach((id, i) => (targets[id] = at(i < extraAttackers ? 78 : 55, 30 + i * 12)));
    defenders.filter((id) => !targets[id]).forEach((id, i) => (targets[id] = at(i === 0 ? 62 : 84, 35 + i * 10)));
  };

  if (sp.kind === "freekick") {
    // The wall: four defenders 9 m towards goal, side by side.
    const dx = 100 - spotDepth;
    const dy = 50 - spotWidth;
    const len = Math.hypot(dx, dy) || 1;
    const wall = defenders.slice(0, 4);
    wall.forEach((id, i) => {
      const along = 9.15 / len;
      const offset = (i - 1.5) * 1.7;
      targets[id] = at(spotDepth + dx * along - (dy / len) * offset, spotWidth + dy * along + (dx / len) * offset);
    });
    defenders.splice(0, wall.length);
    mark([{depth: 90, width: 42}, {depth: 91, width: 52}, {depth: 88, width: 60}, {depth: 92, width: 47}], 2);
    return targets;
  }

  // Corner: the best in the air go to the near post, penalty spot and far post.
  const flag = sp.wallSide;
  mark(
    [
      {depth: 95, width: 50 + flag * 6},
      {depth: 89, width: 50},
      {depth: 94, width: 50 - flag * 7},
      {depth: 92, width: 46},
      {depth: 81, width: 50},
    ],
    1
  );
  // Two more defenders guard the posts.
  defenders.filter((id) => !targets[id] || progressFor(att, targets[id].x) > 83).slice(-2).forEach((id, i) => {
    targets[id] = at(98.6, i === 0 ? 46 : 54);
  });
  return targets;
}

export function buildOverrides(ctx: Ctx, setPieces: SetPiece[]): Override[] {
  const frames = ctx.frames;
  const out: Override[] = [{from: 0, to: frames[0]?.minute ?? 0.4, targets: kickoffTargets(ctx, 0, frames[0]?.playerId)}];
  frames.forEach((f, i) => {
    const next = frames[i + 1];
    if (f.kind === "goal") {
      const kicker = next?.kind === "kickoff" ? next.playerId : undefined;
      out.push({from: f.minute, to: next?.minute ?? f.minute + 1, targets: kickoffTargets(ctx, f.minute, kicker)});
    } else if (f.kind === "setpiece") {
      const sp = setPieces.find((s) => s.minute === Math.ceil(f.minute) && s.side === f.possession);
      if (sp) out.push({from: f.minute - 0.001, to: next?.minute ?? f.minute + 0.3, targets: setupTargets(ctx, sp, f.minute)});
    }
  });
  return out;
}

/** "Push forward" / "stay back" at time t, from the instruction events. */
function pushesAt(report: MatchReport, t: number): Record<string, number> {
  const push: Record<string, number> = {};
  for (const e of report.events) {
    if (e.type !== "instruction" || e.minute > t || !e.playerId || !e.note?.startsWith("position")) continue;
    push[e.playerId] = e.note.endsWith("+") ? 1 : e.note.endsWith("-") ? -1 : 0;
  }
  return push;
}

function possessionAt(ctx: Ctx, t: number): Side {
  const i = touchIndex(ctx.frames, t);
  return i >= 0 ? ctx.frames[i].possession : "home";
}

/** Everyone in place, the ball at the latest touch: used when jumping in time. */
export function snap(ctx: Ctx, t: number, dyn: Dyn = NO_DYN): Scene {
  const i = touchIndex(ctx.frames, t);
  const ball = i >= 0 && ctx.frames[i].kind !== "goal" ? {x: ctx.frames[i].x, y: ctx.frames[i].y} : {x: 50, y: 50};
  const possession = possessionAt(ctx, t);
  const override = dyn.overrides.find((o) => t >= o.from && t < o.to);
  const bodies: Record<string, Body> = {};
  for (const side of ["home", "away"] as const) {
    for (const [slot, id] of onPitchAt(ctx.report, side, t)) {
      const spot = override?.targets[id] ?? teamSpot(ctx.slots[side][slot], side, ball, possession === side, dyn.push[id] ?? 0);
      bodies[id] = {...spot, vx: 0, vy: 0, sprint: false};
    }
  }
  return {time: t, ball, bodies};
}

/** Moves the scene forward to t1 in small steps. Pure: returns a new scene. */
export function advance(prev: Scene, t1: number, ctx: Ctx, dyn: Dyn = NO_DYN): Scene {
  let ball = {...prev.ball};
  const bodies: Record<string, Body> = {};
  for (const [id, b] of Object.entries(prev.bodies)) bodies[id] = {...b};
  let t = prev.time;

  while (t < t1 - 1e-9) {
    const dt = Math.min(STEP, t1 - t);
    t += dt;
    const i = touchIndex(ctx.frames, t);
    const cur = i >= 0 ? ctx.frames[i] : undefined;
    const next = ctx.frames[i + 1];
    const possession: Side = cur?.possession ?? "home";
    const override = dyn.overrides.find((o) => t >= o.from && t < o.to);

    // Ball: in the net after a goal (then back on the spot), with the carrier
    // for a moment, then on its way to the next touch.
    if (cur?.kind === "goal") {
      ball = t - cur.minute < 0.02 ? {x: cur.x, y: cur.y} : {x: 50, y: 50};
    } else if (cur && next) {
      const span = next.minute - cur.minute;
      const held = cur.playerId && next.playerId !== cur.playerId && t - cur.minute < span * HOLD;
      const carrier = cur.playerId ? bodies[cur.playerId] : undefined;
      if (held && carrier) {
        ball = {x: carrier.x, y: carrier.y};
      } else {
        const left = Math.max(next.minute - t, dt);
        const k = Math.min(1, dt / left);
        ball = {x: ball.x + (next.x - ball.x) * k, y: ball.y + (next.y - ball.y) * k};
      }
    } else if (cur?.playerId && bodies[cur.playerId]) {
      ball = {x: bodies[cur.playerId].x, y: bodies[cur.playerId].y};
    }

    for (const side of ["home", "away"] as const) {
      const onPitch = onPitchAt(ctx.report, side, t);
      // The nearest outfield player of the side without the ball presses it.
      let presser: string | undefined;
      if (side !== possession && !override) {
        let best = Infinity;
        for (const [slot, id] of onPitch) {
          const b = bodies[id];
          if (!b || ctx.slots[side][slot].pos === "GK") continue;
          const d = distance(b, ball);
          if (d < best) {
            best = d;
            presser = id;
          }
        }
      }
      for (const [slot, id] of onPitch) {
        const spot = teamSpot(ctx.slots[side][slot], side, ball, possession === side, dyn.push[id] ?? 0);
        const body = bodies[id] ?? {...spot, vx: 0, vy: 0, sprint: false};
        const w = wander(id, t);
        let target: Point = {x: spot.x + w.x, y: spot.y + w.y};
        let sprint = false;
        if (next?.playerId === id && next.minute - t < 1) {
          target = {x: next.x, y: next.y};
          sprint = true;
        } else if (override?.targets[id]) {
          target = override.targets[id];
          sprint = distance(body, target) > 6;
        } else if (cur?.playerId === id && next && t - cur.minute < (next.minute - cur.minute) * HOLD) {
          target = {x: cur.x, y: cur.y};
        } else if (id === presser) {
          target = ball;
          sprint = true;
        }
        const top = topSpeed(ctx, id, t);
        const speed = sprint ? top : top * 0.45;
        const dx = target.x - body.x;
        const dy = target.y - body.y;
        const gap = Math.hypot(dx, dy);
        const move = Math.min(gap, speed * dt);
        const nx = gap > 0 ? (dx / gap) * move : 0;
        const ny = gap > 0 ? (dy / gap) * move : 0;
        bodies[id] = {x: body.x + nx, y: body.y + ny, vx: nx / dt, vy: ny / dt, sprint: sprint && move / dt > top * 0.6};
      }
    }
  }
  // Drop players who went off.
  const onNow = new Set([...onPitchAt(ctx.report, "home", t1).values(), ...onPitchAt(ctx.report, "away", t1).values()]);
  for (const id of Object.keys(bodies)) if (!onNow.has(id)) delete bodies[id];
  return {time: t1, ball, bodies};
}

/** While play is stopped: everyone jogs (or sprints) to their target spots. */
function regroup(prev: Scene, dt: number, ctx: Ctx, targets: Record<string, Point>): Scene {
  const bodies: Record<string, Body> = {};
  for (const [id, b] of Object.entries(prev.bodies)) {
    const target = targets[id];
    if (!target) {
      bodies[id] = {...b, vx: 0, vy: 0, sprint: false};
      continue;
    }
    const top = topSpeed(ctx, id, prev.time);
    const dx = target.x - b.x;
    const dy = target.y - b.y;
    const gap = Math.hypot(dx, dy);
    const move = Math.min(gap, top * dt);
    const nx = gap > 0 ? (dx / gap) * move : 0;
    const ny = gap > 0 ? (dy / gap) * move : 0;
    bodies[id] = {x: b.x + nx, y: b.y + ny, vx: nx / dt, vy: ny / dt, sprint: move / dt > top * 0.6};
  }
  return {...prev, bodies};
}

/** Replays a stored match. */
export function MatchViewer({fixtureId}: {fixtureId: string}) {
  const game = useGameState();
  const watchMatch = useGame((s) => s.watchMatch);
  const report = game.reports.find((r) => r.fixtureId === fixtureId);
  if (!report) return null;
  return <MatchScreen report={report} onClose={() => watchMatch(null)} />;
}

/** The user's match, played live. */
export function LiveMatchViewer() {
  const game = useGameState();
  const act = useGame((s) => s.act);
  const [live] = useState(() => {
    const m = new LiveMatch(game);
    try {
      m.manualCorners = localStorage.getItem(CORNERS_KEY) !== "auto";
    } catch {
      // Default: take corners yourself.
    }
    return m;
  });
  // Closing early lets the computer decide the rest; either way the week goes on.
  const finish = () => {
    live.playOut();
    act((g, rng) => finishWeek(g, rng));
  };
  return <MatchScreen report={live.report} live={live} onClose={finish} onFinish={finish} />;
}

interface ScreenProps {
  report: MatchReport;
  live?: LiveMatch;
  onClose: () => void;
  onFinish?: () => void;
}

interface Pause {
  key: string;
  kind: "goal" | "setup";
  time: number;
  side: Side;
  sp?: SetPiece;
}

interface Freeze extends Pause {
  started: number;
  duration: number;
  targets: Record<string, Point>;
  /** Goals: the scorers' teammates mob the scorer first. */
  huddle?: Record<string, Point>;
  scorerId?: string;
}

interface Shout {
  id: number;
  playerId: string;
  text: string;
}

const setPieceKey = (sp: {minute: number; side: Side}) => `s${sp.minute}-${sp.side}`;

function MatchScreen({report, live, onClose, onFinish}: ScreenProps) {
  const {t, tx} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const ctx = useMemo<Ctx>(
    () => ({
      report,
      frames: report.frames,
      slots: {home: FORMATIONS[report.formations.home], away: FORMATIONS[report.formations.away]},
      players: game.players,
    }),
    // Players only matter for pace and stamina, which don't change mid-replay.
    [report]
  );
  const [scene, setScene] = useState<Scene>(() => snap(ctx, 0, {overrides: buildOverrides(ctx, report.setPieces ?? []), push: {}}));
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [freeze, setFreeze] = useState<Freeze | null>(null);
  const [shown, setShown] = useState<{sp: SetPiece; outcome?: SetPieceOutcome} | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [teamList, setTeamList] = useState(false);
  const [shouts, setShouts] = useState<Shout[]>([]);
  const [, rerender] = useState(0);
  const done = useRef(new Set<string>());
  const skipped = useRef(false);

  const time = scene.time;
  const frameCount = report.frames.length;
  const setPieceCount = report.setPieces?.length ?? 0;
  const overrides = useMemo(
    () => buildOverrides(ctx, report.setPieces ?? []),
    // The arrays grow in place during a live match.
    [ctx, frameCount, setPieceCount]
  );
  const minute = Math.floor(time);
  const eventCount = report.events.length;
  const push = useMemo(() => pushesAt(report, minute), [report, minute, eventCount]);
  const dynRef = useRef<Dyn>({overrides, push});
  dynRef.current = {overrides, push};

  const pauses = useMemo<Pause[]>(() => {
    const list: Pause[] = [];
    report.frames.forEach((f, i) => {
      if (f.kind === "goal") list.push({key: `g${i}`, kind: "goal", time: f.minute, side: f.possession});
      if (f.kind === "setpiece") {
        const sp = report.setPieces?.find((s) => s.minute === Math.ceil(f.minute) && s.side === f.possession);
        if (sp) list.push({key: setPieceKey(sp), kind: "setup", time: f.minute, side: sp.side, sp});
      }
    });
    if (live?.pending) {
      const sp = live.pending;
      list.push({key: setPieceKey(sp), kind: "setup", time: sp.minute - 1, side: sp.side, sp});
    }
    return list.sort((a, b) => a.time - b.time);
  }, [report, frameCount, live?.pending]);
  const nextPause = skipped.current ? undefined : pauses.find((p) => !done.current.has(p.key) && p.time >= time - 1e-6);

  // How far playback may run: the next stop, the live engine's progress, or full time.
  // The live engine moves on inside the animation loop, so its part of the
  // limit is read fresh every frame rather than from this render.
  const pauseLimit = nextPause ? Math.min(90, nextPause.time) : 90;
  const pauseLimitRef = useRef(pauseLimit);
  pauseLimitRef.current = pauseLimit;

  // Playback and freezes share one animation loop.
  const timeRef = useRef(time);
  timeRef.current = time;
  const freezeRef = useRef(freeze);
  freezeRef.current = freeze;
  const running = playing && !selected && !teamList && !shown;
  useEffect(() => {
    if (!running && !freeze) return;
    let raf = 0;
    let last: number | null = null;
    const tick = (now: number) => {
      // Cap the step so a background tab doesn't fast-forward in one jump.
      const dt = last === null ? 0 : Math.min(now - last, 100);
      last = now;
      const fz = freezeRef.current;
      if (fz) {
        const elapsed = now - fz.started;
        const targets = fz.huddle && elapsed < fz.duration * 0.45 ? fz.huddle : fz.targets;
        setScene((prev) => regroup(prev, (dt / MS_PER_MINUTE) * 2.2, ctx, targets));
      } else {
        let limit = pauseLimitRef.current;
        if (live && !live.done) {
          if (!live.pending) {
            const before = live.nextMinute;
            live.advanceTo(Math.floor(timeRef.current) + 1);
            // New frames or a set piece to take: re-render so stops are seen.
            if (live.nextMinute !== before || live.pending || live.done) rerender((n) => n + 1);
          }
          if (!live.done) limit = Math.min(limit, live.pending ? live.pending.minute - 1 : Math.max(0, live.nextMinute - 1));
        }
        setScene((prev) => {
          const next = Math.min(limit, prev.time + (dt / MS_PER_MINUTE) * speed);
          return next > prev.time ? advance(prev, next, ctx, dynRef.current) : prev;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, freeze, speed, ctx, live]);

  // Reaching a stop starts a freeze: celebration or lining up.
  useEffect(() => {
    if (freeze || !nextPause || time < nextPause.time - 1e-6) return;
    const p = nextPause;
    if (p.kind === "goal") {
      const goal = report.events.find((e) => e.type === "goal" && e.side === p.side && e.minute === Math.ceil(p.time));
      const scorer = goal?.playerId ? scene.bodies[goal.playerId] : undefined;
      const huddle: Record<string, Point> = {};
      if (scorer) {
        let k = 0;
        for (const id of onPitchAt(report, p.side, time).values()) {
          if (id === goal?.playerId) continue;
          const angle = (k++ / 10) * Math.PI * 2;
          huddle[id] = {x: scorer.x + Math.cos(angle) * 3, y: scorer.y + Math.sin(angle) * 4};
        }
      }
      const kickers = report.frames.find((f) => f.kind === "kickoff" && f.minute > p.time);
      const targets = kickoffTargets(ctx, time, kickers?.playerId);
      setFreeze({...p, started: performance.now(), duration: GOAL_PAUSE_MS, targets, huddle: {...targets, ...huddle}, scorerId: goal?.playerId});
    } else if (p.sp) {
      setFreeze({...p, started: performance.now(), duration: SETUP_PAUSE_MS, targets: setupTargets(ctx, p.sp, time)});
    }
  }, [freeze, nextPause, time, report, ctx, scene.bodies]);

  // End of a freeze: everyone in place, play on.
  useEffect(() => {
    if (!freeze) return;
    const id = setTimeout(() => {
      done.current.add(freeze.key);
      setScene((prev) => {
        const bodies = {...prev.bodies};
        for (const [pid, target] of Object.entries(freeze.targets)) {
          if (bodies[pid]) bodies[pid] = {...target, vx: 0, vy: 0, sprint: false};
        }
        const ball = freeze.kind === "goal" ? {x: 50, y: 50} : freeze.sp ? freeze.sp.spot : prev.ball;
        return {...prev, bodies, ball};
      });
      setFreeze(null);
    }, freeze.duration);
    return () => clearTimeout(id);
  }, [freeze]);

  useEffect(() => {
    if (time >= 90) setPlaying(false);
  }, [time]);

  // The pending set piece shows once its players are lined up.
  const pendingReady = live?.pending && done.current.has(setPieceKey(live.pending)) ? live.pending : null;
  const current = shown ?? (pendingReady ? {sp: pendingReady} : null);

  const answer = useCallback(
    (input: SetPieceInput | null) => {
      if (!live?.pending) return;
      const sp = live.pending;
      // Saved straight away, so reloading can't undo the choice.
      if (input) act((g) => { if (g.liveMatch) g.liveMatch.inputs[sp.index] = input; });
      live.answer(input);
      setShown({sp, outcome: report.setPieces?.find((s) => s.index === sp.index)});
    },
    [live, act, report]
  );

  const shout = (playerId: string, text: string) => {
    const s = {id: performance.now(), playerId, text};
    setShouts((list) => [...list.slice(-1), s]);
    setTimeout(() => setShouts((list) => list.filter((x) => x.id !== s.id)), SHOUT_MS);
  };

  const give = (cmd: Parameters<LiveMatch["command"]>[0]) => {
    if (!live) return;
    const full = live.command(cmd);
    act((g) => {
      if (g.liveMatch) g.liveMatch.commands = [...(g.liveMatch.commands ?? []), full];
    });
    rerender((n) => n + 1);
  };

  const instruct = (playerId: string, key: InstructionKey, level: InstructionLevel) => {
    give({type: "instruct", playerId, key, level});
    const name = game.players[playerId]?.lastName ?? "";
    shout(playerId, tx(level === 0 ? "shout.reset" : `shout.${key}${level > 0 ? "+" : "-"}`, {player: name}));
  };

  const substitute = (outId: string, inId: string) => {
    give({type: "sub", outId, inId});
    shout(outId, t("shout.sub", {in: game.players[inId]?.lastName ?? "", out: game.players[outId]?.lastName ?? ""}));
    setSelected(null);
  };

  const events = report.events.filter((e) => e.minute <= time);
  const home = game.clubs[report.homeId];
  const away = game.clubs[report.awayId];
  const score = {
    home: events.filter((e) => e.type === "goal" && e.side === "home").length,
    away: events.filter((e) => e.type === "goal" && e.side === "away").length,
  };
  const finished = time >= 90 && (!live || live.done);
  const carrierIndex = touchIndex(report.frames, time);
  const carrierId = carrierIndex >= 0 ? report.frames[carrierIndex].playerId : undefined;
  const booked = new Set(events.filter((e) => e.type === "yellow").map((e) => e.playerId));
  const shoutedAt = new Set(shouts.map((s) => s.playerId));

  const name = (id?: string) => {
    const p = id ? game.players[id] : undefined;
    return p ? p.lastName : "?";
  };
  const jump = (to: number) => {
    if (to >= 90) {
      skipped.current = true;
      live?.playOut();
      setShown(null);
      setFreeze(null);
    }
    setScene(snap(ctx, to, dynRef.current));
    setPlaying(to < 90);
    rerender((n) => n + 1);
  };

  const userSide = live?.userSide;
  const dots = (side: Side) => {
    const club = side === "home" ? home : away;
    const mine = side === userSide;
    return [...onPitchAt(report, side, time).values()].map((id) => {
      const b = scene.bodies[id];
      if (!b) return null;
      const cx = b.x * 1.05;
      const cy = b.y * 0.68;
      // Trail length follows actual speed, so fast sprinters leave longer trails.
      const trail = b.sprint ? 0.12 : 0;
      return (
        <g key={id} className={mine ? "dot mine" : "dot"} onClick={mine ? () => setSelected(id) : undefined}>
          {trail > 0 && (
            <line x1={(b.x - b.vx * trail) * 1.05} y1={(b.y - b.vy * trail) * 0.68} x2={cx} y2={cy} className="trail" stroke={club.color} />
          )}
          <g transform={`translate(${cx} ${cy})`}>
            {mine && <circle r={4} className="hit" />}
            {shoutedAt.has(id) && <circle r={3.2} className="shout-ring" />}
            {id === carrierId && <circle r={2.4} className="carrier-ring" />}
            {id === selected && <circle r={2.8} className="selected-ring" />}
            <circle r={1.6} fill={club.color} stroke={club.color2} strokeWidth={0.4} />
            {booked.has(id) && <rect x={0.9} y={-2.6} width={1.1} height={1.5} rx={0.2} className="booked" />}
            <text y={-2.4} className="dot-label">{name(id)}</text>
          </g>
        </g>
      );
    });
  };

  const scorer = freeze?.kind === "goal" ? game.players[freeze.scorerId ?? ""] : undefined;
  const scoringClub = freeze?.kind === "goal" ? (freeze.side === "home" ? home : away) : undefined;

  return (
    <Modal wide title={<>{live && <span className="live-badge">{t("match.live")}</span>} {home.name} – {away.name}</>} onClose={onClose}>
      <div className="scoreboard">
        <span className="crest" style={{background: home.color, color: home.color2}}>{home.short}</span>
        <span className="score">{score.home} – {score.away}</span>
        <span className="crest" style={{background: away.color, color: away.color2}}>{away.short}</span>
        <span className="clock">{Math.floor(time)}'</span>
      </div>

      {current && live ? (
        <SetPieceView
          key={current.sp.index}
          sp={current.sp}
          role={live.role(current.sp) ?? "shooter"}
          taker={game.players[current.sp.takerId]}
          keeper={current.sp.keeperId ? game.players[current.sp.keeperId] : undefined}
          attackers={[...live.team(current.sp.side).onPitch].map((o) => game.players[o.id])}
          shooters={current.sp.side === "home" ? home : away}
          keepers={current.sp.side === "home" ? away : home}
          outcome={current.outcome}
          onAnswer={answer}
          onDone={() => setShown(null)}
        />
      ) : (
        <div className="pitch-wrap">
          <svg className="pitch" viewBox="0 0 105 68" role="img" aria-label={t("match.pitch")}>
            <rect x={0} y={0} width={105} height={68} className="pitch-grass" />
            <g className="pitch-line">
              <rect x={1} y={1} width={103} height={66} fill="none" />
              <line x1={52.5} y1={1} x2={52.5} y2={67} />
              <circle cx={52.5} cy={34} r={9.15} fill="none" />
              <circle cx={52.5} cy={34} r={0.5} className="spot" />
              <rect x={1} y={13.84} width={16.5} height={40.32} fill="none" />
              <rect x={87.5} y={13.84} width={16.5} height={40.32} fill="none" />
              <rect x={1} y={24.84} width={5.5} height={18.32} fill="none" />
              <rect x={98.5} y={24.84} width={5.5} height={18.32} fill="none" />
              <circle cx={12} cy={34} r={0.5} className="spot" />
              <circle cx={93} cy={34} r={0.5} className="spot" />
            </g>
            {dots("home")}
            {dots("away")}
            <circle cx={scene.ball.x * 1.05} cy={scene.ball.y * 0.68} r={0.9} className="ball" />
          </svg>

          {freeze?.kind === "goal" && scoringClub && (
            <>
              <Confetti key={freeze.key} colors={[scoringClub.color, scoringClub.color2, "#fde047", "#ffffff"]} />
              <div className="goal-banner">
                <strong>{t("match.goal")}</strong>
                {scorer && <span>{scorer.firstName} {scorer.lastName}</span>}
              </div>
            </>
          )}
          {freeze?.kind === "setup" && freeze.sp && (
            <div className="setup-banner">{tx(`ev.${freeze.sp.kind}`, {team: (freeze.side === "home" ? home : away).short, player: name(freeze.sp.takerId)})}</div>
          )}
          {shouts.length > 0 && userSide && (
            <div className={`shout ${userSide}`} role="status">
              <span className="shout-manager" aria-hidden>🧑‍💼</span>
              <span className="shout-bubble">📣 {shouts[shouts.length - 1].text}</span>
            </div>
          )}
        </div>
      )}

      {live && selected && !current && (
        <Orders
          live={live}
          playerId={selected}
          booked={booked.has(selected)}
          onInstruct={instruct}
          onSub={substitute}
          onClose={() => setSelected(null)}
        />
      )}
      {live && teamList && !selected && !current && (
        <TeamList live={live} booked={booked} onPick={(id) => { setTeamList(false); setSelected(id); }} onClose={() => setTeamList(false)} />
      )}

      <div className="btn-row">
        {finished && onFinish ? (
          <button className="btn primary" onClick={onFinish}>{t("match.finish")} ▶</button>
        ) : (
          <>
            <button className="btn" disabled={!!current} onClick={() => (finished ? jump(0) : setPlaying(!playing))}>
              {finished ? `↺ ${t("match.replay")}` : playing ? `⏸ ${t("match.pause")}` : `▶ ${t("match.play")}`}
            </button>
            {SPEEDS.map((s) => (
              <button key={s} className={s === speed ? "chip active" : "chip"} onClick={() => setSpeed(s)}>{s}×</button>
            ))}
            {live && !finished && (
              <>
                <button className="btn" onClick={() => setTeamList(!teamList)}>📋 {t("orders.team")}</button>
                <button
                  className="chip"
                  onClick={() => {
                    live.manualCorners = !live.manualCorners;
                    try {
                      localStorage.setItem(CORNERS_KEY, live.manualCorners ? "self" : "auto");
                    } catch {
                      // Only remembered for this match.
                    }
                    rerender((n) => n + 1);
                  }}
                >
                  🚩 {t("match.corners", {mode: live.manualCorners ? t("match.cornersSelf") : t("match.cornersAuto")})}
                </button>
              </>
            )}
            {!finished && <button className="btn" onClick={() => jump(90)}>⏭ {t("match.skip")}</button>}
          </>
        )}
      </div>
      {live && !finished && !selected && !teamList && <p className="muted small">{t("orders.hint")}</p>}

      <div className="match-columns">
        <ol className="feed" aria-live="polite">
          {events.slice().reverse().map((e, i) => (
            <li key={i} className={`ev ev-${e.type} ${e.side ?? ""}`}>
              <span className="ev-min">{e.minute}'</span> {eventText(e, name, tx, e.side === "home" ? home.short : away.short)}
            </li>
          ))}
        </ol>
        {finished && <Summary report={report} />}
      </div>
    </Modal>
  );
}

/** Confetti in the scoring club's colours. */
function Confetti({colors}: {colors: string[]}) {
  const pieces = useMemo(
    () =>
      Array.from({length: 80}, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 1.6 + Math.random() * 1.2,
        color: colors[i % colors.length],
        rotate: Math.random() * 360,
        drift: (Math.random() - 0.5) * 60,
        round: Math.random() < 0.3,
      })),
    [colors]
  );
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className={p.round ? "piece round" : "piece"}
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
            ["--drift" as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

/** Instructions and substitution for one of the user's players. */
function Orders({
  live,
  playerId,
  booked,
  onInstruct,
  onSub,
  onClose,
}: {
  live: LiveMatch;
  playerId: string;
  booked: boolean;
  onInstruct: (id: string, key: InstructionKey, level: InstructionLevel) => void;
  onSub: (outId: string, inId: string) => void;
  onClose: () => void;
}) {
  const {t} = useT();
  const [picking, setPicking] = useState(false);
  const p = live.player(playerId);
  const team = live.team();
  if (!p) return null;
  const pendingSubs = live.pendingSubs();
  const subsLeft = team.subsLeft - pendingSubs.length;
  const comingOff = pendingSubs.some((c) => c.type === "sub" && c.outId === playerId);
  const takenIn = new Set(pendingSubs.map((c) => (c.type === "sub" ? c.inId : "")));
  const onPitch = team.onPitch.some((o) => o.id === playerId);
  const bench = team.bench.filter((id) => !takenIn.has(id)).map((id) => live.player(id)!).filter(Boolean);

  return (
    <section className="orders">
      <header className="orders-head">
        <PosBadge pos={p.position} />
        <strong>{p.firstName} {p.lastName}</strong>
        {booked && <span className="booked-tag">🟨 {t("orders.booked")}</span>}
        <span className="orders-fitness"><Bar value={p.fitness} small label={t("col.fitness")} /></span>
        <button className="btn small" onClick={onClose}>{t("orders.done")}</button>
      </header>

      {picking ? (
        <>
          <h3>{t("orders.pickSub")}</h3>
          <ul className="pick-list">
            {bench.map((b) => (
              <li key={b.id}>
                <button className="pick" onClick={() => onSub(playerId, b.id)}>
                  <PosBadge pos={b.position} />
                  <span className="pick-name">{b.firstName.charAt(0)}. {b.lastName}</span>
                  <span />
                  <span className="num strong">{overall(b)}</span>
                  <Bar value={b.fitness} small />
                </button>
              </li>
            ))}
          </ul>
          <button className="btn small" onClick={() => setPicking(false)}>{t("common.cancel")}</button>
        </>
      ) : (
        <>
          <div className="orders-grid">
            {INSTRUCTIONS.map((key) => {
              const current = live.level(playerId, key);
              return (
                <div key={key} className="order-row">
                  <span className="order-label">{t(`orders.${key}`)}</span>
                  <div className="order-chips">
                    {([-1, 0, 1] as const).map((lvl) => (
                      <button
                        key={lvl}
                        className={lvl === current ? "chip active" : "chip"}
                        disabled={!onPitch}
                        onClick={() => lvl !== current && onInstruct(playerId, key, lvl)}
                      >
                        {lvl === -1 ? t(`orders.${key}.low`) : lvl === 1 ? t(`orders.${key}.high`) : t("orders.normal")}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="btn-row">
            {comingOff ? (
              <span className="muted small">🔁 {t("orders.subPending")}</span>
            ) : (
              <button className="btn" disabled={subsLeft <= 0 || !onPitch || bench.length === 0} onClick={() => setPicking(true)}>
                🔁 {t("orders.sub")}
              </button>
            )}
            <span className="muted small">{subsLeft > 0 ? t("orders.subsLeft", {n: subsLeft}) : t("orders.noSubs")}</span>
          </div>
        </>
      )}
    </section>
  );
}

/** The user's players on the pitch, easier to hit than the dots on a phone. */
function TeamList({live, booked, onPick, onClose}: {live: LiveMatch; booked: Set<string | undefined>; onPick: (id: string) => void; onClose: () => void}) {
  const {t} = useT();
  const team = live.team();
  return (
    <section className="orders">
      <header className="orders-head">
        <strong>{t("orders.team")}</strong>
        <span className="muted small">{t("orders.subsLeft", {n: team.subsLeft - live.pendingSubs().length})}</span>
        <button className="btn small" onClick={onClose}>{t("orders.done")}</button>
      </header>
      <ul className="pick-list">
        {team.onPitch.map((o) => {
          const p = live.player(o.id);
          if (!p) return null;
          const told = Object.values(live.instructions(o.id)).some((v) => v !== 0);
          return (
            <li key={o.id}>
              <button className="pick" onClick={() => onPick(o.id)}>
                <PosBadge pos={team.slots[o.slot].pos} />
                <span className="pick-name">{p.firstName.charAt(0)}. {p.lastName} {booked.has(o.id) && "🟨"} {told && "📣"}</span>
                <span />
                <span className="num strong">{overall(p)}</span>
                <Bar value={p.fitness} small />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function eventText(e: MatchEvent, name: (id?: string) => string, tx: (k: string, p?: Record<string, string | number>) => string, team: string): string {
  const params = {player: name(e.playerId), other: name(e.otherId), team};
  if (e.type === "goal" && e.otherId) return tx("ev.goalAssist", params);
  if (e.type === "instruction" && e.note) return `📣 ${tx(e.note.endsWith("0") ? "shout.reset" : `shout.${e.note}`, params)}`;
  return tx(`ev.${e.type}`, params);
}

function Summary({report}: {report: MatchReport}) {
  const {t} = useT();
  const game = useGameState();
  const openPlayer = useGame((s) => s.openPlayer);
  const rows = (clubId: string) =>
    Object.entries(report.ratings)
      .filter(([id]) => game.players[id]?.clubId === clubId || game.players[id]?.loan?.parentClubId === clubId)
      .sort((a, b) => b[1] - a[1]);
  return (
    <div className="summary">
      <dl className="kv">
        <dt>{t("match.possession")}</dt><dd>{report.possessionHome}% – {100 - report.possessionHome}%</dd>
        <dt>{t("match.shots")}</dt><dd>{report.shots[0]} – {report.shots[1]}</dd>
        <dt>{t("match.onTarget")}</dt><dd>{report.onTarget[0]} – {report.onTarget[1]}</dd>
      </dl>
      <div className="ratings">
        {[report.homeId, report.awayId].map((clubId) => (
          <div key={clubId}>
            <h4>{game.clubs[clubId].short}</h4>
            <ul className="plain-list small">
              {rows(clubId).map(([id, r]) => (
                <li key={id}>
                  <button className="link" onClick={() => openPlayer(id)}>{game.players[id].lastName}</button>{" "}
                  <span className={r >= 7.5 ? "rating good" : r < 6 ? "rating bad" : "rating"}>{r.toFixed(1)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
