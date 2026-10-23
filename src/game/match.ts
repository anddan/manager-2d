// Match simulation. Minute by minute, the midfield decides who has the ball,
// attack against defence decides chances, and the shooter against the keeper
// decides goals. Everything is driven by effective ratings, so lineup,
// formation, mentality, form, fitness and morale all matter.
import {DIAMONDS_PER_WIN, FORMATIONS, MAX_SUBS, type Slot} from "./constants";
import {book} from "./helpers";
import {isAvailable} from "./lineup";
import {distance, fromSide, progressFor, teamSpot, type Point} from "./pitch";
import {effectiveRating} from "./ratings";
import {Rng, clamp} from "./rng";
import {
  FREEKICK_RATE,
  PENALTY_RATE,
  pickTaker,
  resolveSetPiece,
  type Aim,
  type SetPiece,
  type SetPieceInput,
  type SetPieceKind,
} from "./setpieces";
import type {
  Club,
  Fixture,
  Frame,
  GameState,
  MatchEvent,
  MatchReport,
  Mentality,
  Player,
  Position,
  Side,
  TouchKind,
} from "./types";

/** How much a slot adds to [defence, midfield, attack]. */
const LINE_WEIGHTS: Record<Position, [number, number, number]> = {
  GK: [0, 0, 0],
  CB: [1, 0.1, 0],
  FB: [0.7, 0.25, 0.15],
  DM: [0.55, 0.5, 0],
  CM: [0.15, 0.85, 0.15],
  AM: [0, 0.45, 0.6],
  W: [0.1, 0.35, 0.65],
  ST: [0, 0.1, 1],
};
// Divisors so a typical eleven scores about its average rating per line.
const LINE_NORM: [number, number, number] = [3.9, 3.3, 3.6];

const MENTALITY: Record<Mentality, {def: number; att: number}> = {
  defensive: {def: 1.08, att: 0.9},
  balanced: {def: 1, att: 1},
  attacking: {def: 0.92, att: 1.09},
};

const HOME_ADVANTAGE = 1.05;
const CHANCE_BASE = 0.34;

interface OnPitch {
  id: string;
  slot: number;
}

interface Team {
  side: Side;
  club: Club;
  slots: Slot[];
  onPitch: OnPitch[];
  bench: string[];
  subsLeft: number;
  booked: Set<string>;
  shots: number;
  onTarget: number;
  goals: number;
}

function buildTeam(state: GameState, club: Club, side: Side): Team {
  const slots = FORMATIONS[club.formation];
  const onPitch = club.lineup
    .map((id, slot) => ({id, slot}))
    .filter(({id}) => state.players[id] && isAvailable(state.players[id]));
  return {
    side,
    club,
    slots,
    onPitch,
    bench: club.bench.filter((id) => state.players[id] && isAvailable(state.players[id])),
    subsLeft: MAX_SUBS,
    booked: new Set(),
    shots: 0,
    onTarget: 0,
    goals: 0,
  };
}

function lines(state: GameState, team: Team, home: boolean): {def: number; mid: number; att: number; gk: number} {
  const sums = [0, 0, 0];
  let gk = 20; // An empty goal is nearly hopeless.
  for (const {id, slot} of team.onPitch) {
    const pos = team.slots[slot].pos;
    const rating = effectiveRating(state.players[id], pos);
    if (pos === "GK") gk = rating;
    const w = LINE_WEIGHTS[pos];
    for (let i = 0; i < 3; i++) sums[i] += rating * w[i];
  }
  const m = MENTALITY[team.club.mentality];
  const h = home ? HOME_ADVANTAGE : 1;
  return {
    def: (sums[0] / LINE_NORM[0]) * m.def * h,
    mid: (sums[1] / LINE_NORM[1]) * h,
    att: (sums[2] / LINE_NORM[2]) * m.att * h,
    gk: gk * h,
  };
}

const SHOOTER_WEIGHT: Record<Position, number> = {GK: 0, CB: 0.4, FB: 0.4, DM: 0.5, CM: 1.2, AM: 3, W: 2.5, ST: 5};
const ASSIST_WEIGHT: Record<Position, number> = {GK: 0.05, CB: 0.4, FB: 1.5, DM: 1.2, CM: 3, AM: 4, W: 3.5, ST: 2};
const FOUL_WEIGHT: Record<Position, number> = {GK: 0.2, CB: 3, FB: 2, DM: 3, CM: 2, AM: 1, W: 1, ST: 1};

