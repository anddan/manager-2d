// The tick engine: a match played in small steps with every player and the ball in it (the new way; the minute engine in match.ts is the old).
//
// Players have places, speed and tiring; the ball has a place and flies, bounces and is won or lost by whoever gets to it. A pass is a ball
// that is struck (with the passer's skill deciding how true) and then has to get past the defenders to the receiver; a tackle is a duel
// between the two; a foul comes from a tackle that went wrong; a shot is worth what the chance is worth (chances.ts) and is blocked, saved or
// scored; offside is whether the receiver was beyond the last defender when it was played. What the manager has told the team, the
// players' attributes (with form, fitness and morale already counted in) and the match state (the score, the time) decide how they play.
//
// The engine records only the highlights as frames for the match view (that plays a match in a few minutes, not in 90).
import {Rng, clamp} from "./rng";
import {chanceXg, type ChanceKind} from "./chances";
import {kickoffSpot, teamSpot} from "./pitch";
import type {Slot} from "./constants";
import type {Frame, Position, Side, TouchKind} from "./types";

export const L = 105;
export const W = 68;
const GOAL_HALF = 3.66;
const BOX_DEPTH = 16.5;
const BOX_HALF = 20.15;
const GRAV = 9.8;

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

export interface SimPlayer {
  id: string;
  pos: Position;
  slot: Slot;
  pace: number;
  stamina: number;
  passing: number;
  vision: number;
  technique: number;
  finishing: number;
  tackling: number;
  strength: number;
  aerial: number;
  keeping: number;
  /** From the manager's instructions: how hard he goes in, how much he shoots, how direct he plays, how much he dribbles, forward (+1) or back (-1). */
  aggression: number;
  shooting: number;
  directness: number;
  dribbling: number;
  push: number;
}

export interface SimTeam {
  players: SimPlayer[];
  /** -1 defensive, 0 balanced, 1 attacking. */
  mentality: number;
  /** How hard the team presses (1 is normal). */
  pressing: number;
  /** A lift to every skill: home advantage and the manager's "Forza!". */
  lift: number;
  /** How quickly legs tire (the manager's instructions). */
  tire: number;
}

export interface Perf {
  passOk: number;
  passBad: number;
  keyPass: number;
  tackleWon: number;
  tackleLost: number;
  intercept: number;
  dribbleWon: number;
  shots: number;
  saves: number;
  fouls: number;
  headers: number;
  offsides: number;
}

export type SimEvent =
  | {t: "goal"; team: 0 | 1; scorer: string; assist?: string; xg: number; kind: ChanceKind}
  | {t: "shot"; team: 0 | 1; shooter: string; result: "goal" | "saved" | "missed" | "blocked"; xg: number; kind: ChanceKind; keeper?: string; blocker?: string}
  | {t: "foul"; team: 0 | 1; fouler: string; victim: string; card: "none" | "yellow" | "red"; x: number; y: number; inBox: boolean}
  | {t: "offside"; team: 0 | 1; player: string}
  | {t: "setpiece"; kind: "corner" | "freekick" | "penalty"; team: 0 | 1; x: number; y: number; foulerId?: string}
  | {t: "kickoff"; team: 0 | 1};

interface Mover {
  id: string;
  team: 0 | 1;
  sk: SimPlayer;
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  stam: number;
  speed: number;
  cool: number;
  perf: Perf;
  /** How far in front of (+) or behind (-) the last defender he times his run (mostly behind; now and then he is late to hold back). */
  slip: number;
  slipT: number;
}

type PassKind = "ground" | "through" | "long" | "cross";

const newPerf = (): Perf => ({passOk: 0, passBad: 0, keyPass: 0, tackleWon: 0, tackleLost: 0, intercept: 0, dribbleWon: 0, shots: 0, saves: 0, fouls: 0, headers: 0, offsides: 0});

export class TickMatch {
  readonly dt: number;
  /** Seconds played. */
  t = 0;
  events: SimEvent[] = [];
  readonly stats = {
    passes: [0, 0], passesOk: [0, 0], tackles: [0, 0], interceptions: [0, 0], fouls: [0, 0], offsides: [0, 0], corners: [0, 0], possession: [0, 0], goals: [0, 0], shots: [0, 0], onTarget: [0, 0], xg: [0, 0],
  } as Record<string, [number, number]>;
  /** True while the caller is dealing with a set piece (the engine waits). */
  waiting = false;

  private teams: [SimTeam, SimTeam];
  private M: Mover[] = [];
  private kept = new Map<string, {x: number; y: number; stam: number; perf: Perf}>();
  private b = {x: L / 2, y: W / 2, z: 0, vx: 0, vy: 0, vz: 0};
  private carrier = -1;
  private lastTouch = -1;
  private lastTouchTeam: 0 | 1 = 0;
  private passTarget = -1;
  private passKind: PassKind = "ground";
  private passer = -1;
  private flightLeft = 0;
  private think = 0.6;
  private carryX = 0;
  private carryY = 0;
  private hold = 0;
  private pending: {kind: "kickoff" | "throwin" | "goalkick" | "freekick"; team: 0 | 1; x: number; y: number} | null = null;
  private shotAt = -1;
  private shot: {team: 0 | 1; shooter: number; result: "goal" | "saved" | "missed" | "blocked"; xg: number; kind: ChanceKind; keeper: number; blocker: number; ty: number; assist?: string} | null = null;
  private lastFrameT = -10;
  private lastFrame = {x: L / 2, y: W / 2, idx: -1};
  private lastPassFlight: Frame["flight"] | undefined;
  private strict = 1;
  private booked = new Set<string>();
  private urgency: [number, number] = [0, 0];
  private lastAssist: string | undefined;
  private lastAssistKind: PassKind = "ground";
  private lastAssistT = -99;
  private fromByline = false;
  private onFrame: (f: Frame) => void;

  constructor(private rng: Rng, readonly hz: number, teams: [SimTeam, SimTeam], onFrame: (f: Frame) => void, strict = 1) {
    this.dt = 1 / hz;
    this.teams = teams;
    this.onFrame = onFrame;
    this.strict = strict;
    this.rebuild();
  }

  perfOf(id: string): Perf | undefined {
    return this.M.find((m) => m.id === id)?.perf ?? this.kept.get(id)?.perf;
  }

  /** The teams as they are now (substitutions, sent off, orders given): players already on keep their place and tiredness. */
  setTeams(teams: [SimTeam, SimTeam]): void {
    this.teams = teams;
    this.rebuild();
  }

  /** The score and the time: what a side that is behind late on, or ahead late on, does about it. */
  setContext(minute: number, diffHome: number): void {
    const late = clamp((minute - 20) / 60, 0.1, 1);
    this.urgency = [clamp(-diffHome * 0.55 * late, -1, 1), clamp(diffHome * 0.55 * late, -1, 1)];
  }

  private rebuild(): void {
    const carrierId = this.carrier >= 0 ? this.M[this.carrier]?.id : undefined;
    const targetId = this.passTarget >= 0 ? this.M[this.passTarget]?.id : undefined;
    const lastId = this.lastTouch >= 0 ? this.M[this.lastTouch]?.id : undefined;
    const passerId = this.passer >= 0 ? this.M[this.passer]?.id : undefined;
    for (const m of this.M) this.kept.set(m.id, {x: m.x, y: m.y, stam: m.stam, perf: m.perf});
    this.M = [];
    for (const team of [0, 1] as const) {
      for (const p of this.teams[team].players) {
        const prev = this.kept.get(p.id);
        const [x, y] = prev ? [prev.x, prev.y] : this.spotOf(team, p, {x: L / 2, y: W / 2}, false);
        this.M.push({
          id: p.id, team, sk: p, x, y, vx: 0, vy: 0, tx: x, ty: y, stam: prev?.stam ?? 1,
          speed: 5.6 + p.pace * 0.032, cool: 0, perf: prev?.perf ?? newPerf(), slip: -0.7, slipT: 0,
        });
      }
    }
    const find = (id?: string) => (id ? this.M.findIndex((m) => m.id === id) : -1);
    this.carrier = find(carrierId);
    this.passTarget = find(targetId);
    this.lastTouch = find(lastId);
    this.passer = find(passerId);
    if (this.carrier < 0 && carrierId && this.shot === null && this.hold <= 0 && !this.waiting) {
      // The one with the ball is gone (sent off, or taken off): it is lying there.
      this.b.vx = this.b.vy = 0;
    }
  }

