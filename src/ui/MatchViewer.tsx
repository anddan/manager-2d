// Plays back a match from the touches the engine recorded (passes, dribbles,
// tackles, shots). Stored matches are replays; the user's match this week is
// live: it stops at set pieces for the user to take, at half-time, and when
// one of the user's players is injured (the manager must bring someone on).
// The manager can tap a player, or the whole team, to shout instructions.
//
// Every player moves on their own, accelerating and slowing like a runner:
// - the player about to receive the ball runs to meet it,
// - the nearest defender presses the ball and the next one covers behind,
// - defenders hold a flat line and pick up the attackers in their zone,
// - attackers run in behind (but stay onside), wingers stretch the pitch,
//   full-backs overlap on their flank and the nearest teammates come short
//   to offer the carrier a pass,
// - everyone else holds their spot in the team's shape, which shifts with the ball.
// Top speed comes from pace and drops late in the game for players with low
// stamina, so quick players visibly get there first. Sprinting players leave a trail.
// Goals stop play for a celebration and a kick-off from the centre spot;
// penalties, free kicks and corners stop play while the players line up.
import {memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from "react";
import {addMessage, findFixture, fullName, isCupFixture, listName, playerName, shortName} from "../game/helpers";
import {shootoutOver} from "../game/cup";
import {WIN_VIDEO_DIAMONDS, taskProgress, videoAfterWin} from "../game/daily";
import {Rng} from "../game/rng";
import {matchVerdict, PLAYER_TALKS, TEAM_TALKS, teamTalk, type PlayerTalk, type TeamTalk} from "../game/morale";
import {boardAt, clockLabel, matchLength} from "../game/clock";
import {FORMATIONS, type Slot} from "../game/constants";
import {LiveMatch} from "../game/live";
import {distance, fromSide, kickoffSpot, progressFor, teamSpot, type Point} from "../game/pitch";
import {effectiveRating, overall, teamOvr} from "../game/ratings";
import {aerial, cornerAttacker, resolveSetPiece, type SetPiece, type SetPieceInput, type SetPieceOutcome} from "../game/setpieces";
import {cornerZone} from "../game/match";
import {
  INSTRUCTIONS,
  type Club,
  type Frame,
  type GameState,
  type InstructionKey,
  type InstructionLevel,
  type MatchEvent,
  type MatchReport,
  type Player,
  type Side,
} from "../game/types";
import {finishWeek} from "../game/week";
import {useT} from "../i18n";
import {useGame, useGameState} from "../store";
import {Avatar, ManagerAvatar, defaultManagerLook} from "./Avatar";
import {Football} from "./Ball";
import {Bar, Flag, Modal, PosBadge} from "./common";
import {SetPieceView} from "./SetPieceView";
import {VideoAd} from "./VideoAd";
import {diamondBurst} from "./effects";

/** Fast-forward goes up one step per press, to this. */
const MAX_SPEED = 5;
/** Real milliseconds per match minute at 1x. */
const MS_PER_MINUTE = 1200;
/** Physics step in match minutes. */
const STEP = 0.02;
/** Share of the gap between touches that the carrier keeps the ball. */
const HOLD = 0.3;
/** How far behind the goal line a scored ball ends up (pitch runs 0..100; the net is drawn about 2.5 deep). */
const NET_DEPTH = 101.8;
/** How far ahead of a dribbling player's feet the ball runs. */
const BALL_LEAD = 1.1;
/** How much faster a player runs when the ball is waiting on them. */
const CATCH_UP = 1.7;/** How fast the ball is brought to the spot for a set piece or restart. */
const BALL_PLACE_SPEED = 90;
/** Fastest the ball moves (a hard pass or shot), in pitch units per match minute. */
const BALL_TOP_SPEED = 550;
/** How quickly players reach the speed they want (per match minute). */
const ACCEL = 14;
const GOAL_PAUSE_MS = 2800;
/** A ruled-out goal: "GOAL!" first, then the referee's decision. */
const NO_GOAL_PAUSE_MS = 3200;
const SETUP_PAUSE_MS = 1700;
/** Teams take up positions for a goal kick; a throw-in is quicker. */
const GOAL_KICK_PAUSE_MS = 1400;
const THROW_IN_PAUSE_MS = 700;
const HALFTIME_REPLAY_MS = 3000;
const SHOUT_MS = 3200;
const SET_PIECES_KEY = "manager2d.manualSetPieces";

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
  /** Index of the last touch the ball has actually got to; it plays them in order. */
  reached: number;
  /** On its way to the next touch (it only sets off from a player's feet). */
  flying?: boolean;
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
  /** Only once the ball has got to this touch (after a goal: once it is in the net). */
  afterTouch?: number;
  /** Held past `to` until the ball has been played on from this touch (a kick-off, goal kick or throw-in). */
  untilPlayed?: number;
}

/** Whether a stretch of fixed positions applies at time t, with the ball at touch `reached`. */
function overrideOn(o: Override, t: number, reached: number, flying: boolean): boolean {
  if (t < o.from || (o.afterTouch !== undefined && reached < o.afterTouch)) return false;
  if (o.untilPlayed !== undefined && (reached < o.untilPlayed || (reached === o.untilPlayed && !flying))) return t < o.to + 1;
  return t < o.to;
}

/** Things that change during playback and steer movement. */
export interface Dyn {
  overrides: Override[];
  /** "Push forward" (+1) or "stay back" (-1) per player; "@home"/"@away" for whole-team orders. */
  push: Record<string, number>;
}

const NO_DYN: Dyn = {overrides: [], push: {}};

const pushFor = (dyn: Dyn, id: string, side: Side) => dyn.push[id] ?? dyn.push[`@${side}`] ?? 0;

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
  const tiring = 1 - (Math.min(t, 90) / 90) * (1 - p.attrs.stamina / 100) * 0.35;
  // Pace 40 -> ~19, pace 85 -> ~32 units a minute: a clear gap on screen.
  return (8 + p.attrs.pace * 0.28) * tiring;
}

const hashOf = (id: string) => [...id].reduce((s, c) => s + c.charCodeAt(0), 0);

/** A small personal drift so nobody stands perfectly still. */
function wander(id: string, t: number, amount = 1): Point {
  const h = hashOf(id);
  return {x: Math.sin(t * 0.8 + h) * 2.5 * amount, y: Math.cos(t * 0.6 + h * 1.7) * 3 * amount};
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

  // Defenders stay goal side of the attacker they mark: the best defenders
  // first, the same ones the set-piece view shows.
  const p = (id: string) => ctx.players[id];
  defenders.sort((a, b) => p(b).attrs.defending + p(b).attrs.physical - (p(a).attrs.defending + p(a).attrs.physical));
  const mark = (pairs: {depth: number; width: number}[], extraAttackers: number, chosen: string[] = []) => {
    const runners = [...chosen, ...byAir(attackers.filter((id) => !chosen.includes(id)))].slice(0, pairs.length);
    runners.forEach((id, i) => (targets[id] = at(pairs[i].depth, pairs[i].width)));
    const markers = defenders.filter((id) => !targets[id]).slice(0, runners.length);
    markers.forEach((id, i) => (targets[id] = at(pairs[i].depth + 1.6, pairs[i].width + 1)));
    // The rest: a couple stay back for the counter, the others hold the edge of the box.
    attackers.filter((id) => !targets[id]).forEach((id, i) => (targets[id] = at(i < extraAttackers ? 78 : 55, 30 + i * 12)));
    defenders.filter((id) => !targets[id]).forEach((id, i) => (targets[id] = at(i === 0 ? 62 : 84, 35 + i * 10)));
  };

  if (sp.kind === "freekick") {
    // The wall: four defenders 9 m towards goal, side by side (the strongest, as the set-piece view shows them).
    const dx = 100 - spotDepth;
    const dy = 50 - spotWidth;
    const len = Math.hypot(dx, dy) || 1;
    const wall = defenders.slice().sort((a, b) => p(b).attrs.physical - p(a).attrs.physical).slice(0, 4);
    for (const id of wall) defenders.splice(defenders.indexOf(id), 1);
    wall.forEach((id, i) => {
      const along = 9.15 / len;
      const offset = (i - 1.5) * 1.7;
      targets[id] = at(spotDepth + dx * along - (dy / len) * offset, spotWidth + dy * along + (dx / len) * offset);
    });
    mark([{depth: 90, width: 42}, {depth: 91, width: 52}, {depth: 88, width: 60}, {depth: 92, width: 47}], 2);
    return targets;
  }

  // Corner: whoever the set-piece view puts in each zone stands there (near
  // post, penalty spot, far post, short), then the best of the rest in the air.
  const flag = sp.wallSide;
  const used = new Set([sp.takerId]);
  const chosen: string[] = [];
  const zones: {depth: number; width: number}[] = [];
  for (const zone of ["near", "penalty", "far", "short"] as const) {
    const who = cornerAttacker(attackers.filter((id) => !used.has(id)).map(p), zone, sp.takerId);
    if (!who) continue;
    used.add(who.id);
    chosen.push(who.id);
    zones.push(cornerZone(zone, flag));
  }
  mark([...zones, {depth: 92, width: 46}, {depth: 81, width: 50}], 1, chosen);
  // Two more defenders guard the posts.
  defenders.filter((id) => !targets[id] || progressFor(att, targets[id].x) > 83).slice(-2).forEach((id, i) => {
    targets[id] = at(98.6, i === 0 ? 46 : 54);
  });
  return targets;
}

/** A cross: a pass into the box straight after a run down to the byline. */
function isCross(frames: Frame[], k: number): boolean {
  const f = frames[k];
  const prev = frames[k - 1];
  if (f?.flight === "cross") return true;
  if (!f || !prev || f.kind !== "pass" || prev.kind !== "dribble" || prev.possession !== f.possession) return false;
  return progressFor(prev.possession, prev.x) > 86 && (prev.y < 12 || prev.y > 88) && progressFor(f.possession, f.x) > 82;
}

/** The touch before a shot from open play: the ball goes to the shooting position. */
function isShotSetup(frames: Frame[], k: number): boolean {
  const f = frames[k];
  const next = frames[k + 1];
  if (!f || !next || (f.kind !== "pass" && f.kind !== "dribble")) return false;
  if (next.kind === "goal" || next.kind === "nogoal" || next.kind === "save") return true;
  // Wide of the goal: out over the goal line (or played into the corner and run out for a corner).
  return next.kind === "out" && progressFor(next.possession, next.x) >= 99.5;
}

/** Restart touches play stops for while everyone takes up position. */
const isRestart = (f: Frame) => f.kind === "goalkick" || f.kind === "throwin";

/**
 * Where everyone stands for a goal kick or throw-in, from the restarting
 * side's view. Goal kick: the keeper on the ball, centre-backs split wide by
 * the box, full-backs high and wide, the rest spread up the pitch; the other
 * side drops off towards the middle. Throw-in: the thrower on the line, both
 * teams in shape around the ball.
 */
function restartTargets(ctx: Ctx, f: Frame, t: number): Record<string, Point> {
  const own = f.possession;
  const targets: Record<string, Point> = {};
  for (const side of ["home", "away"] as const) {
    for (const [slot, id] of onPitchAt(ctx.report, side, t)) {
      const s = ctx.slots[side][slot];
      if (f.kind === "goalkick" && side === own) {
        const left = s.y < 50;
        const plan: Record<string, [number, number]> = {
          GK: [5.5, 50],
          CB: [14, left ? 24 : 76],
          FB: [26, left ? 6 : 94],
          DM: [30, s.y],
          CM: [42, s.y],
          AM: [52, s.y],
          W: [56, left ? 10 : 90],
          ST: [62, s.y],
        };
        const [depth, width] = plan[s.pos];
        targets[id] = fromSide(side, depth, width);
      } else if (f.kind === "goalkick") {
        // The other side backs off towards the middle.
        targets[id] = teamSpot(s, side, {x: 50, y: 50}, false);
      } else {
        targets[id] = teamSpot(s, side, f, side === own);
      }
    }
  }
  if (f.playerId) targets[f.playerId] = {x: f.x, y: f.y};
  return targets;
}