function shotSkill(p: Player): number {
  const raw = p.attrs.finishing * 0.65 + p.attrs.technique * 0.2 + p.attrs.vision * 0.15;
  return raw * (0.8 + 0.2 * (p.fitness / 100)) * (0.93 + 0.14 * (p.form / 100));
}

/** Picks a player on the pitch weighted by slot position and an attribute. */
function pickOnPitch(
  rng: Rng,
  state: GameState,
  team: Team,
  weights: Record<Position, number>,
  attr: (p: Player) => number,
  exclude?: string
): OnPitch | undefined {
  const pool = team.onPitch.filter((o) => o.id !== exclude);
  if (pool.length === 0) return undefined;
  return rng.weighted(pool, (o) => weights[team.slots[o.slot].pos] * attr(state.players[o.id]));
}

/** Best bench player for a slot, by today's rating there. */
function bestSub(state: GameState, team: Team, pos: Position): string | undefined {
  let best: string | undefined;
  let score = -1;
  for (const id of team.bench) {
    const s = effectiveRating(state.players[id], pos);
    if (s > score) {
      score = s;
      best = id;
    }
  }
  return best;
}

interface SimContext {
  state: GameState;
  rng: Rng;
  events: MatchEvent[];
  ratings: Record<string, number>;
  minutes: Record<string, {on: number; off: number}>;
  sentOff: Set<string>;
}

function substitute(ctx: SimContext, team: Team, out: OnPitch, minute: number): boolean {
  if (team.subsLeft <= 0) return false;
  const inId = bestSub(ctx.state, team, team.slots[out.slot].pos);
  if (!inId) return false;
  team.bench = team.bench.filter((id) => id !== inId);
  team.onPitch = team.onPitch.map((o) => (o === out ? {id: inId, slot: out.slot} : o));
  team.subsLeft--;
  ctx.minutes[out.id].off = minute;
  ctx.minutes[inId] = {on: minute, off: 90};
  ctx.ratings[inId] = 6;
  ctx.events.push({minute, type: "sub", side: team.side, playerId: out.id, otherId: inId});
  return true;
}

function removePlayer(team: Team, id: string): void {
  team.onPitch = team.onPitch.filter((o) => o.id !== id);
}

type ShotOutcome =
  | {type: "none"}
  | {type: "goal"; shooterId: string; assistId?: string; setPiece?: SetPieceShot}
  | {type: "saved"; shooterId: string; keeperId?: string; setPiece?: SetPieceShot}
  | {type: "missed"; shooterId: string; setPiece?: SetPieceShot}
  | {type: "blocked"; shooterId: string; setPiece: SetPieceShot};

/** How a set piece went, for drawing it in the replay. */
interface SetPieceShot {
  kind: SetPieceKind;
  shot: Aim;
  dive: number;
  wallSide: -1 | 1;
}

/** Half the goal's width in pitch units (7.32 m of a 68 m wide pitch, scaled to 100). */
const GOAL_HALF_WIDTH = 5.4;

/**
 * Builds the replay. Each minute becomes a short chain of touches between real
 * players, ending in that minute's shot if there was one. Passes go to
 * teammates further up the pitch, weighted by vision; quick, technical
 * players carry the ball themselves more often.
 */
class Replay {
  frames: Frame[] = [];
  private ball: Point = {x: 50, y: 50};
  private carrier: {id: string; side: Side} | null = null;
  /** After a goal the other side kicks off; after a miss, a goal kick. */
  private restart: {side: Side; kind: "kickoff" | "goalKick"} | null = {side: "home", kind: "kickoff"};
  private state: GameState;
  private rng: Rng;

  constructor(state: GameState, rng: Rng) {
    this.state = state;
    this.rng = rng;
  }

  private spot(team: Team, id: string, inPossession: boolean): Point {
    const o = team.onPitch.find((p) => p.id === id);
    return o ? teamSpot(team.slots[o.slot], team.side, this.ball, inPossession) : this.ball;
  }