  private sideOf(t: 0 | 1): Side {
    return t === 0 ? "home" : "away";
  }

  private spotOf(team: 0 | 1, p: SimPlayer, ballM: {x: number; y: number}, inPossession: boolean): [number, number] {
    const s = teamSpot(p.slot, this.sideOf(team), {x: ballM.x / 1.05, y: ballM.y / 0.68}, inPossession, p.push);
    return [s.x * 1.05, s.y * 0.68];
  }

  // ---- kick-off and restarts ----

  /** Kick-off by a side (at the start, after a goal and after half-time). */
  kickoff(team: 0 | 1, minuteFraction = false): void {
    void minuteFraction;
    for (const m of this.M) {
      const s = kickoffSpot(m.sk.slot, this.sideOf(m.team));
      m.x = s.x * 1.05;
      m.y = s.y * 0.68;
      m.vx = m.vy = 0;
    }
    // The nearest forward to the centre takes it.
    let best = -1;
    let bd = 1e9;
    this.M.forEach((m, i) => {
      if (m.team !== team || m.sk.pos === "GK") return;
      const d = dist(m.x, m.y, L / 2, W / 2) - (m.sk.pos === "ST" ? 3 : 0);
      if (d < bd) { bd = d; best = i; }
    });
    const k = this.M[best];
    if (k) { k.x = L / 2 - (team === 0 ? 0.4 : -0.4); k.y = W / 2; }
    this.b = {x: L / 2, y: W / 2, z: 0, vx: 0, vy: 0, vz: 0};
    this.carrier = best;
    this.lastTouch = best;
    this.lastTouchTeam = team;
    this.passTarget = -1;
    this.shot = null;
    this.think = 0.8;
    this.carryX = k ? k.x : L / 2;
    this.carryY = k ? k.y : W / 2;
    if (k) this.frame("kickoff", k, L / 2 / 1.05, W / 2 / 0.68, this.sideOf(team));
    this.events.push({t: "kickoff", team});
  }

  private frame(kind: TouchKind, m: Mover | undefined, xPct: number, yPct: number, possession: Side, extra?: Partial<Frame>, minGap = 0.4): Frame {
    const ft = Math.max(this.t, this.lastFrameT + minGap);
    this.lastFrameT = ft;
    const f: Frame = {minute: ft / 60, x: clamp(xPct, 0, 100), y: clamp(yPct, 0, 100), possession, kind, ...extra};
    if (m) f.playerId = m.id;
    this.lastFrame = {x: m ? m.x : (xPct * 1.05), y: m ? m.y : (yPct * 0.68), idx: m ? this.M.indexOf(m) : -1};
    this.onFrame(f);
    return f;
  }

  // ---- stepping ----

  step(): void {
    const dt = this.dt;
    this.t += dt;
    if (this.waiting) return;
    if (this.hold > 0) {
      this.hold -= dt;
      this.moveAll(true);
      if (this.hold <= 0) this.afterHold();
      return;
    }
    const poss = this.carrier >= 0 ? this.M[this.carrier].team : this.lastTouchTeam;
    this.stats.possession[poss] += 1;
    this.targets(poss);
    this.moveAll(false);
    this.ballStep();
    if (this.shot && this.t >= this.shotAt) this.resolveShot();
    if (this.carrier >= 0 && !this.shot) this.carrierStep();
  }

  takeEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ---- where everyone goes ----

  private offsideLine(attacking: 0 | 1): number {
    // The second-last defender (the keeper counts): the line the attackers must not be beyond.
    const xs = this.M.filter((m) => m.team !== attacking).map((m) => (attacking === 0 ? m.x : L - m.x)).sort((a, b) => b - a);
    const second = xs[1] ?? xs[0] ?? L;
    return attacking === 0 ? second : L - second;
  }

  private targets(poss: 0 | 1): void {
    const ballM = {x: this.b.x, y: this.b.y};
    const line = [this.offsideLine(0), this.offsideLine(1)];
    // The defenders closest to the ball press it; more of them for a side that presses hard.
    const chasers = new Map<number, number>();
    for (const team of [0, 1] as const) {
      const loose = this.carrier < 0;
      if (team === poss && !loose) continue;
      const order = this.M.map((m, i) => ({i, d: m.team === team && m.sk.pos !== "GK" ? dist(m.x, m.y, ballM.x, ballM.y) : 1e9})).sort((a, b) => a.d - b.d);
      const n = loose ? 2 : this.teams[team].pressing > 1.2 ? 3 : this.teams[team].pressing > 0.8 ? 2 : 1;
      for (let k = 0; k < n; k++) if (order[k].d < (loose ? 40 : 28)) chasers.set(order[k].i, k);
    }
    const carrierM = this.carrier >= 0 ? this.M[this.carrier] : null;
    // The ones who show for a pass.
    const support = new Set<number>();
    if (carrierM) {
      const near = this.M.map((m, i) => ({i, d: m.team === carrierM.team && i !== this.carrier && m.sk.pos !== "GK" ? dist(m.x, m.y, carrierM.x, carrierM.y) : 1e9})).sort((a, b) => a.d - b.d);
      for (let k = 0; k < 3; k++) if (near[k].d < 30) support.add(near[k].i);
    }
    this.M.forEach((m, i) => {
      const st = this.teams[m.team];
      const dir = m.team === 0 ? 1 : -1;
      const inPoss = m.team === poss;
      // The line the manager asked for (mentality, "forward"/"back" and what the match asks for) moves the whole shape up or down.
      const push = m.sk.push + st.mentality * 0.5 + this.urgency[m.team] * 0.6;
      let runner = false;
      let [tx, ty] = this.spotOf(m.team, {...m.sk, push: 0}, ballM, inPoss);
      tx += dir * push * 6;
      if (m.sk.pos === "GK") {
        // Between the ball and the goal, off the line when the ball is near.
        const goalX = m.team === 0 ? 0 : L;
        const bd = dist(this.b.x, this.b.y, goalX, W / 2);
        tx = goalX + dir * clamp(1 + (30 - bd) * 0.12, 1, 6);
        ty = W / 2 + (this.b.y - W / 2) * clamp(7 / Math.max(bd, 7), 0.15, 0.5);
      } else if (!inPoss && !chasers.has(i) && i !== this.passTarget && !(carrierM && i === this.carrier)) {
        // Marking: a man close to his place takes the nearest attacker, standing just goal-side of him.
        let near = -1;
        let bd = 14 * 14;
        for (let j = 0; j < this.M.length; j++) {
          const o = this.M[j];
          if (o.team === m.team || o.sk.pos === "GK" || j === this.carrier) continue;
          const d2 = (o.x - tx) * (o.x - tx) + (o.y - ty) * (o.y - ty);
          if (d2 < bd) { bd = d2; near = j; }
        }
        if (near >= 0) {
          const o = this.M[near];
          tx = o.x - dir * 1.8;
          ty = o.y;
        }
      } else if (carrierM && i === this.carrier) {
        tx = this.carryX;
        ty = this.carryY;
      } else if (i === this.passTarget && this.carrier < 0) {
        // Gets to where the ball will be.
        tx = this.b.x + this.b.vx * Math.max(0, this.flightLeft) * 0.7;
        ty = this.b.y + this.b.vy * Math.max(0, this.flightLeft) * 0.7;
      } else if (chasers.has(i)) {
        const rank = chasers.get(i)!;
        if (rank === 0 || this.carrier < 0) {
          tx = this.b.x - (carrierM ? dir * 1.0 : 0);
          ty = this.b.y;
        } else {
          // The second covers: between the ball and his own goal.
          const gx = m.team === 0 ? 0 : L;
          tx = this.b.x + (gx - this.b.x) * 0.15;
          ty = this.b.y + (W / 2 - this.b.y) * 0.1;
        }
      } else if (inPoss && carrierM && support.has(i)) {
        // Showing for the ball: ahead and to the side, away from the nearest opponent.
        const side = m.y < carrierM.y ? -1 : 1;
        tx = carrierM.x + dir * (6 + (m.sk.pos === "ST" || m.sk.pos === "W" ? 6 : 0));
        ty = clamp(carrierM.y + side * 11, 3, W - 3);
      } else if (inPoss && (m.sk.pos === "ST" || m.sk.pos === "W" || m.sk.pos === "AM") && (m.team === 0 ? this.b.x > L * 0.4 : this.b.x < L * 0.6)) {
        // A run in behind: up to the line.
        if (this.t >= m.slipT) {
          m.slipT = this.t + 2.5 + this.rng.next() * 2;
          m.slip = this.rng.next() < 0.3 * (1.5 - m.sk.vision / 100) ? 1.0 + this.rng.next() * 2.2 : -0.7;
        }
        tx = m.team === 0 ? Math.min(line[0] + m.slip, Math.max(tx, m.x) + 12) : Math.max(line[1] - m.slip, Math.min(tx, m.x) - 12);
        ty = clamp(ty, 6, W - 6);
        runner = true;
      }
      // Never beyond the last defender (unless the ball is ahead of him already).
      if (inPoss && !runner && m.sk.pos !== "GK" && i !== this.carrier && i !== this.passTarget) {
        const l = line[m.team];
        if (m.team === 0 ? tx > l - 0.3 && this.b.x < l : tx < l + 0.3 && this.b.x > l) tx = m.team === 0 ? l - 0.4 : l + 0.4;
      }
      m.tx = clamp(tx, 0.5, L - 0.5);
      m.ty = clamp(ty, 0.5, W - 0.5);
    });
  }

