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
import {STAND_MAX} from "../game/stadium";
import {Icon, iconize, type IconName} from "./Icon";
import {ClubCrest, TeamOvr} from "./LineupSheet";
import {useKeepScroll} from "./scrollKeep";
import {Jersey} from "./Jersey";
import {boardSpots} from "./views/Tactics";
import {FORMATION_IDS, type FormationId} from "../game/types";
import {memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from "react";
import {createPortal} from "react-dom";
import type {PointerEvent as ReactPointerEvent} from "react";
import {addMessage, findFixture, fullName, isCupFixture, isKnockout, listName, playerName, shortName, difficulty} from "../game/helpers";
import {shootoutOver} from "../game/cup";
import {WIN_VIDEO_DIAMONDS, taskProgress, videoAfterWin} from "../game/daily";
import {Rng} from "../game/rng";
import {matchVerdict, PLAYER_TALKS, TEAM_TALKS, talkFit, teamTalk, type PlayerTalk, type TeamTalk} from "../game/morale";
import {boardAt, clockLabel, matchLength} from "../game/clock";
import {FORMATIONS, type Slot, ENERGY_COST_FORZA} from "../game/constants";
import {LiveMatch} from "../game/live";
import {distance, fromSide, kickoffSpot, progressFor, teamSpot, type Point} from "../game/pitch";
import {effectiveRating, overall} from "../game/ratings";
import {aerial, cornerAttacker, resolveSetPiece, type SetPiece, type SetPieceInput, type SetPieceOutcome} from "../game/setpieces";
import {cornerZone, FORZA, hashString} from "../game/match";
import {GEAR_COLOR, GEAR_KIND_COLOR} from "../game/gear";
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
import {spendEnergy} from "../game/monetization";
import {Bar, Flag, Modal, PosBadge, Hint} from "./common";
import {SetPieceView} from "./SetPieceView";
import {VideoAd} from "./VideoAd";
import {diamondBurst, energySpent} from "./effects";
import {chatter, rallyFanfare, crowd, crowdMurmur, isMuted, kick, onMutedChange, setMuted, whistle} from "./sound";

/** Fast-forward goes up one step per press, to this. */
const MAX_SPEED = 5;
/** Real milliseconds per match minute at 1x. */
const MS_PER_MINUTE = 1200;
/** Normal play (▶, not fast-forward) runs a bit slower than that, so it is easy to follow. */
const NORMAL_PLAY_RATE = 0.8;
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
const SUBS_KEY = "manager2d.manualSubs";
const TEXT_ONLY_KEY = "manager2d.textOnly";
/** Finishing above this: every shot flies with a tail of fire. */
const FIRE_FINISHING = 95;

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
  /**
   * Touches taken by a nearer teammate than the one recorded: a loose ball is
   * picked up by whoever of that side gets there first (touch index -> player).
   */
  subs?: Record<number, string>;
}

export interface Ctx {
  report: MatchReport;
  frames: Frame[];
  slots: Record<Side, Slot[]>;
  players: GameState["players"];
}