  private nearest(team: Team, to: Point, inPossession: boolean): string | undefined {
    let best: string | undefined;
    let bestDistance = Infinity;
    for (const o of team.onPitch) {
      if (team.slots[o.slot].pos === "GK") continue;
      const d = distance(teamSpot(team.slots[o.slot], team.side, this.ball, inPossession), to);
      if (d < bestDistance) {
        bestDistance = d;
        best = o.id;
      }
    }
    return best;
  }

  private keeper(team: Team): string | undefined {
    return team.onPitch.find((o) => team.slots[o.slot].pos === "GK")?.id;
  }

  private jitter(p: Point, amount: number): Point {
    return {
      x: clamp(p.x + this.rng.range(-amount, amount), 1, 99),
      y: clamp(p.y + this.rng.range(-amount, amount), 2, 98),
    };
  }

  /** A teammate to pass to: usually someone a bit further up the pitch. */
  private receiver(team: Team, from: string): string | undefined {
    const progress = progressFor(team.side, this.ball.x);
    const aim = progress + this.rng.range(-5, 22);
    const options = team.onPitch.filter((o) => o.id !== from && (team.slots[o.slot].pos !== "GK" || progress < 25));
    if (options.length === 0) return undefined;
    return this.rng.weighted(options, (o) => {
      const depth = progressFor(team.side, teamSpot(team.slots[o.slot], team.side, this.ball, true).x);
      return Math.exp(-Math.abs(depth - aim) / 14) * (0.5 + this.state.players[o.id].attrs.vision / 100);
    }).id;
  }

  private dribbles(team: Team, id: string): boolean {
    const o = team.onPitch.find((p) => p.id === id);
    if (!o || team.slots[o.slot].pos === "GK" || team.slots[o.slot].pos === "CB") return false;
    const {technique, pace} = this.state.players[id].attrs;
    return this.rng.chance(clamp(0.08 + (technique + pace - 110) / 300, 0.03, 0.4));
  }

  minute(minute: number, attacking: Team, defending: Team, outcome: ShotOutcome): void {
    const side = attacking.side;
    const touches: Frame[] = [];
    const add = (kind: TouchKind, id: string | undefined, at: Point, touchSide: Side = side) => {
      touches.push({minute: 0, x: at.x, y: at.y, possession: touchSide, playerId: id, kind});
      this.ball = at;
      if (id) this.carrier = {id, side: touchSide};
    };

    if (this.restart) {
      const team = this.restart.side === side ? attacking : defending;
      if (this.restart.kind === "kickoff") {
        this.ball = {x: 50, y: 50};
        add("kickoff", this.nearest(team, this.ball, true), {x: 50, y: 50}, team.side);
      } else {
        add("pass", this.keeper(team), fromSide(team.side, 6, 50), team.side);
      }
      this.restart = null;
    }

    // The side that has it now won the ball back: their nearest player.
    if (this.carrier && this.carrier.side !== side) {
      add("tackle", this.nearest(attacking, this.ball, false), this.jitter(this.ball, 3));
    }
    let carrier = this.carrier?.side === side ? this.carrier.id : this.nearest(attacking, this.ball, true);
    if (!carrier) return;

    const passes = outcome.type === "none" ? this.rng.int(1, 3) : outcome.setPiece ? 0 : this.rng.int(0, 2);
    for (let i = 0; i < passes; i++) {
      if (this.dribbles(attacking, carrier)) {
        // Faster players get further with the ball.
        const depth = progressFor(side, this.ball.x) + this.rng.range(6, 10) + this.state.players[carrier].attrs.pace / 15;
        const width = (side === "home" ? this.ball.y : 100 - this.ball.y) + this.rng.range(-8, 8);
        add("dribble", carrier, fromSide(side, clamp(depth, 5, 88), clamp(width, 5, 95)));
        continue;
      }
      const next = this.receiver(attacking, carrier);
      if (!next) break;
      add("pass", next, this.jitter(this.spot(attacking, next, true), 4));
      carrier = next;
    }

    if (outcome.type !== "none" && outcome.setPiece) {
      // The taker places the ball, then the shot goes where it actually went.
      const sp = outcome.setPiece;
      const spot = sp.kind === "penalty"
        ? fromSide(side, 89.5, 50)
        : fromSide(side, this.rng.range(72, 80), 50 + sp.wallSide * this.rng.range(8, 22));
      add("setpiece", outcome.shooterId, spot);
      const width = (x: number) => clamp(50 - x * GOAL_HALF_WIDTH, 1, 99);
      if (outcome.type === "goal") {
        add("goal", undefined, fromSide(side, 100, width(sp.shot.x)));
        this.carrier = null;
        this.restart = {side: defending.side, kind: "kickoff"};
      } else if (outcome.type === "saved") {
        add("save", outcome.keeperId, fromSide(side, 98, width(sp.dive)), defending.side);
      } else if (outcome.type === "blocked") {
        // Off the wall, and the defenders have it.
        const wallAt = fromSide(side, progressFor(side, spot.x) + 9, side === "home" ? spot.y : 100 - spot.y);
        add("tackle", this.nearest(defending, wallAt, false), wallAt, defending.side);
      } else {
        add("out", undefined, fromSide(side, 100, clamp(50 - sp.shot.x * GOAL_HALF_WIDTH, 30, 70)));
        this.carrier = null;
        this.restart = {side: defending.side, kind: "goalKick"};
      }
    } else if (outcome.type !== "none") {
      const onPitch = (id?: string) => !!id && attacking.onPitch.some((o) => o.id === id);
      if (outcome.type === "goal" && onPitch(outcome.assistId) && outcome.assistId !== carrier) {
        add("pass", outcome.assistId, this.jitter(this.spot(attacking, outcome.assistId!, true), 4));
        carrier = outcome.assistId!;
      }
      const box = fromSide(side, this.rng.range(80, 90), this.rng.range(32, 68));
      add(outcome.shooterId === carrier ? "dribble" : "pass", outcome.shooterId, box);
      if (outcome.type === "goal") {
        add("goal", undefined, fromSide(side, 100, this.rng.range(45, 55)));
        this.carrier = null;
        this.restart = {side: defending.side, kind: "kickoff"};
      } else if (outcome.type === "saved") {
        add("save", outcome.keeperId, fromSide(side, 97, this.rng.range(42, 58)), defending.side);
      } else {
        const wide = this.rng.chance(0.5) ? this.rng.range(30, 40) : this.rng.range(60, 70);
        add("out", undefined, fromSide(side, 100, wide));
        this.carrier = null;
        this.restart = {side: defending.side, kind: "goalKick"};
      }
    }

    // Spread the touches over the minute.
    touches.forEach((t, k) => {
      t.minute = minute - 1 + (k + 0.5) / touches.length;
      this.frames.push(t);
    });
  }
}