  private moveAll(idle: boolean): void {
    const dt = this.dt;
    for (let i = 0; i < this.M.length; i++) {
      const m = this.M[i];
      const lift = this.teams[m.team].lift;
      let dx = m.tx - m.x;
      let dy = m.ty - m.y;
      const d = Math.sqrt(dx * dx + dy * dy) + 1e-6;
      const top = m.speed * (0.78 + 0.22 * m.stam) * (idle ? 0.35 : 1) * (0.97 + 0.03 * lift) * (i === this.carrier ? 0.9 : 1);
      const want = Math.min(top, d * 1.4);
      dx = (dx / d) * want;
      dy = (dy / d) * want;
      // Not all on top of each other.
      for (let j = 0; j < this.M.length; j++) {
        if (j === i) continue;
        const o = this.M[j];
        const sx = m.x - o.x;
        const sy = m.y - o.y;
        const sd = sx * sx + sy * sy;
        if (sd < 2.25 && sd > 1e-6) {
          const k = (1.5 - Math.sqrt(sd)) / 1.5;
          dx += sx * k * 1.2;
          dy += sy * k * 1.2;
        }
      }
      const ax = clamp(dx - m.vx, -5.5 * dt, 5.5 * dt);
      const ay = clamp(dy - m.vy, -5.5 * dt, 5.5 * dt);
      m.vx += ax;
      m.vy += ay;
      m.x = clamp(m.x + m.vx * dt, 0, L);
      m.y = clamp(m.y + m.vy * dt, 0, W);
      const sp = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
      // Tiring: running hard, and the legs the player has (his stamina) and what the manager asks.
      const drain = (sp / m.speed) ** 2 * 0.000062 * (1.45 - m.sk.stamina / 100) * this.teams[m.team].tire * dt * 5;
      m.stam = clamp(m.stam - drain + (idle ? 0.00006 * dt * 5 : 0), 0.45, 1);
      if (m.cool > 0) m.cool -= dt;
    }
  }

  // ---- the ball ----

  private ballStep(): void {
    const dt = this.dt;
    const b = this.b;
    if (this.carrier >= 0) {
      const c = this.M[this.carrier];
      this.lastTouch = this.carrier;
      this.lastTouchTeam = c.team;
      const sp = Math.sqrt(c.vx * c.vx + c.vy * c.vy) + 1e-6;
      b.x = c.x + (c.vx / sp) * 0.45;
      b.y = c.y + (c.vy / sp) * 0.45;
      b.z = 0;
      b.vx = c.vx;
      b.vy = c.vy;
      this.tackleStep(c);
      return;
    }
    // In flight: gravity and a little drag in the air, more along the ground.
    b.vz -= GRAV * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    if (b.z < 0) {
      b.z = 0;
      b.vz = Math.abs(b.vz) > 2.5 ? -b.vz * 0.4 : 0;
    }
    const k = Math.max(0, 1 - (b.z > 0.15 ? 0.12 : 1.1) * dt);
    b.vx *= k;
    b.vy *= k;
    this.flightLeft -= dt;
    if (this.outOfPlay()) return;
    // A cross is decided when it comes down (the jump for it), not by whoever it passes.
    if (this.aerialAt) {
      if (this.t >= this.aerialAt.t) this.resolveAerial();
      return;
    }
    this.contest();
  }

