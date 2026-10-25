// Match simulation. Minute by minute, the midfield decides who has the ball,
// attack against defence decides chances, and the shooter against the keeper
// decides goals. Everything is driven by effective ratings, so lineup,
// formation, mentality, form, fitness, morale and the manager's instructions
// all matter.
//
// A match is a generator: it pauses before every minute (so the manager's
// substitutions and instructions can come in) and at every set piece (so the
// user can take it). simulateMatch runs one straight through.
import {DIAMONDS_PER_WIN, MAX_SUBS, clubSlots, type Slot} from "./constants";
import {book, findFixture} from "./helpers";
import {isAvailable} from "./lineup";
import {distance, fromSide, progressFor, teamSpot, type Point} from "./pitch";
import {FORM_EFFECT, effectiveRating} from "./ratings";
import {Rng, clamp} from "./rng";
import {
  CORNER_RATE,
  FREEKICK_RATE,
  PENALTY_RATE,
  pickTaker,
  resolveCorner,
  resolveSetPiece,
  type Aim,
  type CornerTarget,
  type SetPiece,
  type SetPieceInput,
  type SetPieceKind,
  type SetPieceOutcome,
} from "./setpieces";
import type {
  Club,
  Fixture,
  Frame,
  GameState,
  InstructionKey,
  InstructionLevel,
  Instructions,
  MatchCommand,
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

const HOME_ADVANTAGE = 1.02;
// Lower than it would be without added time and the frequent set pieces, which add goals of their own.
const CHANCE_BASE = 0.29;
/**
 * How sharply strength differences turn into possession and chances. Kept
 * moderate so teams at about the same level get even matches where both
 * sides score, while a much better side still wins most of the time.
 */
const POSSESSION_POWER = 2.2;
/** On top of midfield strength, how often the side with the ball keeps it into the next minute (fewer turnovers, same possession share). */
const POSSESSION_KEEP = 0.4;
/** A shot on target goes in this often against a keeper as good as the shooter. */
const GOAL_BASE = 0.22;
const CHANCE_POWER = 1.5;

/**
 * What each instruction does, at "more" (+1). "Less" (-1) is the inverse.
 * Line factors scale the player's contribution to defence, midfield and attack.
 */
const INSTRUCTION_EFFECTS: Record<InstructionKey, {line: [number, number, number]; shoot: number; assist: number; foul: number; tire: number}> = {
  passing: {line: [1, 1.04, 1], shoot: 0.8, assist: 1.5, foul: 1, tire: 1},
  dribbling: {line: [1, 1, 1.04], shoot: 1.15, assist: 0.9, foul: 1, tire: 1.06},
  shooting: {line: [1, 1, 1], shoot: 1.8, assist: 0.8, foul: 1, tire: 1},
  tackling: {line: [1.06, 1, 1], shoot: 1, assist: 1, foul: 2.2, tire: 1.05},
  position: {line: [0.9, 1, 1.1], shoot: 1.2, assist: 1, foul: 1, tire: 1.05},
};

interface OnPitch {
  id: string;
  slot: number;
}

export interface Team {
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
  instructions: Record<string, Instructions>;
  /** Orders for the whole team; a player's own orders override them. */
  teamInstructions: Instructions;
  /** Injured players waiting for the manager to bring someone on in their slot. */
  injured: OnPitch[];
  /** Once the manager makes a substitution, the assistant stops making tactical ones. */
  manualSubs: boolean;
}

function buildTeam(state: GameState, club: Club, side: Side): Team {
  const slots = clubSlots(club);
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
    instructions: {},
    teamInstructions: {},
    injured: [],
    manualSubs: false,
  };
}

/** A player's orders: the team's, with their own on top. */
export function ordersFor(team: Team, id: string): Instructions {
  return {...team.teamInstructions, ...team.instructions[id]};
}

function level(team: Team, id: string, key: InstructionKey): InstructionLevel {
  return ordersFor(team, id)[key] ?? 0;
}

/** Product of one effect over a player's instructions; "less" inverts it. */
function effect(team: Team, id: string, pick: (e: (typeof INSTRUCTION_EFFECTS)[InstructionKey]) => number): number {
  let factor = 1;
  for (const [key, lvl] of Object.entries(ordersFor(team, id)) as [InstructionKey, InstructionLevel][]) {
    const value = pick(INSTRUCTION_EFFECTS[key]);
    if (lvl === 1) factor *= value;
    else if (lvl === -1) factor /= value;
  }
  return factor;
}