export function buildOverrides(ctx: Ctx, setPieces: SetPiece[]): Override[] {
  const frames = ctx.frames;
  // Everyone stays in their half until the kick-off has been played.
  const out: Override[] = [{from: 0, to: frames[0]?.minute ?? 0.4, targets: kickoffTargets(ctx, 0, frames[0]?.playerId), untilPlayed: 0}];
  frames.forEach((f, i) => {
    const next = frames[i + 1];
    if (f.kind === "goal") {
      const kicker = next?.kind === "kickoff" ? next.playerId : undefined;
      out.push({from: f.minute, to: next?.minute ?? f.minute + 1, targets: kickoffTargets(ctx, f.minute, kicker), afterTouch: i, ...(kicker ? {untilPlayed: i + 1} : {})});
    } else if (f.kind === "setpiece") {
      const sp = setPieces.find((s) => s.minute === Math.ceil(f.minute) && s.side === f.possession);
      // Lined up once the ball has gone out for the corner, or the foul has happened.
      if (sp) out.push({from: (frames[i - 1]?.minute ?? f.minute) - 0.001, to: next?.minute ?? f.minute + 0.3, targets: setupTargets(ctx, sp, f.minute), afterTouch: i - 1});
    } else if (isRestart(f)) {
      // From the ball going out until it's played again.
      // Once the ball has actually gone out.
      out.push({from: frames[i - 1]?.minute ?? f.minute - 0.2, to: next?.minute ?? f.minute + 0.3, targets: restartTargets(ctx, f, f.minute), afterTouch: i - 1, untilPlayed: i});
    }
  });
  // Half-time: both teams line up for the second-half kick-off.
  const ht = ctx.report.events.find((e) => e.type === "halftime");
  if (ht) {
    const k = frames.findIndex((f) => f.minute > ht.minute);
    const kickoff = frames[k];
    const kicker = kickoff?.kind === "kickoff" ? kickoff.playerId : undefined;
    out.push({from: ht.minute, to: kickoff?.minute ?? ht.minute + 0.5, targets: kickoffTargets(ctx, ht.minute, kicker), ...(kicker ? {untilPlayed: k} : {})});
  }
  return out;
}

/** "Push forward" / "stay back" at time t, from the instruction events. */
function pushesAt(report: MatchReport, t: number): Record<string, number> {
  const push: Record<string, number> = {};
  const sideOf: Record<string, Side | undefined> = {};
  for (const e of report.events) {
    if (e.type !== "instruction" || e.minute > t || !e.note?.startsWith("position")) continue;
    const value = e.note.endsWith("+") ? 1 : e.note.endsWith("-") ? -1 : 0;
    if (e.playerId) {
      push[e.playerId] = value;
      sideOf[e.playerId] = e.side;
    } else if (e.side) {
      // A team order replaces everyone's own.
      for (const id of Object.keys(push)) if (sideOf[id] === e.side) delete push[id];
      push[`@${e.side}`] = value;
    }
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
      const spot = override?.targets[id] ?? teamSpot(ctx.slots[side][slot], side, ball, possession === side, pushFor(dyn, id, side));
      bodies[id] = {...spot, vx: 0, vy: 0, sprint: false};
    }
  }
  return {time: t, ball, bodies, reached: i};
}