  /** Who gets to the ball: the one it was passed to, or a defender who cuts it out, or whoever is nearest when it is loose. */
  private contest(): void {
    const b = this.b;
    if (this.shot) return;
    const passing = this.passTarget >= 0;
    let best = -1;
    let bestScore = -1e9;
    for (let i = 0; i < this.M.length; i++) {
      const m = this.M[i];
      const d = dist(m.x, m.y, b.x, b.y);
      const reach = b.z > 0.4 ? 1.9 : 1.15;
      if (d > reach || b.z > 2.7) continue;
      const mine = passing && m.team === this.M[this.passTarget]?.team;
      if (passing && mine && i !== this.passTarget) continue;
      if (i === this.passer && this.flightLeft > 0.2) continue;
      // Who takes it: the receiver (his touch), a defender (his reading and tackling), or the nearest.
      const skill = i === this.passTarget ? m.sk.technique : (m.sk.tackling * 0.55 + m.sk.vision * 0.25 + m.sk.pace * 0.2);
      const score = skill * 0.01 - d * 0.5 + this.rng.next() * 0.5;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    if (best < 0) return;
    const m = this.M[best];
    const speed = Math.hypot(b.vx, b.vy);
    if (best === this.passTarget) {
      // A pass reaches its man: it can be hard to control (hard, from far, with a man on him).
      const pressure = this.pressureOn(best);
      const ok = this.rng.next() < clamp(0.7 + m.sk.technique * 0.0042 - speed * 0.006 - pressure * 0.1 - (b.z > 0.6 ? 0.08 : 0), 0.3, 0.98);
      this.stats.passesOk[m.team] += ok ? 1 : 0;
      const from = this.passer >= 0 ? this.M[this.passer] : null;
      if (from) {
        if (ok) from.perf.passOk++;
        else from.perf.passBad++;
      }
      if (!ok) {
        // Heavy touch: loose again, a couple of metres away.
        b.vx = this.rng.range(-3, 3);
        b.vy = this.rng.range(-3, 3);
        this.passTarget = -1;
        this.passer = -1;
        this.lastTouch = best;
        this.lastTouchTeam = m.team;
        return;
      }
      if (from && ((m.team === 0 ? m.x - from.x : from.x - m.x) > 14 || this.inFinalThird(m))) from.perf.keyPass += this.inFinalThird(m) && this.passKind === "through" ? 1 : 0;
      this.gain(best, true);
      return;
    }
    const m0 = this.M[best];
    const receivingTeam = this.passTarget >= 0 ? this.M[this.passTarget].team : this.lastTouchTeam;
    if (m0.team !== receivingTeam || this.passTarget < 0) {
      // A defender (or someone nearest a loose ball) gets there: the ball is won.
      if (this.passTarget >= 0) {
        // Only if he really gets to it (he has to beat the pass).
        const p = clamp(0.1 + m0.sk.tackling * 0.0035 + m0.sk.vision * 0.0015 - speed * 0.005, 0.05, 0.6);
        if (this.rng.next() > p) return;
        this.stats.interceptions[m0.team]++;
        m0.perf.intercept++;
        const from = this.passer >= 0 ? this.M[this.passer] : null;
        if (from) from.perf.passBad++;
      }
      this.gain(best, this.passTarget >= 0);
    }
  }

  /** `best` has the ball. */
  private gain(i: number, wonFromOther: boolean): void {
    const m = this.M[i];
    const prevTeam = this.lastTouchTeam;
    const prevCarrier = this.lastTouch;
    this.carrier = i;
    this.passTarget = -1;
    this.b.vx = this.b.vy = this.b.vz = 0;
    this.b.z = 0;
    this.think = 2.0 + this.rng.next() * 2.0;
    this.carryX = m.x;
    this.carryY = m.y;
    this.lastTouch = i;
    this.lastTouchTeam = m.team;
    if (wonFromOther && m.team !== prevTeam) {
      // A possession change: shown (it is what the match view needs to follow).
      if (this.t - this.lastFrameT >= 14) this.frame("tackle", m, m.x / 1.05, m.y / 0.68, this.sideOf(m.team));
      this.passKindFrame(undefined);
    } else if (prevCarrier !== i) {
      this.noteProgress(true);
    }
  }

  private passKindFrame(f: Frame["flight"]): void {
    this.lastPassFlight = f;
  }

  private inFinalThird(m: Mover): boolean {
    return m.team === 0 ? m.x > L * 0.67 : m.x < L * 0.33;
  }

  private pressureOn(i: number): number {
    const m = this.M[i];
    let p = 0;
    for (const o of this.M) {
      if (o.team === m.team) continue;
      const d = dist(m.x, m.y, o.x, o.y);
      if (d < 4) p += (1 - d / 4) ** 1.4 * (o.sk.pos === "GK" ? 0.2 : 1);
    }
    return Math.min(p, 2.5);
  }

  // ---- tackles, fouls ----

  private tackleStep(c: Mover): void {
    if (this.hold > 0 || this.shot) return;
    for (let k = 0; k < this.M.length; k++) {
      const o = this.M[k];
      if (o.team === c.team || o.cool > 0 || o.sk.pos === "GK") continue;
      const d = dist(o.x, o.y, c.x, c.y);
      if (d > 1.7) continue;
      const press = this.teams[o.team].pressing;
      // A go at him every now and then (more for a side that presses and for one that goes in hard).
      if (this.rng.next() > clamp(0.0075 * press * (0.7 + o.sk.aggression * 0.35), 0.002, 0.2)) continue;
      o.cool = 2;
      this.stats.tackles[o.team]++;
      // The duel: his tackling against the carrier's control of the ball and pace, with a man to the side to help.
      const defend = o.sk.tackling * 0.7 + o.sk.pace * 0.15 + o.sk.strength * 0.15;
      const keep = c.sk.technique * 0.5 + c.sk.pace * 0.2 + c.sk.strength * 0.15 + c.sk.dribbling * 12 + 15;
      const pWin = 1 / (1 + Math.exp(-(defend - keep) / 14 - 0.15));
      const roll = this.rng.next();
      if (roll < pWin * 0.72) {
        o.perf.tackleWon++;
        c.perf.tackleLost++;
        const slide = d > 1.2 && this.rng.next() < 0.4;
        this.carrier = k;
        this.lastTouch = k;
        this.lastTouchTeam = o.team;
        this.carryX = o.x;
        this.carryY = o.y;
        this.think = 0.4;
        if (this.t - this.lastFrameT >= 14) this.frame("tackle", o, o.x / 1.05, o.y / 0.68, this.sideOf(o.team), slide ? {slide: true} : undefined);
        this.lastPassFlight = undefined;
        return;
      }
      // Lost the duel (or not won it): sometimes a foul.
      const ownGoalX = o.team === 0 ? 0 : L;
      const careful = Math.abs(c.x - ownGoalX) < BOX_DEPTH + 1 && Math.abs(c.y - W / 2) < BOX_HALF + 1 ? 0.03 : 1;
      const pFoul = clamp((0.4 + 0.25 * o.sk.aggression) * (1.2 - o.sk.tackling / 170) * (roll < pWin ? 1 : 0.55) * careful * 1.0, 0.01, 0.8);
      if (this.rng.next() < pFoul) {
        this.foul(k, this.carrier);
        return;
      }
      c.perf.dribbleWon++;
      o.perf.tackleLost++;
    }
  }

  private foul(fouler: number, victim: number): void {
    const f = this.M[fouler];
    const v = this.M[victim];
    f.perf.fouls++;
    this.stats.fouls[f.team]++;
    const ownGoalX = f.team === 0 ? 0 : L;
    const inBox = Math.abs(f.x - ownGoalX) < BOX_DEPTH && Math.abs(f.y - W / 2) < BOX_HALF;
    // The referee: how bad, how strict.
    const bad = this.rng.next() ** 1.7;
    // A man who is booked already is careful (and the referee slower to send him off).
    const already = this.booked.has(f.id);
    const yellow = bad > 1 - 0.3 * this.strict * (0.6 + f.sk.aggression * 0.5) * (inBox ? 1.2 : 1) * (already ? 0.3 : 1);
    const red = bad > 1 - 0.012 * this.strict;
    const card = red ? "red" : yellow ? "yellow" : "none";
    if (card === "yellow") this.booked.add(f.id);
    this.frame("tackle", f, v.x / 1.05, v.y / 0.68, this.sideOf(v.team), {foul: true, slide: this.rng.next() < 0.4});
    this.events.push({t: "foul", team: v.team, fouler: f.id, victim: v.id, card, x: v.x / 1.05, y: v.y / 0.68, inBox});
    this.carrier = -1;
    this.b.vx = this.b.vy = this.b.vz = 0;
    this.b.x = v.x;
    this.b.y = v.y;
    this.lastTouchTeam = v.team;
    this.lastTouch = victim;
    this.passTarget = -1;
    // What follows: a penalty, a free kick the manager may take, or the game goes on from the spot.
    const goalX = v.team === 0 ? L : 0;
    const dg = dist(v.x, v.y, goalX, W / 2);
    const central = Math.abs(v.y - W / 2) < 22;
    if (inBox) {
      this.waiting = true;
      this.events.push({t: "setpiece", kind: "penalty", team: v.team, x: v.x / 1.05, y: v.y / 0.68, foulerId: f.id});
    } else if (dg < 33 && central) {
      this.waiting = true;
      this.events.push({t: "setpiece", kind: "freekick", team: v.team, x: v.x / 1.05, y: v.y / 0.68, foulerId: f.id});
    } else {
      this.pending = {kind: "freekick", team: v.team, x: v.x, y: v.y};
      this.hold = 2.5;
    }
  }

  // ---- what the one with the ball does ----

  private carrierStep(): void {
    const c = this.M[this.carrier];
    this.think -= this.dt;
    // Carrying on towards the goal (or wherever he is going), and now and then a frame for the match view.
    this.noteProgress(false);
    if (this.think > 0) return;
    const pressure = this.pressureOn(this.carrier);
    const nearGoal = dist(c.x, c.y, c.team === 0 ? L : 0, W / 2) < 20 ? 0.6 : 1;
    this.think = clamp(2.0 + pressure * 0.4 - c.sk.vision * 0.003 + this.rng.next() * 1.2, 0.8, 3.8) * nearGoal * (this.urgency[c.team] < -0.5 ? 1.35 : 1);
    this.decide(c, pressure);
  }

  private noteProgress(forced: boolean): void {
    if (this.carrier < 0) return;
    const m = this.M[this.carrier];
    const since = this.t - this.lastFrameT;
    const moved = dist(m.x, m.y, this.lastFrame.x, this.lastFrame.y);
    const changed = this.lastFrame.idx !== this.carrier;
    if (forced) return;
    if (since >= 25 && moved >= 22) {
      this.frame(changed ? "pass" : "dribble", m, m.x / 1.05, m.y / 0.68, this.sideOf(m.team), changed && this.lastPassFlight ? {flight: this.lastPassFlight} : undefined);
      this.lastPassFlight = undefined;
    }
  }

  private decide(c: Mover, pressure: number): void {
    const team = c.team;
    const dir = team === 0 ? 1 : -1;
    const goalX = team === 0 ? L : 0;
    const dGoal = dist(c.x, c.y, goalX, W / 2);
    const st = this.teams[team];
    const urgency = this.urgency[team];
    const lift = st.lift;
    const idx = this.carrier;
    const line = this.offsideLine(team);
    const inBox = Math.abs(c.x - goalX) < BOX_DEPTH + 2 && Math.abs(c.y - W / 2) < BOX_HALF + 2;

    // A shot: from where it is worth it (and more of them from a man who shoots, or a side that needs a goal).
    if (dGoal < 34) {
      const q = this.shotXg(idx, pressure);
      // In the box a man with the ball shoots (or it is gone); from further out only when it is a fair chance.
      const bias = 1 + c.sk.shooting * 0.4 + urgency * 0.3;
      const want = inBox ? (0.009 + q * 0.115) * bias : q * (dGoal > 24 ? 0.24 : 0.27) * bias;
      if (this.rng.next() < clamp(want, 0, 0.75)) {
        this.takeShot(idx, pressure);
        return;
      }
    }

    // A cross: out wide near the byline with men in the box.
    const wide = Math.abs(c.y - W / 2) > 17;
    const nearByline = Math.abs(c.x - goalX) < 32;
    if (wide && nearByline && c.sk.pos !== "GK") {
      const inBoxMates = this.M.filter((m) => m.team === team && m.sk.pos !== "GK" && m.id !== c.id && Math.abs(m.x - goalX) < 17 && Math.abs(m.y - W / 2) < 16).length;
      if (inBoxMates >= 1 && this.rng.next() < 0.5 + (urgency > 0 ? 0.2 : 0)) {
        this.cross(idx);
        return;
      }
    }

    // A pass: forward and into space is worth the most, a man with a defender on him the least, and the lane must be open.
    let best = -1e9;
    let bestJ = -1;
    let bestKind: PassKind = "ground";
    let bestRisk = 0;
    const directness = clamp(0.5 + st.mentality * 0.18 + urgency * 0.25 + c.sk.directness * 0.2, 0.1, 1.3);
    for (let j = 0; j < this.M.length; j++) {
      const r = this.M[j];
      if (r.team !== team || j === idx || r.sk.pos === "GK" && c.sk.pos !== "GK" && dGoal > 25) continue;
      const dx = r.x - c.x;
      const dy = r.y - c.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 4 || d > 50) continue;
      // Not into an offside position.
      const ahead = (r.x - c.x) * dir > 0;
      const offside = ahead && (team === 0 ? r.x > line + 0.2 : r.x < line - 0.2) && (team === 0 ? r.x > L / 2 : r.x < L / 2);
      if (offside && this.rng.next() < 0.5 + c.sk.vision * 0.004) continue;
      // The lane: how close any opponent gets to the line of the pass.
      let risk = 0;
      for (const o of this.M) {
        if (o.team === team) continue;
        const ex = o.x - c.x;
        const ey = o.y - c.y;
        const u = clamp((ex * dx + ey * dy) / (d * d), 0, 1);
        const qx = ex - dx * u;
        const qy = ey - dy * u;
        const q = Math.sqrt(qx * qx + qy * qy);
        if (q < 3.2) risk += (1 - q / 3.2) * (u > 0.85 ? 1.3 : 1);
      }
      let free = 8;
      for (const o of this.M) if (o.team !== team) free = Math.min(free, dist(o.x, o.y, r.x, r.y));
      const forward = ((r.x - c.x) * dir) / 30;
      const behindLine = ahead && (team === 0 ? r.x > line - 3 : r.x < line + 3);
      let kind: PassKind = "ground";
      if (d > 26 || (risk > 0.9 && free > 3.5)) kind = "long";
      else if (behindLine && forward > 0.3 && d > 12) kind = "through";
      const goalPull = (dGoal - dist(r.x, r.y, goalX, W / 2)) / 35;
      const value = forward * directness * 1.6 + goalPull * directness + Math.min(free, 8) * 0.14 - risk * (0.9 - directness * 0.2) - d * 0.006 - (kind === "long" ? 0.25 : 0) + (kind === "through" ? 0.2 : 0) + this.rng.next() * (0.55 - c.sk.vision * 0.004);
      // Leading late: keep it, safe and sideways.
      const safe = urgency < -0.45 ? (forward < 0 ? 0.35 : 0) - risk * 0.4 : 0;
      if (value + safe > best) { best = value + safe; bestJ = j; bestKind = kind; bestRisk = risk; }
    }
    // Carrying on instead: when there is room ahead, or nothing good to pass to.
    const ahead = this.M.filter((o) => o.team !== team && (o.x - c.x) * dir > 0 && (o.x - c.x) * dir < 10 && Math.abs(o.y - c.y) < 6).length;
    const carryValue = 0.1 + c.sk.dribbling * 0.35 + (ahead === 0 ? 0.35 : -0.35 * ahead) - pressure * 0.12 + (c.sk.technique - 50) * 0.003;
    if (bestJ >= 0 && best > carryValue) {
      void lift;
      this.pass(idx, bestJ, bestKind, bestRisk);
      return;
    }
    // Carry the ball: forward when there is room, away from the nearest man otherwise.
    this.carryX = clamp(c.x + dir * (6 + this.rng.next() * 5), 2, L - 2);
    this.carryY = clamp(c.y + (W / 2 - c.y) * 0.12 + (this.rng.next() - 0.5) * 7, 2, W - 2);
    c.perf.dribbleWon += 0;
  }