/** A match being played. `report` fills in as `run` advances. */
export interface MatchRun {
  report: MatchReport;
  /** Yields at every penalty and dangerous free kick; send the user's input back. */
  run: Generator<SetPiece, MatchReport, SetPieceInput | null | undefined>;
}

/**
 * Sets up a match that can be played step by step. Everything random is drawn
 * from `rng`, so the same seed and the same inputs give the same match.
 */
export function createMatch(state: GameState, rng: Rng, fixture: Fixture, withFrames: boolean): MatchRun {
  const homeClub = state.clubs[fixture.homeId];
  const awayClub = state.clubs[fixture.awayId];
  const home = buildTeam(state, homeClub, "home");
  const away = buildTeam(state, awayClub, "away");
  const ctx: SimContext = {state, rng, events: [], ratings: {}, minutes: {}, sentOff: new Set()};
  for (const team of [home, away]) {
    for (const o of team.onPitch) {
      ctx.ratings[o.id] = 6;
      ctx.minutes[o.id] = {on: 0, off: 90};
    }
  }
  // The replay gets its own random stream, so watching a match never changes
  // its result. The seed is drawn either way to keep the main stream identical.
  const visualSeed = rng.int(1, 2 ** 31 - 1);
  const replay = withFrames ? new Replay(state, new Rng(visualSeed)) : null;
  ctx.events.push({minute: 0, type: "kickoff"});

  const report: MatchReport = {
    fixtureId: fixture.id,
    homeId: homeClub.id,
    awayId: awayClub.id,
    homeGoals: 0,
    awayGoals: 0,
    events: ctx.events,
    frames: replay?.frames ?? [],
    ratings: ctx.ratings,
    possessionHome: 50,
    shots: [0, 0],
    onTarget: [0, 0],
    lineups: {home: homeClub.lineup.slice(), away: awayClub.lineup.slice()},
    formations: {home: homeClub.formation, away: awayClub.formation},
    setPieces: [],
  };

  const rate = (id: string | undefined, delta: number) => {
    if (id && ctx.ratings[id] !== undefined) ctx.ratings[id] += delta;
  };

  function* play(): Generator<SetPiece, MatchReport, SetPieceInput | null | undefined> {
    let homePossession = 0;
    for (let minute = 1; minute <= 90; minute++) {
      if (minute === 46) ctx.events.push({minute: 45, type: "halftime"});
      const h = lines(state, home, true);
      const a = lines(state, away, false);
      const pHome = h.mid ** 3 / (h.mid ** 3 + a.mid ** 3);
      const attacking = rng.chance(pHome) ? home : away;
      const defending = attacking === home ? away : home;
      const att = attacking === home ? h : a;
      const def = attacking === home ? a : h;
      if (attacking === home) homePossession++;

      let outcome: ShotOutcome = {type: "none"};

      const ratio = att.att / Math.max(def.def, 1);
      const pChance = clamp(CHANCE_BASE * ratio ** 2.2, 0.03, 0.55);
      if (rng.chance(pChance)) {
        const shooterSlot = pickOnPitch(rng, state, attacking, SHOOTER_WEIGHT, (p) => p.attrs.finishing / 50);
        if (shooterSlot) {
          const shooter = state.players[shooterSlot.id];
          const skill = shotSkill(shooter);
          attacking.shots++;
          outcome = {type: "missed", shooterId: shooterSlot.id};
          const pOnTarget = clamp(0.3 + (skill - 50) / 180 + (ratio - 1) * 0.15, 0.15, 0.65);
          if (rng.chance(pOnTarget)) {
            attacking.onTarget++;
            rate(shooterSlot.id, 0.1);
            const pGoal = clamp(0.37 + (skill - def.gk) / 150, 0.12, 0.62);
            const keeper = defending.onPitch.find((o) => defending.slots[o.slot].pos === "GK");
            if (rng.chance(pGoal)) {
              attacking.goals++;
              const assist = rng.chance(0.75)
                ? pickOnPitch(rng, state, attacking, ASSIST_WEIGHT, (p) => (p.attrs.passing + p.attrs.vision) / 100, shooterSlot.id)
                : undefined;
              outcome = {type: "goal", shooterId: shooterSlot.id, assistId: assist?.id};
              ctx.events.push({minute, type: "goal", side: attacking.side, playerId: shooterSlot.id, otherId: assist?.id});
              rate(shooterSlot.id, 1);
              rate(assist?.id, 0.6);
              rate(keeper?.id, -0.3);
              for (const o of defending.onPitch) {
                if (["CB", "FB", "DM"].includes(defending.slots[o.slot].pos)) rate(o.id, -0.12);
              }
            } else {
              outcome = {type: "saved", shooterId: shooterSlot.id, keeperId: keeper?.id};
              ctx.events.push({minute, type: "saved", side: attacking.side, playerId: shooterSlot.id, otherId: keeper?.id});
              rate(keeper?.id, 0.3);
            }
          } else if (rng.chance(0.45)) {
            // Only the clearer misses make the feed.
            ctx.events.push({minute, type: "missed", side: attacking.side, playerId: shooterSlot.id});
            rate(shooterSlot.id, -0.05);
          }
        }
      }

      // Penalties and free kicks near the box: the moments the user can take over.
      const roll = rng.next();
      if (outcome.type === "none") {
        const pPenalty = PENALTY_RATE * ratio;
        const kind: SetPieceKind | null = roll < pPenalty ? "penalty" : roll < pPenalty + FREEKICK_RATE * ratio ? "freekick" : null;
        const taker = kind ? pickTaker(attacking.onPitch.map((o) => state.players[o.id]), kind) : undefined;
        if (kind && taker) {
          const keeperSlot = defending.onPitch.find((o) => defending.slots[o.slot].pos === "GK");
          const sp: SetPiece = {
            index: report.setPieces!.length,
            kind,
            minute,
            side: attacking.side,
            takerId: taker.id,
            keeperId: keeperSlot?.id,
            wallSide: rng.chance(0.5) ? -1 : 1,
          };
          ctx.events.push({minute, type: kind, side: attacking.side, playerId: taker.id});
          const input = yield sp;
          const keeper = keeperSlot ? state.players[keeperSlot.id] : undefined;
          const res = resolveSetPiece(rng, sp, input ?? null, taker, keeper);
          report.setPieces!.push({...sp, ...res});
          const setPiece = {kind, shot: res.shot, dive: res.dive, wallSide: sp.wallSide};
          attacking.shots++;
          if (res.result === "goal") {
            attacking.onTarget++;
            attacking.goals++;
            ctx.events.push({minute, type: "goal", side: attacking.side, playerId: taker.id});
            rate(taker.id, 0.9);
            rate(keeper?.id, -0.2);
            outcome = {type: "goal", shooterId: taker.id, setPiece};
          } else if (res.result === "saved") {
            attacking.onTarget++;
            ctx.events.push({minute, type: "saved", side: attacking.side, playerId: taker.id, otherId: keeper?.id});
            rate(keeper?.id, kind === "penalty" ? 0.8 : 0.3);
            rate(taker.id, kind === "penalty" ? -0.5 : 0);
            outcome = {type: "saved", shooterId: taker.id, keeperId: keeper?.id, setPiece};
          } else if (res.result === "missed") {
            ctx.events.push({minute, type: "missed", side: attacking.side, playerId: taker.id});
            rate(taker.id, kind === "penalty" ? -0.6 : -0.05);
            outcome = {type: "missed", shooterId: taker.id, setPiece};
          } else {
            ctx.events.push({minute, type: "blocked", side: attacking.side, playerId: taker.id});
            outcome = {type: "blocked", shooterId: taker.id, setPiece};
          }
        }
      }
      // Drawn before cards and injuries: those players were still on during this minute.
      replay?.minute(minute, attacking, defending, outcome);
      report.homeGoals = home.goals;
      report.awayGoals = away.goals;

      // Cards: the side without the ball fouls more.
      if (rng.chance(0.04)) {
        const team = rng.chance(0.65) ? defending : attacking;
        const fouler = pickOnPitch(rng, state, team, FOUL_WEIGHT, () => 1);
        if (fouler) {
          const straightRed = rng.chance(0.03);
          if (straightRed || team.booked.has(fouler.id)) {
            ctx.events.push({minute, type: "red", side: team.side, playerId: fouler.id});
            rate(fouler.id, -1.5);
            ctx.sentOff.add(fouler.id);
            ctx.minutes[fouler.id].off = minute;
            removePlayer(team, fouler.id);
          } else {
            team.booked.add(fouler.id);
            ctx.events.push({minute, type: "yellow", side: team.side, playerId: fouler.id});
            rate(fouler.id, -0.3);
          }
        }
      }

      // Injuries.
      if (rng.chance(0.003)) {
        const team = rng.chance(0.5) ? home : away;
        const hurt = team.onPitch.length > 0 ? rng.pick(team.onPitch) : undefined;
        if (hurt) {
          const p = state.players[hurt.id];
          p.injuryWeeks = rng.weighted([1, 2, 3, 5, 8, 14], (w) => ({1: 40, 2: 22, 3: 15, 5: 12, 8: 7, 14: 4})[w] ?? 1);
          ctx.events.push({minute, type: "injury", side: team.side, playerId: hurt.id});
          if (!substitute(ctx, team, hurt, minute)) {
            ctx.minutes[hurt.id].off = minute;
            removePlayer(team, hurt.id);
          }
        }
      }

      // Tiring: low stamina and attacking mentality burn more.
      for (const team of [home, away]) {
        const extra = team.club.mentality === "attacking" ? 1.1 : 1;
        for (const o of team.onPitch) {
          const p = state.players[o.id];
          p.fitness = clamp(p.fitness - (0.24 - p.attrs.stamina * 0.0013) * extra, 0, 100);
        }
        // Tactical subs: tired players come off from the hour mark.
        if (minute >= 58 && minute <= 85 && team.subsLeft > 0 && rng.chance(0.25)) {
          const tired = team.onPitch
            .filter((o) => team.slots[o.slot].pos !== "GK")
            .sort((x, y) => state.players[x.id].fitness - state.players[y.id].fitness)[0];
          if (tired && state.players[tired.id].fitness < 70) substitute(ctx, team, tired, minute);
        }
      }
    }
    ctx.events.push({minute: 90, type: "fulltime"});

    // Result and clean-sheet adjustments to ratings.
    for (const [team, other] of [[home, away], [away, home]] as const) {
      const result = team.goals > other.goals ? 0.3 : team.goals < other.goals ? -0.2 : 0;
      for (const id of Object.keys(ctx.minutes)) {
        const p = state.players[id];
        if (p.clubId !== team.club.id) continue;
        rate(id, result + rng.normal(0, 0.35));
        if (other.goals === 0 && ["GK", "CB", "FB"].includes(p.position)) rate(id, 0.4);
      }
    }
    for (const id of Object.keys(ctx.ratings)) {
      ctx.ratings[id] = Math.round(clamp(ctx.ratings[id], 3, 10) * 10) / 10;
    }
    report.possessionHome = Math.round((homePossession / 90) * 100);
    report.shots = [home.shots, away.shots];
    report.onTarget = [home.onTarget, away.onTarget];
    return report;
  }

  return {report, run: play()};
}