/** Nearest of `ids` to a point, skipping `skip`. */
function nearestTo(bodies: Record<string, Body>, ids: string[], to: Point, skip?: Set<string>): string | undefined {
  let best: string | undefined;
  let bestD = Infinity;
  for (const id of ids) {
    const b = bodies[id];
    if (!b || skip?.has(id)) continue;
    const d = distance(b, to);
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

/** Moves the scene forward to t1 in small steps. Pure: returns a new scene. */
export function advance(prev: Scene, t1: number, ctx: Ctx, dyn: Dyn = NO_DYN): Scene {
  let ball = {...prev.ball};
  let reached = prev.reached;
  let flying = prev.flying ?? false;
  const bodies: Record<string, Body> = {};
  for (const [id, b] of Object.entries(prev.bodies)) bodies[id] = {...b};
  let t = prev.time;

  while (t < t1 - 1e-9) {
    const dt = Math.min(STEP, t1 - t);
    t += dt;
    const i = touchIndex(ctx.frames, t);
    const cur = i >= 0 ? ctx.frames[i] : undefined;
    const possession: Side = cur?.possession ?? "home";
    const override = dyn.overrides.find((o) => overrideOn(o, t, reached, flying));

    // Ball: it plays the touches strictly in order and only turns once it has
    // reached the touch: the player's feet for passes, dribbles and tackles
    // (they run to meet it), the recorded spot for shots, balls out and set
    // pieces. Its speed is capped, so it never jumps; running late, it goes
    // at top speed until it has caught up.
    const holdOn = (k: number) => {
      const f = ctx.frames[k];
      const after = ctx.frames[k + 1];
      if (!after) return true;
      // In the net or out of play, it stays there until play restarts.
      if (!f.playerId || f.kind === "goal" || f.kind === "nogoal") return t < after.minute;
      return after.playerId !== f.playerId && t - f.minute < (after.minute - f.minute) * HOLD;
    };
    const aimFor = (k: number): Point => {
      const f = ctx.frames[k];
      // A goal ends up in the back of the net.
      if (f.kind === "goal" || f.kind === "nogoal") return {x: f.x > 50 ? NET_DEPTH : 100 - NET_DEPTH, y: f.y};
      // The ball is played into the shooting position, and the shooter runs onto it.
      if (isShotSetup(ctx.frames, k)) return f;
      // A cross goes into the box, for the attacker to meet.
      // Crosses and through balls go into space, for the attacker to run onto.
      if (isCross(ctx.frames, k) || f.flight === "through") return f;
      // Placed balls go to the spot. Everything else, dribbles included (carried
      // at the player's feet), goes to the player.
      const toSpot = ["setpiece", "kickoff", "goalkick", "throwin"].includes(f.kind ?? "");
      const body = f.playerId && !toSpot ? bodies[f.playerId] : undefined;
      return body ?? f;
    };
    const holderOf = (k: number) => {
      const f = ctx.frames[k];
      return f.playerId && f.kind !== "goal" && f.kind !== "nogoal" ? bodies[f.playerId] : undefined;
    };
    // It only leaves a player from their feet.
    const atFeet = (k: number) => {
      const h = holderOf(k);
      return !h || distance(h, ball) < 2.2;
    };
    const due = reached < 0 ? i >= 0 : reached < i || !holdOn(reached);
    if (due && !flying && (reached < 0 || atFeet(reached))) {
      // Played on from the player's foot.
      const h = reached >= 0 ? holderOf(reached) : undefined;
      if (h) ball = {x: h.x, y: h.y};
      flying = true;
    }
    const ahead = flying;
    if (ahead && ctx.frames[reached + 1]) {
      const k = reached + 1;
      const to = aimFor(k);
      const gap = distance(ball, to);
      const timeLeft = ctx.frames[k].minute - t;
      const speed = Math.min(BALL_TOP_SPEED, timeLeft > dt ? gap / timeLeft : BALL_TOP_SPEED);
      const move = Math.min(gap, speed * dt);
      if (gap > 0) ball = {x: ball.x + ((to.x - ball.x) / gap) * move, y: ball.y + ((to.y - ball.y) / gap) * move};
      // A dribble is done when the run is (the ball rides along at their feet until then).
      // The run to a foul or out for a corner goes all the way there (play stops there, and waits for it).
      const f = ctx.frames[k];
      const beforeStop = ctx.frames[k + 1]?.kind === "setpiece" || (ctx.frames[k + 1]?.kind === "out" && ctx.frames[k + 2]?.kind === "setpiece");
      const runDone = f.kind !== "dribble" || (t >= f.minute - 0.02 && (!beforeStop || distance(ball, f) < 3));
      if (gap - move < 0.8 && runDone) {
        reached = k;
        flying = false;
      }
    } else if (reached >= 0) {
      // Holding: at the player's feet it goes with them. Otherwise it lies
      // still until they get to it (they run onto it). Out of play or in the net, it stays.
      const carrier = holderOf(reached);
      // Fouled, or the ball has gone out for a corner: it stays where it is for the set piece.
      const stopped = ctx.frames[reached + 1]?.kind === "setpiece";
      if (carrier && !stopped && distance(carrier, ball) < 2.2) ball = {x: carrier.x, y: carrier.y};
    }

    const sides = {home: onPitchAt(ctx.report, "home", t), away: onPitchAt(ctx.report, "away", t)};
    // Who has the ball and who it's on its way to, from where the ball really is.
    const heading = ctx.frames[reached + 1];
    const travelling = !!heading && flying;
    const held = reached >= 0 ? ctx.frames[reached] : undefined;
    const carrierId = !travelling && held?.playerId && held.kind !== "goal" ? held.playerId : undefined;
    const receiver = travelling && heading.playerId && heading.minute - t < 1 ? heading : undefined;
    const receiverId = receiver?.playerId;
    // Players who get the ball in the next few touches start heading there now.
    const upcoming = new Map<string, Frame>();
    for (let k = reached + 2; k <= reached + 5 && k < ctx.frames.length; k++) {
      const f = ctx.frames[k];
      if (f.minute - t > 1.5) break;
      if (f.playerId && (f.kind === "pass" || f.kind === "dribble") && !upcoming.has(f.playerId)) upcoming.set(f.playerId, f);
    }
    // The ball is behind: whoever it is waiting for gets there quicker.
    const late = reached < i;
    // Whoever just played it on, while it is on its way to a teammate.
    const justPassed = travelling && held?.playerId && heading.possession === held.possession && heading.playerId !== held.playerId ? held.playerId : undefined;
    // A keeper with the ball in their hands (or walking it out) isn't closed down.
    const onBall = carrierId ?? (travelling && heading.kind === "dribble" && heading.playerId === held?.playerId ? heading.playerId : undefined);
    const keeperHolds = !!onBall && (["home", "away"] as const).some((s) => [...sides[s]].some(([slot, id]) => id === onBall && ctx.slots[s][slot].pos === "GK"));

    for (const side of ["home", "away"] as const) {
      const other: Side = side === "home" ? "away" : "home";
      const onPitch = sides[side];
      const slotsOf = ctx.slots[side];
      const outfield = [...onPitch].filter(([slot]) => slotsOf[slot].pos !== "GK").map(([, id]) => id);
      const opponents = [...sides[other]].filter(([slot]) => ctx.slots[other][slot].pos !== "GK").map(([, id]) => id);
      const inPossession = side === possession;
      const ownGoal = fromSide(side, 0, 50);
      const ballDepth = progressFor(side, ball.x);
      const ballWidth = side === "home" ? ball.y : 100 - ball.y;

      // Without the ball: the nearest presses, the next covers.
      let presser: string | undefined;
      let cover: string | undefined;
      if (!inPossession && !override && !keeperHolds) {
        presser = nearestTo(bodies, outfield, ball);
        cover = nearestTo(bodies, outfield, ball, new Set(presser ? [presser] : []));
      }
      // With it: the two nearest teammates show for a pass, each in the freest
      // spot around the carrier (forward if possible, not where a mate already is).
      const supportSpots = new Map<string, Point>();
      if (inPossession && !override && carrierId && bodies[carrierId]) {
        const carrier = bodies[carrierId];
        const skip = new Set([carrierId, ...(receiverId ? [receiverId] : [])]);
        const taken: Point[] = [];
        const forward = side === "home" ? 0 : Math.PI;
        for (let k = 0; k < 2; k++) {
          const s = nearestTo(bodies, outfield, carrier, skip);
          if (!s) break;
          skip.add(s);
          let best: Point | null = null;
          let bestScore = -Infinity;
          for (const deg of [-70, -40, -12, 12, 40, 70, 115, -115]) {
            const a = forward + (deg * Math.PI) / 180;
            const p = {x: carrier.x + Math.cos(a) * 11, y: carrier.y + Math.sin(a) * 13};
            if (p.x < 3 || p.x > 97 || p.y < 4 || p.y > 96) continue;
            let free = 12;
            for (const o of opponents) if (bodies[o]) free = Math.min(free, distance(bodies[o], p));
            const crowded = taken.some((q) => distance(q, p) < 8) ? 8 : 0;
            const score = free + Math.cos((deg * Math.PI) / 180) * 2.5 - crowded - distance(bodies[s], p) * 0.12;
            if (score > bestScore) {
              bestScore = score;
              best = p;
            }
          }
          if (best) {
            supportSpots.set(s, best);
            taken.push(best);
          }
        }
      }
      // A cross is on: the ball is out wide in the attacking half, or a winger is
      // on the way down the line (the attackers read it and get into the box).
      const wide = ballWidth < 25 || ballWidth > 75;
      let crossComing = false;
      for (let k = reached + 1; k < ctx.frames.length && ctx.frames[k].minute - t < 1.6; k++) {
        // Whose cross it is: the side crossing it, even if a defender gets to it first.
        if (isCross(ctx.frames, k) && (ctx.frames[k - 1]?.possession ?? ctx.frames[k].possession) === possession) crossComing = true;
      }
      const crossing = inPossession && !override && ((ballDepth > 55 && wide) || crossComing);
      const underCross = !inPossession && !override && ((ballDepth < 45 && wide) || crossComing);
      // Attackers stay level with the last outfield defender (or the ball).
      let offside = ballDepth;
      for (const id of opponents) {
        const b = bodies[id];
        if (b) offside = Math.max(offside, progressFor(side, b.x));
      }
      offside = Math.min(offside, 96);
      // The back line keeps one depth.
      const backLine: number[] = [];
      for (const [slot, id] of onPitch) {
        const pos = slotsOf[slot].pos;
        if (pos === "CB" || pos === "FB") backLine.push(progressFor(side, teamSpot(slotsOf[slot], side, ball, inPossession, pushFor(dyn, id, side)).x));
      }
      const lineDepth = backLine.length ? backLine.reduce((s, d) => s + d, 0) / backLine.length : 0;

      for (const [slot, id] of onPitch) {
        const slotInfo = slotsOf[slot];
        const pos = slotInfo.pos;
        const spot = teamSpot(slotInfo, side, ball, inPossession, pushFor(dyn, id, side));
        const body = bodies[id] ?? {...spot, vx: 0, vy: 0, sprint: false};
        const w = wander(id, t, pos === "CB" || pos === "GK" ? 0.5 : 1);
        let depth = progressFor(side, spot.x);
        let width = side === "home" ? spot.y : 100 - spot.y;
        let target: Point | null = null;
        let sprint = false;
        let hurry = false;
        let boxRun = false;

        if (receiverId === id && receiver) {
          target = {x: receiver.x, y: receiver.y};
          sprint = true;
        } else if (override?.targets[id]) {
          target = override.targets[id];
          sprint = distance(body, target) > 6;
        } else if (upcoming.has(id) && carrierId !== id) {
          // Reads the play: heads for where they'll get the ball next.
          const f = upcoming.get(id)!;
          target = {x: f.x, y: f.y};
          sprint = distance(body, target) > 8;
          hurry = true;
        } else if (carrierId === id) {
          // On the ball: go to it if it isn't at their feet yet.
          target = {x: ball.x, y: ball.y};
          sprint = distance(body, ball) > 3;
        } else if (id === presser) {
          target = ball;
          sprint = true;
        } else if (id === cover) {
          // Between the ball and the goal, a few steps behind the presser.
          target = {x: ball.x + (ownGoal.x - ball.x) * 0.22, y: ball.y + (ownGoal.y - ball.y) * 0.22};
          hurry = true;
        } else if (pos === "GK") {
          // Off the line when the ball comes close, on the line between ball and goal.
          if (distance(ball, ownGoal) < 32) {
            target = {x: ownGoal.x + (ball.x - ownGoal.x) * 0.1, y: ownGoal.y + (ball.y - ownGoal.y) * 0.22};
          }
        } else if (inPossession) {
          const nearSide = slotInfo.y === 50 || (slotInfo.y < 50) === (ballWidth < 50);
          if (crossing && (pos === "ST" || pos === "AM" || pos === "CM" || (pos === "W" && !nearSide))) {
            // A cross is coming: attack the box. Near post, far post, penalty spot, edge of the box.
            const left = ballWidth < 50;
            if (pos === "ST") {
              depth = nearSide ? 93 : 90;
              width = left ? (nearSide ? 42 : 60) : nearSide ? 58 : 40;
            } else if (pos === "W") {
              depth = 90;
              width = left ? 66 : 34;
            } else if (pos === "AM") {
              depth = 86;
              width = 50;
            } else {
              depth = 77;
              width = slotInfo.y;
            }
            sprint = pos !== "CM";
            hurry = true;
            boxRun = true;
          } else if (justPassed === id && pos !== "CB") {
            // Pass and move: run on to show for it again.
            depth = Math.min(depth + 12, offside - 1);
            hurry = true;
          } else if (supportSpots.has(id)) {
            // Show for the pass: into the free space near the carrier.
            target = supportSpots.get(id)!;
            hurry = distance(body, target) > 6;
          } else if (pos === "ST" && ballDepth > 35) {
            // Runs in behind, then checks back: always on the shoulder of the last defender.
            const run = Math.sin(t * 1.1 + hashOf(id)) * 0.5 + 0.5;
            depth = Math.max(depth, offside - 1 - run * 7);
            width += Math.sin(t * 0.9 + hashOf(id)) * 8;
            hurry = run > 0.75;
          } else if (pos === "W" && ballDepth > 30) {
            // Hug the touchline to stretch the defence.
            width = slotInfo.y < 50 ? Math.min(width, 9) : Math.max(width, 91);
            depth = Math.max(depth, Math.min(offside - 2, ballDepth + 8));
          } else if (pos === "FB" && ballDepth > 50 && (ballWidth < 50) === (slotInfo.y < 50)) {
            // Overlap down their own flank.
            depth = Math.max(depth, ballDepth + 4);
            width = slotInfo.y < 50 ? 8 : 92;
            hurry = true;
          } else if (pos === "AM" || pos === "CM") {
            // Find a pocket between the opposition's lines.
            depth = Math.min(depth + 3, offside - 4);
          }
          // Onside, except runs into the box for a cross from the byline (the ball is level with them by then).
          if (!boxRun) depth = Math.min(depth, offside - 0.5);
        } else {
          if (pos === "CB" || pos === "FB") depth = depth * 0.4 + lineDepth * 0.6;
          if (underCross) {
            // A cross is coming in: centre-backs guard the goalmouth, the far full-back the far post, the holder the edge.
            const left = ballWidth < 50;
            const nearSide = (slotInfo.y < 50) === left;
            if (pos === "CB") {
              depth = 8;
              width = slotInfo.y < 50 ? 44 : 56;
            } else if (pos === "FB" && !nearSide) {
              depth = 7;
              width = left ? 62 : 38;
            } else if (pos === "DM") {
              depth = 15;
              width = 50;
            }
          }
          if (pos === "CB" || pos === "FB" || pos === "DM") {
            // Pick up the nearest attacker in the zone, staying goal side.
            const zone = fromSide(side, depth, width);
            const threat = nearestTo(bodies, opponents, zone);
            const tb = threat ? bodies[threat] : undefined;
            if (tb && distance(tb, zone) < 14) {
              const dx = ownGoal.x - tb.x;
              const dy = ownGoal.y - tb.y;
              const len = Math.hypot(dx, dy) || 1;
              const mark = {x: tb.x + (dx / len) * 2.5, y: tb.y + (dy / len) * 2.5};
              target = {x: zone.x * 0.45 + mark.x * 0.55, y: zone.y * 0.45 + mark.y * 0.55};
            }
          }
        }
        if (!target) {
          const shaped = fromSide(side, Math.max(2, Math.min(98, depth)), Math.max(3, Math.min(97, width)));
          target = {x: shaped.x + w.x, y: shaped.y + w.y};
        }
        // Don't stand on a teammate's toes.
        if (!sprint) {
          for (const [, mate] of onPitch) {
            if (mate === id || !bodies[mate]) continue;
            const mb = bodies[mate];
            const gap = distance(mb, target);
            if (gap < 4 && gap > 0.01) {
              target = {x: target.x + ((target.x - mb.x) / gap) * (4 - gap), y: target.y + ((target.y - mb.y) / gap) * (4 - gap)};
            }
          }
        }
        target = {x: Math.max(0.5, Math.min(99.5, target.x)), y: Math.max(1, Math.min(99, target.y))};

        let top = topSpeed(ctx, id, t);
        if (receiverId === id && receiver) {
          // Meeting a pass or carrying a dribble: as fast as it takes to be there on time (within reason).
          const need = distance(body, receiver) / Math.max(0.05, receiver.minute - t);
          top = Math.min(top * CATCH_UP, Math.max(top, need));
        } else if (late && (id === carrierId || upcoming.has(id))) {
          // The ball is waiting on them.
          top *= CATCH_UP;
        }
        const dx = target.x - body.x;
        const dy = target.y - body.y;
        const gap = Math.hypot(dx, dy);
        // Sprint, hurry or jog; ease off when arriving.
        const wanted = Math.min(sprint ? top : hurry ? top * 0.75 : top * 0.45, gap * 6);
        const k = 1 - Math.exp(-ACCEL * dt);
        let vx = body.vx + ((gap > 0 ? (dx / gap) * wanted : 0) - body.vx) * k;
        let vy = body.vy + ((gap > 0 ? (dy / gap) * wanted : 0) - body.vy) * k;
        const speed = Math.hypot(vx, vy);
        if (speed > top) {
          vx *= top / speed;
          vy *= top / speed;
        }
        // Never overshoot the target in one step.
        const move = Math.hypot(vx * dt, vy * dt);
        const scale = move > gap && move > 0 ? gap / move : 1;
        bodies[id] = {
          x: body.x + vx * dt * scale,
          y: body.y + vy * dt * scale,
          vx,
          vy,
          sprint: (sprint || hurry) && Math.hypot(vx, vy) > top * 0.6,
        };
      }
    }

    // Carried: the ball runs just ahead of the player's feet, the way they're going
    // (not after a foul or with it out for a corner, when it stays put).
    const dribbling = travelling && heading.kind === "dribble" && heading.playerId === held?.playerId ? heading.playerId : undefined;
    const runner = carrierId ?? dribbling;
    const owner = runner && ctx.frames[reached + 1]?.kind !== "setpiece" ? bodies[runner] : undefined;
    if (owner && distance(owner, ball) < 2.5) {
      const pace = Math.hypot(owner.vx, owner.vy);
      if (pace > 3) ball = {x: owner.x + (owner.vx / pace) * BALL_LEAD, y: owner.y + (owner.vy / pace) * BALL_LEAD};
    }
  }
  // Drop players who went off.
  const onNow = new Set([...onPitchAt(ctx.report, "home", t1).values(), ...onPitchAt(ctx.report, "away", t1).values()]);
  for (const id of Object.keys(bodies)) if (!onNow.has(id)) delete bodies[id];
  return {time: t1, ball, bodies, reached, flying};
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

/** Grass, markings and goals. Never changes, so it's built once rather than every frame. */
const PITCH = (
  <g>
    <rect x={-3.5} y={-1} width={112} height={70} className="pitch-surround" />
    <rect x={0} y={0} width={105} height={68} className="pitch-grass" />
    {Array.from({length: 7}, (_, i) => (
      <rect key={i} x={i * 15} y={0} width={7.5} height={68} className="pitch-stripe" />
    ))}
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
      <path d="M17.5 27.5 A9.15 9.15 0 0 1 17.5 40.5 M87.5 27.5 A9.15 9.15 0 0 0 87.5 40.5" fill="none" />
    </g>
    {/* Goals: 7.32 m wide on the goal line, net behind. */}
    {[{x: -1.8, line: 1}, {x: 104, line: 104}].map((g) => (
      <g key={g.x} className="pitch-goal">
        <rect x={g.x} y={30.34} width={2.8} height={7.32} className="goal-net" />
        {[31.8, 33.3, 34.7, 36.2].map((y) => <line key={y} x1={g.x} y1={y} x2={g.x + 2.8} y2={y} className="goal-mesh" />)}
        <line x1={g.x + 1.4} y1={30.34} x2={g.x + 1.4} y2={37.66} className="goal-mesh" />
        <path d={g.line === 1 ? `M1 30.34 H${g.x} V37.66 H1` : `M104 30.34 H${g.x + 2.8} V37.66 H104`} className="goal-frame" />
        <circle cx={g.line} cy={30.34} r={0.45} className="goal-post" />
        <circle cx={g.line} cy={37.66} r={0.45} className="goal-post" />
      </g>
    ))}
  </g>
);

/** What the camera shows: the whole stadium, or just the pitch. Same shape, so the view doesn't resize. */
const VIEW_STADIUM = {x: -12, y: -4.85, w: 128, h: 77.7};
const VIEW_PITCH = {x: -3.5, y: 0, w: 112, h: 68};
const ZOOM_KEY = "manager2d.zoomedIn";

/** Eases the SVG view box between the stadium and pitch views. */
function useZoom(zoomedIn: boolean): string {
  const target = zoomedIn ? VIEW_PITCH : VIEW_STADIUM;
  const [box, setBox] = useState(target);
  const boxRef = useRef(box);
  boxRef.current = box;
  useEffect(() => {
    const from = boxRef.current;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 450);
      const e = 1 - (1 - k) ** 3;
      setBox({x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e});
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return `${box.x} ${box.y} ${box.w} ${box.h}`;
}

/**
 * The stands: two rows of fans round the pitch behind the advertising boards.
 * Home fans fill the home end and half of each side, away fans the rest, in
 * their club colours. Drawn once per match (it's hundreds of shapes, so it
 * mustn't redraw with every frame of play); only the cheering class changes.
 */
/** Penalty takers in order: the designated taker first, then the best finishers. */
function shootoutTakers(players: Player[], designated?: string): Player[] {
  const outfield = players.filter((p) => p.position !== "GK").sort((a, b) => b.attrs.finishing + b.attrs.technique / 2 - (a.attrs.finishing + a.attrs.technique / 2));
  const first = outfield.find((p) => p.id === designated);
  return first ? [first, ...outfield.filter((p) => p !== first)] : outfield;
}

/**
 * The shoot-out after a level cup tie, kick by kick, home first: the user
 * aims their side's kicks and dives for the other side's, in the same view as
 * penalties in the match. Five each, then sudden death; it stops as soon as
 * it's decided.
 */
function Shootout({report, seed, userSide, onDone}: {report: MatchReport; seed: number; userSide: Side; onDone: (score: [number, number]) => void}) {
  const {t} = useT();
  const game = useGameState();
  const home = game.clubs[report.homeId];
  const away = game.clubs[report.awayId];
  const end = matchLength(report);
  const onPitch = (side: Side) => [...onPitchAt(report, side, end).values()].map((id) => game.players[id]).filter(Boolean);
  const takers = {home: shootoutTakers(onPitch("home"), home.roles?.penalties), away: shootoutTakers(onPitch("away"), away.roles?.penalties)};
  const keepers = {home: onPitch("home").find((p) => p.position === "GK"), away: onPitch("away").find((p) => p.position === "GK")};
  // Scored or not, kick by kick (home, away, home, ...).
  const [kicks, setKicks] = useState<boolean[]>([]);
  const [outcome, setOutcome] = useState<SetPieceOutcome | undefined>();
  const scoreOf = (list: boolean[]): [number, number] => [list.filter((g, i) => g && i % 2 === 0).length, list.filter((g, i) => g && i % 2 === 1).length];
  const score = scoreOf(kicks);
  const over = shootoutOver(score, [Math.ceil(kicks.length / 2), Math.floor(kicks.length / 2)]);
  const k = kicks.length;
  const side: Side = k % 2 === 0 ? "home" : "away";
  const other: Side = side === "home" ? "away" : "home";
  const taker = takers[side][Math.floor(k / 2) % Math.max(1, takers[side].length)];
  const keeper = keepers[other];
  const sp: SetPiece = {index: 1000 + k, kind: "penalty", minute: Math.ceil(end) + 1, side, takerId: taker?.id ?? "", keeperId: keeper?.id, wallSide: 1, spot: side === "home" ? {x: 89.5, y: 50} : {x: 10.5, y: 50}};

  // Decided: show the final score a moment, then back to the pitch.
  useEffect(() => {
    if (!over) return;
    const id = setTimeout(() => onDone(score), 1800);
    return () => clearTimeout(id);
  }, [over]); // eslint-disable-line react-hooks/exhaustive-deps

  const dots = (s: Side) => {
    const mine = kicks.filter((_, i) => i % 2 === (s === "home" ? 0 : 1));
    const pending = Math.max(0, 5 - mine.length);
    return (
      <div className="shootout-row">
        <span className="crest tiny" style={{background: (s === "home" ? home : away).color}} /> <strong>{(s === "home" ? home : away).short}</strong>
        {mine.map((g, i) => <span key={i} className={g ? "pen scored" : "pen missed"}>{g ? "✓" : "✗"}</span>)}
        {Array.from({length: pending}, (_, i) => <span key={"p" + i} className="pen">○</span>)}
      </div>
    );
  };

  return (
    <div className="shootout">
      <div className="shootout-head">
        <strong>⚽ {t("so.title")}</strong>
        <span className="shootout-score">{home.short} {score[0]} – {score[1]} {away.short}</span>
      </div>
      {dots("home")}
      {dots("away")}
      {over ? (
        <p className="shootout-result">{t((score[0] > score[1]) === (userSide === "home") ? "so.won" : "so.lost", {h: score[0], a: score[1]})}</p>
      ) : taker ? (
        <SetPieceView
          key={k}
          sp={sp}
          role={side === userSide ? "shooter" : "keeper"}
          taker={taker}
          keeper={keeper}
          shooters={side === "home" ? home : away}
          keepers={side === "home" ? away : home}
          outcome={outcome}
          onAnswer={(input) => setOutcome(resolveSetPiece(new Rng(seed + 7919 * (k + 1)), sp, input, taker, keeper))}
          onDone={() => {
            setKicks((list) => [...list, outcome?.result === "goal"]);
            setOutcome(undefined);
          }}
        />
      ) : null}
    </div>
  );
}

/** Pause, play and fast-forward, drawn alike (emoji differ between systems). */
export function ControlIcon({kind}: {kind: "pause" | "play" | "forward"}) {
  return (
    <svg className="ctl-icon" viewBox="0 0 16 16" aria-hidden>
      {kind === "pause" && <path d="M4 3h3v10H4zM9 3h3v10H9z" />}
      {kind === "play" && <path d="M4 2.5l9 5.5-9 5.5z" />}
      {kind === "forward" && <path d="M1.5 3l6.5 5-6.5 5zM8 3l6.5 5L8 13z" />}
    </svg>
  );
}

/**
 * The players' tunnel in the middle of the near touchline, with a dugout on
 * each side of it: home on the left, away on the right. Players walk off
 * down the tunnel; the managers shout from the dugouts.
 */
const Dugouts = memo(function Dugouts({home, away}: {home: Club; away: Club}) {
  const dugout = (x: number, club: Club) => (
    <g>
      <rect x={x} y={69.2} width={10} height={3.6} rx={0.8} className="dugout" />
      {Array.from({length: 7}, (_, i) => (
        <rect key={i} x={x + 0.8 + i * 1.25} y={70.9} width={0.95} height={1.1} rx={0.25} fill={club.color} stroke={club.color2} strokeWidth={0.12} />
      ))}
      <rect x={x} y={69.2} width={10} height={1.1} rx={0.5} className="dugout-roof" />
    </g>
  );
  return (
    <g aria-hidden>
      {dugout(39.5, home)}
      {dugout(55.5, away)}
      {/* The tunnel: a dark mouth into the stand, lit from inside. */}
      <path d="M50 74 L50.4 69 Q52.5 67.9 54.6 69 L55 74 Z" className="tunnel" />
      <path d="M51.1 74 L51.3 69.6 Q52.5 69 53.7 69.6 L53.9 74 Z" className="tunnel-light" />
    </g>
  );
});

const Stands = memo(function Stands({home, away, cheering, boards}: {home: Club; away: Club; cheering: Side | null; boards: string}) {
  const fans = useMemo(() => {
    const spots: {x: number; y: number; side: Side}[] = [];
    // Pitch units as drawn (105 x 68). Top and bottom: two rows; ends: three columns.
    for (const y of [-2.7, -4.3, 70.7, 72.3]) {
      for (let x = -10; x <= 115; x += 1.75) spots.push({x: x + (y % 2 ? 0.8 : 0), y, side: x < 52.5 ? "home" : "away"});
    }
    for (const x of [-6.2, -8, -9.8, 111.2, 113, 114.8]) {
      for (let y = -1.2; y <= 69.2; y += 1.75) spots.push({x, y: y + (x % 2 ? 0.8 : 0), side: x < 52.5 ? "home" : "away"});
    }
    return spots.map((s, i) => {
      const club = s.side === "home" ? home : away;
      const h = (i * 37) % 11;
      const shirt = h < 5 ? club.color : h < 8 ? club.color2 : ["#e5e7eb", "#64748b", "#1f2937"][h % 3];
      const skin = ["#f6d5bd", "#ebbd9c", "#d49c74", "#8a5638"][(i * 7) % 4];
      return {...s, shirt, skin, delay: (h % 5) * 0.08};
    });
  }, [home, away]);
  const crowds = useMemo(() => {
    const draw = (side: Side) =>
      fans.filter((f) => f.side === side).map((f, i) => (
        <g key={i} className="fan" style={{animationDelay: `${f.delay}s`}}>
          <rect x={f.x - 0.55} y={f.y - 0.2} width={1.1} height={1} rx={0.35} fill={f.shirt} />
          <circle cx={f.x} cy={f.y - 0.45} r={0.42} fill={f.skin} />
        </g>
      ));
    return {home: draw("home"), away: draw("away")};
  }, [fans]);
  return (
    <g className="stands" aria-hidden>
      <rect x={-14} y={-7} width={132} height={82} className="stand-bg" />
      <g className={cheering === "home" ? "fans cheer" : "fans"}>{crowds.home}</g>
      <g className={cheering === "away" ? "fans cheer" : "fans"}>{crowds.away}</g>
      {/* Advertising boards round the pitch. */}
      <path d="M-4.6 -1.4 H109.6 V69.4 H-4.6 Z" className="ad-boards" stroke={boards} />
    </g>
  );
});

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
      m.manualSetPieces = localStorage.getItem(SET_PIECES_KEY) !== "auto";
    } catch {
      // Default: take set pieces yourself.
    }
    return m;
  });
  const notify = useGame((s) => s.notify);
  // Closing early lets the computer decide the rest; either way the week goes on.
  // The team talk comes after the match is counted (it changes their mood, not the result).
  const finish = (words?: Words) => {
    live.playOut();
    const said = act((g, rng) => {
      // Includes substitutions the assistant made for injuries while skipping.
      if (g.liveMatch) g.liveMatch.commands = live.allCommands();
      const report = finishWeek(g, rng);
      if (!words || !report) return null;
      const res = teamTalk(g, rng, report, words.talk, words.single);
      taskProgress(g, "talk");
      if (res.player) {
        addMessage(g, {kind: "player", key: res.player.key, params: {name: playerName(g, res.player.id)}, action: {type: "player", playerId: res.player.id}});
      }
      return res;
    });
    if (said) notify(said.worn ? "tt.worn" : said.key, {}, said.fit > 0 ? "good" : said.fit < 0 ? "error" : "info");
  };
  return <MatchScreen report={live.report} live={live} onClose={() => finish()} onFinish={finish} />;
}