  // ---- striking the ball ----

  private strike(c: Mover, tx: number, ty: number, speed: number, loft: number, kind: PassKind, aimNoise: number): void {
    const b = this.b;
    const dx = tx - b.x;
    const dy = ty - b.y;
    const d = Math.sqrt(dx * dx + dy * dy) + 1e-6;
    const ang = Math.atan2(dy, dx) + (this.rng.next() - 0.5) * 2 * aimNoise;
    const err = 1 + (this.rng.next() - 0.5) * 0.12;
    b.vx = Math.cos(ang) * speed * err;
    b.vy = Math.sin(ang) * speed * err;
    const t = d / (speed * 0.9);
    b.vz = loft > 0 ? (GRAV * t) / 2 * loft : 0;
    this.flightLeft = t;
    this.carrier = -1;
    this.passer = this.M.indexOf(c);
    this.lastTouch = this.passer;
    this.lastTouchTeam = c.team;
    this.passKind = kind;
    c.cool = 0.4;
  }

  private pass(i: number, j: number, kind: PassKind, risk: number): void {
    const c = this.M[i];
    const r = this.M[j];
    const dir = c.team === 0 ? 1 : -1;
    // The pass is played to where the receiver is going (into space for a ball in behind).
    const d0 = dist(c.x, c.y, r.x, r.y);
    const speed = clamp(11 + d0 * 0.42 + (kind === "through" ? 3 : 0), 11, 27);
    const flight = d0 / (speed * 0.9);
    const lead = kind === "through" ? 0.85 : 0.5;
    const tx = clamp(r.x + r.vx * flight * lead + (kind === "through" ? dir * 3 : 0), 1, L - 1);
    const ty = clamp(r.y + r.vy * flight * lead, 1, W - 1);
    // How true: his passing, the man on him, and how far.
    const pressure = this.pressureOn(i);
    const skill = c.sk.passing * 0.7 + c.sk.technique * 0.3;
    const noise = clamp((105 - skill) * 0.0008 * (1 + pressure * 0.4) * (1 + d0 / 50) * (kind === "long" ? 1.35 : 1), 0.01, 0.3);
    this.stats.passes[c.team]++;
    // Offside: judged the moment it is played.
    const line = this.offsideLine(c.team);
    const beyond = (c.team === 0 ? r.x > line + 0.15 && r.x > c.x && r.x > L / 2 : r.x < line - 0.15 && r.x < c.x && r.x < L / 2);
    if (beyond && this.rng.next() < 0.9) {
      this.stats.offsides[c.team]++;
      r.perf.offsides++;
      this.events.push({t: "offside", team: c.team, player: r.id});
      this.carrier = -1;
      this.b.vx = this.b.vy = 0;
      this.b.x = r.x;
      this.b.y = r.y;
      this.passTarget = -1;
      this.pending = {kind: "freekick", team: c.team === 0 ? 1 : 0, x: r.x, y: r.y};
      this.hold = 2.5;
      this.lastTouchTeam = c.team;
      return;
    }
    if (kind === "long") this.lastPassFlight = "long";
    this.strike(c, tx, ty, speed, kind === "long" ? 1 : kind === "through" ? 0.1 : 0, kind, noise);
    this.passTarget = j;
    void risk;
    this.lastAssist = c.id;
    this.lastAssistKind = kind;
    this.lastAssistT = this.t;
    this.fromByline = Math.abs(c.x - (c.team === 0 ? L : 0)) < 8 && Math.abs(c.y - W / 2) > 18;
  }