function lines(state: GameState, team: Team, home: boolean): {def: number; mid: number; att: number; gk: number} {
  const sums = [0, 0, 0];
  let gk = 20; // An empty goal is nearly hopeless.
  for (const {id, slot} of team.onPitch) {
    const pos = team.slots[slot].pos;
    const rating = effectiveRating(state.players[id], pos);
    if (pos === "GK") gk = rating;
    const w = LINE_WEIGHTS[pos];
    for (let i = 0; i < 3; i++) sums[i] += rating * w[i] * effect(team, id, (e) => e.line[i]);
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

function shotSkill(team: Team, p: Player): number {
  const raw = p.attrs.finishing * 0.65 + p.attrs.technique * 0.2 + p.attrs.vision * 0.15;
  // Shooting more means trying from further out; less means only clear chances.
  const choice = [4, 0, -6][level(team, p.id, "shooting") + 1];
  return (raw + choice) * (0.8 + 0.2 * (p.fitness / 100)) * (1 + FORM_EFFECT * (p.form / 50 - 1));
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
export function bestSub(state: GameState, team: Team, pos: Position, exclude: Set<string> = new Set()): string | undefined {
  let best: string | undefined;
  let score = -1;
  for (const id of team.bench) {
    if (exclude.has(id)) continue;
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

function substitute(ctx: SimContext, team: Team, out: OnPitch, minute: number, chosen?: string): boolean {
  if (team.subsLeft <= 0) return false;
  const inId = chosen ?? bestSub(ctx.state, team, team.slots[out.slot].pos);
  if (!inId || !team.bench.includes(inId)) return false;
  team.bench = team.bench.filter((id) => id !== inId);
  if (team.injured.includes(out)) {
    // Comes on for an injured player who has already gone off.
    team.injured = team.injured.filter((o) => o !== out);
    team.onPitch = [...team.onPitch, {id: inId, slot: out.slot}];
  } else {
    team.onPitch = team.onPitch.map((o) => (o === out ? {id: inId, slot: out.slot} : o));
    ctx.minutes[out.id].off = minute;
  }
  team.subsLeft--;
  ctx.minutes[inId] = {on: minute, off: 90};
  ctx.ratings[inId] = 6;
  ctx.events.push({minute, type: "sub", side: team.side, playerId: out.id, otherId: inId});
  return true;
}

function removePlayer(team: Team, id: string): void {
  team.onPitch = team.onPitch.filter((o) => o.id !== id);
}

/** How a set piece went, for drawing it in the replay. */
interface SetPieceShot {
  kind: SetPieceKind;
  spot: Point;
  shot: Aim;
  dive: number;
  wallSide: -1 | 1;
  target?: CornerTarget;
  takerId: string;
  defenderId?: string;
}

type ShotOutcome =
  | {type: "none"}
  | {type: "goal"; shooterId: string; assistId?: string; setPiece?: SetPieceShot}
  /** In the net, but ruled out: offside, a foul or handball. */
  | {type: "disallowed"; shooterId: string; reason: DisallowReason; setPiece?: undefined}
  | {type: "saved"; shooterId: string; keeperId?: string; setPiece?: SetPieceShot}
  | {type: "missed"; shooterId: string; setPiece?: SetPieceShot}
  | {type: "blocked"; shooterId: string; setPiece: SetPieceShot}
  | {type: "cleared"; shooterId: string; setPiece: SetPieceShot};

/** Records one touch of the replay. */
type AddTouch = (kind: TouchKind, id: string | undefined, at: Point, touchSide?: Side, flight?: Frame["flight"]) => void;

/** Share of goals ruled out afterwards (offside, a foul in the build-up, handball). */
const DISALLOWED_CHANCE = 0.07;
/** How often a pass goes back to the player who just passed and ran on (in the replay only). */
const ONE_TWO_CHANCE = 0.22;
/** Share of a minute the build-up to a set piece takes; the kick and what follows get the rest. */
const LEAD_UP_SHARE = 0.68;
export const DISALLOW_REASONS = ["offside", "offside", "foul", "handball"] as const;
export type DisallowReason = (typeof DISALLOW_REASONS)[number];

/** Share of minutes without a shot where the ball goes out for a throw-in (in the replay only). */
/** Of the times the ball is lost in open play, how often it goes out for a throw-in. */
const THROW_IN_CHANCE = 0.3;
/** How far up (0–100) a move that creates nothing may get before the defence cuts it out. */
const DANGER_DEPTH = 74;
/** A cross or through ball into the box that comes to nothing: how often the keeper claims it. */
const KEEPER_CLAIM_CHANCE = 0.45;

/** Half the goal's width in pitch units (7.32 m of a 68 m wide pitch, scaled to 100). */
const GOAL_HALF_WIDTH = 5.4;

/** Where a corner aimed at a zone lands, in the attacking side's own view. */
export function cornerZone(target: CornerTarget, flag: -1 | 1): {depth: number; width: number} {
  switch (target) {
    case "near": return {depth: 95, width: 50 + flag * 6};
    case "penalty": return {depth: 89, width: 50};
    case "far": return {depth: 94, width: 50 - flag * 7};
    case "short": return {depth: 88, width: 50 + flag * 26};
  }
}

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
  /** How play starts again next minute; `at` is where a throw-in is taken. */
  private restart: {side: Side; kind: "kickoff" | "goalKick" | "throwIn" | "keeper"; at?: Point} | null = {side: "home", kind: "kickoff"};
  /** The minute whose set-piece build-up is already drawn. */
  private ledUp = -1;
  private state: GameState;
  private rng: Rng;

  constructor(state: GameState, rng: Rng) {
    this.state = state;
    this.rng = rng;
  }

  private spot(team: Team, id: string, inPossession: boolean): Point {
    const o = team.onPitch.find((p) => p.id === id);
    return o ? teamSpot(team.slots[o.slot], team.side, this.ball, inPossession, level(team, id, "position")) : this.ball;
  }

  private nearest(team: Team, to: Point, inPossession: boolean): string | undefined {
    let best: string | undefined;
    let bestDistance = Infinity;
    for (const o of team.onPitch) {
      if (team.slots[o.slot].pos === "GK") continue;
      const d = distance(this.spot(team, o.id, inPossession), to);
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

  /**
   * A goal kick: the keeper places it in the six-yard box, then either kicks
   * it long towards the halfway line, where the nearest midfielder or forward
   * takes it, or plays it short to a defender. Keepers who pass well go short more.
   */
  private goalKick(team: Team, add: AddTouch): void {
    add("goalkick", this.keeper(team), fromSide(team.side, 5.5, this.rng.range(42, 58)), team.side);
    this.distribute(team, add);
  }

  /**
   * The keeper plays it out: short to a defender, or long towards the halfway
   * line for a midfielder or forward. Keepers who pass well go short more, and
   * the manager's order ("short" / "long") tips it further.
   */
  private distribute(team: Team, add: AddTouch): void {
    const keeper = this.keeper(team);
    const passing = keeper ? this.state.players[keeper].attrs.passing : 40;
    const style = keeper ? level(team, keeper, "passing") : 0;
    const outfield = team.onPitch.filter((o) => team.slots[o.slot].pos !== "GK");
    if (outfield.length === 0) return;
    if (this.rng.chance(clamp(0.25 + passing / 250 + style * 0.35, 0.05, 0.95))) {
      // Short: to a centre-back split wide by the box, or a full-back out on the flank.
      const backs = outfield.filter((o) => ["CB", "FB"].includes(team.slots[o.slot].pos));
      const o = this.rng.pick(backs.length ? backs : outfield);
      const slot = team.slots[o.slot];
      const left = slot.y < 50;
      const at = slot.pos === "FB" ? fromSide(team.side, this.rng.range(20, 28), left ? 8 : 92) : fromSide(team.side, this.rng.range(13, 18), left ? 20 : 80);
      add("pass", o.id, this.jitter(at, 2), team.side);
    } else {
      const landing = fromSide(team.side, this.rng.range(45, 62), this.rng.range(20, 80));
      const ahead = outfield.filter((o) => !["CB", "FB"].includes(team.slots[o.slot].pos));
      let best = (ahead.length ? ahead : outfield)[0].id;
      for (const o of ahead.length ? ahead : outfield) {
        if (distance(this.spot(team, o.id, true), landing) < distance(this.spot(team, best, true), landing)) best = o.id;
      }
      add("pass", best, landing, team.side, "long");
    }
  }

  /** A throw-in: the nearest player takes it on the touchline and throws it to a teammate close by. */
  private throwIn(team: Team, at: Point, add: AddTouch): void {
    const outfield = team.onPitch.filter((o) => team.slots[o.slot].pos !== "GK");
    if (outfield.length === 0) return;
    this.ball = at;
    let thrower = outfield[0].id;
    for (const o of outfield) if (distance(this.spot(team, o.id, true), at) < distance(this.spot(team, thrower, true), at)) thrower = o.id;
    add("throwin", thrower, at, team.side);
    // A few metres infield and a bit forward.
    const target = {x: clamp(at.x + (team.side === "home" ? 5 : -5), 3, 97), y: at.y < 50 ? at.y + 12 : at.y - 12};
    const mates = outfield.filter((o) => o.id !== thrower);
    if (mates.length === 0) return;
    let to = mates[0].id;
    for (const o of mates) if (distance(this.spot(team, o.id, true), target) < distance(this.spot(team, to, true), target)) to = o.id;
    add("pass", to, this.jitter(target, 3), team.side);
  }

  /**
   * A through ball: a midfielder or winger slips a forward in behind the
   * defence, into the space ahead of them. More from players with vision, and
   * from those told to play it direct.
   */
  private throughBall(team: Team, from: string): {to: string; at: Point; flight: "through"} | undefined {
    const pos = this.posOf(team, from);
    if (pos !== "CM" && pos !== "AM" && pos !== "W" && pos !== "DM") return undefined;
    const progress = progressFor(team.side, this.ball.x);
    if (progress < 35 || progress > 78) return undefined;
    const style = level(team, from, "passing");
    const chance = (0.08 + this.state.players[from].attrs.vision / 700) * (style < 0 ? 1.6 : style > 0 ? 0.6 : 1);
    if (!this.rng.chance(chance)) return undefined;
    const runners = team.onPitch.filter((o) => {
      const p = team.slots[o.slot].pos;
      return o.id !== from && (p === "ST" || p === "W" || p === "AM") && progressFor(team.side, this.spot(team, o.id, true).x) > progress + 4;
    });
    if (runners.length === 0) return undefined;
    const to = this.rng.weighted(runners, (o) => this.state.players[o.id].attrs.pace + this.state.players[o.id].attrs.finishing).id;
    const spot = this.spot(team, to, true);
    const width = team.side === "home" ? spot.y : 100 - spot.y;
    const at = fromSide(team.side, clamp(progressFor(team.side, spot.x) + this.rng.range(8, 14), 10, 90), clamp(width + this.rng.range(-6, 6), 8, 92));
    return {to, at, flight: "through"};
  }

  /** Switching play: a long ball from one flank out to a winger or full-back on the other. */
  private switchPlay(team: Team, from: string): {to: string; at: Point; flight: "long"} | undefined {
    const pos = this.posOf(team, from);
    if (pos !== "CB" && pos !== "FB" && pos !== "DM" && pos !== "CM") return undefined;
    const width = team.side === "home" ? this.ball.y : 100 - this.ball.y;
    if (width > 30 && width < 70) return undefined;
    if (!this.rng.chance(0.05 + this.state.players[from].attrs.vision / 900)) return undefined;
    const far = team.onPitch.filter((o) => {
      const s = team.slots[o.slot];
      return o.id !== from && (s.pos === "W" || s.pos === "FB") && (s.y < 50) !== (width < 50);
    });
    if (far.length === 0) return undefined;
    const to = this.rng.pick(far).id;
    return {to, at: this.jitter(this.spot(team, to, true), 3), flight: "long"};
  }

  /** The ball near the attacking side's goal and central: a shooting chance if anything is on. */
  private inFrontOfGoal(side: Side): boolean {
    const width = side === "home" ? this.ball.y : 100 - this.ball.y;
    return progressFor(side, this.ball.x) > DANGER_DEPTH && width > 22 && width < 78;
  }

  /** A winger or full-back with the ball out wide in the final third. */
  private wideAndHigh(team: Team, id: string): boolean {
    const pos = this.posOf(team, id);
    if (pos !== "W" && pos !== "FB") return false;
    const width = team.side === "home" ? this.ball.y : 100 - this.ball.y;
    return progressFor(team.side, this.ball.x) > 58 && (width < 28 || width > 72);
  }

  /** Down the line to the byline on the side the ball is on. */
  private toByline(side: Side, id: string, add: AddTouch): void {
    const width = side === "home" ? this.ball.y : 100 - this.ball.y;
    const flank = width < 50 ? this.rng.range(4, 10) : this.rng.range(90, 96);
    add("dribble", id, fromSide(side, this.rng.range(89, 95), flank));
  }

  /**
   * Dribble to the byline and cross to someone attacking the box: a striker
   * most likely, then an attacking midfielder or the other winger.
   * Returns who it went to.
   */
  private crossIn(team: Team, from: string, add: AddTouch): string | undefined {
    this.toByline(team.side, from, add);
    const weights: Partial<Record<Position, number>> = {ST: 5, AM: 2.5, W: 2, CM: 1};
    const options = team.onPitch.filter((o) => o.id !== from && weights[team.slots[o.slot].pos]);
    if (options.length === 0) return undefined;
    const to = this.rng.weighted(options, (o) => weights[team.slots[o.slot].pos] ?? 0).id;
    add("pass", to, fromSide(team.side, this.rng.range(84, 93), this.rng.range(36, 64)), team.side, "cross");
    return to;
  }

  /** The second half starts with a kick-off by the side that didn't start the first. */
  halftime(): void {
    this.carrier = null;
    this.restart = {side: "away", kind: "kickoff"};
  }

  private jitter(p: Point, amount: number): Point {
    return {
      x: clamp(p.x + this.rng.range(-amount, amount), 1, 99),
      y: clamp(p.y + this.rng.range(-amount, amount), 2, 98),
    };
  }

  private posOf(team: Team, id: string): Position | undefined {
    const o = team.onPitch.find((p) => p.id === id);
    return o ? team.slots[o.slot].pos : undefined;
  }

  /**
   * A teammate to pass to. Like a real side: mostly short and forward,
   * sideways when nothing is on, and back only from deep. Forwards and
   * midfielders never play it back to their own keeper; defenders may, in
   * their own third. Long balls need vision. Told to pass more, a player keeps
   * it short and safe; told to go direct, they look long and forward.
   */
  private receiver(team: Team, from: string): string | undefined {
    const progress = progressFor(team.side, this.ball.x);
    const fromPos = this.posOf(team, from) ?? "CM";
    const deep = fromPos === "GK" || fromPos === "CB" || fromPos === "FB" || fromPos === "DM";
    const vision = this.state.players[from].attrs.vision;
    const style = level(team, from, "passing");
    // How far back a pass may go before it gets unlikely, by the passer's role.
    // In the final third, everyone looks forward.
    const backTolerance = progress > 66 ? 5 : fromPos === "ST" || fromPos === "W" || fromPos === "AM" ? 7 : deep ? 18 : 11;
    const options = team.onPitch.filter((o) => {
      if (o.id === from) return false;
      if (team.slots[o.slot].pos !== "GK") return true;
      return deep && progress < 30;
    });
    if (options.length === 0) return undefined;
    return this.rng.weighted(options, (o) => {
      const spot = this.spot(team, o.id, true);
      const depth = progressFor(team.side, spot.x) - progress;
      const length = distance(spot, this.ball);
      // Forward is good, sideways is fine, backwards fades fast.
      let w = depth >= 0 ? 1 + Math.min(depth, 25) / (style < 0 ? 12 : 22) : Math.exp(depth / backTolerance);
      // Short passes are the norm; long ones need a passer who sees them.
      const comfortable = 14 + vision / 6 + (style < 0 ? 10 : style > 0 ? -4 : 0);
      if (length > comfortable) w *= Math.exp(-(length - comfortable) / (6 + vision / 12));
      if (length < 4) w *= 0.3;
      if (team.slots[o.slot].pos === "GK") w *= 0.25;
      return w * (0.6 + this.state.players[o.id].attrs.technique / 200);
    }).id;
  }

  private dribbles(team: Team, id: string): boolean {
    const o = team.onPitch.find((p) => p.id === id);
    if (!o || team.slots[o.slot].pos === "GK" || team.slots[o.slot].pos === "CB") return false;
    const {technique, pace} = this.state.players[id].attrs;
    const told = [0.4, 1, 2.2][level(team, id, "dribbling") + 1];
    return this.rng.chance(clamp((0.08 + (technique + pace - 110) / 300) * told, 0.02, 0.6));
  }

  /** Touches for this minute, collected before they're given times. */
  private recorder(side: Side): {touches: Frame[]; add: AddTouch} {
    const touches: Frame[] = [];
    const add: AddTouch = (kind, id, at, touchSide = side, flight) => {
      touches.push({minute: 0, x: at.x, y: at.y, possession: touchSide, playerId: id, kind, ...(flight ? {flight} : {})});
      this.ball = at;
      if (id) this.carrier = {id, side: touchSide};
    };
    return {touches, add};
  }

  /** How the minute starts: any restart, then the side with the ball wins it if they hadn't got it. Returns who has it. */
  private opening(attacking: Team, defending: Team, add: AddTouch): string | undefined {
    const side = attacking.side;
    if (this.restart) {
      const team = this.restart.side === side ? attacking : defending;
      if (this.restart.kind === "kickoff") {
        this.ball = {x: 50, y: 50};
        const kicker = this.nearest(team, this.ball, true);
        add("kickoff", kicker, {x: 50, y: 50}, team.side);
        // Always played back to a teammate: a midfielder or defender in their own half.
        const backs = team.onPitch.filter((o) => o.id !== kicker && ["CM", "DM", "CB", "FB"].includes(team.slots[o.slot].pos));
        if (backs.length > 0) {
          const to = this.rng.pick(backs).id;
          const spot = this.spot(team, to, true);
          add("pass", to, fromSide(team.side, clamp(progressFor(team.side, spot.x), 25, 42), team.side === "home" ? spot.y : 100 - spot.y), team.side);
        }
      } else if (this.restart.kind === "keeper") {
        // The keeper kept hold after a save: walks it to the edge of the box, then plays it out.
        add("dribble", this.keeper(team), fromSide(team.side, this.rng.range(11, 15), this.rng.range(38, 62)), team.side);
        this.distribute(team, add);
      } else if (this.restart.kind === "goalKick") {
        this.goalKick(team, add);
      } else {
        this.throwIn(team, this.restart.at ?? this.ball, add);
      }
      this.restart = null;
      // The side that restarted keeps it for a pass before it can be won off them.
      if (this.carrier && this.carrier.side !== side) {
        const next = this.receiver(team, this.carrier.id);
        if (next) add("pass", next, this.jitter(this.spot(team, next, true), 4), team.side);
      }
    } else if (this.carrier && this.carrier.side !== side && progressFor(side, this.ball.x) > DANGER_DEPTH) {
      // Won off them near goal last minute: the defenders get it away before it can be won back.
      this.clear(defending, add);
    }
    // The side that has it now won the ball back: their nearest player.
    if (this.carrier && this.carrier.side !== side) {
      add("tackle", this.nearest(attacking, this.ball, false), this.jitter(this.ball, 3));
    }
    return this.carrier?.side === side ? this.carrier.id : this.nearest(attacking, this.ball, true);
  }

  /**
   * The build-up to a set piece, drawn before it's taken so the replay shows
   * it first: a run at the box that ends with the ball out for a corner, or
   * with a foul in the box (penalty) or near it (free kick). It fills the
   * first part of the minute; `minute` adds the kick and what followed.
   */
  leadUp(minute: number, attacking: Team, defending: Team, sp: {kind: SetPieceKind; spot: Point}): void {
    const side = attacking.side;
    const {touches, add} = this.recorder(side);
    let carrier = this.opening(attacking, defending, add);
    const spotWidth = side === "home" ? sp.spot.y : 100 - sp.spot.y;
    // Where the last run ends: out for a corner, the foul for a penalty or free kick.
    const runTo =
      sp.kind === "corner" ? fromSide(side, this.rng.range(82, 90), spotWidth < 50 ? this.rng.range(10, 24) : this.rng.range(76, 90))
      : sp.kind === "penalty" ? fromSide(side, this.rng.range(86, 92), this.rng.range(38, 62))
      : fromSide(side, progressFor(side, sp.spot.x) + 1.5, clamp(spotWidth + this.rng.range(-4, 4), 5, 95));
    // From far away, it's played up to whoever is already up there (long if it
    // has to be): no dribble runs half the pitch, and nobody has to sprint 40 m to get it.
    const mates = attacking.onPitch.filter((o) => o.id !== carrier && attacking.slots[o.slot].pos !== "GK");
    if (carrier && mates.length > 0 && distance(this.ball, runTo) > 22) {
      let to = mates[0].id;
      for (const o of mates) if (distance(this.spot(attacking, o.id, true), runTo) < distance(this.spot(attacking, to, true), runTo)) to = o.id;
      const spot = this.spot(attacking, to, true);
      const at = this.jitter({x: spot.x + (runTo.x - spot.x) * 0.4, y: spot.y + (runTo.y - spot.y) * 0.4}, 2);
      add("pass", to, at, side, distance(this.ball, at) > 35 ? "long" : undefined);
      carrier = to;
    }
    add("dribble", carrier, runTo);
    if (sp.kind === "corner") {
      add("out", undefined, fromSide(side, 99.6, spotWidth < 50 ? this.rng.range(8, 30) : this.rng.range(70, 92)));
    }
    this.flush(minute, touches, 0, LEAD_UP_SHARE);
    this.ledUp = minute;
  }

  /** `turnover`: the other side has the ball next minute (after a shot, or won off them). */
  minute(minute: number, attacking: Team, defending: Team, outcome: ShotOutcome, turnover = false): void {
    const side = attacking.side;
    const {touches, add} = this.recorder(side);
    // A set piece's build-up is already drawn (leadUp): just the kick and what followed, in the rest of the minute.
    const ledUp = outcome.type !== "none" && !!outcome.setPiece && this.ledUp === minute;
    const first = ledUp ? this.carrier?.id : this.opening(attacking, defending, add);
    if (!first) return;
    let carrier: string = first;
    const flush = () => (ledUp ? this.flush(minute, touches, LEAD_UP_SHARE, 1) : this.flush(minute, touches));

    const passes = outcome.type === "none" ? this.rng.int(1, 3) : outcome.setPiece ? 0 : this.rng.int(0, 2);
    // Already camped in their half (not just won it or restarted): the box has filled up for a cross.
    const settled = touches.length === 0 && progressFor(side, this.ball.x) > 45;
    let lastPasser: string | undefined;
    for (let i = 0; i < passes; i++) {
      // In front of goal it is never played back out: the chance comes from here (the shot
      // below), or nothing does and the defence cuts it out.
      if (this.inFrontOfGoal(side)) break;
      // Wide in the final third: take it down the line and cross it into the box.
      // (In a minute that ends with them keeping the ball, nothing goes into the box.)
      const intoBox = outcome.type !== "none" || turnover;
      if (intoBox && settled && this.wideAndHigh(attacking, carrier) && this.rng.chance(0.5)) {
        carrier = this.crossIn(attacking, carrier, add) ?? carrier;
        break;
      }
      // A ball in behind for a forward to run onto, or a long one out to the far flank.
      const special: {to: string; at: Point; flight: "through" | "long"} | undefined = (intoBox ? this.throughBall(attacking, carrier) : undefined) ?? this.switchPlay(attacking, carrier);
      if (special) {
        add("pass", special.to, special.at, side, special.flight);
        lastPasser = carrier;
        carrier = special.to;
        continue;
      }
      if (this.dribbles(attacking, carrier)) {
        // Faster players get further with the ball.
        const depth = progressFor(side, this.ball.x) + this.rng.range(6, 10) + this.state.players[carrier].attrs.pace / 15;
        const width = (side === "home" ? this.ball.y : 100 - this.ball.y) + this.rng.range(-8, 8);
        add("dribble", carrier, fromSide(side, clamp(depth, 5, intoBox ? 88 : DANGER_DEPTH), clamp(width, 5, 95)));
        continue;
      }
      // Give and go: the player who just passed has run on and gets it back further up.
      const backTo = lastPasser;
      if (backTo && backTo !== carrier && this.posOf(attacking, backTo) !== "GK" && this.posOf(attacking, backTo) !== "CB" && this.rng.chance(ONE_TWO_CHANCE)) {
        const spot = this.spot(attacking, backTo, true);
        const width = side === "home" ? spot.y : 100 - spot.y;
        add("pass", backTo, fromSide(side, clamp(progressFor(side, this.ball.x) + this.rng.range(8, 14), 5, 88), clamp(width, 6, 94)));
        lastPasser = carrier;
        carrier = backTo;
        continue;
      }
      const next = this.receiver(attacking, carrier);
      if (!next) break;
      add("pass", next, this.jitter(this.spot(attacking, next, true), 4));
      lastPasser = carrier;
      carrier = next;
    }

    // Won off them: near goal the defence (or the keeper) cuts it out, so no
    // attacker is left free in front of goal; elsewhere an interception or a
    // tackle, and now and then the ball goes out for a throw-in.
    if (outcome.type === "none" && turnover && (this.inFrontOfGoal(side) || !this.rng.chance(THROW_IN_CHANCE))) {
      this.cutOut(attacking, defending, touches, add);
      return flush();
    }
    if (outcome.type === "none" && turnover) {
      const near = this.ball.y < 50 ? 0.3 : 99.7;
      const along = clamp(this.ball.x + (side === "home" ? 1 : -1) * this.rng.range(2, 8), 3, 97);
      add("out", undefined, {x: along, y: near});
      this.carrier = null;
      this.restart = {side: defending.side, kind: "throwIn", at: {x: along, y: near < 50 ? 1 : 99}};
      return flush();
    }

    const width = (x: number) => clamp(50 - x * GOAL_HALF_WIDTH, 1, 99);
    if (outcome.type !== "none" && outcome.setPiece) {
      // (The build-up came first, in leadUp.) The taker places the ball; corners are crossed in to the attacker first.
      const sp = outcome.setPiece;
      add("setpiece", sp.takerId, sp.spot);
      if (sp.kind === "corner") {
        const zone = cornerZone(sp.target ?? "penalty", sp.wallSide);
        const at = fromSide(side, zone.depth, zone.width);
        if (outcome.type === "cleared") {
          add("tackle", sp.defenderId ?? this.nearest(defending, at, false), at, defending.side);
          return flush();
        }
        add("pass", outcome.shooterId, at);
      }
      if (outcome.type === "goal") {
        add("goal", undefined, fromSide(side, 100, width(sp.shot.x)));
        this.carrier = null;
        this.restart = {side: defending.side, kind: "kickoff"};
      } else if (outcome.type === "saved") {
        add("save", outcome.keeperId ?? this.keeper(defending), fromSide(side, 98, width(sp.dive)), defending.side);
        this.restart = {side: defending.side, kind: "keeper"};
      } else if (outcome.type === "blocked" || outcome.type === "cleared") {
        // Off the wall, and the defenders have it.
        const spotDepth = progressFor(side, sp.spot.x);
        const wallAt = fromSide(side, spotDepth + 9, side === "home" ? sp.spot.y : 100 - sp.spot.y);
        add("tackle", this.nearest(defending, wallAt, false), wallAt, defending.side);
      } else {
        add("out", undefined, fromSide(side, 100, clamp(50 - sp.shot.x * GOAL_HALF_WIDTH, 30, 70)));
        this.carrier = null;
        this.restart = {side: defending.side, kind: "goalKick"};
      }
    } else if (outcome.type !== "none") {
      const onPitch = (id?: string) => !!id && attacking.onPitch.some((o) => o.id === id);
      // Already in front of goal: they go straight for it (or square it to the shooter), no ball back out first.
      if (outcome.type === "goal" && onPitch(outcome.assistId) && outcome.assistId !== carrier && !this.inFrontOfGoal(side)) {
        // To the provider, in the final third and never further back than the ball.
        const spot = this.spot(attacking, outcome.assistId!, true);
        const depth = Math.max(progressFor(side, this.ball.x), progressFor(side, spot.x), this.rng.range(66, 78));
        add("pass", outcome.assistId, this.jitter(fromSide(side, Math.min(depth, 86), side === "home" ? spot.y : 100 - spot.y), 3));
        carrier = outcome.assistId!;
        // Wingers and full-backs mostly set goals up from the byline.
        const pos = this.posOf(attacking, carrier);
        if ((pos === "W" || pos === "FB") && this.rng.chance(0.7)) this.toByline(side, carrier, add);
      }
      const box = fromSide(side, this.rng.range(80, 90), this.rng.range(32, 68));
      add(outcome.shooterId === carrier ? "dribble" : "pass", outcome.shooterId, box);
      if (outcome.type === "goal") {
        add("goal", undefined, fromSide(side, 100, this.rng.range(45, 55)));
        this.carrier = null;
        this.restart = {side: defending.side, kind: "kickoff"};
      } else if (outcome.type === "disallowed") {
        // In the net, then ruled out: the defending side restarts from their box.
        add("nogoal", undefined, fromSide(side, 100, this.rng.range(45, 55)));
        this.carrier = null;
        this.restart = {side: defending.side, kind: "goalKick"};
      } else if (outcome.type === "saved") {
        add("save", outcome.keeperId, fromSide(side, 97, this.rng.range(42, 58)), defending.side);
        // Held: the keeper plays it out next.
        this.restart = {side: defending.side, kind: "keeper"};
      } else {
        const wide = this.rng.chance(0.5) ? this.rng.range(30, 40) : this.rng.range(60, 70);
        add("out", undefined, fromSide(side, 100, wide));
        this.carrier = null;
        this.restart = {side: defending.side, kind: "goalKick"};
      }
    }
    flush();
  }

  /**
   * An attack that came to nothing, stopped near goal. A ball played in is cut
   * out where it lands: claimed by the keeper if it's a cross or through ball
   * into the box, otherwise intercepted by the nearest defender. A run is
   * stopped with a tackle. The defenders then clear it or play it out.
   */
  private cutOut(attacking: Team, defending: Team, touches: Frame[], add: AddTouch): void {
    const last = touches[touches.length - 1];
    const keeper = this.keeper(defending);
    const inBox = progressFor(attacking.side, this.ball.x) > 84;
    // (It still flies in as a cross or through ball; it's just someone else who gets there.)
    const won = (kind: TouchKind, id: string | undefined) => {
      Object.assign(last, {kind, playerId: id, possession: defending.side});
      if (id) this.carrier = {id, side: defending.side};
    };
    if (last?.kind === "pass" && inBox && keeper && (last.flight === "cross" || last.flight === "through") && this.rng.chance(KEEPER_CLAIM_CHANCE)) {
      won("save", keeper);
      this.restart = {side: defending.side, kind: "keeper"};
      return;
    }
    // A throw-in, goal kick or kick-off still reaches the teammate, who plays it on; it's won after that.
    const fromRestart = touches.slice(-3, -1).some((t) => ["throwin", "goalkick", "kickoff"].includes(t.kind ?? ""));
    if (fromRestart && last?.playerId) {
      const next = this.receiver(attacking, last.playerId);
      if (next) add("pass", next, this.jitter(this.spot(attacking, next, true), 4));
    }
    const by = this.nearest(defending, this.ball, false);
    if (last?.kind === "pass" && !fromRestart) won("tackle", by);
    else add("tackle", by, this.jitter(this.ball, 2), defending.side);
  }

  /** Won deep in their own third: cleared long towards a forward, or played out short. */
  private clear(team: Team, add: AddTouch): void {
    if (!this.carrier) return;
    if (this.rng.chance(0.55)) {
      const landing = fromSide(team.side, this.rng.range(42, 60), this.rng.range(20, 80));
      const ahead = team.onPitch.filter((o) => o.id !== this.carrier!.id && ["ST", "W", "AM", "CM"].includes(team.slots[o.slot].pos));
      if (ahead.length === 0) return;
      let to = ahead[0].id;
      for (const o of ahead) if (distance(this.spot(team, o.id, true), landing) < distance(this.spot(team, to, true), landing)) to = o.id;
      add("pass", to, landing, team.side, "long");
    } else {
      const next = this.receiver(team, this.carrier.id);
      if (next) add("pass", next, this.jitter(this.spot(team, next, true), 4), team.side);
    }
  }

  /** Spreads touches over the part of the minute from `from` to `to` (shares of it). */
  private flush(minute: number, touches: Frame[], from = 0, to = 1): void {
    // Each touch gets time for how far the ball goes to it: a carried ball
    // (dribble) needs much longer than a pass over the same distance.
    let prev: Point | undefined = this.frames[this.frames.length - 1];
    const weights = touches.map((t) => {
      const d = prev ? distance(prev, t) : 0;
      prev = t;
      return 0.5 + d / (t.kind === "dribble" ? 10 : 25);
    });
    const total = weights.reduce((s, w) => s + w, 0);
    let done = 0;
    touches.forEach((t, k) => {
      done += weights[k];
      t.minute = minute - 1 + from + ((to - from) * (done - weights[k] / 2)) / total;
      this.frames.push(t);
    });
  }
}

/**
 * What a match generator stops for. Injuries only stop for the managed side,
 * whose manager picks the substitute; half-time stops so changes made in the
 * break count from the second-half kick-off.
 */
export type MatchStep =
  | {type: "minute"; minute: number}
  | {type: "setpiece"; sp: SetPiece}
  | {type: "injury"; minute: number; side: Side; playerId: string; pos: Position}
  | {type: "halftime"; minute: number};

/** A match being played. `report` and `teams` fill in as `run` advances. */
export interface MatchRun {
  report: MatchReport;
  teams: Record<Side, Team>;
  run: Generator<MatchStep, MatchReport, SetPieceInput | null | undefined>;
}

/**
 * Sets up a match that can be played step by step. Everything random is drawn
 * from `rng`, so the same seed, set-piece inputs and commands give the same match.
 * `commands` is read before each minute, so a live caller can add to it.
 * The `managed` side's injured players wait for a substitution command
 * instead of being replaced by the assistant.
 */
export function createMatch(
  state: GameState,
  rng: Rng,
  fixture: Fixture,
  withFrames: boolean,
  commands: MatchCommand[] = [],
  managed?: Side
): MatchRun {
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
    slots: {home: clubSlots(homeClub), away: clubSlots(awayClub)},
    setPieces: [],
    added: [0, 0],
  };
  const added = report.added!;

  const rate = (id: string | undefined, delta: number) => {
    if (id && ctx.ratings[id] !== undefined) ctx.ratings[id] += delta;
  };

  const teamOf = (id: string): Team | undefined =>
    [home, away].find((t) => t.onPitch.some((o) => o.id === id) || t.bench.includes(id) || t.injured.some((o) => o.id === id));

  function applyCommands(minute: number): void {
    for (const c of commands) {
      if (c.minute !== minute) continue;
      if (c.type === "sub") {
        const team = teamOf(c.outId);
        const out = team?.onPitch.find((o) => o.id === c.outId) ?? team?.injured.find((o) => o.id === c.outId);
        if (team && out && substitute(ctx, team, out, minute, c.inId)) team.manualSubs = true;
      } else if (c.type === "instructTeam") {
        const team = managed === "home" ? home : managed === "away" ? away : undefined;
        if (!team) continue;
        team.teamInstructions = {...team.teamInstructions, [c.key]: c.level};
        // The team order replaces what individuals were told about the same thing.
        for (const id of Object.keys(team.instructions)) delete team.instructions[id][c.key];
        const sign = c.level > 0 ? "+" : c.level < 0 ? "-" : "0";
        ctx.events.push({minute, type: "instruction", side: team.side, note: `${c.key}${sign}`});
      } else {
        const team = teamOf(c.playerId);
        if (!team) continue;
        team.instructions[c.playerId] = {...team.instructions[c.playerId], [c.key]: c.level};
        const sign = c.level > 0 ? "+" : c.level < 0 ? "-" : "0";
        ctx.events.push({minute, type: "instruction", side: team.side, playerId: c.playerId, note: `${c.key}${sign}`});
      }
    }
  }

  function* takeSetPiece(
    kind: SetPieceKind,
    minute: number,
    attacking: Team,
    defending: Team
  ): Generator<MatchStep, ShotOutcome, SetPieceInput | null | undefined> {
    const attackers = attacking.onPitch.map((o) => state.players[o.id]);
    const roles = attacking.club.roles;
    const taker = pickTaker(attackers, kind, kind === "penalty" ? roles?.penalties : kind === "freekick" ? roles?.freekicks : roles?.corners);
    if (!taker) return {type: "none"};
    const keeperSlot = defending.onPitch.find((o) => defending.slots[o.slot].pos === "GK");
    const keeper = keeperSlot ? state.players[keeperSlot.id] : undefined;
    const wallSide: -1 | 1 = rng.chance(0.5) ? -1 : 1;
    const spot =
      kind === "penalty" ? fromSide(attacking.side, 89.5, 50)
      : kind === "corner" ? fromSide(attacking.side, 99.5, wallSide < 0 ? 1 : 99)
      : fromSide(attacking.side, rng.range(72, 80), 50 + wallSide * rng.range(8, 22));
    const sp: SetPiece = {
      index: report.setPieces!.length,
      kind,
      minute,
      side: attacking.side,
      takerId: taker.id,
      keeperId: keeperSlot?.id,
      wallSide,
      spot,
    };
    ctx.events.push({minute, type: kind, side: attacking.side, playerId: taker.id});
    // Draw the build-up first, so it plays before the set piece is shown (and taken).
    replay?.leadUp(minute, attacking, defending, sp);
    const input = yield {type: "setpiece", sp};
    const res: SetPieceOutcome = kind === "corner"
      ? resolveCorner(rng, input ?? null, taker, attackers, defending.onPitch.map((o) => state.players[o.id]), keeper)
      : resolveSetPiece(rng, sp, input ?? null, taker, keeper);
    report.setPieces!.push({...sp, ...res});
    const shooterId = res.headerId ?? taker.id;
    const assistId = kind === "corner" && shooterId !== taker.id ? taker.id : undefined;
    const setPiece: SetPieceShot = {
      kind, spot, shot: res.shot, dive: res.dive, wallSide, target: res.target, takerId: taker.id, defenderId: res.defenderId,
    };
    if (res.result === "cleared") {
      if (res.defenderId) {
        ctx.events.push({minute, type: "cleared", side: defending.side, playerId: res.defenderId});
        rate(res.defenderId, 0.1);
      }
      return {type: "cleared", shooterId, setPiece};
    }
    attacking.shots++;
    if (res.result === "goal") {
      attacking.onTarget++;
      attacking.goals++;
      ctx.events.push({minute, type: "goal", side: attacking.side, playerId: shooterId, otherId: assistId});
      rate(shooterId, 0.9);
      rate(assistId, 0.5);
      rate(keeper?.id, -0.2);
      return {type: "goal", shooterId, assistId, setPiece};
    }
    if (res.result === "saved") {
      attacking.onTarget++;
      ctx.events.push({minute, type: "saved", side: attacking.side, playerId: shooterId, otherId: keeper?.id});
      rate(keeper?.id, kind === "penalty" ? 0.8 : 0.3);
      rate(shooterId, kind === "penalty" ? -0.5 : 0);
      return {type: "saved", shooterId, keeperId: keeper?.id, setPiece};
    }
    if (res.result === "missed") {
      ctx.events.push({minute, type: "missed", side: attacking.side, playerId: shooterId});
      rate(shooterId, kind === "penalty" ? -0.6 : -0.05);
      return {type: "missed", shooterId, setPiece};
    }
    ctx.events.push({minute, type: "blocked", side: attacking.side, playerId: shooterId});
    return {type: "blocked", shooterId, setPiece};
  }

  /** Added time: a minute or two, more after goals, changes, injuries and penalties. */
  function stoppage(from: number, base: number, max: number): number {
    const stops = ctx.events.filter((e) => e.minute > from && ["goal", "sub", "injury", "red", "penalty"].includes(e.type)).length;
    return clamp(base + Math.round(stops * 0.4) + rng.int(0, 1), base, max);
  }

  function* play(): Generator<MatchStep, MatchReport, SetPieceInput | null | undefined> {
    let homePossession = 0;
    // Who has the ball: the home side kicks off. It changes hands after a shot
    // (the other side restarts) or when it is won off them (see the end of the minute).
    let holder: Team = home;
    let minute = 0;
    // The second half's added time is only known at 90 minutes.
    let end = Infinity;
    while (minute < end) {
      minute++;
      // A pause point: a live caller can add commands for this minute now.
      yield {type: "minute", minute};
      applyCommands(minute);
      const h = lines(state, home, true);
      const a = lines(state, away, false);
      const pHome = h.mid ** POSSESSION_POWER / (h.mid ** POSSESSION_POWER + a.mid ** POSSESSION_POWER);
      const attacking: Team = holder;
      const defending = attacking === home ? away : home;
      const att = attacking === home ? h : a;
      const def = attacking === home ? a : h;
      if (attacking === home) homePossession++;

      let outcome: ShotOutcome = {type: "none"};

      const ratio = att.att / Math.max(def.def, 1);
      const pChance = clamp(CHANCE_BASE * ratio ** CHANCE_POWER, 0.05, 0.42);
      if (rng.chance(pChance)) {
        const shooterSlot = pickOnPitch(rng, state, attacking, SHOOTER_WEIGHT, (p) => (p.attrs.finishing / 50) * effect(attacking, p.id, (e) => e.shoot));
        if (shooterSlot) {
          const shooter = state.players[shooterSlot.id];
          const skill = shotSkill(attacking, shooter);
          attacking.shots++;
          outcome = {type: "missed", shooterId: shooterSlot.id};
          const pOnTarget = clamp(0.3 + (skill - 50) / 180 + (ratio - 1) * 0.15, 0.15, 0.65);
          if (rng.chance(pOnTarget)) {
            attacking.onTarget++;
            rate(shooterSlot.id, 0.1);
            const pGoal = clamp(GOAL_BASE + (skill - def.gk) / 150, 0.12, 0.62);
            const keeper = defending.onPitch.find((o) => defending.slots[o.slot].pos === "GK");
            const scored = rng.chance(pGoal);
            if (scored && rng.chance(DISALLOWED_CHANCE)) {
              // In the net, but the referee (or VAR) rules it out.
              const reason = rng.pick(DISALLOW_REASONS);
              outcome = {type: "disallowed", shooterId: shooterSlot.id, reason};
              ctx.events.push({minute, type: "disallowed", side: attacking.side, playerId: shooterSlot.id, note: reason});
            } else if (scored) {
              attacking.goals++;
              const assist = rng.chance(0.75)
                ? pickOnPitch(rng, state, attacking, ASSIST_WEIGHT, (p) => ((p.attrs.passing + p.attrs.vision) / 100) * effect(attacking, p.id, (e) => e.assist), shooterSlot.id)
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

      // Penalties, free kicks near the box and corners: moments the user can take over.
      const roll = rng.next();
      const cornerRoll = rng.next();
      if (outcome.type === "none") {
        const pPenalty = PENALTY_RATE * ratio;
        const kind: SetPieceKind | null =
          roll < pPenalty ? "penalty"
          : roll < pPenalty + FREEKICK_RATE * ratio ? "freekick"
          : cornerRoll < CORNER_RATE * Math.sqrt(ratio) ? "corner"
          : null;
        if (kind) outcome = yield* takeSetPiece(kind, minute, attacking, defending);
      }
      // Who has it next minute. After a shot, the other side (kick-off, goal kick, the
      // keeper). Otherwise the better side in midfield keeps it more often: the share of
      // possession still follows pHome, with fewer, longer spells.
      const share = attacking === home ? pHome : 1 - pHome;
      const turnover = outcome.type !== "none" || !rng.chance(POSSESSION_KEEP + (1 - POSSESSION_KEEP) * share);
      holder = turnover ? defending : attacking;
      // Drawn before cards and injuries: those players were still on during this minute.
      replay?.minute(minute, attacking, defending, outcome, turnover);
      report.homeGoals = home.goals;
      report.awayGoals = away.goals;

      // Cards: the side without the ball fouls more; told to tackle hard, more still.
      if (rng.chance(0.04)) {
        const team = rng.chance(0.65) ? defending : attacking;
        const fouler = pickOnPitch(rng, state, team, FOUL_WEIGHT, (p) => effect(team, p.id, (e) => e.foul));
        if (fouler) {
          const straightRed = rng.chance(0.03);
          // Told to hold back, a booked player usually pulls out of the second foul.
          const careful = team.booked.has(fouler.id) && level(team, fouler.id, "tackling") === -1 && rng.chance(0.7);
          if (careful) {
            // No card.
          } else if (straightRed || team.booked.has(fouler.id)) {
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
          if (team.side === managed && team.subsLeft > 0 && team.bench.length > 0) {
            // Off for treatment; the manager picks who comes on next minute.
            ctx.minutes[hurt.id].off = minute;
            removePlayer(team, hurt.id);
            team.injured.push(hurt);
            yield {type: "injury", minute, side: team.side, playerId: hurt.id, pos: team.slots[hurt.slot].pos};
          } else if (!substitute(ctx, team, hurt, minute)) {
            ctx.minutes[hurt.id].off = minute;
            removePlayer(team, hurt.id);
          }
        }
      }

      // Tiring: low stamina, attacking mentality and busy instructions burn more.
      for (const team of [home, away]) {
        const extra = team.club.mentality === "attacking" ? 1.1 : 1;
        for (const o of team.onPitch) {
          const p = state.players[o.id];
          const told = effect(team, o.id, (e) => e.tire);
          p.fitness = clamp(p.fitness - (0.24 - p.attrs.stamina * 0.0013) * extra * told, 0, 100);
        }
        // Tactical subs from the hour mark, until the manager takes over.
        if (!team.manualSubs && minute >= 58 && minute <= 85 && team.subsLeft > 0 && rng.chance(0.25)) {
          const tired = team.onPitch
            .filter((o) => team.slots[o.slot].pos !== "GK")
            .sort((x, y) => state.players[x.id].fitness - state.players[y.id].fitness)[0];
          if (tired && state.players[tired.id].fitness < 70) substitute(ctx, team, tired, minute);
        }
      }

      if (minute === 45) added[0] = stoppage(0, 1, 4);
      if (minute === 45 + added[0]) {
        ctx.events.push({minute, type: "halftime"});
        replay?.halftime();
        holder = away;
        yield {type: "halftime", minute};
      }
      if (minute === 90 + added[0]) {
        added[1] = stoppage(45 + added[0], 2, 7);
        end = minute + added[1];
      }
    }
    ctx.events.push({minute, type: "fulltime"});

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
    report.possessionHome = Math.round((homePossession / minute) * 100);
    report.shots = [home.shots, away.shots];
    report.onTarget = [home.onTarget, away.onTarget];
    return report;
  }

  return {report, teams: {home, away}, run: play()};
}

/** Plays a whole match at once. Set pieces use `inputs` where given, else the computer decides. */
export function simulateMatch(
  state: GameState,
  rng: Rng,
  fixture: Fixture,
  withFrames: boolean,
  inputs: Record<number, SetPieceInput> = {},
  commands: MatchCommand[] = [],
  managed?: Side
): MatchReport {
  const {run} = createMatch(state, rng, fixture, withFrames, commands, managed);
  let step = run.next();
  while (!step.done) {
    step = run.next(step.value.type === "setpiece" ? inputs[step.value.sp.index] ?? null : undefined);
  }
  return step.value;
}

/** Writes a finished match into the season: table, stats, form, cards, bonuses. */
export function applyMatch(state: GameState, report: MatchReport): void {
  const fixture = findFixture(state, report.fixtureId)!;
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
