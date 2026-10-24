// Daily tasks and rewarded videos.
//
// Every calendar day brings three tasks, each worth a few diamonds; doing all
// three earns a free bronze pack. Rewarded videos are always optional and
// always pay: an energy point when the bar is low (a few a day), and a
// diamond bonus after a win (once per match).
//
// Videos go through a mock ad provider for now (see `mockAdProvider`). A real
// ad network must be set up for a children's audience before launch: no
// personalised ads, child-safe content only, no tracking.
import {ENERGY_MAX} from "./constants";
import {regenerateEnergy} from "./monetization";
import {openPack} from "./packs";
import type {Rng} from "./rng";
import type {GameState} from "./types";

export const TASK_KINDS = ["win", "goals", "order", "talk", "train", "pack", "video"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

/** How much each task asks for, and what it pays. */
export const TASKS: Record<TaskKind, {target: number; reward: number}> = {
  win: {target: 1, reward: 8},
  goals: {target: 3, reward: 6},
  order: {target: 1, reward: 4},
  talk: {target: 1, reward: 4},
  train: {target: 1, reward: 5},
  pack: {target: 1, reward: 5},
  video: {target: 1, reward: 3},
};
export const TASKS_PER_DAY = 3;
/** Energy from videos, per day. */
export const ENERGY_VIDEOS_PER_DAY = 3;
/** Diamonds for the video after a win. */
export const WIN_VIDEO_DIAMONDS = 3;

export interface DailyTask {
  kind: TaskKind;
  progress: number;
  claimed: boolean;
}

export interface Daily {
  /** The calendar day (YYYY-MM-DD) these are for. */
  day: string;
  tasks: DailyTask[];
  bonusClaimed: boolean;
  energyVideos: number;
  /** The match whose win-video has been watched. */
  winVideoFixture?: string;
}

/** A number from the day, so everyone gets the same tasks that day (and a reload doesn't reshuffle). */
function seedOf(day: string): number {
  let h = 2166136261;
  for (const c of day) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Today's tasks: picked fresh on a new day, otherwise kept as they are. */
export function ensureDaily(state: GameState, today: string): Daily {
  if (state.daily?.day === today) return state.daily;
  const kinds = [...TASK_KINDS];
  let seed = seedOf(today);
  const picked: TaskKind[] = [];
  while (picked.length < TASKS_PER_DAY) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    picked.push(kinds.splice(seed % kinds.length, 1)[0]);
  }
  state.daily = {day: today, tasks: picked.map((kind) => ({kind, progress: 0, claimed: false})), bonusClaimed: false, energyVideos: 0};
  return state.daily;
}

/** Counts towards today's task of that kind, if there is one. */
export function taskProgress(state: GameState, kind: TaskKind, amount = 1): void {
  const task = state.daily?.tasks.find((t) => t.kind === kind);
  if (task) task.progress = Math.min(TASKS[kind].target, task.progress + amount);
}

export function taskDone(task: DailyTask): boolean {
  return task.progress >= TASKS[task.kind].target;
}

/** Collects a finished task's diamonds; the diamonds given, or 0. */
export function claimTask(state: GameState, index: number): number {
  const task = state.daily?.tasks[index];
  if (!task || task.claimed || !taskDone(task)) return 0;
  task.claimed = true;
  const reward = TASKS[task.kind].reward;
  state.monetization.diamonds += reward;
  return reward;
}

/** All three done and collected: a free bronze pack. The new player's id, or an error key. */
export function claimDailyBonus(state: GameState, rng: Rng): {playerId: string} | {error: string} {
  const daily = state.daily;
  if (!daily || daily.bonusClaimed || !daily.tasks.every((t) => t.claimed)) return {error: "daily.notYet"};
  // The pack is on the house: give its price, then open it.
  state.monetization.diamonds += 20;
  const res = openPack(state, rng, "bronze");
  if ("error" in res) {
    state.monetization.diamonds -= 20;
    return res;
  }
  daily.bonusClaimed = true;
  return res;
}

/** After watching a video for energy: +1 ⚡ (a few times a day). An error key if not allowed. */
export function videoForEnergy(state: GameState, today: string, now: number): string | null {
  const daily = ensureDaily(state, today);
  const m = state.monetization;
  regenerateEnergy(m, now);
  if (m.energy >= ENERGY_MAX) return "shop.energyFull";
  if (daily.energyVideos >= ENERGY_VIDEOS_PER_DAY) return "video.limit";
  daily.energyVideos++;
  m.energy++;
  if (m.energy >= ENERGY_MAX) m.energyAt = now;
  taskProgress(state, "video");
  return null;
}

/** After watching the video for a won match: bonus diamonds, once per match. */
export function videoAfterWin(state: GameState, today: string, fixtureId: string): string | null {
  const daily = ensureDaily(state, today);
  if (daily.winVideoFixture === fixtureId) return "video.done";
  daily.winVideoFixture = fixtureId;
  state.monetization.diamonds += WIN_VIDEO_DIAMONDS;
  taskProgress(state, "video");
  return null;
}

/**
 * Stand-in for an ad network's rewarded video. The UI plays a short fake
 * advert; swap this for the real SDK (set up for children) before launch.
 */
export const mockAdProvider = {
  /** Seconds the advert runs before the reward can be collected. */
  seconds: 5,
};
