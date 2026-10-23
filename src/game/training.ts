// Weekly training: attributes grow with focus, age, potential, minutes,
// intensity, facilities, form and morale. Older players decline.
import {NATURAL_GAIN_SHARE, TRAINING_BASE_GAIN, TRAINING_INJURY_CHANCE} from "./constants";
import {overall} from "./ratings";
import {Rng, clamp} from "./rng";
import {
  ATTRIBUTES,
  type Attribute,
  type Club,
  type GameState,
  type Intensity,
  type Player,
  type TrainingFocus,
} from "./types";

/** Attributes each programme works on, with how much of the effort they get. */
export const FOCUS_ATTRIBUTES: Record<TrainingFocus, Partial<Record<Attribute, number>>> = {
  attack: {finishing: 0.6, technique: 0.2, vision: 0.2},
  defense: {defending: 0.65, physical: 0.15, vision: 0.2},
  passing: {passing: 0.6, vision: 0.4},
  physical: {physical: 0.55, pace: 0.45},
  conditioning: {stamina: 0.8, pace: 0.2},
  technique: {technique: 0.6, passing: 0.2, finishing: 0.2},
  goalkeeping: {goalkeeping: 1},
  recovery: {},
};

export const INTENSITY: Record<Intensity, {gain: number; fitness: number; injury: number; mood: number}> = {
  light: {gain: 0.6, fitness: 14, injury: 0.5, mood: 0.6},
  normal: {gain: 1, fitness: 8, injury: 1, mood: 0},
  hard: {gain: 1.4, fitness: 0, injury: 2.2, mood: -1.6},
};

function ageFactor(age: number): number {
  if (age <= 18) return 1.3;
  if (age <= 21) return 1.15;
  if (age <= 24) return 0.9;
  if (age <= 27) return 0.5;
  if (age <= 29) return 0.25;
  if (age <= 31) return 0.08;
  return 0;
}

/** Weekly loss for veterans: physical attributes first, the rest from 33. */
function decline(age: number, attr: Attribute): number {
  if (age < 30) return 0;
  const physical = attr === "pace" || attr === "stamina" || attr === "physical";
  if (physical) return (age - 29) * 0.022;
  if (age >= 33 && attr !== "vision") return (age - 32) * 0.01;
  return 0;
}

interface TrainOptions {
  focus: TrainingFocus;
  intensity: Intensity;
  /** Extra sessions count less and don't age anyone. */
  extraSession?: boolean;
}

/** Trains one player; returns the attribute changes. */
export function trainPlayer(rng: Rng, club: Club, p: Player, opts: TrainOptions): Partial<Record<Attribute, number>> {
  const changes: Partial<Record<Attribute, number>> = {};
  const intensity = INTENSITY[opts.intensity];
  if (p.injuryWeeks > 0) return changes;

  // Keepers do keeper drills whatever the team does, outfielders skip them.
  let focus = FOCUS_ATTRIBUTES[opts.focus];
  if (p.position === "GK" && opts.focus !== "recovery") focus = {goalkeeping: 0.7, ...pick(focus, 0.3)};
  if (p.position !== "GK" && opts.focus === "goalkeeping") focus = {vision: 0.3};

  const ovr = overall(p);
  const room = clamp((p.potential - ovr) / 10, 0, 1.2);
  const quality = 0.7 + club.facilities * 0.1;
  const mood = (0.8 + 0.4 * (p.morale / 100)) * (0.9 + 0.2 * (p.form / 100));
  const starts = p.recentStarts.filter(Boolean).length;
  const minutes = 0.8 + 0.4 * (starts / 5);
  const session = opts.extraSession ? 0.5 : 1;
  const base = TRAINING_BASE_GAIN * ageFactor(p.age) * room * quality * intensity.gain * mood * minutes * session;

  for (const attr of ATTRIBUTES) {
    let delta = 0;
    // Natural development touches everything a little.
    const share = (focus[attr] ?? 0) + NATURAL_GAIN_SHARE / ATTRIBUTES.length;
    const individual = p.individualFocus === attr ? 0.35 : 0;
    if (base > 0) delta += base * (share + individual) * rng.range(0.5, 1.5);
    if (!opts.extraSession) delta -= decline(p.age, attr) * rng.range(0.6, 1.4);
    // An overall above potential can't keep climbing.
    if (delta > 0 && ovr >= p.potential) delta = 0;
    if (Math.abs(delta) > 0.0001) {
      p.attrs[attr] = clamp(p.attrs[attr] + delta, 1, 99);
      changes[attr] = delta;
    }
  }

  p.fitness = clamp(p.fitness + intensity.fitness * session - (opts.extraSession ? 6 : 0), 0, 100);
  if (opts.focus === "recovery") {
    p.fitness = clamp(p.fitness + 12, 0, 100);
    p.morale = clamp(p.morale + 2, 0, 100);
  }
  if (opts.focus === "conditioning") p.fitness = clamp(p.fitness - 3, 0, 100);

  // Hard work tires and annoys the less professional.
  const moodHit = intensity.mood * (1.2 - p.professionalism / 100);
  p.happiness = clamp(p.happiness + moodHit, 0, 100);

  const tired = p.fitness < 50 ? 1.6 : 1;
  if (opts.focus !== "recovery" && rng.chance(TRAINING_INJURY_CHANCE * intensity.injury * tired * session)) {
    p.injuryWeeks = rng.int(1, 3);
  }
  return changes;
}

function pick(focus: Partial<Record<Attribute, number>>, scale: number): Partial<Record<Attribute, number>> {
  const out: Partial<Record<Attribute, number>> = {};
  for (const [a, w] of Object.entries(focus)) out[a as Attribute] = (w ?? 0) * scale;
  return out;
}

/** AI clubs rotate programmes so their squads stay rounded. */
const AI_ROTATION: TrainingFocus[] = ["technique", "attack", "defense", "passing", "physical", "conditioning", "recovery"];

export function weeklyTraining(state: GameState, rng: Rng): void {
  for (const club of Object.values(state.clubs)) {
    const isUser = club.id === state.userClubId;
    const opts: TrainOptions = isUser
      ? state.training
      : {focus: AI_ROTATION[state.absWeek % AI_ROTATION.length], intensity: "normal"};
    for (const p of Object.values(state.players)) {
      if (p.clubId !== club.id) continue;
      p.weeklyChange = trainPlayer(rng, club, p, opts);
    }
  }
  // Free agents keep fit-ish and age like everyone else.
  for (const p of Object.values(state.players)) {
    if (p.clubId !== null) continue;
    for (const attr of ATTRIBUTES) p.attrs[attr] = clamp(p.attrs[attr] - decline(p.age, attr), 1, 99);
  }
}

/** An extra session for the user's squad, paid with energy. */
export function extraTraining(state: GameState, rng: Rng): void {
  const club = state.clubs[state.userClubId];
  for (const p of Object.values(state.players)) {
    if (p.clubId !== club.id) continue;
    const changes = trainPlayer(rng, club, p, {...state.training, extraSession: true});
    for (const [a, d] of Object.entries(changes)) {
      const attr = a as Attribute;
      p.weeklyChange[attr] = (p.weeklyChange[attr] ?? 0) + (d ?? 0);
    }
  }
}