  private cross(i: number): void {
    const c = this.M[i];
    const team = c.team;
    const goalX = team === 0 ? L : 0;
    const dir = team === 0 ? 1 : -1;
    // Where: near post, the penalty spot or the far post, towards the best of the men in the box.
    const mates = this.M.map((m, k) => ({m, k})).filter(({m}) => m.team === team && m.sk.pos !== "GK" && m.id !== c.id && Math.abs(m.x - goalX) < 20 && Math.abs(m.y - W / 2) < 18);
    if (mates.length === 0) return;
    const target = mates.sort((a, b) => b.m.sk.aerial - a.m.sk.aerial)[0];
    const spotX = goalX - dir * (7 + this.rng.next() * 3);
    const spotY = clamp(target.m.y + (W / 2 - target.m.y) * 0.2, W / 2 - 9, W / 2 + 9);
    const pressure = this.pressureOn(i);
    const noise = clamp((105 - c.sk.passing) * 0.0016 * (1 + pressure * 0.4), 0.02, 0.28);
    const d0 = dist(c.x, c.y, spotX, spotY);
    this.stats.passes[team]++;
    this.lastPassFlight = "cross";
    this.strike(c, spotX, spotY, clamp(14 + d0 * 0.35, 14, 25), 1.15, "cross", noise);
    this.passTarget = -1;
    this.passer = i;
    this.lastAssist = c.id;
    this.lastAssistKind = "cross";
    this.lastAssistT = this.t;
    this.fromByline = Math.abs(c.x - goalX) < 12;
    // The cross lands in the box: who wins it.
    this.aerialAt = {x: spotX, y: spotY, team, t: this.t + d0 / (clamp(14 + d0 * 0.35, 14, 25) * 0.9)};
  }

  private aerialAt: {x: number; y: number; team: 0 | 1; t: number} | null = null;

  /** A cross comes down: the attackers and the defenders near it jump for it, and the keeper may come for it. */
  private resolveAerial(): void {
    const a = this.aerialAt;
    if (!a) return;
    this.aerialAt = null;
    const goalX = a.team === 0 ? L : 0;
    const cands = this.M.map((m, k) => ({m, k, d: dist(m.x, m.y, a.x, a.y)})).filter((o) => o.d < 4.5 && o.m.sk.pos !== "GK");
    const keeperIdx = this.M.findIndex((m) => m.team !== a.team && m.sk.pos === "GK");
    const keeper = this.M[keeperIdx];
    if (keeper && dist(keeper.x, keeper.y, a.x, a.y) < 5 && this.rng.next() < clamp(0.12 + keeper.sk.keeping * 0.0045, 0.1, 0.55)) {
      // The keeper comes and takes it.
      keeper.perf.saves++;
      this.b.vx = this.b.vy = this.b.vz = 0;
      this.carrier = keeperIdx;
      this.passTarget = -1;
      this.lastTouch = keeperIdx;
      this.lastTouchTeam = keeper.team;
      this.carryX = keeper.x;
      this.carryY = keeper.y;
      this.frame("save", keeper, keeper.x / 1.05, keeper.y / 0.68, this.sideOf(keeper.team));
      return;
    }
    if (cands.length === 0) {
      this.passTarget = -1;
      return;
    }
    let win = cands[0];
    let ws = -1e9;
    for (const o of cands) {
      const s = o.m.sk.aerial * 0.8 + o.m.sk.strength * 0.2 - o.d * 4 + this.rng.next() * 22 + (o.m.team !== a.team ? 4 : 0);
      if (s > ws) { ws = s; win = o; }
    }
    win.m.perf.headers++;
    if (win.m.team === a.team) {
      // Met by an attacker: a header at goal.
      this.carrier = win.k;
      this.lastTouch = win.k;
      this.lastTouchTeam = win.m.team;
      this.b.vx = this.b.vy = this.b.vz = 0;
      this.passTarget = -1;
      this.carryX = win.m.x;
      this.carryY = win.m.y;
      this.takeShot(win.k, this.pressureOn(win.k), "header");
    } else {
      // Cleared: out of the box, to no one in particular.
      this.carrier = -1;
      this.passTarget = -1;
      this.lastTouch = win.k;
      this.lastTouchTeam = win.m.team;
      const away = win.m.team === 0 ? 1 : -1;
      this.b.x = win.m.x;
      this.b.y = win.m.y;
      this.b.vx = away * (9 + this.rng.next() * 6);
      this.b.vy = (this.rng.next() - 0.5) * 12;
      this.b.vz = 4 + this.rng.next() * 3;
      this.frame("tackle", win.m, win.m.x / 1.05, win.m.y / 0.68, this.sideOf(win.m.team));
      void goalX;
    }
  }

  // ---- shots ----

  private shotKind(i: number, force?: ChanceKind): ChanceKind {
    if (force) return force;
    const c = this.M[i];
    const goalX = c.team === 0 ? L : 0;
    const dGoal = dist(c.x, c.y, goalX, W / 2);
    const recent = this.t - this.lastAssistT < 4;
    if (recent && this.lastAssistKind === "through" && dGoal < 22) return "through";
    if (recent && this.fromByline && dGoal < 20) return "cutback";
    if (dGoal < 8) return "close";
    if (Math.abs(c.x - goalX) < BOX_DEPTH && Math.abs(c.y - W / 2) < BOX_HALF) return "box";
    return "long";
  }