/** What the manager says after the match. */
interface Words {
  talk: TeamTalk;
  single?: {playerId: string; talk: PlayerTalk};
}

interface ScreenProps {
  report: MatchReport;
  live?: LiveMatch;
  onClose: () => void;
  onFinish?: (words?: Words) => void;
}

/**
 * The dressing room after the match: one thing to say to the team, and
 * (if you like) a word with one player. Shows how the match went against
 * what was expected, so the right words can be picked.
 */
function TeamTalkDialog({report, onDone}: {report: MatchReport; onDone: (words?: Words) => void}) {
  const {t, tx} = useT();
  const game = useGameState();
  const [talk, setTalk] = useState<TeamTalk | null>(null);
  const [single, setSingle] = useState<{playerId: string; talk: PlayerTalk} | null>(null);
  const verdict = matchVerdict(game, report);
  const side = report.homeId === game.userClubId ? "home" : "away";
  const played = Object.entries(report.ratings)
    .filter(([id]) => game.players[id]?.clubId === game.userClubId && (report.lineups[side].includes(id) || report.events.some((e) => e.type === "sub" && e.otherId === id)))
    .sort((a, b) => b[1] - a[1]);
  const icons: Record<TeamTalk, string> = {praise: "👏", calm: "🧘", demand: "💪", disappointed: "😠"};
  return (
    <MatchDialog title={`🗣️ ${t("tt.title")}`} onClose={() => onDone()}>
      <p className="tt-verdict">{tx(`tt.verdict.${verdict.result}.${verdict.how}`)}</p>
      <div className="tt-options">
        {TEAM_TALKS.map((k) => (
          <button key={k} className={`tt-option ${talk === k ? "active" : ""}`} onClick={() => setTalk(k)}>
            <strong>{icons[k]} {tx(`tt.talk.${k}`)}</strong>
            <small>{tx(`tt.talk.${k}.desc`)}</small>
          </button>
        ))}
      </div>
      <h4>{t("tt.onePlayer")}</h4>
      <div className="tt-players">
        {played.map(([id, rating]) => {
          const p = game.players[id];
          const mine = single?.playerId === id;
          return (
            <div key={id} className={`tt-player ${mine ? "active" : ""}`}>
              <span className="tt-name">{shortName(p)} <span className={`rating-pill ${rating >= 7 ? "good" : rating < 6 ? "bad" : ""}`}>{rating.toFixed(1)}</span></span>
              {PLAYER_TALKS.map((pt) => (
                <button key={pt} className={`btn small ${mine && single?.talk === pt ? "primary" : ""}`} onClick={() => setSingle(mine && single?.talk === pt ? null : {playerId: id, talk: pt})} title={tx(`tt.player.${pt}`)}>
                  {pt === "praise" ? "👍" : "👎"}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <div className="btn-row tt-actions">
        <button className="btn" onClick={() => onDone()}>{t("tt.skip")}</button>
        <button className="btn primary" disabled={!talk} onClick={() => talk && onDone({talk, ...(single ? {single} : {})})}>{t("tt.say")} ▶</button>
      </div>
    </MatchDialog>
  );
}

interface Pause {
  key: string;
  kind: "goal" | "nogoal" | "setup" | "halftime" | "injury" | "restart" | "fulltime";
  time: number;
  side: Side;
  sp?: SetPiece;
  playerId?: string;
  /** The touch the ball must have got to before play stops (in the net, out of play, the foul). */
  frameIndex?: number;
  /** Goal kicks and throw-ins: the touch play restarts with. */
  restart?: Frame;
}

interface Freeze extends Pause {
  started: number;
  duration: number;
  targets: Record<string, Point>;
  /** Goals: the scorers' teammates mob the scorer first. */
  huddle?: Record<string, Point>;
  /** Full time: where everyone heads, stage by stage (until ms after the whistle). */
  stages?: FullTimeStage[];
  scorerId?: string;
}

interface Shout {
  id: number;
  playerId: string;
  text: string;
}

const setPieceKey = (sp: {minute: number; side: Side}) => `s${sp.minute}-${sp.side}`;

/** How long the players celebrate, thank the fans and go off after the final whistle. */
const FULLTIME_MS = 14000;
/** Past the near touchline (pitch y), a player is in the tunnel and out of sight. */
const IN_TUNNEL = 101.5;

export interface FullTimeStage {
  /** Until this many ms after the whistle. */
  until: number;
  targets: Record<string, Point>;
}

/**
 * After the final whistle, in stages. The winners mob each other in a ring,
 * then run to their own fans (behind their goal: home on the left, as the
 * stands are drawn) and applaud them for a few seconds, then go off. The
 * losers stand a moment, then walk straight off. Off is down the tunnel in
 * the middle of the near touchline, between the dugouts, where they
 * disappear. After a draw both sides just walk off.
 */
export function fullTimeStages(ctx: Ctx, t: number, winner: Side | null, bodies: Record<string, Point>): FullTimeStage[] {
  const stand: Record<string, Point> = {};
  const thank: Record<string, Point> = {};
  const off: Record<string, Point> = {};
  for (const side of ["home", "away"] as const) {
    const ids = [...onPitchAt(ctx.report, side, t).values()];
    const fansX = side === "home" ? 3 : 97;
    const ring = {x: side === "home" ? 38 : 62, y: 50};
    // Into the tunnel, each side on its own side of it.
    const tunnel = {x: side === "home" ? 49.4 : 50.6, y: IN_TUNNEL + 6};
    ids.forEach((id, k) => {
      off[id] = tunnel;
      if (winner === side) {
        const angle = (k / ids.length) * Math.PI * 2;
        stand[id] = {x: ring.x + Math.cos(angle) * 3, y: ring.y + Math.sin(angle) * 4};
        thank[id] = {x: fansX, y: 22 + (k * 56) / Math.max(1, ids.length - 1)};
      } else {
        stand[id] = bodies[id] ?? {x: 50, y: 50};
        thank[id] = tunnel;
      }
    });
  }
  return [
    {until: 2000, targets: stand},
    // A draw: nothing to thank anyone for, everyone goes.
    {until: winner ? 6500 : 2000, targets: thank},
    {until: Infinity, targets: off},
  ];
}

/** Match minutes play may run on past a stop while the ball is still getting there (the clock slows meanwhile). */
const STOP_GRACE = 2;
/** The latest a pause can start. */
/** The touch play restarts from after a stop: the kick-off, goal kick, throw-in or set piece. */
export function restartTouch(frames: Frame[], p: {kind: string; time: number; frameIndex?: number}, reached: number): number {
  if (p.kind === "goal" || p.kind === "halftime") {
    const k = frames.findIndex((f) => f.kind === "kickoff" && f.minute > p.time);
    return k >= 0 ? k : (p.frameIndex ?? reached);
  }
  if (p.frameIndex === undefined || (p.kind !== "restart" && p.kind !== "setup")) return reached;
  const next = frames[p.frameIndex + 1];
  return next && (isRestart(next) || next.kind === "setpiece") ? p.frameIndex + 1 : p.frameIndex;
}

const pauseUntil =(p: {time: number; frameIndex?: number}) => (p.frameIndex === undefined ? p.time : p.time + STOP_GRACE);

/** A goal being shown again, slowed down. */
interface GoalReplay {
  from: number;
  to: number;
  started: number;
  scene: Scene;
  /** Played from what was shown, rather than worked out again. */
  recorded: boolean;
}
/** Replays start this many match minutes before the goal. */
const REPLAY_LEAD = 0.9;
/** Slow motion: share of normal speed. */
const REPLAY_SPEED = 0.4;
const REPLAY_LINGER_MS = 900;
/** How much play is kept for replays, in match minutes. */
const REPLAY_KEEP = 2.5;

function MatchScreen({report, live, onClose, onFinish}: ScreenProps) {
  const {t, tx, lang} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const ctx = useMemo<Ctx>(
    () => ({
      report,
      frames: report.frames,
      slots: report.slots ?? {home: FORMATIONS[report.formations.home], away: FORMATIONS[report.formations.away]},
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
  /** Whose orders are open: the whole team, a player, or none. */
  const [selected, setSelected] = useState<OrdersTarget | null>(null);
  const [shouts, setShouts] = useState<Shout[]>([]);
  const [, rerender] = useState(0);
  const done = useRef(new Set<string>());
  const skipped = useRef(false);
  const [zoomedIn, setZoomedIn] = useState(() => {
    try {
      return localStorage.getItem(ZOOM_KEY) === "1";
    } catch {
      return false;
    }
  });
  const viewBox = useZoom(zoomedIn);
  const [replay, setReplay] = useState<GoalReplay | null>(null);
  /** Asking whether to leave a live match before the end. */
  const [confirmClose, setConfirmClose] = useState(false);
  const [talking, setTalking] = useState(false);
  const [watchingAd, setWatchingAd] = useState(false);
  /** The last few minutes as they were shown, so a goal can be replayed exactly. */
  const history = useRef<Scene[]>([]);

  const time = scene.time;
  const frameCount = report.frames.length;
  const setPieceCount = report.setPieces?.length ?? 0;
  const eventCount = report.events.length;
  const overrides = useMemo(
    () => buildOverrides(ctx, report.setPieces ?? []),
    // The arrays grow in place during a live match.
    [ctx, frameCount, setPieceCount, eventCount]
  );
  const minute = Math.floor(time);
  const push = useMemo(() => pushesAt(report, minute), [report, minute, eventCount]);
  const dynRef = useRef<Dyn>({overrides, push});
  dynRef.current = {overrides, push};
  const length = matchLength(report);
  const liveRunning = !!live && !live.done;

  const pauses = useMemo<Pause[]>(() => {
    const list: Pause[] = [];
    report.frames.forEach((f, i) => {
      if (f.kind === "goal") list.push({key: `g${i}`, kind: "goal", time: f.minute, side: f.possession, frameIndex: i});
      if (f.kind === "nogoal") list.push({key: `n${i}`, kind: "nogoal", time: f.minute, side: f.possession, frameIndex: i});
      if (f.kind === "setpiece") {
        const sp = report.setPieces?.find((s) => s.minute === Math.ceil(f.minute) && s.side === f.possession);
        // Once the ball has gone out for the corner, or the foul has happened.
        if (sp) list.push({key: setPieceKey(sp), kind: "setup", time: f.minute, side: sp.side, sp, frameIndex: i - 1});
      }
      // Once the ball has gone out.
      if (isRestart(f)) list.push({key: `r${i}`, kind: "restart", time: f.minute, side: f.possession, restart: f, frameIndex: i - 1});
    });
    const ht = report.events.find((e) => e.type === "halftime");
    if (ht) list.push({key: "ht", kind: "halftime", time: ht.minute, side: "home"});
    if (live?.pending) {
      const sp = live.pending;
      // After its build-up: the ball out for a corner, or the foul.
      const last = report.frames.length - 1;
      list.push({key: setPieceKey(sp), kind: "setup", time: Math.max(sp.minute - 1, report.frames[last]?.minute ?? 0), side: sp.side, sp, frameIndex: last >= 0 ? last : undefined});
    }
    if (live?.stop?.type === "injury") {
      const s = live.stop;
      list.push({key: `i${s.minute}-${s.playerId}`, kind: "injury", time: s.minute, side: live.userSide, playerId: s.playerId});
    }
    return list.sort((a, b) => a.time - b.time);
  }, [report, frameCount, eventCount, live?.pending, live?.stop]);
  const nextPause = skipped.current ? undefined : pauses.find((p) => !done.current.has(p.key) && pauseUntil(p) >= time - 1e-6);
  // A goal waits for the ball to be in the net, running on a little if it is late.
  const ballIn = (p: Pause) => p.frameIndex === undefined || scene.reached >= p.frameIndex;

  // How far playback may run: the next stop, the live engine's progress, or full time.
  // The live engine moves on inside the animation loop, so its part of the
  // limit is read fresh every frame rather than from this render.
  const end = liveRunning ? Infinity : length;
  const pauseLimit = nextPause ? Math.min(end, ballIn(nextPause) ? nextPause.time : pauseUntil(nextPause)) : end;
  const pauseLimitRef = useRef(pauseLimit);
  pauseLimitRef.current = pauseLimit;

  // Playback and freezes share one animation loop.
  const timeRef = useRef(time);
  timeRef.current = time;
  const freezeRef = useRef(freeze);
  freezeRef.current = freeze;
  // The pending set piece shows once its players are lined up; play waits while the manager chooses.
  const pendingReady = live?.pending && done.current.has(setPieceKey(live.pending)) ? live.pending : null;
  const running = playing && !selected && !shown && !pendingReady && !replay && !confirmClose;

  // Keep what was shown during play (not freezes), for replays.
  useEffect(() => {
    const h = history.current;
    const last = h[h.length - 1];
    if (last && scene.time < last.time) h.length = 0; // Jumped back: start over.
    if (!freeze && (!last || scene.time > last.time)) {
      h.push(scene);
      while (h.length > 1 && h[0].time < scene.time - REPLAY_KEEP) h.shift();
    }
  }, [scene, freeze]);

  // A replay plays in slow motion, from what was recorded or, for older goals, worked out again.
  useEffect(() => {
    if (!replay) return;
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - replay.started;
      const at = Math.min(replay.to, replay.from + (elapsed / MS_PER_MINUTE) * REPLAY_SPEED);
      if (elapsed > ((replay.to - replay.from) / REPLAY_SPEED) * MS_PER_MINUTE + REPLAY_LINGER_MS) {
        setReplay(null);
        return;
      }
      setReplay((r) => {
        if (!r) return r;
        if (r.recorded) {
          const h = history.current;
          let pick = h[0];
          for (const s of h) if (s.time <= at) pick = s;
          return pick === r.scene ? r : {...r, scene: pick};
        }
        return at > r.scene.time ? {...r, scene: advance(r.scene, at, ctx, dynRef.current)} : r;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Restart only for a new replay, not every scene it shows.
  }, [replay?.started, ctx]);

  const toggleZoom = () => {
    setZoomedIn((z) => {
      try {
        localStorage.setItem(ZOOM_KEY, z ? "0" : "1");
      } catch {
        // Only for this match.
      }
      return !z;
    });
  };

  /** The goal's touch in the replay, for a goal event; old saves may not have one. */
  const goalTouch = (e: MatchEvent) => {
    const kind = e.type === "disallowed" ? "nogoal" : "goal";
    return report.frames.find((f) => f.kind === kind && f.possession === e.side && Math.ceil(f.minute) === e.minute);
  };

  /** Replays the build-up to a goal; `goalTime` is the goal's touch. */
  const startReplay = (goalTime: number) => {
    const from = Math.max(0, goalTime - REPLAY_LEAD);
    const h = history.current;
    const recorded = h.length > 0 && h[0].time <= from + 0.05 && h[h.length - 1].time >= goalTime - 0.02;
    const first = recorded ? h.find((s) => s.time >= from) ?? h[0] : snap(ctx, from, dynRef.current);
    setReplay({from, to: goalTime + 0.05, started: performance.now(), scene: first, recorded});
  };
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
        const targets = fz.stages
          ? (fz.stages.find((s) => elapsed < s.until) ?? fz.stages[fz.stages.length - 1]).targets
          : fz.huddle && elapsed < fz.duration * 0.45 ? fz.huddle : fz.targets;
        const step = (dt / MS_PER_MINUTE) * 2.2;
        // At a set piece or restart the ball is brought to the spot while everyone lines up.
        const spot = fz.sp ? fz.sp.spot : fz.restart ? {x: fz.restart.x, y: fz.restart.y} : null;
        setScene((prev) => {
          const next = regroup(prev, step, ctx, targets);
          if (!spot) return next;
          const gap = distance(prev.ball, spot);
          const move = Math.min(gap, BALL_PLACE_SPEED * step);
          return gap > 0 ? {...next, ball: {x: prev.ball.x + ((spot.x - prev.ball.x) / gap) * move, y: prev.ball.y + ((spot.y - prev.ball.y) / gap) * move}} : next;
        });
      } else {
        const limit = pauseLimitRef.current;
        let liveCap = Infinity;
        if (live && !live.done) {
          if (!live.pending && !live.stop) {
            const before = live.nextMinute;
            live.advanceTo(Math.floor(timeRef.current) + 1);
            // New frames or something for the user: re-render so stops are seen.
            if (live.nextMinute !== before || live.pending || live.stop || live.done) rerender((n) => n + 1);
          }
          if (!live.done) liveCap = live.shownUpTo();
        }
        setScene((prev) => {
          // Play may not run past what the live match has drawn, except while the
          // ball is still catching up with the last touch (or it would wait forever).
          const behind = prev.reached < ctx.frames.length - 1;
          const cap = Math.min(limit, liveCap + (behind ? STOP_GRACE : 0));
          const next = Math.min(cap, prev.time + (dt / MS_PER_MINUTE) * speed);
          return next > prev.time ? advance(prev, next, ctx, dynRef.current) : prev;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, freeze, speed, ctx, live]);

  // Reaching a stop starts a freeze: celebration, lining up, half-time or an injury.
  useEffect(() => {
    if (freeze || !nextPause || time < nextPause.time - 1e-6) return;
    if (!ballIn(nextPause) && time < pauseUntil(nextPause) - 1e-6) return;
    const p = nextPause;
    const started = performance.now();
    if (p.kind === "nogoal") {
      // In the net... then ruled out. Everyone stops where they are.
      setFreeze({...p, started, duration: NO_GOAL_PAUSE_MS, targets: {}});
    } else if (p.kind === "goal") {
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
      setFreeze({...p, started, duration: GOAL_PAUSE_MS, targets, huddle: {...targets, ...huddle}, scorerId: goal?.playerId});
    } else if (p.kind === "halftime") {
      const kickoff = report.frames.find((f) => f.minute > p.time);
      const targets = kickoffTargets(ctx, time, kickoff?.kind === "kickoff" ? kickoff.playerId : undefined);
      setFreeze({...p, started, duration: live ? Infinity : HALFTIME_REPLAY_MS, targets});
    } else if (p.kind === "restart" && p.restart) {
      const duration = p.restart.kind === "goalkick" ? GOAL_KICK_PAUSE_MS : THROW_IN_PAUSE_MS;
      setFreeze({...p, started, duration, targets: restartTargets(ctx, p.restart, time)});
    } else if (p.kind === "injury") {
      setFreeze({...p, started, duration: Infinity, targets: {}});
    } else if (p.sp) {
      setFreeze({...p, started, duration: SETUP_PAUSE_MS, targets: setupTargets(ctx, p.sp, time)});
    }
  }, [freeze, nextPause, time, report, ctx, scene.bodies, live]);

  // End of a freeze: everyone in place, play on.
  const endFreeze = useCallback(() => {
    const fz = freezeRef.current;
    if (!fz) return;
    done.current.add(fz.key);
    setScene((prev) => {
      const bodies = {...prev.bodies};
      for (const [pid, target] of Object.entries(fz.targets)) {
        if (bodies[pid]) bodies[pid] = {...target, vx: 0, vy: 0, sprint: false};
      }
      const ball = fz.kind === "goal" || fz.kind === "halftime" ? {x: 50, y: 50} : fz.sp ? fz.sp.spot : fz.restart ? {x: fz.restart.x, y: fz.restart.y} : prev.ball;
      // The ball is placed for the restart, and it's the restart's touch: with the
      // keeper, thrower, taker or kicker, who plays it from there. (Not a later
      // touch the clock has got to while play waited: then the ball would lie
      // there for whoever that was, the taker would walk off, and anyone could take it.)
      return {...prev, bodies, ball, reached: restartTouch(ctx.frames, fz, prev.reached), flying: false};
    });
    setFreeze(null);
  }, [ctx]);
  useEffect(() => {
    if (!freeze || !Number.isFinite(freeze.duration)) return;
    const id = setTimeout(endFreeze, freeze.duration);
    return () => clearTimeout(id);
  }, [freeze, endFreeze]);

  const finished = time >= length - 1e-6 && (!live || live.done);
  // A cup tie level at the end: the user takes the shoot-out (once; it's saved on the fixture).
  const tie = live ? findFixture(game, report.fixtureId) : undefined;
  const [pens, setPens] = useState<[number, number] | null>(null);
  const shootoutScore = pens ?? (tie && isCupFixture(tie) ? tie.penalties : undefined) ?? null;
  const needsShootout = !!live && finished && !!tie && isCupFixture(tie) && report.homeGoals === report.awayGoals && !shootoutScore;
  // The user won (in the match, or on penalties).
  const ours = live?.userSide === "home" ? report.homeGoals : report.awayGoals;
  const theirs = live?.userSide === "home" ? report.awayGoals : report.homeGoals;
  const wonIt = !!live && finished && (ours > theirs || (ours === theirs && !!shootoutScore && (shootoutScore[0] > shootoutScore[1]) === (live.userSide === "home")));
  const notify = useGame((s) => s.notify);
  useEffect(() => {
    if (finished) setPlaying(false);
  }, [finished]);

  // The final whistle: the winners celebrate and go to thank their fans; the
  // losers trudge off to the tunnel. After a draw both go to their own fans.
  useEffect(() => {
    if (!finished || needsShootout || freeze || replay || done.current.has("ft")) return;
    // Level, but won on penalties: the shoot-out winners celebrate.
    const winner: Side | null =
      report.homeGoals > report.awayGoals ? "home"
      : report.awayGoals > report.homeGoals ? "away"
      : shootoutScore ? (shootoutScore[0] > shootoutScore[1] ? "home" : "away")
      : null;
    const stages = fullTimeStages(ctx, time, winner, scene.bodies);
    setFreeze({key: "ft", kind: "fulltime", time, side: winner ?? "home", started: performance.now(), duration: FULLTIME_MS, stages, targets: stages[stages.length - 1].targets});
  }, [finished, needsShootout, shootoutScore, freeze, replay, report, ctx, time, scene.bodies]);

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
      taskProgress(g, "order");
    });
    rerender((n) => n + 1);
  };

  const instruct = (playerId: string, key: InstructionKey, level: InstructionLevel) => {
    give({type: "instruct", playerId, key, level});
    const name = (game.players[playerId] ? shortName(game.players[playerId]) : undefined) ?? "";
    shout(playerId, tx(level === 0 ? "shout.reset" : `shout.${key}${level > 0 ? "+" : "-"}`, {player: name}));
  };

  const instructTeam = (key: InstructionKey, level: InstructionLevel) => {
    give({type: "instructTeam", key, level});
    shout("", tx(level === 0 ? "shout.reset" : `shout.${key}${level > 0 ? "+" : "-"}`, {player: t("shout.everyone")}));
  };

  const substitute = (outId: string, inId: string) => {
    give({type: "sub", outId, inId});
    shout(outId, t("shout.sub", {in: (game.players[inId] ? shortName(game.players[inId]) : undefined) ?? "", out: (game.players[outId] ? shortName(game.players[outId]) : undefined) ?? ""}));
    setSelected(null);
  };

  // The injured player's replacement: picked, then play goes on.
  const replaceInjured = (inId: string) => {
    const stop = live?.stop;
    if (!live || stop?.type !== "injury") return;
    substitute(stop.playerId, inId);
    live.continue();
    endFreeze();
    rerender((n) => n + 1);
  };

  const startSecondHalf = () => {
    if (live?.stop?.type === "halftime") live.continue();
    setSelected(null);
    endFreeze();
    rerender((n) => n + 1);
  };

  // Events show once their minute is over; a goal shows the moment the ball goes in.
  const events = report.events.filter((e) => {
    if (e.minute <= time) return true;
    const touch = e.type === "goal" || e.type === "disallowed" ? goalTouch(e) : undefined;
    return !!touch && touch.minute <= time + 1e-6 && scene.reached >= report.frames.indexOf(touch);
  });
  const home = game.clubs[report.homeId];
  const away = game.clubs[report.awayId];
  const score = {
    home: events.filter((e) => e.type === "goal" && e.side === "home").length,
    away: events.filter((e) => e.type === "goal" && e.side === "away").length,
  };
  // During a replay the pitch shows the replayed moment; the score and clock stay live.
  const view = replay?.scene ?? scene;
  const carrierIndex = touchIndex(report.frames, view.time);
  const carrierId = carrierIndex >= 0 ? report.frames[carrierIndex].playerId : undefined;
  const booked = new Set(events.filter((e) => e.type === "yellow").map((e) => e.playerId));
  const hurt = new Set(events.filter((e) => e.type === "injury").map((e) => e.playerId));
  const shoutedAt = new Set(shouts.map((s) => s.playerId));

  const name = (id?: string) => {
    const p = id ? game.players[id] : undefined;
    return p ? shortName(p) : "?";
  };
  const jump = (to: number) => {
    let at = to;
    if (to >= length) {
      skipped.current = true;
      live?.playOut();
      setShown(null);
      setFreeze(null);
      setSelected(null);
      at = matchLength(report);
    }
    setScene(snap(ctx, at, dynRef.current));
    setPlaying(at < matchLength(report));
    rerender((n) => n + 1);
  };

  const userSide = live?.userSide;
  const managerLook = game.managerLook ?? defaultManagerLook(game.managerName);
  // Winners jump for joy after the final whistle.
  // A winner, in the match or on penalties.
  const decided = report.homeGoals !== report.awayGoals || !!shootoutScore;
  const celebrating = freeze?.kind === "fulltime" && decided ? freeze.side : null;
  const dots = (side: Side) => {
    const club = side === "home" ? home : away;
    const mine = side === userSide;
    const onPitch = [...onPitchAt(report, side, view.time).values()];
    // The armband: the chosen captain, or (none chosen, or off) the best outfield player on the pitch.
    const captain = club.roles?.captain && onPitch.includes(club.roles.captain)
      ? club.roles.captain
      : onPitch
          .filter((id) => game.players[id]?.position !== "GK")
          .reduce<string | undefined>((best, id) => (!best || overall(game.players[id]) > overall(game.players[best]) ? id : best), undefined);
    return onPitch.map((id) => {
      const b = view.bodies[id];
      // Gone down the tunnel after the final whistle.
      if (!b || (finished && b.y > IN_TUNNEL)) return null;
      const cx = b.x * 1.05;
      const cy = b.y * 0.68;
      // Trail length follows actual speed, so fast sprinters leave longer trails.
      const trail = b.sprint ? 0.12 : 0;
      return (
        <g key={id} className={`dot${mine && !finished ? " mine" : ""}${celebrating === side ? " celebrate" : ""}`} onClick={mine && !freeze && !finished ? () => setSelected(id) : undefined}>
          {trail > 0 && (
            <line x1={(b.x - b.vx * trail) * 1.05} y1={(b.y - b.vy * trail) * 0.68} x2={cx} y2={cy} className="trail" stroke={club.color} />
          )}
          <g transform={`translate(${cx} ${cy})`}>
            {mine && <circle r={4} className="hit" />}
            {shoutedAt.has(id) && <circle r={3.2} className="shout-ring" />}
            {id === carrierId && <circle r={2.4} className="carrier-ring" />}
            {id === selected && <circle r={2.8} className="selected-ring" />}
            <circle r={1.6} fill={club.color} stroke={club.color2} strokeWidth={0.4} className="body" />
            {id === captain && <text y={0.62} className="dot-captain" fill={club.color2}>C</text>}
            {booked.has(id) && <rect x={0.9} y={-2.6} width={1.1} height={1.5} rx={0.2} className="booked" />}
            {hurt.has(id) && <text x={-2.6} y={0.6} className="dot-hurt">✚</text>}
            <text y={-2.4} className="dot-label">{name(id)}</text>
          </g>
        </g>
      );
    });
  };

  // The event list only changes when an event is added, not with every frame of play.
  const feed = useMemo(
    () => (
      <ol className="feed" aria-live="polite">
        {events.slice().reverse().map((e, i) => (
          <li key={events.length - i} className={`ev ev-${e.type} ${e.side ?? ""}`}>
            <span className="ev-min">{clockLabel(report, e.minute)}</span> {eventText(e, name, tx, e.side === "home" ? home.short : away.short, t("shout.everyone"))}
            {(e.type === "goal" || e.type === "disallowed") && goalTouch(e) && !current && (
              <button className="ev-replay" onClick={() => startReplay(goalTouch(e)!.minute)} title={t("match.replayGoal")} aria-label={t("match.replayGoal")}>🎥</button>
            )}
          </li>
        ))}
      </ol>
    ),
    // Text depends on the language; replays are only offered outside set pieces.
    [events.length, lang, !!current, report]
  );

  // What players see: a fan in front of them, the way they're running (or
  // towards the goal they attack when standing). Longer with better vision.
  const seers = new Set<string>();
  if (carrierId) seers.add(carrierId);
  if (selected && selected !== "team") seers.add(selected);
  const cones = [...seers].map((id) => {
    const b = view.bodies[id];
    const p = game.players[id];
    if (!b || !p) return null;
    const side: Side = p.clubId === report.homeId || p.loan?.parentClubId === report.homeId ? "home" : "away";
    const moving = Math.hypot(b.vx, b.vy) > 3;
    const angle = moving ? Math.atan2(b.vy * 0.68, b.vx * 1.05) : side === "home" ? 0 : Math.PI;
    const reach = 7 + p.attrs.vision / 8;
    const spread = 0.6;
    const cx = b.x * 1.05;
    const cy = b.y * 0.68;
    const edge = (a: number) => `${(cx + Math.cos(a) * reach).toFixed(2)} ${(cy + Math.sin(a) * reach).toFixed(2)}`;
    return (
      <g key={`cone-${id}`} className={id === carrierId ? "vision carrier" : "vision"}>
        <defs>
          <radialGradient id={`cone-${id}`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={reach}>
            <stop offset="0" stopColor="#fff" stopOpacity={0.42} />
            <stop offset="1" stopColor="#fff" stopOpacity={0} />
          </radialGradient>
        </defs>
        <path d={`M${cx} ${cy} L${edge(angle - spread)} A${reach} ${reach} 0 0 1 ${edge(angle + spread)} Z`} fill={`url(#cone-${id})`} />
      </g>
    );
  });

  const flightNow = view.flying ? report.frames[view.reached + 1]?.flight : undefined;
  const lofted = flightNow === "long" || flightNow === "cross";

  const scorer = freeze?.kind === "goal" ? game.players[freeze.scorerId ?? ""] : undefined;
  const scoringClub = freeze?.kind === "goal" ? (freeze.side === "home" ? home : away) : undefined;
  const board = boardAt(report, time);
  const atHalftime = freeze?.kind === "halftime";
  const injuryStop = freeze?.kind === "injury" && live?.stop?.type === "injury" ? live.stop : null;
  const clock = finished ? t("match.ft") : atHalftime ? t("match.ht") : clockLabel(report, time);
  // Closing a live match before the end asks first; yes plays the rest out
  // automatically and closes, just like Finish.
  const close = live && !finished ? () => setConfirmClose(true) : onClose;

  return (
    <Modal wide title={<>{live && <span className="live-badge">{t("match.live")}</span>} {home.name} – {away.name}</>} onClose={close} backdropCloses={!live}>
      <div className="scoreboard">
        {live && <span className="team-ovr" title={t("tac.teamOvrHint")}>{t("tac.teamOvr")} <strong>{teamOvr(game, home.id)}</strong></span>}
        <span className="crest" style={{background: home.color, color: home.color2}}>{home.short}</span>
        <span className="score">{score.home} – {score.away}</span>
        {shootoutScore && <small className="score-pens">{t("fx.penalties", {h: shootoutScore[0], a: shootoutScore[1]})}</small>}
        <span className="crest" style={{background: away.color, color: away.color2}}>{away.short}</span>
        {live && <span className="team-ovr" title={t("tac.teamOvrHint")}>{t("tac.teamOvr")} <strong>{teamOvr(game, away.id)}</strong></span>}
        <span className="clock">{clock}</span>
        {board > 0 && !atHalftime && !finished && (
          <span className="board" title={t("match.added", {n: board})}>+{board}</span>
        )}
      </div>

      {needsShootout && live ? (
        <Shootout
          report={report}
          seed={game.liveMatch?.seed ?? 1}
          userSide={live.userSide}
          onDone={(score) => {
            act((g) => {
              const f = findFixture(g, report.fixtureId);
              if (f && isCupFixture(f)) f.penalties = score;
            });
            setPens(score);
          }}
        />
      ) : current && live ? (
        <SetPieceView
          key={current.sp.index}
          sp={current.sp}
          role={live.role(current.sp) ?? "shooter"}
          taker={game.players[current.sp.takerId]}
          keeper={current.sp.keeperId ? game.players[current.sp.keeperId] : undefined}
          attackers={[...live.team(current.sp.side).onPitch].map((o) => game.players[o.id])}
          defenders={[...live.team(current.sp.side === "home" ? "away" : "home").onPitch].map((o) => game.players[o.id])}
          shooters={current.sp.side === "home" ? home : away}
          keepers={current.sp.side === "home" ? away : home}
          outcome={current.outcome}
          onAnswer={answer}
          onDone={() => setShown(null)}
        />
      ) : (
        <div className="pitch-wrap">
          <svg className="pitch" viewBox={viewBox} role="img" aria-label={t("match.pitch")}>
            <Stands home={home} away={away} cheering={(freeze?.kind === "goal" || (freeze?.kind === "fulltime" && decided)) && !replay ? freeze.side : null} boards={(userSide === "away" ? away : home).color} />
            {PITCH}
            <Dugouts home={home} away={away} />
            {(!freeze || replay) && cones}
            {dots("home")}
            {dots("away")}
            {/* A long ball or cross is in the air: bigger, with its shadow further off on the grass. */}
            <ellipse cx={view.ball.x * 1.05 + (lofted ? 0.9 : 0.25)} cy={view.ball.y * 0.68 + (lofted ? 1.8 : 0.45)} rx={lofted ? 0.8 : 0.95} ry={lofted ? 0.4 : 0.5} className="ball-shadow" />
            <g transform={`translate(${view.ball.x * 1.05} ${view.ball.y * 0.68})`}>
              <Football r={lofted ? 1.4 : 1.05} />
            </g>
          </svg>

          {freeze?.kind === "goal" && scoringClub && !replay && (
            <>
              <Confetti key={freeze.key} colors={[scoringClub.color, scoringClub.color2, "#fde047", "#ffffff"]} />
              <div className="goal-banner">
                <strong>{t("match.goal")}</strong>
                {scorer && <span>{fullName(scorer)}</span>}
              </div>
              <button className="btn replay-btn" onClick={() => startReplay(freeze.time)}>🎥 {t("match.replayGoal")}</button>
            </>
          )}
          {replay && (
            <>
              <div className="replay-badge" aria-live="polite">🎥 {t("match.replayBadge")}</div>
              <button className="btn small replay-skip" onClick={() => setReplay(null)}>⏭ {t("match.replayEnd")}</button>
            </>
          )}
          <button className="btn small zoom-btn" onClick={toggleZoom} aria-pressed={zoomedIn} title={zoomedIn ? t("match.zoomOut") : t("match.zoomIn")}>
            {zoomedIn ? "🏟️" : "🔍"} {zoomedIn ? t("match.zoomOut") : t("match.zoomIn")}
          </button>
          {freeze?.kind === "nogoal" && !replay && <NoGoalBanner key={freeze.key} reason={report.events.find((e) => e.type === "disallowed" && e.side === freeze.side && e.minute === Math.ceil(freeze.time))?.note} />}
          {freeze?.kind === "restart" && freeze.restart && !replay && (
            <div className="setup-banner">
              {freeze.restart.kind === "goalkick" ? "🥅" : "🤾"} {t(freeze.restart.kind === "goalkick" ? "match.goalKick" : "match.throwIn", {team: (freeze.side === "home" ? home : away).short, player: name(freeze.restart.playerId)})}
            </div>
          )}
          {freeze?.kind === "setup" && freeze.sp && (
            <div className="setup-banner">{tx(`ev.${freeze.sp.kind}`, {team: (freeze.side === "home" ? home : away).short, player: name(freeze.sp.takerId)})}</div>
          )}
          {atHalftime && !live && <div className="setup-banner">{t("ev.halftime")}</div>}
          {freeze?.kind === "fulltime" && (
            <div className="setup-banner">
              🏁 {!decided ? t("match.ftDraw") : t("match.ftWin", {team: (freeze.side === "home" ? home : away).name})}
            </div>
          )}
          {shouts.length > 0 && userSide && (
            <div className={`shout ${userSide}`} role="status">
              <span className="shout-manager" aria-hidden><ManagerAvatar look={managerLook} size={40} tie={(userSide === "home" ? home : away).color} /></span>
              <span className="shout-bubble">📣 {shouts[shouts.length - 1].text}</span>
            </div>
          )}
        </div>
      )}

      {live && atHalftime && !selected && !replay && (
        <MatchDialog title={`☕ ${t("match.halftime")}`} onClose={startSecondHalf}>
          <div className="ht-score">
            <span className="crest" style={{background: home.color, color: home.color2}}>{home.short}</span>
            <strong>{score.home} – {score.away}</strong>
            <span className="crest" style={{background: away.color, color: away.color2}}>{away.short}</span>
          </div>
          <ul className="plain-list small ht-goals">
            {events.filter((e) => e.type === "goal").map((e, i) => (
              <li key={i}>⚽ {clockLabel(report, e.minute)} {name(e.playerId)} ({e.side === "home" ? home.short : away.short})</li>
            ))}
          </ul>
          <p className="muted small">{t("match.htHint")}</p>
          <div className="btn-row">
            <button className="btn" onClick={() => setSelected("team")}>📋 {t("match.teamTalk")}</button>
            <button className="btn primary" onClick={startSecondHalf}>▶ {t("match.secondHalf")}</button>
          </div>
        </MatchDialog>
      )}

      {watchingAd && (
        <VideoAd
          onClose={() => setWatchingAd(false)}
          onReward={() => {
            setWatchingAd(false);
            const err = act((g) => videoAfterWin(g, new Date().toISOString().slice(0, 10), report.fixtureId));
            if (err) notify(err, undefined, "error");
            else diamondBurst(null, WIN_VIDEO_DIAMONDS);
          }}
        />
      )}
      {talking && onFinish && <TeamTalkDialog report={report} onDone={(words) => { setTalking(false); onFinish(words); }} />}
      {confirmClose && (
        <MatchDialog title={`⏹ ${t("match.closeTitle")}`} onClose={() => setConfirmClose(false)}>
          <p>{t("match.closeText")}</p>
          <div className="btn-row">
            <button className="btn" onClick={() => setConfirmClose(false)}>{t("match.closeNo")}</button>
            <button className="btn primary push-right" onClick={onClose}>{t("match.closeYes")}</button>
          </div>
        </MatchDialog>
      )}

      {live && injuryStop && (
        <InjuryDialog live={live} playerId={injuryStop.playerId} pos={injuryStop.pos} onPick={replaceInjured} />
      )}

      {live && selected && !finished && !current && !injuryStop && (
        <MatchDialog title={`📋 ${t("orders.title")}`} onClose={() => setSelected(null)}>
          <OrdersPanel
            live={live}
            target={selected}
            booked={booked}
            onTarget={setSelected}
            onInstruct={instruct}
            onTeamInstruct={instructTeam}
            onSub={substitute}
            onClose={() => setSelected(null)}
          />
        </MatchDialog>
      )}

      <div className="match-controls">
        {finished && onFinish ? (
          !needsShootout && (
            <>
              {/* Won: a video for bonus diamonds, once per match. */}
              {wonIt && game.daily?.winVideoFixture !== report.fixtureId && (
                <button className="btn push-right" onClick={() => setWatchingAd(true)}>🎬 {t("video.win", {n: WIN_VIDEO_DIAMONDS})}</button>
              )}
              <button className={wonIt && game.daily?.winVideoFixture !== report.fixtureId ? "btn primary" : "btn primary push-right"} onClick={() => setTalking(true)}>{t("match.finish")} ▶</button>
            </>
          )
        ) : (
          <>
            {finished ? (
              <button className="btn ctl" title={t("match.replay")} aria-label={t("match.replay")} onClick={() => jump(0)}>↺</button>
            ) : (
              // Pause, play at normal speed, and fast-forward: each press a step faster, up to 5×.
              <span className="speed-group" role="group" aria-label={t("match.speed")}>
                <button className={!playing ? "chip active" : "chip"} disabled={!!current} title={t("match.pause")} aria-label={t("match.pause")} onClick={() => setPlaying(false)}><ControlIcon kind="pause" /></button>
                <button className={playing && speed === 1 ? "chip active" : "chip"} disabled={!!current} title={t("match.play")} aria-label={t("match.play")} onClick={() => { setSpeed(1); setPlaying(true); }}><ControlIcon kind="play" /></button>
                <button
                  className={playing && speed > 1 ? "chip active" : "chip"}
                  disabled={!!current}
                  title={t("match.fastForward")}
                  aria-label={t("match.fastForward")}
                  onClick={() => { setSpeed(playing ? Math.min(MAX_SPEED, speed + 1) : Math.max(2, speed)); setPlaying(true); }}
                >
                  <ControlIcon kind="forward" />{speed > 1 ? " " + speed + "×" : ""}
                </button>
              </span>
            )}
            {live && !finished && (
              <>
                <button className="btn ctl" data-tour="orders" disabled={!!freeze && !atHalftime} onClick={() => setSelected(selected ? null : "team")}>📋 {t("orders.button")}</button>
                <button
                  className={live.manualSetPieces ? "chip active" : "chip"}
                  title={t("match.setPiecesHint")}
                  data-tour="setpieces"
                  onClick={() => {
                    live.manualSetPieces = !live.manualSetPieces;
                    try {
                      localStorage.setItem(SET_PIECES_KEY, live.manualSetPieces ? "self" : "auto");
                    } catch {
                      // Only remembered for this match.
                    }
                    rerender((n) => n + 1);
                  }}
                >
                  🎯 {live.manualSetPieces ? t("match.setPiecesSelf") : t("match.setPiecesAuto")}
                </button>
              </>
            )}
            {!finished && (
              <button className="btn ctl push-right" title={t("match.skip")} aria-label={t("match.skip")} onClick={() => jump(Infinity)}>
                ⏭<span className="skip-label"> {t("match.skip")}</span>
              </button>
            )}
          </>
        )}
      </div>
      {/* What the buttons above do. */}
      {live && !finished && !selected && (
        <ul className="control-help muted small">
          <li>📋 {t("orders.hint")}</li>
          <li>🎯 {t("match.setPiecesHint")}</li>
          <li>🔍 {t("match.zoomHint")}</li>
        </ul>
      )}

      <div className="match-columns">
        {feed}
        {finished && <Summary report={report} />}
      </div>
    </Modal>
  );
}

/** "GOAL!"... and then the referee rules it out. */
function NoGoalBanner({reason}: {reason?: string}) {
  const {t, tx} = useT();
  const [ruled, setRuled] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setRuled(true), 1100);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className={ruled ? "goal-banner ruled-out" : "goal-banner"}>
      <strong>{ruled ? `❌ ${t("match.ruledOut")}` : t("match.goal")}</strong>
      {ruled && reason && <span>🚩 {tx(`reason.${reason}`)}</span>}
    </div>
  );
}

/** A see-through dialog over the match, so the pitch stays in view behind it. */
function MatchDialog({title, onClose, children}: {title: ReactNode; onClose: () => void; children: ReactNode}) {
  const {t} = useT();
  return (
    <div className="match-dialog-backdrop" onClick={onClose}>
      <section className="match-dialog" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} onClick={(e) => e.stopPropagation()}>
        <header className="match-dialog-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label={t("common.close")}>✕</button>
        </header>
        {children}
      </section>
    </div>
  );
}

/** Confetti in the scoring club's colours. */
export function Confetti({colors}: {colors: string[]}) {
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

const INSTRUCTION_ICONS: Record<InstructionKey, string> = {passing: "🔁", dribbling: "🏃", shooting: "🥅", tackling: "🦵", position: "↕️"};
const levelName = (lvl: InstructionLevel) => (lvl === -1 ? "low" : lvl === 1 ? "high" : "normal");

/** One row per instruction: less, normal, more, with what the current choice does. */
function InstructionGrid({value, disabled, onPick, keeper}: {value: (key: InstructionKey) => InstructionLevel; disabled?: boolean; onPick: (key: InstructionKey, level: InstructionLevel) => void; keeper?: boolean}) {
  const {t, tx} = useT();
  // A keeper only has one order: how to play it out (passing: "more" is short, "direct" is long).
  const keys = keeper ? (["passing"] as const) : INSTRUCTIONS;
  const base = (key: InstructionKey) => (keeper ? "orders.gk" : `orders.${key}`);
  return (
    <div className="orders-grid">
      {keys.map((key) => {
        const current = value(key);
        return (
          <div key={key} className={current === 0 ? "order-row" : "order-row changed"}>
            <span className="order-label">{keeper ? "🧤" : INSTRUCTION_ICONS[key]} {tx(base(key))}</span>
            <div className="order-chips">
              {([-1, 0, 1] as const).map((lvl) => (
                <button
                  key={lvl}
                  className={lvl === current ? "chip active" : "chip"}
                  disabled={disabled}
                  title={tx(`${base(key)}.${levelName(lvl)}.desc`)}
                  onClick={() => lvl !== current && onPick(key, lvl)}
                >
                  {lvl === -1 ? tx(`${base(key)}.low`) : lvl === 1 ? tx(`${base(key)}.high`) : t("orders.normal")}
                </button>
              ))}
            </div>
            <p className="order-desc">{tx(`${base(key)}.${levelName(current)}.desc`)}</p>
          </div>
        );
      })}
    </div>
  );
}

/** Bench players to bring on, best for the position first. */
function BenchList({live, pos, onPick, recommend}: {live: LiveMatch; pos?: Parameters<typeof effectiveRating>[1]; onPick: (id: string) => void; recommend?: boolean}) {
  const {t} = useT();
  const takenIn = new Set(live.pendingSubs().map((c) => (c.type === "sub" ? c.inId : "")));
  const bench = live.team().bench.filter((id) => !takenIn.has(id)).map((id) => live.player(id)!).filter(Boolean);
  if (pos) bench.sort((a, b) => effectiveRating(b, pos) - effectiveRating(a, pos));
  return (
    <ul className="pick-list">
      {bench.map((b, i) => (
        <li key={b.id}>
          <button className="pick" onClick={() => onPick(b.id)}>
            <PosBadge pos={b.position} />
            <span className="pick-name"><Flag code={b.nationality} size={15} /> {listName(b)}</span>
            <span className="muted small">{recommend && i === 0 ? `⭐ ${t("match.injuryBest")}` : ""}</span>
            <span className="num strong">{pos ? Math.round(effectiveRating(b, pos)) : overall(b)}</span>
            <Bar value={b.fitness} small />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** A player is down: the manager has to choose who comes on. */
function InjuryDialog({live, playerId, pos, onPick}: {live: LiveMatch; playerId: string; pos: Parameters<typeof effectiveRating>[1]; onPick: (id: string) => void}) {
  const {t} = useT();
  const game = useGameState();
  const p = live.player(playerId);
  const club = game.clubs[game.userClubId];
  const subsLeft = live.team().subsLeft - live.pendingSubs().length;
  return (
    <div className="match-dialog-backdrop">
      <section className="match-dialog injury" role="alertdialog" aria-modal="true" aria-label={t("match.injuryTitle", {player: (p ? shortName(p) : undefined) ?? ""})}>
        <header className="injury-head">
          {p && <Avatar player={p} shirt={club.color} trim={club.color2} size={64} mood={10} />}
          <div>
            <h3>🩹 {t("match.injuryTitle", {player: p ? `${fullName(p)}` : "?"})}</h3>
            <p className="muted small">{t("match.injuryHint", {pos: t(`pos.${pos}`)})} · {t("orders.subsLeft", {n: subsLeft})}</p>
          </div>
        </header>
        <BenchList live={live} pos={pos} onPick={onPick} recommend />
      </section>
    </div>
  );
}

/** Who the orders are for: the whole team or one player. */
export type OrdersTarget = "team" | string;

/**
 * All the manager's orders in one place. The strip at the top picks who
 * they're for: the whole team or any player on the pitch (tapping a player
 * on the pitch opens it on them). Each instruction says what it does.
 */
function OrdersPanel({
  live,
  target,
  booked,
  onTarget,
  onInstruct,
  onTeamInstruct,
  onSub,
  onClose,
}: {
  live: LiveMatch;
  target: OrdersTarget;
  booked: Set<string | undefined>;
  onTarget: (target: OrdersTarget) => void;
  onInstruct: (id: string, key: InstructionKey, level: InstructionLevel) => void;
  onTeamInstruct: (key: InstructionKey, level: InstructionLevel) => void;
  onSub: (outId: string, inId: string) => void;
  onClose: () => void;
}) {
  const {t} = useT();
  const game = useGameState();
  const club = game.clubs[game.userClubId];
  const team = live.team();
  const subsLeft = team.subsLeft - live.pendingSubs().length;
  const teamTold = INSTRUCTIONS.some((k) => live.teamLevel(k) !== 0);
  return (
    <div className="orders">
      <div className="target-strip" role="tablist" aria-label={t("orders.who")}>
        <button role="tab" aria-selected={target === "team"} className={target === "team" ? "target active" : "target"} onClick={() => onTarget("team")}>
          <span className="target-icon" aria-hidden>👥</span>
          <span className="target-name">{t("orders.teamTitle")}</span>
          {teamTold && <span className="target-told" aria-hidden>📣</span>}
        </button>
        {team.onPitch.map((o) => {
          const p = live.player(o.id);
          if (!p) return null;
          const told = INSTRUCTIONS.some((k) => live.level(o.id, k) !== live.teamLevel(k));
          return (
            <button key={o.id} role="tab" aria-selected={target === o.id} className={target === o.id ? "target active" : "target"} onClick={() => onTarget(o.id)}>
              <Avatar player={p} shirt={club.color} trim={club.color2} size={34} />
              <span className="target-name">{shortName(p)}</span>
              <span className="target-pos">{t(`pos.${team.slots[o.slot].pos}`)}{booked.has(o.id) ? " 🟨" : ""}</span>
              {told && <span className="target-told" aria-hidden>📣</span>}
            </button>
          );
        })}
      </div>

      {target === "team" ? (
        <>
          <p className="orders-intro">{t("orders.teamHint")}</p>
          <InstructionGrid value={(key) => live.teamLevel(key)} onPick={onTeamInstruct} />
        </>
      ) : (
        <PlayerOrders key={target} live={live} playerId={target} booked={booked.has(target)} onInstruct={onInstruct} onSub={onSub} />
      )}

      <div className="btn-row">
        <span className="muted small">{subsLeft > 0 ? t("orders.subsLeft", {n: subsLeft}) : t("orders.noSubs")}</span>
        <button className="btn primary push-right" onClick={onClose}>{t("orders.done")}</button>
      </div>
    </div>
  );
}

/** Instructions and substitution for one of the user's players. */
function PlayerOrders({
  live,
  playerId,
  booked,
  onInstruct,
  onSub,
}: {
  live: LiveMatch;
  playerId: string;
  booked: boolean;
  onInstruct: (id: string, key: InstructionKey, level: InstructionLevel) => void;
  onSub: (outId: string, inId: string) => void;
}) {
  const {t} = useT();
  const game = useGameState();
  const [picking, setPicking] = useState(false);
  const p = live.player(playerId);
  const team = live.team();
  if (!p) return null;
  const club = game.clubs[game.userClubId];
  const pendingSubs = live.pendingSubs();
  const subsLeft = team.subsLeft - pendingSubs.length;
  const comingOff = pendingSubs.some((c) => c.type === "sub" && c.outId === playerId);
  const slot = team.onPitch.find((o) => o.id === playerId);
  const onPitch = !!slot;
  const benchLeft = team.bench.filter((id) => !pendingSubs.some((c) => c.type === "sub" && c.inId === id)).length;

  return (
    <>
      <header className="orders-head">
        <Avatar player={p} shirt={club.color} trim={club.color2} size={48} />
        <div className="orders-who">
          <strong>{fullName(p)}</strong>
          <span className="orders-meta">
            <PosBadge pos={slot ? team.slots[slot.slot].pos : p.position} />
            <Flag code={p.nationality} />
            {booked && <span className="booked-tag">🟨 {t("orders.booked")}</span>}
          </span>
        </div>
        <span className="orders-fitness" title={t("col.fitness")}>⚡ <Bar value={p.fitness} small label={t("col.fitness")} /></span>
      </header>

      {picking ? (
        <>
          <h3>{t("orders.pickSub")}</h3>
          <BenchList live={live} pos={slot ? team.slots[slot.slot].pos : undefined} onPick={(id) => onSub(playerId, id)} />
          <button className="btn small" onClick={() => setPicking(false)}>{t("common.cancel")}</button>
        </>
      ) : (
        <>
          <p className="orders-intro">{t("orders.playerHint", {name: shortName(p)})}</p>
          <InstructionGrid keeper={(slot ? team.slots[slot.slot].pos : p.position) === "GK"} value={(key) => live.level(playerId, key)} disabled={!onPitch} onPick={(key, lvl) => onInstruct(playerId, key, lvl)} />
          <div className="btn-row">
            {comingOff ? (
              <span className="muted small">🔁 {t("orders.subPending")}</span>
            ) : (
              <button className="btn" disabled={subsLeft <= 0 || !onPitch || benchLeft === 0} onClick={() => setPicking(true)}>
                🔁 {t("orders.sub")}
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}

function eventText(
  e: MatchEvent,
  name: (id?: string) => string,
  tx: (k: string, p?: Record<string, string | number>) => string,
  team: string,
  everyone: string
): string {
  const params = {player: e.type === "instruction" && !e.playerId ? everyone : name(e.playerId), other: name(e.otherId), team};
  if (e.type === "goal" && e.otherId) return tx("ev.goalAssist", params);
  if (e.type === "disallowed") return tx("ev.disallowed", {...params, reason: tx(`reason.${e.note}`)});
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
                  <button className="link" onClick={() => openPlayer(id)}>{shortName(game.players[id])}</button>{" "}
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