/** The places a side stands in at time t (a formation change moves them). */
function slotsAt(ctx: Ctx, side: Side, t: number): Slot[] {
  let slots = ctx.slots[side];
  for (const c of ctx.report.slotChanges ?? []) if (c.side === side && c.minute - 1 <= t) slots = c.slots;
  return slots;
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

/** The centre circle's radius in metres (9.15 m), and a step to spare. */
const CENTRE_CIRCLE_M = 10.2;

/**
 * Kick-off: everyone in their own half, the taker on the centre spot, and
 * nobody from the other side inside the centre circle.
 */
function kickoffTargets(ctx: Ctx, t: number, kickerId?: string): Record<string, Point> {
  const cs = {home: slotsAt(ctx, "home", t), away: slotsAt(ctx, "away", t)};
  const targets: Record<string, Point> = {};
  for (const side of ["home", "away"] as const) {
    const players = onPitchAt(ctx.report, side, t);
    const kicking = !!kickerId && [...players.values()].includes(kickerId);
    for (const [slot, id] of players) {
      let spot = kickoffSpot(cs[side][slot], side);
      if (!kicking) {
        // Out of the circle (in metres: the pitch is 105 x 68), still in their own half.
        const dx = (spot.x - 50) * 1.05;
        const dy = (spot.y - 50) * 0.68;
        const d = Math.hypot(dx, dy);
        if (d < CENTRE_CIRCLE_M) {
          const ux = d > 0.01 ? dx / d : side === "home" ? -1 : 1;
          const uy = d > 0.01 ? dy / d : 0;
          spot = {x: 50 + (ux * CENTRE_CIRCLE_M) / 1.05, y: 50 + (uy * CENTRE_CIRCLE_M) / 0.68};
        }
      }
      targets[id] = spot;
    }
  }
  if (kickerId) targets[kickerId] = {x: 50, y: 50};
  return targets;
}

/**
 * Where everyone stands for a set piece, worked out in the attacking side's
 * view (attacking towards 100) and converted at the end.
 */
function setupTargets(ctx: Ctx, sp: SetPiece, t: number): Record<string, Point> {
  const cs = {home: slotsAt(ctx, "home", t), away: slotsAt(ctx, "away", t)};
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
      if (cs[side][slot].pos === "GK") {
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
  const cs = {home: slotsAt(ctx, "home", t), away: slotsAt(ctx, "away", t)};
  const own = f.possession;
  const targets: Record<string, Point> = {};
  for (const side of ["home", "away"] as const) {
    for (const [slot, id] of onPitchAt(ctx.report, side, t)) {
      const s = cs[side][slot];
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
  // Fired up ("Forza!"): the whole side pushes up for as long as it lasts, whatever they were told.
  for (const e of report.events) {
    if (e.type !== "instruction" || (e.note !== "forza" && e.note !== "forzaRival") || !e.side) continue;
    if (t < e.minute || t >= e.minute + FORZA.minutes) continue;
    for (const id of Object.keys(push)) if (sideOf[id] === e.side) push[id] = 1;
    push[`@${e.side}`] = 1;
  }
  return push;
}

function possessionAt(ctx: Ctx, t: number): Side {
  const i = touchIndex(ctx.frames, t);
  return i >= 0 ? ctx.frames[i].possession : "home";
}

/** Everyone in place, the ball at the latest touch: used when jumping in time. */
export function snap(ctx: Ctx, t: number, dyn: Dyn = NO_DYN): Scene {
  const cs = {home: slotsAt(ctx, "home", t), away: slotsAt(ctx, "away", t)};
  const i = touchIndex(ctx.frames, t);
  const ball = i >= 0 && ctx.frames[i].kind !== "goal" ? {x: ctx.frames[i].x, y: ctx.frames[i].y} : {x: 50, y: 50};
  const possession = possessionAt(ctx, t);
  const override = dyn.overrides.find((o) => t >= o.from && t < o.to);
  const bodies: Record<string, Body> = {};
  for (const side of ["home", "away"] as const) {
    for (const [slot, id] of onPitchAt(ctx.report, side, t)) {
      const spot = override?.targets[id] ?? teamSpot(cs[side][slot], side, ball, possession === side, pushFor(dyn, id, side));
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
  const cs = {home: slotsAt(ctx, "home", t1), away: slotsAt(ctx, "away", t1)};
  let ball = {...prev.ball};
  let reached = prev.reached;
  let flying = prev.flying ?? false;
  const subs = {...(prev.subs ?? {})};
  const fr = (k: number): Frame => {
    const f = ctx.frames[k];
    const sub = subs[k];
    return sub && f ? {...f, playerId: sub} : f;
  };
  const bodies: Record<string, Body> = {};
  for (const [id, b] of Object.entries(prev.bodies)) bodies[id] = {...b};
  let t = prev.time;

  while (t < t1 - 1e-9) {
    const dt = Math.min(STEP, t1 - t);
    t += dt;
    const i = touchIndex(ctx.frames, t);
    const cur = i >= 0 ? fr(i) : undefined;
    const possession: Side = cur?.possession ?? "home";
    const override = dyn.overrides.find((o) => overrideOn(o, t, reached, flying));

    // Ball: it plays the touches strictly in order and only turns once it has
    // reached the touch: the player's feet for passes, dribbles and tackles
    // (they run to meet it), the recorded spot for shots, balls out and set
    // pieces. Its speed is capped, so it never jumps; running late, it goes
    // at top speed until it has caught up.
    const holdOn = (k: number) => {
      const f = fr(k);
      const after = fr(k + 1);
      if (!after) return true;
      // In the net or out of play, it stays there until play restarts.
      if (!f.playerId || f.kind === "goal" || f.kind === "nogoal") return t < after.minute;
      return after.playerId !== f.playerId && t - f.minute < (after.minute - f.minute) * HOLD;
    };
    const aimFor = (k: number): Point => {
      const f = fr(k);
      // A goal ends up in the back of the net.
      if (f.kind === "goal" || f.kind === "nogoal") return {x: f.x > 50 ? NET_DEPTH : 100 - NET_DEPTH, y: f.y};
      // Played into space for someone to run onto: the shooting position, a cross into
      // the box, a ball in behind. Never further than they can get to in time (then it's
      // played nearer to them, on their way there), so nobody else is left standing by it.
      if (isShotSetup(ctx.frames, k) || isCross(ctx.frames, k) || f.flight === "through") {
        // Carried into the shot: it stays at the shooter's feet.
        if (f.kind === "dribble") return (f.playerId && bodies[f.playerId]) || f;
        const rb = f.playerId ? bodies[f.playerId] : undefined;
        if (!rb) return f;
        const reach = topSpeed(ctx, f.playerId!, t) * CATCH_UP * Math.max(0, f.minute - t) + 1.5;
        const d = distance(rb, f);
        if (d <= reach) return f;
        let k2 = reach / d;
        // A shot is still struck from around the box (a shooter far off sprints the rest).
        if (isShotSetup(ctx.frames, k)) {
          const depth = (q: number) => progressFor(f.possession, rb.x + (f.x - rb.x) * q);
          if (depth(k2) < 70 && depth(1) > depth(0)) k2 = Math.min(1, Math.max(k2, (70 - depth(0)) / (depth(1) - depth(0))));
        }
        return {x: rb.x + (f.x - rb.x) * k2, y: rb.y + (f.y - rb.y) * k2};
      }
      // Placed balls go to the spot. Everything else, dribbles included (carried
      // at the player's feet), goes to the player.
      const toSpot = ["setpiece", "kickoff", "goalkick", "throwin"].includes(f.kind ?? "");
      const body = f.playerId && !toSpot ? bodies[f.playerId] : undefined;
      return body ?? f;
    };
    const holderOf = (k: number) => {
      const f = fr(k);
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
      // Won off them: by whoever of that side is nearest the ball, not someone far away.
      const won = fr(reached + 1);
      const tackler = won?.kind === "tackle" && won.playerId ? bodies[won.playerId] : undefined;
      if (won && tackler && distance(tackler, ball) > 6) {
        let best: string | undefined;
        let bestD = distance(tackler, ball) - 3;
        for (const [slot, id] of onPitchAt(ctx.report, won.possession, t)) {
          if (cs[won.possession][slot].pos === "GK" || !bodies[id]) continue;
          const d = distance(bodies[id], ball);
          if (d < bestD) {
            bestD = d;
            best = id;
          }
        }
        if (best) {
          const original = won.playerId!;
          for (let j = reached + 1; j < ctx.frames.length && ctx.frames[j].playerId === original; j++) subs[j] = best;
        }
      }
    }
    const ahead = flying;
    if (ahead && fr(reached + 1)) {
      const k = reached + 1;
      const to = aimFor(k);
      const gap = distance(ball, to);
      // Into space for a shooter who is still on his way: weighted so the two get there together.
      const meet = fr(k);
      const runner = isShotSetup(ctx.frames, k) && meet.kind === "pass" && meet.playerId ? bodies[meet.playerId] : undefined;
      const eta = runner ? distance(runner, to) / (topSpeed(ctx, meet.playerId!, t) * CATCH_UP) : 0;
      const timeLeft = Math.max(meet.minute - t, eta);
      const speed = Math.min(BALL_TOP_SPEED, timeLeft > dt ? gap / timeLeft : BALL_TOP_SPEED);
      const move = Math.min(gap, speed * dt);
      if (gap > 0) ball = {x: ball.x + ((to.x - ball.x) / gap) * move, y: ball.y + ((to.y - ball.y) / gap) * move};
      // A dribble is done when the run is (the ball rides along at their feet until then).
      // The run to a foul or out for a corner goes all the way there (play stops there, and waits for it).
      const f = fr(k);
      const beforeStop = fr(k + 1)?.kind === "setpiece" || (fr(k + 1)?.kind === "out" && fr(k + 2)?.kind === "setpiece");
      // Running at goal to shoot: all the way to where the shot is struck from.
      const toSpot = beforeStop || isShotSetup(ctx.frames, k);
      const runDone = f.kind !== "dribble" || (t >= f.minute - 0.02 && (!toSpot || distance(ball, f) < 3));
      // A tackle is won as soon as the ball is within the tackler's reach.
      if (gap - move < (f.kind === "tackle" ? 2 : 0.8) && runDone) {
        reached = k;
        flying = false;
        // Lying loose with the player it was meant for far off: a nearer teammate takes it.
        const lying = fr(k);
        const meant = lying.playerId ? bodies[lying.playerId] : undefined;
        if (meant && lying.playerId && ["pass", "dribble", "tackle"].includes(lying.kind ?? "") && !isShotSetup(ctx.frames, k) && distance(meant, ball) > 5) {
          const side = onPitchAt(ctx.report, lying.possession, t);
          let best: string | undefined;
          let bestD = distance(meant, ball) - 3;
          for (const [slot, id] of side) {
            if (cs[lying.possession][slot].pos === "GK" || !bodies[id]) continue;
            const d = distance(bodies[id], ball);
            if (d < bestD) {
              bestD = d;
              best = id;
            }
          }
          if (best) {
            // And their next touches too, if the same player had them.
            const original = lying.playerId;
            for (let j = k; j < ctx.frames.length && ctx.frames[j].playerId === original; j++) subs[j] = best;
          }
        }
      }
    } else if (reached >= 0) {
      // Holding: at the player's feet it goes with them. Otherwise it lies
      // still until they get to it (they run onto it). Out of play or in the net, it stays.
      const carrier = holderOf(reached);
      // Fouled, or the ball has gone out for a corner: it stays where it is for the set piece.
      const stopped = fr(reached + 1)?.kind === "setpiece";
      if (carrier && !stopped && distance(carrier, ball) < 2.2) ball = {x: carrier.x, y: carrier.y};
    }

    const sides = {home: onPitchAt(ctx.report, "home", t), away: onPitchAt(ctx.report, "away", t)};
    // Who has the ball and who it's on its way to, from where the ball really is.
    const heading = fr(reached + 1);
    const travelling = !!heading && flying;
    const held = reached >= 0 ? fr(reached) : undefined;
    const carrierId = !travelling && held?.playerId && held.kind !== "goal" ? held.playerId : undefined;
    const receiver = travelling && heading.playerId && heading.minute - t < 1 ? heading : undefined;
    const receiverId = receiver?.playerId;
    // Players who get the ball in the next few touches start heading there now.
    const upcoming = new Map<string, Frame>();
    for (let k = reached + 2; k <= reached + 8 && k < ctx.frames.length; k++) {
      const f = fr(k);
      const shot = isShotSetup(ctx.frames, k);
      if (f.minute - t > (shot ? 2.5 : 1.5)) continue;
      if (!shot && k > reached + 5) continue;
      if (f.playerId && (f.kind === "pass" || f.kind === "dribble") && !upcoming.has(f.playerId)) upcoming.set(f.playerId, f);
    }
    // The ball is behind: whoever it is waiting for gets there quicker.
    const late = reached < i;
    // Whoever just played it on, while it is on its way to a teammate.
    const justPassed = travelling && held?.playerId && heading.possession === held.possession && heading.playerId !== held.playerId ? held.playerId : undefined;
    // A keeper with the ball in their hands (or walking it out) isn't closed down.
    const onBall = carrierId ?? (travelling && heading.kind === "dribble" && heading.playerId === held?.playerId ? heading.playerId : undefined);
    const keeperHolds = !!onBall && (["home", "away"] as const).some((s) => [...sides[s]].some(([slot, id]) => id === onBall && cs[s][slot].pos === "GK"));

    for (const side of ["home", "away"] as const) {
      const other: Side = side === "home" ? "away" : "home";
      const onPitch = sides[side];
      const slotsOf = cs[side];
      const outfield = [...onPitch].filter(([slot]) => slotsOf[slot].pos !== "GK").map(([, id]) => id);
      const opponents = [...sides[other]].filter(([slot]) => cs[other][slot].pos !== "GK").map(([, id]) => id);
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
      for (let k = reached + 1; k < ctx.frames.length && fr(k).minute - t < 1.6; k++) {
        // Whose cross it is: the side crossing it, even if a defender gets to it first.
        if (isCross(ctx.frames, k) && (fr(k - 1)?.possession ?? fr(k).possession) === possession) crossComing = true;
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
          target = receiver.kind === "tackle" ? {x: ball.x, y: ball.y} : {x: receiver.x, y: receiver.y};
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
          // A loose ball (in flight, or lying there waiting for who gets it next):
          // close it down but stop a step short, so nobody stands on a free ball and leaves it.
          const holder = carrierId ? bodies[carrierId] : undefined;
          if (travelling && heading.possession !== side) {
            // In the air to one of theirs: get goal side of where it comes down and challenge for it.
            // (Next to the one it's meant for, never ahead of them onto the ball.)
            const land = (heading.playerId && bodies[heading.playerId]) || heading;
            const gl = distance(land, ownGoal) || 1;
            target = {x: land.x + ((ownGoal.x - land.x) / gl) * 2.5, y: land.y + ((ownGoal.y - land.y) / gl) * 2.5};
            sprint = true;
          } else {
            const loose = !holder || distance(holder, ball) > 3;
            const gap = distance(body, ball);
            if (loose) {
              target = gap > 0.01 ? {x: ball.x + ((body.x - ball.x) / gap) * 4, y: ball.y + ((body.y - ball.y) / gap) * 4} : ball;
              sprint = gap > 8;
            } else {
              // On the ball: close them down to a couple of steps, goal side, and wait for the moment
              // (the tackle, when it comes, is his own touch); never stand on top of them.
              const gl = distance(ball, ownGoal) || 1;
              target = {x: ball.x + ((ownGoal.x - ball.x) / gl) * 2.6, y: ball.y + ((ownGoal.y - ball.y) / gl) * 2.6};
              sprint = gap > 6;
            }
            hurry = true;
          }
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
    const owner = runner && fr(reached + 1)?.kind !== "setpiece" ? bodies[runner] : undefined;
    if (owner && distance(owner, ball) < 2.5) {
      const pace = Math.hypot(owner.vx, owner.vy);
      if (pace > 3) ball = {x: owner.x + (owner.vx / pace) * BALL_LEAD, y: owner.y + (owner.vy / pace) * BALL_LEAD};
    }
  }
  // Drop players who went off.
  const onNow = new Set([...onPitchAt(ctx.report, "home", t1).values(), ...onPitchAt(ctx.report, "away", t1).values()]);
  for (const id of Object.keys(bodies)) if (!onNow.has(id)) delete bodies[id];
  return {time: t1, ball, bodies, reached, flying, subs};
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

/** The levels each stand of a stadium is built to (none: an unbuilt ground). */
type StandLevels = {north: number; south: number; west: number; east: number};
const NO_STANDS: StandLevels = {north: 0, south: 0, west: 0, east: 0};
/** Room between rows (long sides) and columns (ends) of fans, in pitch units. */
const ROW_GAP = 1.6;
const COL_GAP = 1.8;

/**
 * Where a stadium's stands are: rows of fans on the long sides (north on top, south below),
 * columns at the ends (west, east), one more per level built, each further out; and the box
 * round it all.
 */
function standLayout(levels: StandLevels) {
  const out = (count: number, front: number, step: number) => Array.from({length: count}, (_, i) => front + step * i);
  const north = out(2 + levels.north, -2.4, -ROW_GAP);
  const south = out(2 + levels.south, 70.4, ROW_GAP);
  const west = out(3 + levels.west, -6, -COL_GAP);
  const east = out(3 + levels.east, 111, COL_GAP);
  // Fully built: the oval outer wall goes round it all, so the box takes it in too.
  const full = levels.north >= STAND_MAX && levels.south >= STAND_MAX && levels.west >= STAND_MAX && levels.east >= STAND_MAX;
  const wall = full ? 3.2 : 0;
  const box = {
    left: west[west.length - 1] - 1.4 - wall,
    right: east[east.length - 1] + 1.4 + wall,
    top: north[north.length - 1] - 1.4 - wall,
    bottom: south[south.length - 1] + 1.4 + wall,
  };
  return {north, south, west, east, box, full, wall};
}

/** The zoomed-out view for a stadium: all of it, at least the usual view, in the usual shape. */
function stadiumView(levels: StandLevels): {x: number; y: number; w: number; h: number} {
  const {box} = standLayout(levels);
  const left = Math.min(VIEW_STADIUM.x, box.left);
  const top = Math.min(VIEW_STADIUM.y, box.top);
  const right = Math.max(VIEW_STADIUM.x + VIEW_STADIUM.w, box.right);
  const bottom = Math.max(VIEW_STADIUM.y + VIEW_STADIUM.h, box.bottom);
  let w = right - left;
  let h = bottom - top;
  const shape = VIEW_STADIUM.w / VIEW_STADIUM.h;
  // Keep the shape: widen the narrow way, centred.
  if (w / h > shape) h = w / shape;
  else w = h * shape;
  return {x: (left + right) / 2 - w / 2, y: (top + bottom) / 2 - h / 2, w, h};
}
const VIEW_PITCH = {x: -3.5, y: 0, w: 112, h: 68};
const ZOOM_KEY = "manager2d.zoomedIn";

/** Eases the SVG view box between the stadium and pitch views. */
function useZoom(zoomedIn: boolean, stadium = VIEW_STADIUM): string {
  const target = zoomedIn ? VIEW_PITCH : stadium;
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
function Shootout({report, seed, userSide, textOnly, onDone}: {report: MatchReport; seed: number; userSide: Side; textOnly?: boolean; onDone: (score: [number, number]) => void}) {
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

  // Commentary only: every kick is taken by the game, one line at a time.
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => {
    if (!textOnly || over || !taker) return;
    const id = setTimeout(() => {
      const res = resolveSetPiece(new Rng(seed + 7919 * (k + 1)), sp, null, taker, keeper);
      const params = {player: shortName(taker), team: (side === "home" ? home : away).short, keeper: keeper ? shortName(keeper) : ""};
      setLines((l) => [t(res.result === "goal" ? "so.kickGoal" : res.result === "saved" ? "so.kickSaved" : "so.kickMissed", params), ...l]);
      setKicks((list) => [...list, res.result === "goal"]);
    }, 1600);
    return () => clearTimeout(id);
  }, [textOnly, over, k]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <strong><Icon name="ball" size={18} /> {iconize(t("so.title"))}</strong>
        <span className="shootout-score">{home.short} {score[0]} – {score[1]} {away.short}</span>
      </div>
      {dots("home")}
      {dots("away")}
      {over ? (
        <p className="shootout-result">{iconize(t((score[0] > score[1]) === (userSide === "home") ? "so.won" : "so.lost", {h: score[0], a: score[1]}))}</p>
      ) : textOnly ? null : taker ? (
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
      {textOnly && lines.length > 0 && (
        <ul className="feed">
          {lines.map((l, i) => <li key={lines.length - i} className="ev">{iconize(l)}</li>)}
        </ul>
      )}
    </div>
  );
}

/** Pause, play and fast-forward, drawn alike (emoji differ between systems). */
export function ControlIcon({kind}: {kind: "pause" | "play" | "forward" | "end" | "maximize" | "minimize" | "plus" | "minus" | "sound" | "mute"}) {
  return (
    <svg className="ctl-icon" viewBox="0 0 16 16" aria-hidden>
      {kind === "pause" && <path d="M4 3h3v10H4zM9 3h3v10H9z" />}
      {kind === "play" && <path d="M4 2.5l9 5.5-9 5.5z" />}
      {kind === "forward" && <path d="M1.5 3l6.5 5-6.5 5zM8 3l6.5 5L8 13z" />}
      {kind === "end" && <path d="M1.5 3l5.5 5-5.5 5zM7 3l5.5 5L7 13zM12.5 3h2v10h-2z" />}
      {kind === "maximize" && <path d="M2 2h5v2H4v3H2zM9 2h5v5h-2V4H9zM2 9h2v3h3v2H2zM12 9h2v5H9v-2h3z" />}
      {(kind === "sound" || kind === "mute") && <path d="M2 6h3l4-3.5v11L5 10H2z" />}
      {kind === "sound" && <path d="M11 5.2a4 4 0 0 1 0 5.6l-1-1a2.6 2.6 0 0 0 0-3.6zM12.8 3.4a6.5 6.5 0 0 1 0 9.2l-1-1a5.1 5.1 0 0 0 0-7.2z" />}
      {kind === "mute" && <path d="M10.3 6.1l1-1 1.6 1.6 1.6-1.6 1 1-1.6 1.6 1.6 1.6-1 1-1.6-1.6-1.6 1.6-1-1 1.6-1.6z" />}
      {kind === "plus" && <path d="M7 2h2v5h5v2H9v5H7V9H2V7h5z" />}
      {kind === "minus" && <path d="M2 7h12v2H2z" />}
      {kind === "minimize" && <path d="M5 2h2v5H2V5h3zM9 2h2v3h3v2H9zM2 9h5v5H5v-3H2zM9 9h5v2h-3v3H9z" />}
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

/** A supporter's flag on a pole, flying away from the pitch (`out`: -1 left, 1 right), striped in the club's colours. */
function FanFlag({x, y, club, out, delay}: {x: number; y: number; club: Club; out: number; delay: number}) {
  const top = y - 3;
  const fly = x + out * 2.4;
  return (
    <g>
      <line x1={x} y1={y - 0.4} x2={x} y2={top} stroke="#e5e7eb" strokeWidth={0.18} />
      <g className={out < 0 ? "fan-flag wave-l" : "fan-flag wave-r"} style={{animationDelay: `${delay * 3}s`}}>
        <rect x={Math.min(x, fly)} y={top} width={2.4} height={0.8} fill={club.color} />
        <rect x={Math.min(x, fly)} y={top + 0.8} width={2.4} height={0.8} fill={club.color2} />
      </g>
    </g>
  );
}

/** A banner in the stands: where, and turned which way (±90 in an end). */
interface BannerSpot {
  x: number;
  y: number;
  rotate: number;
}

/** Where a club's fans hold up their banner: somewhere along the end behind their goal, from the club's id (the same every match). */
function bannerSpots(id: string, side: Side, x: number, count = 1): BannerSpot[] {
  const rng = new Rng(hashString(id + ":banners"));
  const home = side === "home";
  // Spread along the end, each in its own stretch of it, somewhere in that stretch.
  const span = 48 / count;
  return Array.from({length: count}, (_, i) => ({x, y: 10 + i * span + rng.range(span * 0.2, span * 0.8), rotate: home ? -90 : 90}));
}

/** The ground's corners, just outside the pitch, and the turn that faces a stall's front to the pitch
 * (straight: the top ones face down, the bottom ones up).
 * As on the Arena page: the kiosks top left, top right, bottom right (in that order), the shop bottom left. */
/** The corners at the back of the stands (they move out as the ground grows), and the turn that
 * faces a stall's front to the pitch: top left, top right, bottom right for the kiosks (in that
 * order), bottom left for the shop. */
function corners(layout: ReturnType<typeof standLayout>): {kiosks: [number, number, number][]; shop: [number, number, number]} {
  // A little in from the very back, so they cover only the last rows and stay in sight; inside
  // the oval wall's rounded corners when the ground is fully built.
  const inX = 2.6 + (layout.full ? 4.5 : 0);
  const inY = 3 + (layout.full ? 3.2 : 0);
  const left = layout.west[layout.west.length - 1] + inX;
  const right = layout.east[layout.east.length - 1] - inX;
  const top = layout.north[layout.north.length - 1] + inY;
  const bottom = layout.south[layout.south.length - 1] - inY;
  // The shop keeps to its corner, cut by the oval wall when there is one (see the clip).
  const shopLeft = layout.west[layout.west.length - 1] + 2.6 + (layout.full ? 2.4 : 0);
  const shopBottom = layout.south[layout.south.length - 1] - 3 - (layout.full ? 1.6 : 0);
  return {kiosks: [[left, top, 0], [right, top, 0], [right, bottom, 180]], shop: [shopLeft, shopBottom, 180]};
}
/** The shop grows with each level. */
const SHOP_SCALE = [0, 1.7, 2.2, 2.7];

/** A scarf held up over a supporter's head with both hands: stripes in the club's colours, fringed ends. */
function FanScarf({x, y, club}: {x: number; y: number; club: Club}) {
  const top = y - 1.35;
  return (
    <g>
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={x - 1.25 + i * 0.5} y={top} width={0.5} height={0.38} fill={i % 2 ? club.color2 : club.color} />
      ))}
      <path d={`M${x - 1.25} ${top + 0.38} v0.25 M${x + 1.25} ${top + 0.38} v0.25`} stroke={club.color2} strokeWidth={0.12} />
    </g>
  );
}

/** A white line icon centred on (cx, cy), turned back upright inside a building turned by `turn`. */
function UprightIcon({name, cx, cy, size, turn}: {name: IconName; cx: number; cy: number; size: number; turn: number}) {
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${-turn}) translate(${-size / 2} ${-size / 2})`} style={{color: "#fff"}}>
      <Icon name={name} size={size} />
    </g>
  );
}

/** A kiosk in a corner of the ground: a counter under a striped awning in the club's colours. */
function Kiosk({x, y, club, turn = 0}: {x: number; y: number; club: Club; turn?: number}) {
  return (
    <g className="kiosk" aria-hidden>
      <rect x={x} y={y + 0.9} width={3.4} height={1.6} rx={0.2} fill="#e2e8f0" stroke="#0f172a" strokeWidth={0.12} />
      <rect x={x + 0.5} y={y + 1.25} width={2.4} height={0.9} rx={0.15} fill="#0f172a" opacity={0.8} />
      <UprightIcon name="coffee" cx={x + 1.7} cy={y + 1.7} size={0.85} turn={turn} />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M${x - 0.2 + i * 0.95} ${y + 0.9} l0.475 -0.9 l0.475 0.9 Z`} fill={i % 2 ? club.color2 : club.color} stroke="#0f172a" strokeWidth={0.08} />
      ))}
    </g>
  );
}

/** The supporters' shop: a little building in the club's colour with a shirt on its sign, bigger windows the higher the level. */
function SupporterShop({x, y, club, level, turn = 0}: {x: number; y: number; club: Club; level: number; turn?: number}) {
  return (
    <g className="supporter-shop" aria-hidden>
      <rect x={x} y={y + 0.8} width={5} height={2.6} rx={0.25} fill={club.color} stroke="#0f172a" strokeWidth={0.14} />
      <rect x={x - 0.2} y={y + 0.5} width={5.4} height={0.6} rx={0.2} fill={club.color2} stroke="#0f172a" strokeWidth={0.1} />
      {/* Lit windows either side, more the bigger the shop. */}
      {[x + 0.35, x + 3.95, x + 0.35].slice(0, Math.min(level, 2)).map((wx, i) => (
        <rect key={i} x={wx} y={y + 1.45} width={0.7} height={1.1} rx={0.1} fill="#fde68a" opacity={0.9} />
      ))}
      <circle cx={x + 2.5} cy={y + 2.05} r={0.95} fill="rgb(0 0 0 / 0.35)" />
      <UprightIcon name="shirt" cx={x + 2.5} cy={y + 2.05} size={1.3} turn={turn} />
    </g>
  );
}

/** A small banner with the club's initials, read along it. */
function Banner({club, spot}: {club: Club; spot: BannerSpot}) {
  const {x, y, rotate} = spot;
  return (
    // Turned on an outer group: the sway animation sets its own transform on the inner one.
    <g transform={`rotate(${rotate} ${x} ${y})`}>
      <g className="end-banner">
      <rect x={x - 4.2} y={y - 1.3} width={8.4} height={2.6} rx={0.4} fill={club.color} stroke={club.color2} strokeWidth={0.28} />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={club.color2} fontSize={1.8} fontWeight={900} letterSpacing={0.3}>
        {club.short}
      </text>
      </g>
    </g>
  );
}

/** `fill`: share of seats taken (the crowd that came); the rest show as empty seats. */

/**
 * The stands round the pitch. The home club's stadium shows: each level a stand is built up
 * adds a row of fans to it (the ground holds more), and its club shop adds flags, banners and
 * confetti to the home crowd.
 */
const Stands = memo(function Stands({home, away, cheering, boards, fill = 1}: {home: Club; away: Club; cheering: Side | null; boards: string; fill?: number}) {
  const levels = home.stadium?.stands ?? {north: 0, south: 0, west: 0, east: 0};
  const shop = home.stadium?.shop ?? 0;
  const kiosks = home.stadium?.kiosks ?? 0;
  const layout = standLayout(levels);
  const {west, east} = layout;
  const fans = useMemo(() => {
    const spots: {x: number; y: number; side: Side}[] = [];
    // Pitch units as drawn (105 x 68). The long sides (north on top, south below) from two
    // rows, the ends (west, east) from three columns, one more per level built.
    const long = [...layout.north, ...layout.south];
    long.forEach((y, row) => {
      // Right out to the ends' back columns, so the corners fill as well.
      const from = Math.min(-10, west[west.length - 1]);
      const to = Math.max(115, east[east.length - 1]);
      for (let x = from; x <= to; x += 1.75) spots.push({x: x + (row % 2 ? 0.8 : 0), y, side: x < 52.5 ? "home" : "away"});
    });
    [...west, ...east].forEach((x, col) => {
      for (let y = -1.2; y <= 69.2; y += 1.75) spots.push({x, y: y + (col % 2 ? 0.8 : 0), side: x < 52.5 ? "home" : "away"});
    });
    // Who sits where: the best seats (halfway down the long sides) go first, with
    // some chance in it, so a half-full ground has gaps all round, more at the ends.
    const order = spots
      .map((s, i) => {
        const fromMiddle = Math.hypot((s.x - 52.5) / 63, s.y < 0 || s.y > 68 ? 0 : 0.6);
        return {i, score: fromMiddle * 0.55 + ((((i * 2654435761) >>> 0) % 1000) / 1000) * 0.45};
      })
      .sort((a, b) => a.score - b.score);
    const taken = new Set(order.slice(0, Math.round(spots.length * Math.max(0, Math.min(1, fill)))).map((o) => o.i));
    return spots.map((s, i) => {
      const club = s.side === "home" ? home : away;
      const h = (i * 37) % 11;
      const shirt = h < 5 ? club.color : h < 8 ? club.color2 : ["#e5e7eb", "#64748b", "#1f2937"][h % 3];
      const skin = ["#f6d5bd", "#ebbd9c", "#d49c74", "#8a5638"][(i * 7) % 4];
      // Behind the goals, every so often a supporter with a flag (striped in the club's colours);
      // the home club's shop sells more of them.
      const end = s.x < -4 || s.x > 109;
      const every = s.side === "home" ? [7, 5, 4, 3][shop] : 7;
      // A full-size shop (level 3): the home fans wave them along the long sides too.
      const flagHere = end || (s.side === "home" && shop >= 3);
      const flag = flagHere && taken.has(i) && ((i * 2654435761) >>> 0) % (end ? every : every + 3) === 0;
      // Confetti and streamers over the home crowd, more the bigger the shop.
      const confetti = s.side === "home" && shop > 0 && taken.has(i) && ((i * 40503) >>> 0) % [0, 9, 6, 4][shop] === 0;
      // Scarves held up over their heads, striped in the club's colours (more with a bigger shop at home).
      const scarf = !flag && taken.has(i) && ((i * 2246822519) >>> 0) % (s.side === "home" ? [9, 7, 6, 5][shop] : 9) === 0;
      return {...s, shirt, skin, delay: (h % 5) * 0.08, empty: !taken.has(i), flag, confetti, scarf, bit: [club.color, club.color2, "#ffffff", "#facc15"][(i * 13) % 4]};
    });
  }, [home, away, fill, levels.north, levels.south, levels.west, levels.east, shop]);
  const crowds = useMemo(() => {
    const draw = (side: Side) =>
      fans.filter((f) => f.side === side).map((f, i) =>
        f.empty ? (
          <rect key={i} x={f.x - 0.5} y={f.y - 0.5} width={1} height={1} rx={0.25} className="seat" />
        ) : (
          <g key={i} className="fan" style={{animationDelay: `${f.delay}s`}}>
            <rect x={f.x - 0.55} y={f.y - 0.2} width={1.1} height={1} rx={0.35} fill={f.shirt} />
            <circle cx={f.x} cy={f.y - 0.45} r={0.42} fill={f.skin} />
            {f.flag && <FanFlag x={f.x} y={f.y} club={side === "home" ? home : away} out={f.x < 52.5 ? -1 : 1} delay={f.delay} />}
            {f.scarf && <FanScarf x={f.x} y={f.y} club={side === "home" ? home : away} />}
            {f.confetti && <rect className="confetti" x={f.x + 0.3} y={f.y - 1.6} width={0.55} height={0.3} rx={0.1} fill={f.bit} transform={`rotate(${(i * 47) % 180} ${f.x + 0.5} ${f.y - 1.5})`} style={{animationDelay: `${f.delay * 4}s`}} />}
          </g>
        )
      );
    return {home: draw("home"), away: draw("away")};
  }, [fans, home, away]);
  return (
    <g className="stands" aria-hidden>
      {/* The stand behind the fans, as big as the ground has been built (and never less than before). */}
      {layout.full ? (
        <>
          {/* The oval outer wall of a fully built ground, a band in the club's colour along it, and the stands inside with rounded corners. */}
          <rect x={layout.box.left} y={layout.box.top} width={layout.box.right - layout.box.left} height={layout.box.bottom - layout.box.top} rx={16} className="stadium-wall" />
          <rect x={layout.box.left + 1} y={layout.box.top + 1} width={layout.box.right - layout.box.left - 2} height={layout.box.bottom - layout.box.top - 2} rx={15} fill="none" stroke={home.color} strokeWidth={0.7} opacity={0.85} />
          <rect x={layout.box.left + layout.wall} y={layout.box.top + layout.wall} width={layout.box.right - layout.box.left - 2 * layout.wall} height={layout.box.bottom - layout.box.top - 2 * layout.wall} rx={11} className="stand-bg" />
        </>
      ) : (
        <rect x={Math.min(-14, layout.box.left)} y={Math.min(-7, layout.box.top)} width={Math.max(118, layout.box.right) - Math.min(-14, layout.box.left)} height={Math.max(75, layout.box.bottom) - Math.min(-7, layout.box.top)} className="stand-bg" />
      )}
      {/* Fully built, the crowd stays inside the oval wall (the rounded corners cut it). */}
      {layout.full && (
        <clipPath id="stand-clip">
          <rect x={layout.box.left + layout.wall} y={layout.box.top + layout.wall} width={layout.box.right - layout.box.left - 2 * layout.wall} height={layout.box.bottom - layout.box.top - 2 * layout.wall} rx={11} />
        </clipPath>
      )}
      <g clipPath={layout.full ? "url(#stand-clip)" : undefined}>
        <g className={cheering === "home" ? "fans cheer" : "fans"}>{crowds.home}</g>
        <g className={cheering === "away" ? "fans cheer" : "fans"}>{crowds.away}</g>
      </g>
      {/* Each end's banner with the club's initials, over the fans behind the goal (once there are fans to hold it). */}
      {fill > 0.25 && bannerSpots(home.id, "home", (west[0] + west[west.length - 1]) / 2, 1 + shop).map((spot, i) => <Banner key={"h" + i} club={home} spot={spot} />)}
      {/* A full-size shop: banners along the home half of both long sides as well. */}
      {fill > 0.25 && shop >= 3 && [layout.north, layout.south].flatMap((rows, side) =>
        [16, 38].map((x) => <Banner key={`l${side}${x}`} club={home} spot={{x, y: (rows[0] + rows[rows.length - 1]) / 2, rotate: 0}} />)
      )}
      {fill > 0.25 && bannerSpots(away.id, "away", (east[0] + east[east.length - 1]) / 2).map((spot, i) => <Banner key={"a" + i} club={away} spot={spot} />)}
      {/* The kiosks (a stall a level) and the supporters' shop, set slanting in the corners with the
          counter facing the pitch: the rest of the building can be out of sight. */}
      {corners(layout).kiosks.slice(0, kiosks).map(([x, y, turn], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${turn}) scale(2.1) translate(-1.7 -2.6)`}><Kiosk x={0} y={0} club={home} turn={turn} /></g>
      ))}
      {shop > 0 && (
        <g clipPath={layout.full ? "url(#stand-clip)" : undefined}><g transform={`translate(${corners(layout).shop[0]} ${corners(layout).shop[1]}) rotate(${corners(layout).shop[2]}) scale(${SHOP_SCALE[shop]}) translate(-2.5 -3.4)`}><SupporterShop x={0} y={0} club={home} level={shop} turn={corners(layout).shop[2]} /></g></g>
      )}
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
    // Auto unless the manager chose otherwise.
    m.manualSetPieces = false;
    m.manualSubs = false;
    try {
      const sp = localStorage.getItem(SET_PIECES_KEY);
      if (sp) m.manualSetPieces = sp === "self";
      const subs = localStorage.getItem(SUBS_KEY);
      if (subs) m.manualSubs = subs === "self";
    } catch {
      // Defaults only.
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
  const icons: Record<TeamTalk, IconName> = {praise: "star", calm: "target", demand: "fire", disappointed: "warn"};
  return (
    <MatchDialog title={<><Icon name="debrief" size={20} /> {iconize(t("tt.title"))}</>} onClose={() => onDone()}>
      {/* The verdict, and what each talk does behind the (i) (no text on the choices). */}
      <div className="tt-verdict-row">
        <p className="tt-verdict">{iconize(tx(`tt.verdict.${verdict.result}.${verdict.how}`))}</p>
        <Hint>
          <dl className="tt-help">
            {TEAM_TALKS.map((k) => (
              <div key={k}>
                <dt><Icon name={icons[k]} size={16} /> {iconize(tx(`tt.talk.${k}`))}</dt>
                <dd>{iconize(tx(`tt.talk.${k}.desc`))}</dd>
              </div>
            ))}
          </dl>
          {/* The help beside the choices, by difficulty (and which one this game is on). */}
          <div className="tt-help-marks">
            <p className="tt-help-now">{iconize(t("tt.help.marksNow", {level: t(`new.difficulty.${difficulty(game)}`)}))}</p>
            <ul className="tt-help-list">
              {(["easy", "medium", "hard"] as const).map((d) => (
                <li key={d} className={d === difficulty(game) ? "now" : undefined}>
                  <strong>{t(`new.difficulty.${d}`)}:</strong> {iconize(t(`tt.help.marks.${d}`))}
                </li>
              ))}
            </ul>
          </div>
          {/* How the words work on the players (as morale.ts counts it). */}
          <details className="tt-help-more">
            <summary><h4 className="tt-help-title">{iconize(t("tt.help.title"))}</h4></summary>
          <ul className="tt-help-list">
            {(["morale", "happiness", "relation", "right", "wrong", "tough", "repeat", "bench", "single"] as const).map((k) => (
              <li key={k}>{iconize(t(`tt.help.${k}`))}</li>
            ))}
          </ul>
          </details>
        </Hint>
      </div>
      {/* What can be said (the guide points here only, not at the (i) above). */}
      <div className="tt-body">
      <div className="tt-options">
        {TEAM_TALKS.map((k) => (
          <button key={k} className={`tt-option ${talk === k ? "active" : ""}`} onClick={() => setTalk(k)}>
            <Icon name={icons[k]} size={24} />
            <strong>{iconize(tx(`tt.talk.${k}`))}</strong>
            <TalkEffect talk={k} verdict={verdict} />
          </button>
        ))}
      </div>
      <details className="tt-fold" open={!!single}>
      <summary><h4>{iconize(t("tt.onePlayer"))}</h4></summary>
      <div className="tt-players">
        {played.map(([id, rating]) => {
          const p = game.players[id];
          const mine = single?.playerId === id;
          return (
            <div key={id} className={`tt-player ${mine ? "active" : ""}`}>
              <span className="tt-name">{shortName(p)} <span className={`rating-pill ${rating >= 7 ? "good" : rating < 6 ? "bad" : ""}`}>{rating.toFixed(1)}</span></span>
              {PLAYER_TALKS.map((pt) => (
                <button key={pt} className={`btn small ${mine && single?.talk === pt ? "primary" : ""}`} onClick={() => setSingle(mine && single?.talk === pt ? null : {playerId: id, talk: pt})} title={tx(`tt.player.${pt}`)}>
                  <Icon name={pt === "praise" ? "thumbUp" : "thumbDown"} size={16} />
                </button>
              ))}
            </div>
          );
        })}
      </div>
      </details>
      <div className="btn-row dialog-actions">
        <button className="btn" onClick={() => onDone()}>{iconize(t("tt.skip"))}</button>
        <button className="btn primary" disabled={!talk} onClick={() => talk && onDone({talk, ...(single ? {single} : {})})}>{iconize(t("tt.say"))} <Icon name="play" size={16} /></button>
      </div>
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
  /** "Forza!" gets its fanfare instead of the usual chatter. */
  cry?: boolean;
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

export function MatchScreen({report, live, onClose, onFinish}: ScreenProps) {
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
  // Zoomed in to start with (the pitch fills the frame), unless the manager chose to see the stands.
  const [zoomedIn, setZoomedIn] = useState(() => {
    try {
      return localStorage.getItem(ZOOM_KEY) !== "0";
    } catch {
      return true;
    }
  });
  // Zoomed out: the home ground, however big it has been built.
  const homeStands = game.clubs[report.homeId]?.stadium?.stands ?? NO_STANDS;
  const standsKey = `${homeStands.north}-${homeStands.south}-${homeStands.west}-${homeStands.east}`;
  const stadiumBox = useMemo(() => stadiumView(homeStands), [standsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const viewBox = useZoom(zoomedIn, stadiumBox);
  const [replay, setReplay] = useState<GoalReplay | null>(null);
  /** Asking whether to leave a live match before the end. */
  const [confirmClose, setConfirmClose] = useState(false);
  const [talking, setTalking] = useState(false);
  // Sound: on or off (shared with Settings), the crowd's murmur while the match is open,
  // the whistle at the start.
  const [muted, setMutedState] = useState(isMuted());
  useEffect(() => onMutedChange(setMutedState), []);
  useEffect(() => {
    const stop = crowdMurmur(report.crowd?.rate ?? 0.8);
    if (live) whistle("short");
    return stop;
    // Once per match screen.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The manager's menu under the avatar, and the pitch filling the screen.
  const [menuOpen, setMenuOpen] = useState(false);
  // Watch the pitch, or only follow the commentary (remembered). Commentary only: set pieces are the assistant's.
  const [textOnly, setTextOnlyState] = useState(() => {
    try {
      return localStorage.getItem(TEXT_ONLY_KEY) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (!live) return;
    if (textOnly) live.manualSetPieces = false;
    else {
      try {
        live.manualSetPieces = localStorage.getItem(SET_PIECES_KEY) === "self";
      } catch {
        // Keeps what it was.
      }
    }
  }, [live, textOnly]);
  const setTextOnly = (on: boolean) => {
    setTextOnlyState(on);
    try {
      localStorage.setItem(TEXT_ONLY_KEY, on ? "1" : "0");
    } catch {
      // Only for this match.
    }
  };
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const away = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [menuOpen]);
  const [maxed, setMaxed] = useState(false);
  const toggleMax = () => {
    const next = !maxed;
    setMaxed(next);
    // The whole page full screen where the browser allows it (dialogs stay visible); otherwise just the pitch.
    try {
      if (next && !document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => undefined);
      if (!next && document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
    } catch {
      // Not supported: the pitch still fills the window.
    }
  };
  useEffect(() => {
    // Leaving full screen with the browser's own key or gesture shrinks it back too.
    const onChange = () => !document.fullscreenElement && setMaxed(false);
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
    };
  }, []);
  // The crowd is announced as the teams kick off, for a few seconds.
  const [crowdShown, setCrowdShown] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setCrowdShown(false), 4500);
    return () => clearTimeout(id);
  }, []);
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
    // The ball can reach the net a little after its touch: run on until it's in.
    let to = goalTime + 0.05;
    if (recorded) to = Math.max(to, h[h.length - 1].time + 0.05);
    else {
      const idx = report.frames.findIndex((f) => (f.kind === "goal" || f.kind === "nogoal") && Math.abs(f.minute - goalTime) < 1e-6);
      let s = first;
      while (idx >= 0 && s.reached < idx && s.time < goalTime + 1.5) s = advance(s, s.time + 0.02, ctx, dynRef.current);
      to = Math.max(to, s.time + 0.2);
    }
    setReplay({from, to, started: performance.now(), scene: first, recorded});
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
          const next = Math.min(cap, prev.time + (dt / MS_PER_MINUTE) * (speed === 1 ? NORMAL_PLAY_RATE : speed));
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
  // Only the knockout needs a winner on the day; a group game can be drawn.
  const needsShootout = !!live && finished && !!tie && isKnockout(tie) && report.homeGoals === report.awayGoals && !shootoutScore;
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

  // The pitch on screen: the manager's shout bubble is drawn on the page's top layer, at its bottom
  // edge, so nothing (an open dialog, the buttons) ever covers it.
  const pitchRef = useRef<HTMLDivElement>(null);

  // The manager's shouts, one after another (several orders at once are each heard), with a
  // cartoon "blah-blah" for each. Orders given in the orders dialog wait until it's closed ("Done"),
  // then the manager calls them out in turn.
  const shoutQueue = useRef<Shout[]>([]);
  const shouting = useRef(false);
  const heldShouts = useRef<Shout[]>([]);
  const holding = useRef(false);
  const nextShout = () => {
    const s = shoutQueue.current.shift();
    if (!s) {
      shouting.current = false;
      setShouts([]);
      return;
    }
    shouting.current = true;
    setShouts([s]);
    if (s.cry) rallyFanfare();
    else chatter(s.text.length);
    setTimeout(nextShout, shoutQueue.current.length > 0 ? SHOUT_MS * 0.8 : SHOUT_MS);
  };
  const shout = (playerId: string, text: string, cry = false) => {
    const s: Shout = {id: performance.now() + Math.random(), playerId, text, cry};
    // While the orders are open, they wait (the last word for a player counts once).
    if (holding.current && !cry) {
      heldShouts.current = [...heldShouts.current.filter((h) => !(h.playerId === playerId && playerId !== "")), s];
      return;
    }
    shoutQueue.current.push(s);
    if (!shouting.current) nextShout();
  };
  // The orders closed: everything said in them is called out now, one after another.
  useEffect(() => {
    holding.current = !!selected;
    if (selected || heldShouts.current.length === 0) return;
    shoutQueue.current.push(...heldShouts.current);
    heldShouts.current = [];
    if (!shouting.current) nextShout();
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // The referee and the crowd at each stop: a roar for a goal (and a whistle if it's ruled out),
  // a whistle for a set piece, the long whistle at half-time and full time.
  useEffect(() => {
    if (!freeze) return;
    if (freeze.kind === "goal") crowd("goal");
    else if (freeze.kind === "nogoal") {
      crowd("goal");
      const id = setTimeout(() => whistle("short"), 1100);
      return () => clearTimeout(id);
    } else if (freeze.kind === "setup") whistle("short");
    else if (freeze.kind === "halftime" || freeze.kind === "fulltime") whistle("end");
    return undefined;
  }, [freeze?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // The ball leaving a boot: a thud for a shot, a tap for a pass (at normal speed only, or it's a rattle);
  // the crowd's "ooh" when the keeper saves or it flies just wide.
  const flewRef = useRef({reached: -1, flying: false});
  useEffect(() => {
    const was = flewRef.current;
    flewRef.current = {reached: scene.reached, flying: !!scene.flying};
    if (replay || freeze) return;
    const next = report.frames[scene.reached + 1];
    const now = report.frames[scene.reached];
    if (scene.flying && !was.flying && next) {
      const shot = ["goal", "nogoal", "save"].includes(next.kind ?? "") || (next.kind === "out" && progressFor(next.possession, next.x) >= 99.5);
      if (shot) kick("shot");
      else if (speed === 1 && playing && (next.kind === "pass" || next.kind === "dribble")) kick("pass");
    }
    if (scene.reached !== was.reached && now && now.kind === "save") crowd("ooh");
  }, [scene.reached, scene.flying]); // eslint-disable-line react-hooks/exhaustive-deps

  // The other side firing up in a big match: the crowd rallies too.
  const rivalForza = report.events.some((e) => e.note === "forzaRival" && e.minute <= time);
  useEffect(() => {
    if (rivalForza) crowd("rally");
  }, [rivalForza]);

  // "Forza!": a lift for the whole team for a while. Free the first time in a match, then energy each time.
  const forzas = live ? live.allCommands().filter((c) => c.type === "forza") : [];
  const forzaFree = forzas.length === 0;
  // Still going (in the engine's minutes): no second one on top.
  const forzaOn = !!live && forzas.some((c) => live.nextMinute < c.minute + FORZA.minutes);
  const forzaUsed = forzaOn;
  const forzaNote = forzaOn ? t("match.forzaOn") : forzaFree ? t("match.forzaHint") : t("match.forzaCost", {n: ENERGY_COST_FORZA});
  // Free the first time (🔥); after that it costs energy (⚡), shown flying off the button.
  const forzaIcon = <Icon name={forzaFree ? "fire" : "bolt"} size={18} />;
  const forza = (e?: {currentTarget: Element}) => {
    if (forzaOn) return;
    if (!forzaFree) {
      const paid = act((g) => spendEnergy(g.monetization, ENERGY_COST_FORZA, Date.now()));
      if (!paid) {
        notify("err.noEnergy", undefined, "error");
        return;
      }
      energySpent(e?.currentTarget, ENERGY_COST_FORZA);
    }
    give({type: "forza"});
    // Only the manager is heard: no roar from the crowd for our own call.
    shout("", t("shout.forza"), true);
    setMenuOpen(false);
  };

  const instructTeam = (key: InstructionKey, level: InstructionLevel) => {
    give({type: "instructTeam", key, level});
    shout("", tx(level === 0 ? "shout.reset" : `shout.${key}${level > 0 ? "+" : "-"}`, {player: t("shout.everyone")}));
  };

  const substitute = (outId: string, inId: string) => {
    give({type: "sub", outId, inId});
    shout(outId, t("shout.sub", {in: (game.players[inId] ? shortName(game.players[inId]) : undefined) ?? "", out: (game.players[outId] ? shortName(game.players[outId]) : undefined) ?? ""}));
    // From the subs dialog it stays open (more changes may follow); from an injury the play goes on.
    if (selected !== "subs") setSelected(null);
  };

  // The substitutions dialog: its X cancels what was changed in it, "Klar" keeps it.
  const subsStart = useRef(0);
  useEffect(() => {
    if (selected === "subs" && live) subsStart.current = live.allCommands().length;
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps
  const cancelSubs = () => {
    if (live) {
      const removed = live.cancelSince(subsStart.current).map((c) => JSON.stringify(c));
      if (removed.length > 0) {
        act((g) => {
          if (!g.liveMatch?.commands) return;
          g.liveMatch.commands = g.liveMatch.commands.filter((c) => {
            const i = removed.indexOf(JSON.stringify(c));
            if (i < 0) return true;
            removed.splice(i, 1);
            return false;
          });
        });
      }
    }
    heldShouts.current = [];
    setSelected(null);
    rerender((n) => n + 1);
  };
  const changeFormation = (formation: FormationId) => give({type: "formation", formation});
  const swapPlayers = (aId: string, bId: string) => give({type: "swap", aId, bId});
  const placePlayer = (playerId: string, x: number, y: number) => give({type: "place", playerId, x, y});

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
  // Who's being told right now: that player, or (a word to everyone) the whole team.
  const toEveryone = shouts.some((s) => s.playerId === "" && !s.cry);
  const shoutedAt = new Set(shouts.map((s) => s.playerId));
  // "Forza!": the side that got it glows for as long as the lift lasts (its minutes in the engine).
  const forzaEvent = events.find((e) => e.type === "instruction" && (e.note === "forza" || e.note === "forzaRival") && view.time >= e.minute - 1 && view.time < e.minute - 1 + FORZA.minutes);
  const forzaSide = forzaEvent?.side;

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
      const gear = game.players[id]?.gear;
      // Which way they face (degrees, as drawn): the way they run, or standing still the goal they attack.
      const speed = Math.hypot(b.vx, b.vy);
      // Stepping only while the match is actually running (paused, the feet stand still).
      const stepping = running && speed > 0.8;
      const facing = speed > 0.8 ? (Math.atan2(b.vy * 0.68, b.vx * 1.05) * 180) / Math.PI : side === "home" ? 0 : 180;
      return (
        <g key={id} className={`dot${mine && !finished ? " mine" : ""}${celebrating === side ? " celebrate" : ""}`} onClick={mine && !freeze && !finished ? () => setSelected(id) : undefined}>
          {trail > 0 && (
            <line x1={(b.x - b.vx * trail) * 1.05} y1={(b.y - b.vy * trail) * 0.68} x2={cx} y2={cy} className="trail" stroke={club.color} />
          )}
          <g transform={`translate(${cx} ${cy})`}>
            {mine && <circle r={4} className="hit" />}
            {(shoutedAt.has(id) || (mine && toEveryone)) && (
              <>
                <circle r={3.2} className="shout-ring" />
                <circle r={3.2} className="shout-wave" />
              </>
            )}
            {id === carrierId && <circle r={2.4} className="carrier-ring" />}
            {id === selected && <circle r={2.8} className="selected-ring" />}
            {/* Boots (or a keeper's gloves) in their tier's colour, under the player: the toes point
                the way they run and step in turn while running; standing, they face the other goal. */}
            {gear && (
              <g transform={`rotate(${facing.toFixed(0)})`} className={stepping ? "gear-feet running" : "gear-feet"} fill={GEAR_KIND_COLOR[gear.kind]} stroke={GEAR_COLOR[gear.tier]}>
                {gear.kind === "gloves" ? (
                  <>
                    <circle cx={0.75} cy={-1.45} r={0.48} className={gear.tier === "special" ? "gear-dot special" : "gear-dot"} />
                    <circle cx={0.75} cy={1.45} r={0.48} className={gear.tier === "special" ? "gear-dot special" : "gear-dot"} />
                  </>
                ) : (
                  <>
                    <g className="foot left"><ellipse cx={1.45} cy={-0.56} rx={0.8} ry={0.34} className={gear.tier === "special" ? "gear-dot special" : "gear-dot"} /></g>
                    <g className="foot right"><ellipse cx={1.45} cy={0.56} rx={0.8} ry={0.34} className={gear.tier === "special" ? "gear-dot special" : "gear-dot"} /></g>
                  </>
                )}
              </g>
            )}
            {air[id] && <ellipse cx={0.5 + air[id].lift} cy={0.6 + air[id].lift * 1.2} rx={1.6} ry={1} className="ball-shadow" />}
            {air[id]?.dive !== undefined ? (
              <ellipse rx={1.6 + air[id].lift * 1.6} ry={1.4} transform={`rotate(${air[id].dive!.toFixed(0)}) translate(${(air[id].lift * 1.2).toFixed(2)} 0)`} fill={club.color} stroke={club.color2} strokeWidth={0.4} className="body" />
            ) : (
              <circle r={1.6 * (1 + (air[id]?.lift ?? 0) * 0.4)} fill={club.color} stroke={club.color2} strokeWidth={0.4} className="body" />
            )}
            {/* "Forza!": a glowing ring over the player while it lasts. */}
            {forzaSide === side && <circle r={2.05} className="forza-glow" />}
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
  // (Not for whoever has the ball: only the player picked for orders.)
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
  // How high it is: up from where it was struck, highest halfway, down where it lands
  // (seen from above, a ball in the air looks bigger and its shadow falls further off).
  let height = 0;
  if (lofted) {
    const from = report.frames[view.reached];
    const to = report.frames[view.reached + 1];
    if (from && to) {
      const total = distance(from, to);
      const done = total > 0.1 ? Math.min(1, distance(from, view.ball) / total) : 1;
      height = 4 * done * (1 - done) * Math.min(1, total / 30);
    }
  }
  // A shot on its way from distance rises a little.
  const shotTo = view.flying ? report.frames[view.reached + 1] : undefined;
  const shotFrom = report.frames[view.reached];
  const shooting = !!shotTo && !!shotFrom && (["goal", "nogoal", "save"].includes(shotTo.kind ?? "") || (shotTo.kind === "out" && progressFor(shotTo.possession, shotTo.x) >= 99.5));
  // A tail of fire behind the ball, along where it has really been: a fired-up side's shot,
  // or one from a great finisher (over FIRE_FINISHING), whenever they shoot.
  const shooterId = shotFrom?.playerId ? view.subs?.[view.reached] ?? shotFrom.playerId : undefined;
  const greatFinisher = !!shooterId && (game.players[shooterId]?.attrs.finishing ?? 0) > FIRE_FINISHING;
  const fireShot = shooting && ((!!forzaSide && shotFrom?.possession === forzaSide) || greatFinisher);
  const fireRef = useRef<{k: number; pts: Point[]}>({k: -1, pts: []});
  if (fireShot) {
    const f = fireRef.current;
    if (f.k !== view.reached) fireRef.current = {k: view.reached, pts: []};
    const pts = fireRef.current.pts;
    const last = pts[pts.length - 1];
    if (!last || distance(last, view.ball) > 0.4) pts.push({x: view.ball.x, y: view.ball.y});
    if (pts.length > 8) pts.shift();
  } else if (fireRef.current.pts.length) fireRef.current = {k: -1, pts: []};
  if (shooting && shotFrom) {
    const total = distance(shotFrom, shotTo!);
    const gone = distance(shotFrom, view.ball);
    if (total > 20 && gone > 1) {
      const done = Math.min(1, gone / total);
      height = Math.max(height, 4 * done * (1 - done) * 0.35);
    }
  }

  // Up for a header as a high ball comes down, and the keeper diving for a save: just after the touch.
  const touchedRef = useRef({k: -1, at: 0});
  if (touchedRef.current.k !== view.reached) touchedRef.current = {k: view.reached, at: view.time};
  const sinceTouch = view.time - touchedRef.current.at;
  const lastTouch = report.frames[view.reached];
  const air: Record<string, {lift: number; dive?: number}> = {};
  if (lastTouch?.playerId && sinceTouch >= 0 && sinceTouch < 0.12) {
    const who = view.subs?.[view.reached] ?? lastTouch.playerId;
    const pop = Math.sin((sinceTouch / 0.12) * Math.PI);
    const prev = report.frames[view.reached - 1];
    const highBall = (lastTouch.flight === "cross" || lastTouch.flight === "long") && !!prev && distance(prev, lastTouch) > 15;
    if (highBall && view.bodies[who]) {
      air[who] = {lift: pop};
      // The nearest opponent goes up with them.
      let rival: string | undefined;
      let best = 5;
      const theirs = onPitchAt(report, lastTouch.possession === "home" ? "away" : "home", view.time);
      for (const id of theirs.values()) {
        const b = view.bodies[id];
        if (b && distance(b, view.bodies[who]) < best) {
          best = distance(b, view.bodies[who]);
          rival = id;
        }
      }
      if (rival) air[rival] = {lift: pop * 0.85};
    }
    if (lastTouch.kind === "tackle" && lastTouch.slide && view.bodies[who] && prev) {
      const b = view.bodies[who];
      air[who] = {lift: pop * 0.7, dive: (Math.atan2((prev.y - b.y) * 0.68, (prev.x - b.x) * 1.05) * 180) / Math.PI};
    }
    if (lastTouch.kind === "save" && view.bodies[who]) {
      const b = view.bodies[who];
      const prevBall = prev ?? view.ball;
      air[who] = {lift: pop * 0.6, dive: (Math.atan2((prevBall.y - b.y) * 0.68, (prevBall.x - b.x) * 1.05) * 180) / Math.PI};
    }
  }


  const scorer = freeze?.kind === "goal" ? game.players[freeze.scorerId ?? ""] : undefined;
  const scoringClub = freeze?.kind === "goal" ? (freeze.side === "home" ? home : away) : undefined;
  const board = boardAt(report, time);
  const atHalftime = freeze?.kind === "halftime";
  const injuryStop = freeze?.kind === "injury" && live?.stop?.type === "injury" ? live.stop : null;
  const clock = finished ? t("match.ft") : atHalftime ? t("match.ht") : clockLabel(report, time);
  // Closing a live match before the end asks first; yes plays the rest out
  // automatically and closes, just like Finish.
  const close = live && !finished ? () => setConfirmClose(true) : onClose;

  const shoutBubble = (() => {
    if (shouts.length === 0 || !userSide || typeof document === "undefined") return null;
    const r = pitchRef.current?.getBoundingClientRect();
    if (!r) return null;
    const bottom = window.innerHeight - r.bottom + (maxed ? 60 : 6);
    const at = userSide === "home" ? {right: window.innerWidth - (r.left + r.width * 0.48)} : {left: r.left + r.width * 0.52};
    return createPortal(
      <div className={`shout shout-top ${userSide}`} role="status" style={{bottom, ...at}}>
        <span className="shout-manager" aria-hidden><ManagerAvatar look={managerLook} size={40} tie={(userSide === "home" ? home : away).color} /></span>
        <span className="shout-bubble">📣 {shouts[shouts.length - 1].text}</span>
      </div>,
      document.body
    );
  })();

  // Pause, play at normal speed, fast-forward (each press a step faster, up to 5×) and to the end: one group.
  const playControls = (
    <span className="speed-group play-controls" role="group" aria-label={t("match.speed")}>
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
      <button className="chip" title={t("match.skip")} aria-label={t("match.skip")} onClick={() => jump(Infinity)}>
        <ControlIcon kind="end" /><span className="skip-label"> {iconize(t("match.skip"))}</span>
      </button>
    </span>
  );

  return (
    <Modal wide title={<>{live && <span className="live-badge">{iconize(t("match.live"))}</span>} {home.name} – {away.name}</>} onClose={close} backdropCloses={!live}>
      <div className="scoreboard">
        {live && <TeamOvr clubId={home.id} />}
        <ClubCrest clubId={home.id} />
        <span className="score">{score.home} – {score.away}</span>
        {shootoutScore && <small className="score-pens">{iconize(t("fx.penalties", {h: shootoutScore[0], a: shootoutScore[1]}))}</small>}
        <ClubCrest clubId={away.id} />
        {live && <TeamOvr clubId={away.id} />}
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
          textOnly={textOnly}
          onDone={(score) => {
            act((g) => {
              const f = findFixture(g, report.fixtureId);
              if (f && isCupFixture(f)) f.penalties = score;
            });
            setPens(score);
          }}
        />
      ) : current && live ? (
        // Maximised, the set piece fills the screen too.
        <div className={maxed ? "setpiece-max" : undefined}>
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
        </div>
      ) : (
        <div className={`pitch-wrap ${maxed ? "maxed" : ""} ${textOnly ? "text-only" : ""}`} ref={pitchRef}>
          <svg className="pitch" viewBox={viewBox} role="img" aria-label={t("match.pitch")}>
            <Stands home={home} away={away} cheering={(freeze?.kind === "goal" || (freeze?.kind === "fulltime" && decided)) && !replay ? freeze.side : null} boards={(userSide === "away" ? away : home).color} fill={report.crowd?.rate ?? 1} />
            {PITCH}
            <Dugouts home={home} away={away} />
            {(!freeze || replay) && cones}
            {dots("home")}
            {dots("away")}
            {/* A long ball or cross is in the air: bigger, with its shadow further off on the grass. */}
            <ellipse cx={view.ball.x * 1.05 + 0.25 + height * 1.6} cy={view.ball.y * 0.68 + 0.45 + height * 3} rx={0.95 - height * 0.3} ry={0.5 - height * 0.15} className="ball-shadow" />
            {fireShot && fireRef.current.pts.length > 1 && (
              <g className="fire-tail" aria-hidden>
                {fireRef.current.pts.slice(1).map((p, i, rest) => {
                  const a = fireRef.current.pts[i];
                  const k = (i + 1) / rest.length;
                  return <line key={i} x1={a.x * 1.05} y1={a.y * 0.68} x2={p.x * 1.05} y2={p.y * 0.68} strokeWidth={0.4 + k * 1.6} stroke={k > 0.6 ? "#fde047" : k > 0.3 ? "#fb923c" : "#ef4444"} opacity={0.25 + k * 0.7} />;
                })}
              </g>
            )}
            <g transform={`translate(${view.ball.x * 1.05} ${view.ball.y * 0.68})`} className={fireShot ? "ball-fire" : undefined}>
              <Football r={1.05 + height * 1.1} />
            </g>
            {/* The net bulges with the goal. */}
            {freeze?.kind === "goal" && !replay && (
              <g key={freeze.key} className={`net-hit ${view.ball.x > 50 ? "right" : "left"}`}>
                <rect x={view.ball.x > 50 ? 104 : -1.8} y={30.34} width={2.8} height={7.32} />
              </g>
            )}
          </svg>

          {freeze?.kind === "goal" && scoringClub && !replay && (
            <>
              <Confetti key={freeze.key} colors={[scoringClub.color, scoringClub.color2, "#fde047", "#ffffff"]} />
              <div className="goal-banner">
                <strong>{iconize(t("match.goal"))}</strong>
                {scorer && <span>{fullName(scorer)}</span>}
              </div>
              <button className="btn replay-btn" onClick={() => startReplay(freeze.time)}><Icon name="video" size={18} /> {iconize(t("match.replayGoal"))}</button>
            </>
          )}
          {replay && (
            <>
              <div className="replay-badge" aria-live="polite"><Icon name="video" size={18} /> {iconize(t("match.replayBadge"))}</div>
              <button className="btn small replay-skip" onClick={() => setReplay(null)}><Icon name="skip" size={18} /> {iconize(t("match.replayEnd"))}</button>
            </>
          )}
          {/* Fill the screen like a video, and back. */}
          <button className="btn small max-btn" onClick={toggleMax} aria-pressed={maxed} title={maxed ? t("match.minimize") : t("match.maximize")} aria-label={maxed ? t("match.minimize") : t("match.maximize")}>
            <ControlIcon kind={maxed ? "minimize" : "maximize"} />
          </button>
          {/* Maximised: the score and the clock on the pitch, see-through like the buttons. */}
          {maxed && (
            <div className="max-score" aria-live="polite">
              <span className="crest" style={{background: home.color, color: home.color2}}>{home.short}</span>
              <strong className="max-score-goals">{score.home} – {score.away}</strong>
              <span className="crest" style={{background: away.color, color: away.color2}}>{away.short}</span>
              {shootoutScore && <small>{iconize(t("fx.penalties", {h: shootoutScore[0], a: shootoutScore[1]}))}</small>}
              <span className="max-score-clock">{clock}{board > 0 && !atHalftime && !finished ? ` +${board}` : ""}</span>
            </div>
          )}
          {/* Maximised: the score and the clock on the pitch, see-through like the buttons. */}
          {maxed && (
            <div className="max-score" aria-live="polite">
              <span className="crest" style={{background: home.color, color: home.color2}}>{home.short}</span>
              <strong className="max-score-goals">{score.home} – {score.away}</strong>
              <span className="crest" style={{background: away.color, color: away.color2}}>{away.short}</span>
              {shootoutScore && <small>{iconize(t("fx.penalties", {h: shootoutScore[0], a: shootoutScore[1]}))}</small>}
              <span className="max-score-clock">{clock}{board > 0 && !atHalftime && !finished ? ` +${board}` : ""}</span>
            </div>
          )}
          {maxed && !finished && <div className="max-controls">{playControls}</div>}
          {maxed && live && !finished && (
            <div className="max-manager">
              <button className="btn small max-forza" onClick={forza} disabled={forzaUsed} title={forzaNote} aria-label={t("match.forza")}>
                {forzaIcon}<span className="max-forza-label"> {iconize(t("match.forza"))}</span>
              </button>
              <button className="btn small max-forza" onClick={() => setSelected("team")} disabled={!!freeze && !atHalftime} title={t("match.giveOrders")} aria-label={t("match.giveOrders")}>
                <Icon name="megaphone" size={18} />
              </button>
            </div>
          )}
          <button className="btn small zoom-btn" onClick={toggleZoom} aria-pressed={zoomedIn} title={zoomedIn ? t("match.zoomOut") : t("match.zoomIn")} aria-label={zoomedIn ? t("match.zoomOut") : t("match.zoomIn")}>
            <ControlIcon kind={zoomedIn ? "minus" : "plus"} />
          </button>
          {freeze?.kind === "nogoal" && !replay && <NoGoalBanner key={freeze.key} reason={report.events.find((e) => e.type === "disallowed" && e.side === freeze.side && e.minute === Math.ceil(freeze.time))?.note} />}
          {freeze?.kind === "restart" && freeze.restart && !replay && (
            <div className="setup-banner">
              {freeze.restart.kind === "goalkick" ? "🥅" : "🤾"} {iconize(t(freeze.restart.kind === "goalkick" ? "match.goalKick" : "match.throwIn", {team: (freeze.side === "home" ? home : away).short, player: name(freeze.restart.playerId)}))}
            </div>
          )}
          {freeze?.kind === "setup" && freeze.sp && (
            <div className="setup-banner">{iconize(tx(`ev.${freeze.sp.kind}`, {team: (freeze.side === "home" ? home : away).short, player: name(freeze.sp.takerId)}))}</div>
          )}
          {atHalftime && !live && <div className="setup-banner">{iconize(t("ev.halftime"))}</div>}
          {crowdShown && report.crowd && freeze?.kind !== "goal" && (
            <div className="crowd-banner" role="status">
              <strong>{iconize(t("match.crowd", {fans: report.crowd.fans, pct: Math.round(report.crowd.rate * 100)}))}</strong>
              {report.crowd.rate >= 0.995 && <span>{iconize(t("match.soldOut"))}</span>}
            </div>
          )}
          {freeze?.kind === "fulltime" && (
            <div className="setup-banner">
              🏁 {!decided ? t("match.ftDraw") : t("match.ftWin", {team: (freeze.side === "home" ? home : away).name})}
            </div>
          )}
        </div>
      )}

      {live && atHalftime && !selected && !replay && (
        <MatchDialog title={<><Icon name="coffee" size={20} /> {iconize(t("match.halftime"))}</>} onClose={startSecondHalf}>
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
          <p className="muted small">{iconize(t("match.htHint"))}</p>
          <div className="btn-row dialog-actions">
            <button className="btn" onClick={() => setSelected("subs")}><Icon name="swap" size={18} /> {iconize(t("match.subs"))}</button>
            <button className="btn" onClick={() => setSelected("team")}><Icon name="megaphone" size={18} /> {iconize(t("match.giveOrders"))}</button>
            <button className="btn primary" onClick={startSecondHalf}><Icon name="play" size={18} /> {iconize(t("match.secondHalf"))}</button>
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
        <MatchDialog title={<><Icon name="stop" size={20} /> {iconize(t("match.closeTitle"))}</>} onClose={() => setConfirmClose(false)}>
          <p>{iconize(t("match.closeText"))}</p>
          <div className="btn-row dialog-actions">
            <button className="btn" onClick={() => setConfirmClose(false)}>{iconize(t("match.closeNo"))}</button>
            <button className="btn primary" onClick={onClose}>{iconize(t("match.closeYes"))}</button>
          </div>
        </MatchDialog>
      )}

      {live && injuryStop && (
        <InjuryDialog live={live} playerId={injuryStop.playerId} pos={injuryStop.pos} onPick={replaceInjured} />
      )}

      {live && selected === "subs" && !finished && !current && !injuryStop && (
        <MatchDialog title={<><Icon name="swap" size={20} /> {iconize(t("match.subs"))}</>} onClose={cancelSubs}>
          <SubsPanel live={live} onSub={substitute} onFormation={changeFormation} onSwap={swapPlayers} onPlace={placePlayer} onClose={() => setSelected(null)} />
        </MatchDialog>
      )}
      {live && selected && selected !== "subs" && !finished && !current && !injuryStop && (
        <MatchDialog title={<><Icon name="megaphone" size={20} /> {iconize(t("orders.title"))}</>} onClose={() => setSelected(null)}>
          <OrdersPanel
            live={live}
            target={selected}
            booked={booked}
            onTarget={setSelected}
            onInstruct={instruct}
            onTeamInstruct={instructTeam}
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
                <button className="btn push-right" onClick={() => setWatchingAd(true)}><Icon name="video" size={18} /> {iconize(t("video.win", {n: WIN_VIDEO_DIAMONDS}))}</button>
              )}
              <button className={wonIt && game.daily?.winVideoFixture !== report.fixtureId ? "btn primary" : "btn primary push-right"} onClick={() => setTalking(true)}>{iconize(t("match.finish"))} ▶</button>
            </>
          )
        ) : (
          <>
            {finished && <button className="btn ctl" title={t("match.replay")} aria-label={t("match.replay")} onClick={() => jump(0)}>↺</button>}
            {live && !finished && (
              // The manager: instructions, and whether set pieces and substitutions are yours or the assistant's.
              <div className="manager-menu" ref={menuRef}>
                <button className={`btn ctl manager-btn ${menuOpen ? "open" : ""}`} data-tour="orders" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
                  <ManagerAvatar look={managerLook} size={26} tie={(userSide === "away" ? away : home).color} />
                  <span className="manager-btn-label">{iconize(t("match.manager"))}</span> <span aria-hidden>{menuOpen ? "▲" : "▼"}</span>
                </button>
                {menuOpen && (
                  <div className={textOnly ? "manager-pop down" : "manager-pop"} role="menu">
                    <span className="speed-group manager-view" role="group">
                      {([false, true] as const).map((only) => (
                        <button key={String(only)} className={textOnly === only ? "chip active" : "chip"} onClick={() => setTextOnly(only)}><Icon name={only ? "chat" : "video"} size={16} /> {only ? t("match.viewText") : t("match.viewPitch")}</button>
                      ))}
                    </span>
                    <button className="manager-item" role="menuitem" disabled={!!freeze && !atHalftime} onClick={() => { setMenuOpen(false); setSelected("subs"); }}>
                      <span><Icon name="swap" size={18} /> {iconize(t("match.subs"))}</span>
                      <Icon name="chevron" size={16} />
                    </button>
                    <button className="manager-item" role="menuitem" disabled={!!freeze && !atHalftime} onClick={() => { setMenuOpen(false); setSelected("team"); }}>
                      <span><Icon name="megaphone" size={18} /> {iconize(t("match.giveOrders"))}</span>
                      <Icon name="chevron" size={16} />
                    </button>
                    {/* Once a match: the manager fires up the whole team. */}
                    <button className="manager-item forza-btn" role="menuitem" disabled={forzaUsed} onClick={forza}>
                      <span>{forzaIcon} {iconize(t("match.forza"))}</span>
                      <span className="muted small">{iconize(forzaNote)}</span>
                    </button>
                    <div className="manager-item manager-toggle" data-tour="setpieces">
                      <span><Icon name="target" size={18} /> {iconize(t("match.setPieces"))}</span>
                      <span className="speed-group" role="group" aria-label={t("match.setPieces")}>
                        {([true, false] as const).map((self) => (
                          <button key={String(self)} disabled={textOnly} className={live.manualSetPieces === self ? "chip active" : "chip"} onClick={() => {
                            live.manualSetPieces = self;
                            try {
                              localStorage.setItem(SET_PIECES_KEY, self ? "self" : "auto");
                            } catch {
                              // Only remembered for this match.
                            }
                            rerender((n) => n + 1);
                          }}>{self ? t("match.self") : t("match.auto")}</button>
                        ))}
                      </span>
                    </div>
                    <div className="manager-item manager-toggle">
                      <span><Icon name="swap" size={18} /> {iconize(t("match.subsWho"))}</span>
                      <span className="speed-group" role="group" aria-label={t("match.subsWho")}>
                        {([true, false] as const).map((self) => (
                          <button key={String(self)} className={live.manualSubs === self ? "chip active" : "chip"} onClick={() => {
                            live.manualSubs = self;
                            try {
                              localStorage.setItem(SUBS_KEY, self ? "self" : "auto");
                            } catch {
                              // Only remembered for this match.
                            }
                            rerender((n) => n + 1);
                          }}>{self ? t("match.self") : t("match.auto")}</button>
                        ))}
                      </span>
                    </div>
                    <div className="manager-hint-row"><Hint>{iconize(t("match.managerHint"))}</Hint></div>
                  </div>
                )}
              </div>
            )}
            {!finished && (
              <span className="ctl-right push-right">
                <button className="sound-btn" onClick={() => setMuted(!muted)} aria-pressed={!muted} title={muted ? t("sound.on") : t("sound.off")} aria-label={muted ? t("sound.on") : t("sound.off")}>
                  <ControlIcon kind={muted ? "mute" : "sound"} />
                </button>
                {playControls}
              </span>
            )}
          </>
        )}
      </div>
      {/* What the buttons above do. */}
      {live && !finished && !selected && (
        <details className="control-help-fold">
          <summary className="muted small">{iconize(t("match.help"))}</summary>
          <ul className="control-help muted small">
            <li><Icon name="video" size={18} /> {iconize(t("match.viewHint"))}</li>
            <li><Icon name="swap" size={18} /> {iconize(t("match.doSubsHint"))}</li>
            <li><Icon name="megaphone" size={18} /> {iconize(t("orders.hint"))}</li>
            <li><Icon name="fire" size={18} /> {iconize(t("match.forzaHelp"))}</li>
            <li><Icon name="target" size={18} /> {iconize(t("match.setPiecesHint"))}</li>
            <li><Icon name="swap" size={18} /> {iconize(t("match.subsHint"))}</li>
            <li>{iconize(t("match.zoomHint"))}</li>
          </ul>
        </details>
      )}

      {shoutBubble}
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
      {ruled && reason && <span><Icon name="warn" size={18} /> {iconize(tx(`reason.${reason}`))}</span>}
    </div>
  );
}

/** A see-through dialog over the match, so the pitch stays in view behind it. */
function MatchDialog({title, onClose, children}: {title: ReactNode; onClose: () => void; children: ReactNode}) {
  const {t} = useT();
  useKeepScroll();
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

const INSTRUCTION_ICONS: Record<InstructionKey, IconName> = {passing: "swap", dribbling: "run", shooting: "target", tackling: "shield", position: "updown"};
const levelName = (lvl: InstructionLevel) => (lvl === -1 ? "low" : lvl === 1 ? "high" : "normal");

/** One row per instruction: less, normal, more, with what the current choice does. */
function InstructionGrid({value, disabled, onPick, keeper, intro}: {value: (key: InstructionKey) => InstructionLevel; disabled?: boolean; onPick: (key: InstructionKey, level: InstructionLevel) => void; keeper?: boolean; intro?: ReactNode}) {
  const {t, tx} = useT();
  // A keeper only has one order: how to play it out (passing: "more" is short, "direct" is long).
  const keys = keeper ? (["passing"] as const) : INSTRUCTIONS;
  const base = (key: InstructionKey) => (keeper ? "orders.gk" : `orders.${key}`);
  const icon = (key: InstructionKey): IconName => (keeper ? "glove" : INSTRUCTION_ICONS[key]);
  return (
    <div className="orders-grid">
      {/* What it's all about, and what every level does, behind the (i). */}
      <div className="orders-help-row">
        <Hint>
          {intro && <p>{intro}</p>}
          <dl className="tt-help">
            {keys.map((key) => (
              <div key={key}>
                <dt><Icon name={icon(key)} size={16} /> {iconize(tx(base(key)))}</dt>
                {([-1, 0, 1] as const).map((lvl) => (
                  <dd key={lvl}>
                    <strong>{lvl === -1 ? tx(`${base(key)}.low`) : lvl === 1 ? tx(`${base(key)}.high`) : t("orders.normal")}:</strong> {iconize(tx(`${base(key)}.${levelName(lvl)}.desc`))}
                  </dd>
                ))}
              </div>
            ))}
          </dl>
        </Hint>
      </div>
      {keys.map((key) => {
        const current = value(key);
        return (
          <div key={key} className={current === 0 ? "order-row" : "order-row changed"}>
            <span className="order-label"><Icon name={icon(key)} size={18} /> {iconize(tx(base(key)))}</span>
            <div className="order-chips order-switch" role="radiogroup">
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
            <h3><Icon name="medical" size={18} /> {iconize(t("match.injuryTitle", {player: p ? `${fullName(p)}` : "?"}))}</h3>
            <p className="muted small">{iconize(t("match.injuryHint", {pos: t(`pos.${pos}`)}))} · {iconize(t("orders.subsLeft", {n: subsLeft}))}</p>
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
 * The manager's instructions. A list at the top picks who they're for: the whole team or any
 * player on the pitch (tapping a player on the pitch opens it on them). Each instruction says what it does.
 */
function OrdersPanel({
  live,
  target,
  booked,
  onTarget,
  onInstruct,
  onTeamInstruct,
  onClose,
}: {
  live: LiveMatch;
  target: OrdersTarget;
  booked: Set<string | undefined>;
  onTarget: (target: OrdersTarget) => void;
  onInstruct: (id: string, key: InstructionKey, level: InstructionLevel) => void;
  onTeamInstruct: (key: InstructionKey, level: InstructionLevel) => void;
  onClose: () => void;
}) {
  const {t} = useT();
  return (
    <div className="orders">
      <TargetSelect live={live} target={target} booked={booked} onTarget={onTarget} />

      {target === "team" ? (
        <InstructionGrid intro={iconize(t("orders.teamHint"))} value={(key) => live.teamLevel(key)} onPick={onTeamInstruct} />
      ) : (
        <PlayerOrders key={target} live={live} playerId={target} onInstruct={onInstruct} />
      )}

      <div className="btn-row">
        <button className="btn primary push-right" onClick={onClose}>{iconize(t("orders.done"))}</button>
      </div>
    </div>
  );
}

/** A drop-down for who the instructions are for: the whole team, or a player shown like on their card. */
function TargetSelect({live, target, booked, onTarget}: {live: LiveMatch; target: OrdersTarget; booked: Set<string | undefined>; onTarget: (target: OrdersTarget) => void}) {
  const {t} = useT();
  const game = useGameState();
  const club = game.clubs[game.userClubId];
  const team = live.team();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  const row = (id: OrdersTarget) => {
    if (id === "team") {
      const told = INSTRUCTIONS.some((k) => live.teamLevel(k) !== 0);
      return (
        <>
          <span className="target-icon" aria-hidden><Icon name="users" size={26} /></span>
          <span className="target-row-name">{iconize(t("orders.teamTitle"))}</span>
          {told && <Icon name="megaphone" size={14} />}
        </>
      );
    }
    const o = team.onPitch.find((x) => x.id === id);
    const p = live.player(id);
    if (!o || !p) return null;
    const told = INSTRUCTIONS.some((k) => live.level(id, k) !== live.teamLevel(k));
    return (
      <>
        <Avatar player={p} shirt={club.color} trim={club.color2} size={36} />
        <span className="target-row-name">{fullName(p)}</span>
        <PosBadge pos={team.slots[o.slot].pos} />
        <Flag code={p.nationality} />
        {booked.has(id) && <span aria-hidden>🟨</span>}
        {told && <Icon name="megaphone" size={14} />}
      </>
    );
  };
  return (
    <div className="target-select" ref={ref}>
      <button type="button" className="target-current" aria-haspopup="listbox" aria-expanded={open} aria-label={t("orders.who")} onClick={() => setOpen(!open)}>
        {row(target)}
        <Icon name="chevron" size={16} />
      </button>
      {open && (
        <ul className="target-options" role="listbox">
          {(["team", ...team.onPitch.map((o) => o.id)] as OrdersTarget[]).map((id) => (
            <li key={id}>
              <button type="button" role="option" aria-selected={id === target} className={id === target ? "target-option active" : "target-option"} onClick={() => { setOpen(false); onTarget(id); }}>
                {row(id)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Instructions for one of the user's players. */
function PlayerOrders({live, playerId, onInstruct}: {live: LiveMatch; playerId: string; onInstruct: (id: string, key: InstructionKey, level: InstructionLevel) => void}) {
  const {t} = useT();
  const p = live.player(playerId);
  const team = live.team();
  if (!p) return null;
  const slot = team.onPitch.find((o) => o.id === playerId);
  return (
    <InstructionGrid intro={iconize(t("orders.playerHint", {name: shortName(p)}))} keeper={(slot ? team.slots[slot.slot].pos : p.position) === "GK"} value={(key) => live.level(playerId, key)} disabled={!slot} onPick={(key, lvl) => onInstruct(playerId, key, lvl)} />
  );
}

/**
 * Substitutions and the formation, laid out like the tactics page: the pitch with the shirts, the
 * bench below. Tap a player on the pitch, then a substitute to bring on.
 */
function SubsPanel({live, onSub, onFormation, onSwap, onPlace, onClose}: {live: LiveMatch; onSub: (outId: string, inId: string) => void; onFormation: (f: FormationId) => void; onSwap: (a: string, b: string) => void; onPlace: (id: string, x: number, y: number) => void; onClose: () => void}) {
  const {t} = useT();
  const game = useGameState();
  const club = game.clubs[game.userClubId];
  const team = live.team();
  const [out, setOut] = useState<string | null>(null);
  const formation = live.formation();
  // Changes given but not played yet: shown as they will be.
  const ids = team.onPitch.map((o) => o.id);
  const slots = live.previewSlots();
  const at = team.onPitch.map((o) => o.slot);
  const byslot = new Map(ids.map((id, k) => [at[k], id]));
  // Drag a shirt onto another to swap them; with a custom formation, onto an empty spot to move it there.
  const board = useRef<HTMLDivElement>(null);
  const [ghost, setGhost] = useState<{x: number; y: number; label: string} | null>(null);
  const dragged = useRef(false);
  const startDrag = (e: ReactPointerEvent, id: string, label: string) => {
    const from = {x: e.clientX, y: e.clientY};
    dragged.current = false;
    const move = (m: PointerEvent) => {
      if (!dragged.current && Math.hypot(m.clientX - from.x, m.clientY - from.y) < 8) return;
      dragged.current = true;
      setGhost({x: m.clientX, y: m.clientY, label});
    };
    const up = (u: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setGhost(null);
      if (!dragged.current) return;
      setTimeout(() => (dragged.current = false), 0);
      const over = document.elementFromPoint(u.clientX, u.clientY)?.closest<HTMLElement>("[data-slot]");
      const other = over ? byslot.get(Number(over.dataset.slot)) : undefined;
      if (other && other !== id) return onSwap(id, other);
      const rect = board.current?.getBoundingClientRect();
      if (!other && !formation && rect && u.clientX >= rect.left && u.clientX <= rect.right && u.clientY >= rect.top && u.clientY <= rect.bottom) {
        // The board's spot back to the pitch's (the opposite of how the shirts are laid out).
        const left = ((u.clientX - rect.left) / rect.width) * 100;
        const top = ((u.clientY - rect.top - 14) / rect.height) * 100;
        onPlace(id, 5 + (1 - (top - 2) / 79) * 71, 50 + (left - 50) / 0.95);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const spots = boardSpots(slots);
  const pendingOut = new Set(live.pendingSubs().map((c) => (c.type === "sub" ? c.outId : "")));
  const subsLeft = team.subsLeft - live.pendingSubs().length;
  const outSlot = out ? slots[at[ids.indexOf(out)]] : undefined;
  return (
    <div className="orders subs-panel">
      <label className="field">
        <span>{iconize(t("tac.formation"))}</span>
        <select value={formation ?? "custom"} disabled={team.injured.length > 0} onChange={(e) => e.target.value !== "custom" && onFormation(e.target.value as FormationId)}>
          {!formation && <option value="custom">{iconize(t("tac.custom"))}</option>}
          {FORMATION_IDS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </label>
      <div ref={board} className={`pitch-board ${formation ? "" : "custom"}`} role="group" aria-label={t("tac.pitch")}>
        <div className="pitch-lines" aria-hidden />
        {slots.map((slot, i) => {
          const id = byslot.get(i);
          const p = id ? live.player(id) : undefined;
          return (
            <button key={i} data-slot={i} className={`slot ${out && out === id ? "selected" : ""} ${id && pendingOut.has(id) ? "out" : ""} ${p ? "" : "empty"}`} style={spots[i]} disabled={!p} onPointerDown={p ? (e) => startDrag(e, p.id, shortName(p)) : undefined} onClick={() => !dragged.current && p && subsLeft > 0 && !pendingOut.has(p.id) && setOut(out === p.id ? null : p.id)}>
              <Jersey color={club.color} trim={club.color2} pattern={club.pattern} trim3={club.color3} collar={club.collar} sleeves={club.sleeves} keeper={slot.pos === "GK"} number={i + 1} />
              <span className="plate">
                <span className="plate-name">{p ? shortName(p) : t(`pos.${slot.pos}`)}</span>
                <span className="plate-info">
                  {p && <Flag code={p.nationality} size={13} />}
                  <span>{iconize(t(`pos.${slot.pos}`))}</span>
                  {p && <strong>{Math.round(effectiveRating(p, slot.pos))}</strong>}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {ghost && <div className="drag-ghost" style={{left: ghost.x, top: ghost.y}}>{ghost.label}</div>}
      <p className="muted small">{iconize(subsLeft > 0 ? t("orders.subsLeft", {n: subsLeft}) : t("orders.noSubs"))}</p>
      {out && live.player(out) ? (
        <>
          <h3>{iconize(t("subs.pickFor", {name: shortName(live.player(out)!)}))}</h3>
          <BenchList live={live} pos={outSlot?.pos} onPick={(inId) => { onSub(out, inId); setOut(null); }} />
        </>
      ) : (
        <p className="muted small">{iconize(t("subs.hint"))}</p>
      )}
      <div className="btn-row">
        <button className="btn primary push-right" onClick={onClose}>{iconize(t("orders.done"))}</button>
      </div>
    </div>
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
  if (e.type === "goal" && e.otherId) {
    const v = [...(e.playerId ?? "")].reduce((n, c) => n + c.charCodeAt(0), e.minute * 31) % 5;
    return tx(v > 0 ? `ev.goalAssist.v${v}` : "ev.goalAssist", params);
  }
  if (e.type === "disallowed") return tx("ev.disallowed", {...params, reason: tx(`reason.${e.note}`)});
  if (e.type === "instruction" && e.note?.startsWith("form:")) return tx("ev.formation", {...params, formation: e.note.slice(5)});
  if (e.type === "instruction" && e.note) return `📣 ${tx(e.note.endsWith("0") ? "shout.reset" : `shout.${e.note}`, params)}`;
  // The usual events have a few ways of being said, picked from the minute and the player (the same for the same moment).
  const extra = COMMENT_VARIANTS[e.type];
  if (extra) {
    const v = [...(e.playerId ?? "")].reduce((n, c) => n + c.charCodeAt(0), e.minute * 31) % (extra + 1);
    if (v > 0) return tx(`ev.${e.type}.v${v}`, params);
  }
  return tx(`ev.${e.type}`, params);
}

const COMMENT_VARIANTS: Record<string, number> = {goal: 4, saved: 4, missed: 4, blocked: 3, corner: 3, cleared: 3, yellow: 3, freekick: 2, penalty: 2, injury: 2, red: 2, sub: 2};

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
        <dt>{iconize(t("match.possession"))}</dt><dd>{report.possessionHome}% – {100 - report.possessionHome}%</dd>
        <dt>{iconize(t("match.shots"))}</dt><dd>{report.shots[0]} – {report.shots[1]}</dd>
        <dt>{iconize(t("match.onTarget"))}</dt><dd>{report.onTarget[0]} – {report.onTarget[1]}</dd>
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

/**
 * How a team talk will go down after this match, as help by difficulty. Easy: from very good to
 * very bad (++ right words, + harmless gentle ones, − tough words that miss, −− the wrong words).
 * Medium: just good (+) or bad (−). Hard: no help.
 */
function TalkEffect({talk, verdict}: {talk: TeamTalk; verdict: ReturnType<typeof matchVerdict>}) {
  const game = useGameState();
  const level = difficulty(game);
  if (level === "hard") return null;
  const fit = talkFit(talk, verdict);
  const gentle = talk === "praise" || talk === "calm";
  const good = fit === 1 || (fit === 0 && gentle);
  const mark = level === "medium" ? (good ? "+" : "−") : fit === 1 ? "++" : fit === -1 ? "−−" : gentle ? "+" : "−";
  const tone = level === "medium" ? (good ? "great" : "bad") : fit === 1 ? "great" : fit === -1 ? "bad" : gentle ? "good" : "meh";
  return <span className={`tt-effect tt-effect-${tone}`} aria-hidden>{mark}</span>;
}