/** Plays a whole match at once. Set pieces use `inputs` where given, else the computer decides. */
export function simulateMatch(
  state: GameState,
  rng: Rng,
  fixture: Fixture,
  withFrames: boolean,
  inputs: Record<number, SetPieceInput> = {}
): MatchReport {
  const {run} = createMatch(state, rng, fixture, withFrames);
  let step = run.next();
  while (!step.done) step = run.next(inputs[step.value.index] ?? null);
  return step.value;
}

/** Writes a finished match into the season: table, stats, form, cards, bonuses. */
export function applyMatch(state: GameState, report: MatchReport): void {
  const fixture = state.fixtures.find((f) => f.id === report.fixtureId)!;
  fixture.played = true;
  fixture.homeGoals = report.homeGoals;
  fixture.awayGoals = report.awayGoals;

  const goals: Record<string, number> = {};
  const assists: Record<string, number> = {};
  const sentOff = new Set<string>();
  for (const e of report.events) {
    if (e.type === "goal" && e.playerId) {
      goals[e.playerId] = (goals[e.playerId] ?? 0) + 1;
      if (e.otherId) assists[e.otherId] = (assists[e.otherId] ?? 0) + 1;
    }
    if (e.type === "yellow" && e.playerId) {
      const p = state.players[e.playerId];
      p.stats.yellow++;
      p.yellowCount++;
      // Every fifth yellow is a one-match ban.
      if (p.yellowCount % 5 === 0) p.suspension += 1;
    }
    if (e.type === "red" && e.playerId) {
      state.players[e.playerId].stats.red++;
      sentOff.add(e.playerId);
    }
  }

  for (const [clubId, mine, theirs, lineup] of [
    [report.homeId, report.homeGoals, report.awayGoals, report.lineups.home],
    [report.awayId, report.awayGoals, report.homeGoals, report.lineups.away],
  ] as const) {
    const won = mine > theirs;
    const moraleDelta = won ? 6 : mine === theirs ? 1 : -6;
    let bonuses = 0;
    for (const p of Object.values(state.players)) {
      if (p.clubId !== clubId) continue;
      const rating = report.ratings[p.id];
      const started = lineup.includes(p.id) && rating !== undefined;
      if (rating !== undefined) {
        p.stats.apps++;
        if (started) p.stats.starts++;
        p.stats.ratingSum += rating;
        p.stats.goals += goals[p.id] ?? 0;
        p.stats.assists += assists[p.id] ?? 0;
        p.form = clamp(p.form * 0.65 + clamp(50 + (rating - 6) * 20, 0, 100) * 0.35, 0, 100);
        p.sharpness = clamp(p.sharpness + 14, 0, 100);
        p.morale = clamp(p.morale + moraleDelta + (rating - 6.5) * 2, 0, 100);
        bonuses += p.contract.appearanceBonus + p.contract.goalBonus * (goals[p.id] ?? 0);
      } else {
        p.sharpness = clamp(p.sharpness - 5, 0, 100);
        p.morale = clamp(p.morale + moraleDelta / 2, 0, 100);
        // A ban counts down when the club plays without them.
        if (p.suspension > 0) p.suspension--;
      }
      if (sentOff.has(p.id)) p.suspension += 1;
      p.recentStarts = [...p.recentStarts, started].slice(-5);
    }
    if (bonuses > 0) book(state, clubId, "bonuses", -bonuses);
    if (won && clubId === state.userClubId) state.monetization.diamonds += DIAMONDS_PER_WIN;
  }
}