  private shotXg(i: number, pressure: number, force?: ChanceKind): number {
    const c = this.M[i];
    const goalX = c.team === 0 ? L : 0;
    const depth = (c.team === 0 ? c.x : L - c.x) / 1.05;
    const width = (c.team === 0 ? c.y : W - c.y) / 0.68;
    void goalX;
    return chanceXg(this.shotKind(i, force), depth, width) * (1 - 0.22 * Math.min(1, pressure));
  }

  private takeShot(i: number, pressure: number, force?: ChanceKind): void {
    const c = this.M[i];
    const team = c.team;
    const dir = team === 0 ? 1 : -1;
    const goalX = team === 0 ? L : 0;
    const kind = this.shotKind(i, force);
    const xgBase = this.shotXg(i, pressure, force);
    const keeperIdx = this.M.findIndex((m) => m.team !== team && m.sk.pos === "GK");
    const keeper = this.M[keeperIdx];
    // His finishing against the keeper, and whether anyone gets a leg in the way.
    const finishing = c.sk.finishing * 0.75 + c.sk.technique * 0.2 + c.sk.vision * 0.05;
    const duel = clamp(1 + (finishing - (keeper?.sk.keeping ?? 30)) / 130, 0.6, 1.6);
    const urgency = this.urgency[team];
    let blocker = -1;
    for (let k = 0; k < this.M.length; k++) {
      const o = this.M[k];
      if (o.team === team || o.sk.pos === "GK") continue;
      const dx = goalX - c.x;
      const dy = W / 2 - c.y;
      const d = Math.sqrt(dx * dx + dy * dy) + 1e-6;
      const ex = o.x - c.x;
      const ey = o.y - c.y;
      const u = ((ex * dx + ey * dy) / (d * d));
      if (u < 0.02 || u > 0.7) continue;
      const q = Math.abs(ex * dy - ey * dx) / d;
      if (q < 1.1 && Math.hypot(ex, ey) < 9 && this.rng.next() < 0.45) { blocker = k; break; }
    }
    c.perf.shots++;
    this.stats.shots[team]++;
    const pGoal = clamp(xgBase * duel * 0.85 * (1 + urgency * 0.06), 0.01, 0.92);
    this.stats.xg[team] += pGoal;
    let pOT = clamp(0.2 + xgBase * 1.0 + (finishing - 50) / 300, 0.12, 0.85);
    pOT = Math.max(pOT, Math.min(0.97, pGoal / 0.85));
    let result: "goal" | "saved" | "missed" | "blocked";
    if (blocker >= 0) result = "blocked";
    else if (this.rng.next() < pOT) {
      this.stats.onTarget[team]++;
      result = this.rng.next() < clamp(pGoal / pOT, 0.02, 0.95) ? "goal" : "saved";
    } else result = "missed";
    // The ball: struck at the goal (or wide of it), it takes a moment to get there.
    const ty = result === "goal" || result === "saved" ? W / 2 + (this.rng.next() - 0.5) * 2 * GOAL_HALF * 0.85 : W / 2 + (this.rng.next() < 0.5 ? -1 : 1) * (GOAL_HALF + 0.8 + this.rng.next() * 3);
    const speed = 22 + c.sk.finishing * 0.07;
    const d0 = dist(c.x, c.y, goalX, ty);
    const flight = d0 / (speed * 0.95);
    // A frame for the one who shoots (if he has not had one), then the shot.
    if (this.lastFrame.idx !== i) this.frame(this.lastAssistT > this.t - 4 ? "pass" : "dribble", c, c.x / 1.05, c.y / 0.68, this.sideOf(team));
    this.lastPassFlight = undefined;
    this.strike(c, goalX, ty, speed, 0.3, "ground", 0.0);
    this.passTarget = -1;
    this.flightLeft = flight;
    this.shotAt = this.t + flight;
    const assist = this.t - this.lastAssistT < 5 && this.lastAssist && this.lastAssist !== c.id ? this.lastAssist : undefined;
    this.shot = {team, shooter: i, result, xg: pGoal, kind, keeper: keeperIdx, blocker, ty, assist};
    void dir;
  }

  private resolveShot(): void {
    const s = this.shot!;
    this.shot = null;
    const shooter = this.M[s.shooter];
    const team = s.team;
    const goalX = team === 0 ? L : 0;
    const xPct = (team === 0 ? L : 0) / 1.05;
    this.events.push({t: "shot", team, shooter: shooter.id, result: s.result, xg: s.xg, kind: s.kind, keeper: this.M[s.keeper]?.id, blocker: this.M[s.blocker]?.id});
    if (s.result === "goal") {
      this.stats.goals[team]++;
      this.frame("goal", undefined, xPct, s.ty / 0.68, this.sideOf(team), {chance: s.kind}, 0.8);
      this.events.push({t: "goal", team, scorer: shooter.id, assist: s.assist, xg: s.xg, kind: s.kind});
      this.b.x = goalX + (team === 0 ? 1.5 : -1.5);
      this.b.y = s.ty;
      this.b.vx = this.b.vy = 0;
      this.carrier = -1;
      this.passTarget = -1;
      this.pending = {kind: "kickoff", team: team === 0 ? 1 : 0, x: L / 2, y: W / 2};
      this.hold = 9;
      this.lastTouchTeam = team;
    } else if (s.result === "saved") {
      const k = this.M[s.keeper];
      if (k) k.perf.saves++;
      // Held, parried back into play, or turned round the post.
      const r = this.rng.next();
      if (r < 0.58 && k) {
        this.frame("save", k, (team === 0 ? 98 : 2), s.ty / 0.68, this.sideOf(k.team), {chance: s.kind}, 0.8);
        this.carrier = s.keeper;
        this.passTarget = -1;
        this.lastTouch = s.keeper;
        this.lastTouchTeam = k.team;
        this.b.x = k.x;
        this.b.y = k.y;
        this.b.vx = this.b.vy = 0;
        this.carryX = k.x + (k.team === 0 ? 5 : -5);
        this.carryY = W / 2;
        this.think = 1.4;
      } else if (r < 0.74 && k) {
        // A rebound: loose in the box, for whoever is first.
        this.frame("save", k, (team === 0 ? 98 : 2), s.ty / 0.68, this.sideOf(k.team), {chance: s.kind}, 0.8);
        this.carrier = -1;
        this.passTarget = -1;
        this.lastTouch = s.keeper;
        this.lastTouchTeam = k.team;
        this.b.x = goalX - (team === 0 ? 4 : -4) + (this.rng.next() - 0.5) * 3;
        this.b.y = clamp(s.ty + (this.rng.next() - 0.5) * 8, 20, 48);
        this.b.vx = (team === 0 ? -1 : 1) * (2 + this.rng.next() * 4);
        this.b.vy = (this.rng.next() - 0.5) * 6;
        this.b.vz = 0;
      } else {
        // Turned behind: a corner.
        this.cornerFor(team, s.ty);
      }
    } else if (s.result === "blocked") {
      const o = this.M[s.blocker];
      if (o) {
        o.perf.intercept++;
        this.frame("tackle", o, o.x / 1.05, o.y / 0.68, this.sideOf(o.team), {chance: s.kind}, 0.8);
        // Off him: loose, or behind for a corner.
        if (this.rng.next() < 0.4) {
          this.cornerFor(team, o.y);
        } else {
          this.carrier = -1;
          this.passTarget = -1;
          this.lastTouch = s.blocker;
          this.lastTouchTeam = o.team;
          this.b.x = o.x;
          this.b.y = o.y;
          this.b.vx = (team === 0 ? -1 : 1) * (3 + this.rng.next() * 5);
          this.b.vy = (this.rng.next() - 0.5) * 8;
          this.b.vz = 0;
        }
      }
    } else {
      // Wide or over: out behind the goal (a goal kick), now and then off a defender for a corner.
      if (this.rng.next() < 0.2) this.cornerFor(team, s.ty);
      else {
        this.frame("out", undefined, xPct, clamp(s.ty / 0.68, 4, 96), this.sideOf(team), {chance: s.kind}, 0.8);
        this.goalKickFor(team === 0 ? 1 : 0);
      }
    }
  }

  private cornerFor(team: 0 | 1, y: number): void {
    const xPct = team === 0 ? 100 : 0;
    const top = y < W / 2;
    this.frame("out", undefined, xPct, top ? 3 : 97, this.sideOf(team), undefined, 0.8);
    this.stats.corners[team]++;
    this.carrier = -1;
    this.b.vx = this.b.vy = this.b.vz = 0;
    this.waiting = true;
    this.events.push({t: "setpiece", kind: "corner", team, x: xPct, y: top ? 1 : 99});
  }

  private goalKickFor(team: 0 | 1): void {
    this.carrier = -1;
    this.passTarget = -1;
    this.b.vx = this.b.vy = this.b.vz = 0;
    this.pending = {kind: "goalkick", team, x: team === 0 ? 5.5 : L - 5.5, y: W / 2};
    this.b.x = this.pending.x;
    this.b.y = this.pending.y;
    this.hold = 3;
  }

  // ---- out of play ----

  private outOfPlay(): boolean {
    const b = this.b;
    if (b.x >= 0 && b.x <= L && b.y >= 0 && b.y <= W) return false;
    if (this.shot) return false;
    const by = this.lastTouchTeam;
    if (b.y < 0 || b.y > W) {
      // A throw-in for the other side.
      const t: 0 | 1 = by === 0 ? 1 : 0;
      const x = clamp(b.x, 1, L - 1);
      const y = b.y < 0 ? 0 : W;
      this.frame("out", undefined, x / 1.05, y / 0.68, this.sideOf(by));
      this.stats.possession[t] += 0;
      this.carrier = -1;
      this.passTarget = -1;
      this.b.x = x;
      this.b.y = y;
      this.b.vx = this.b.vy = this.b.vz = 0;
      this.b.z = 0;
      this.pending = {kind: "throwin", team: t, x, y};
      this.hold = 2.5;
      return true;
    }
    // Over a goal line: a corner if the defenders put it there, otherwise a goal kick.
    const goalSide: 0 | 1 = b.x > L ? 0 : 1; // the side that attacks this goal
    const defendingTeam: 0 | 1 = goalSide === 0 ? 1 : 0;
    if (by === defendingTeam) this.cornerFor(goalSide, b.y);
    else {
      this.frame("out", undefined, b.x > L ? 100 : 0, clamp(b.y / 0.68, 4, 96), this.sideOf(by));
      this.goalKickFor(defendingTeam);
    }
    return true;
  }

  /** The wait after a restart is over: the ball is played. */
  private afterHold(): void {
    const p = this.pending;
    this.pending = null;
    if (!p) return;
    if (p.kind === "kickoff") {
      this.kickoff(p.team);
      return;
    }
    // The nearest of the side to the place takes it (the keeper for a goal kick).
    let best = -1;
    let bd = 1e9;
    this.M.forEach((m, i) => {
      if (m.team !== p.team) return;
      if (p.kind === "goalkick" ? m.sk.pos !== "GK" : m.sk.pos === "GK") return;
      const d = dist(m.x, m.y, p.x, p.y);
      if (d < bd) { bd = d; best = i; }
    });
    const m = this.M[best];
    if (!m) return;
    m.x = p.x;
    m.y = p.y;
    m.vx = m.vy = 0;
    this.b.x = p.x;
    this.b.y = p.y;
    this.carrier = best;
    this.lastTouch = best;
    this.lastTouchTeam = m.team;
    this.passTarget = -1;
    this.carryX = m.x;
    this.carryY = m.y;
    this.think = 0.5;
    const kind: TouchKind | null = p.kind === "throwin" ? "throwin" : p.kind === "goalkick" ? "goalkick" : null;
    if (kind) this.frame(kind, m, m.x / 1.05, m.y / 0.68, this.sideOf(m.team));
  }

  // ---- after a set piece the caller took ----

  /** The caller has dealt with a set piece (it was played out as frames and a result): play goes on. */
  resume(result: "goal" | "saved" | "missed" | "blocked" | "cleared", team: 0 | 1): void {
    this.waiting = false;
    const other: 0 | 1 = team === 0 ? 1 : 0;
    this.shot = null;
    this.carrier = -1;
    this.passTarget = -1;
    if (result === "goal") {
      this.stats.goals[team]++;
      this.pending = {kind: "kickoff", team: other, x: L / 2, y: W / 2};
      this.hold = 9;
    } else if (result === "saved") {
      const k = this.M.findIndex((m) => m.team === other && m.sk.pos === "GK");
      if (k >= 0) {
        const m = this.M[k];
        const gx = team === 0 ? L : 0;
        m.x = gx + (team === 0 ? -3 : 3);
        m.y = W / 2;
        this.b.x = m.x;
        this.b.y = m.y;
        this.carrier = k;
        this.lastTouch = k;
        this.lastTouchTeam = other;
        this.carryX = m.x + (team === 0 ? -4 : 4);
        this.carryY = W / 2;
        this.think = 1.2;
        this.frame("dribble", m, m.x / 1.05, m.y / 0.68, this.sideOf(other));
      }
    } else if (result === "missed") {
      this.goalKickFor(other);
    } else {
      // Blocked or cleared: the defenders have it, out of the box.
      const gx = team === 0 ? L : 0;
      this.b.x = gx + (team === 0 ? -18 : 18);
      this.b.y = W / 2 + (this.rng.next() - 0.5) * 20;
      this.lastTouchTeam = other;
      let best = -1;
      let bd = 1e9;
      this.M.forEach((m, i) => {
        if (m.team !== other || m.sk.pos === "GK") return;
        const d = dist(m.x, m.y, this.b.x, this.b.y);
        if (d < bd) { bd = d; best = i; }
      });
      if (best >= 0) {
        this.carrier = best;
        this.lastTouch = best;
        const m = this.M[best];
        m.x = this.b.x;
        m.y = this.b.y;
        this.carryX = m.x + (other === 0 ? 8 : -8);
        this.carryY = m.y;
        this.think = 0.6;
      }
    }
  }

  /** The players' positions now (for the caller drawing a set piece). */
  nearestOf(team: 0 | 1, x: number, y: number, notGk = true): string | undefined {
    let best: Mover | undefined;
    let bd = 1e9;
    for (const m of this.M) {
      if (m.team !== team || (notGk && m.sk.pos === "GK")) continue;
      const d = dist(m.x, m.y, x * 1.05, y * 0.68);
      if (d < bd) { bd = d; best = m; }
    }
    return best?.id;
  }

  /** A frame the caller adds (the set piece being taken and what came of it). */
  addFrame(kind: TouchKind, playerId: string | undefined, xPct: number, yPct: number, possession: Side, extra?: Partial<Frame>): void {
    const m = playerId ? this.M.find((q) => q.id === playerId) : undefined;
    this.frame(kind, m, xPct, yPct, possession, extra, 0.8);
  }

  /** Time passes without play (the minute's end while the caller deals with something): keeps the clock. */
  clockTo(seconds: number): void {
    if (seconds > this.t) this.t = seconds;
  }
}
