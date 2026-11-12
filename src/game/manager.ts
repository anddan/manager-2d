// The manager's level and title. The manager earns XP for what they do in the game (winning and drawing matches, winning titles, buying and
// selling players, signing and renewing contracts, tournaments with the national team) and goes up in level (1..100). A new title is
// unlocked in the album every tenth level (the last step, to the very top at level 100, is twenty), and each title above the first brings a
// present (diamonds or money) the moment it is reached. It is meant to be hard to get a new title.
//
// The higher the level, the more the players listen: "Forza!" and the orders given (and the way the team presses) bite harder. A country's
// federation offers a better national team to a manager with a higher title.
import {ENERGY_MAX} from "./constants";
import {addMessage, book} from "./helpers";
import type {GameState} from "./types";

/** The top level: the manager is "Sir". */
export const MAX_LEVEL = 100;

/** The present for a title (the first, the start, has none). */
export interface TitleReward {
  diamonds?: number;
  money?: number;
}

/** The titles, from the first: the level each is reached at, and its present. (Their names are `mgr.level.1` .. `mgr.level.10`: the first is "no title", the last is "Sir" and the manager's name.) */
export const MANAGER_TITLES: {level: number; reward: TitleReward | null}[] = [
  {level: 1, reward: null},
  {level: 10, reward: {diamonds: 5}},
  {level: 20, reward: {diamonds: 10}},
  {level: 30, reward: {money: 500_000}},
  {level: 40, reward: {diamonds: 25}},
  {level: 50, reward: {money: 1_500_000}},
  {level: 60, reward: {diamonds: 50}},
  {level: 70, reward: {diamonds: 100}},
  {level: 80, reward: {money: 15_000_000}},
  {level: 100, reward: {diamonds: 250}},
];
export const TITLE_COUNT = MANAGER_TITLES.length;

/** What the manager has done: XP. (The titles are in the album, where the presents for them are collected.) */
export interface ManagerProgress {
  xp: number;
}

export function managerXp(state: GameState): number {
  return state.manager?.xp ?? 0;
}

/** The XP at level 20 (the second title); the levels up to it go up by 5 x (level - 1) squared. */
const XP_AT_20 = 1805;
/** How steeply the levels above 20 go up, so that the very top (level 100, "Sir") is 100 000 XP. */
const STEEP = Math.log(100_000 / XP_AT_20) / Math.log(99 / 19);

/** The XP it takes to reach a level: a little more for each one, and steeper above level 20 (the top, level 100, is 100 000 XP: a very long career). */
export function xpAtLevel(level: number): number {
  if (level <= 1) return 0;
  if (level <= 20) return 5 * (level - 1) * (level - 1);
  return Math.round(XP_AT_20 * ((level - 1) / 19) ** STEEP);
}

/** The level (1..100) that an amount of XP is. */
export function levelOf(xp: number): number {
  let lo = 1;
  let hi = MAX_LEVEL;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (xp >= xpAtLevel(mid)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Which title (1..10) a level has reached. */
export function titleOf(level: number): number {
  let n = 1;
  MANAGER_TITLES.forEach((t, i) => { if (level >= t.level) n = i + 1; });
  return n;
}

export function managerLevel(state: GameState): number {
  return levelOf(managerXp(state));
}

/** Where the manager is on the way to the next level (how much of the stretch is done, 1 at the top) and which title is next. */
export function managerStanding(state: GameState): {level: number; xp: number; from: number; to: number | null; share: number; title: number; next: {title: number; level: number} | null} {
  const xp = managerXp(state);
  const level = levelOf(xp);
  const from = xpAtLevel(level);
  const to = level < MAX_LEVEL ? xpAtLevel(level + 1) : null;
  const title = titleOf(level);
  const next = title < TITLE_COUNT ? {title: title + 1, level: MANAGER_TITLES[title].level} : null;
  return {level, xp, from, to, share: to === null ? 1 : (xp - from) / (to - from), title, next};
}

/** How much the players listen to the manager, 0 (level 1) to 1 (the very top). */
export function managerAuthority(state: GameState): number {
  return (managerLevel(state) - 1) / (MAX_LEVEL - 1);
}

/** A small present for every level up: something at random (diamonds most often, money, a little energy, now and then a big one). */
export type LevelGift = {kind: "diamonds" | "money" | "energy"; n: number};

function mix(a: number, b: number): number {
  let h = (Math.imul(a ^ 0x9e3779b9, 2654435761) ^ Math.imul(b + 0x85ebca6b, 2246822519)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

/** The present for reaching a level: the same for the same level and manager (a seed from the name). */
export function levelGift(level: number, seed: number): LevelGift {
  const r = mix(level, seed) % 100;
  const q = mix(seed, level * 7 + 1);
  if (r < 45) return {kind: "diamonds", n: 1 + (q % 5)};
  if (r < 80) return {kind: "money", n: Math.round(((50_000 + level * 10_000) * (1 + (q % 4))) / 10_000) * 10_000};
  if (r < 95) return {kind: "energy", n: 2 + (q % 3)};
  return {kind: "diamonds", n: 10};
}

/** Gives XP. A new level is a small present (random) and a nice effect; a new title has a bigger present, collected in the album, and a message about it. */
export function addManagerXp(state: GameState, amount: number): void {
  const xp = Math.round(amount);
  if (!(xp > 0)) return;
  const m = (state.manager ??= {xp: 0});
  const levelBefore = levelOf(m.xp);
  const titleBefore = titleOf(levelBefore);
  m.xp += xp;
  const levelAfter = levelOf(m.xp);
  const titleAfter = titleOf(levelAfter);
  for (let n = titleBefore + 1; n <= titleAfter; n++) announceTitle(state, n);
  if (levelAfter <= levelBefore) return;
  // Every level up has its own present, and the screen says so (levels that come together are shown as one).
  let seed = 7;
  for (const c of state.managerName) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const gifts: LevelGift[] = [];
  for (let lv = levelBefore + 1; lv <= levelAfter; lv++) gifts.push(levelGift(lv, seed));
  for (const g of gifts) {
    if (g.kind === "diamonds") state.monetization.diamonds += g.n;
    else if (g.kind === "money") book(state, state.userClubId, "reward", g.n);
    else state.monetization.energy = Math.min(ENERGY_MAX, state.monetization.energy + g.n);
  }
  const queue = (state.celebrations ??= []);
  const last = queue[queue.length - 1];
  const title = titleAfter > titleBefore ? titleAfter : undefined;
  if (last?.kind === "level") {
    last.level = levelAfter;
    last.gifts.push(...gifts);
    if (title) last.title = title;
  } else queue.push({kind: "level", level: levelAfter, gifts, ...(title ? {title} : {})});
}

/** A new title is reached: a message (the present is collected in the album). */
function announceTitle(state: GameState, title: number): void {
  addMessage(state, {
    kind: "news",
    // (The very top title is "Sir" and the manager's name.)
    key: title === TITLE_COUNT ? "msg.managerTitleSir" : "msg.managerTitle",
    params: {title: `mgr.level.${title}`, name: state.managerName, level: MANAGER_TITLES[title - 1].level},
    highlight: true,
  });
}

// ---- what gives XP ----

/** XP for a match: a win is worth the most, a draw something, a loss a little (you learn); cups and tournaments count more, friendlies less. */
export function matchXp(ours: number, theirs: number, kind: "league" | "cup" | "tournament" | "friendly" = "league"): number {
  const base = ours > theirs ? 40 : ours === theirs ? 15 : 5;
  const factor = kind === "cup" ? 1.5 : kind === "tournament" ? 1.25 : kind === "friendly" ? 0.6 : 1;
  const margin = ours - theirs >= 3 ? 10 : 0;
  const clean = theirs === 0 && ours > 0 ? 5 : 0;
  return Math.round(base * factor + margin + clean);
}

/** XP for buying or selling a player: more for a big deal (up to +40 on top of 10). */
export function transferXp(fee: number): number {
  return 10 + Math.min(40, Math.round(fee / 500_000));
}

/** XP for signing a new contract or renewing one. */
export const CONTRACT_XP = 8;

/** XP for the season: the league (the title, the podium), the cup. */
export function seasonXp(position: number, cupWon: boolean): number {
  return (position === 1 ? 400 : position <= 3 ? 120 : position <= 6 ? 40 : 0) + (cupWon ? 300 : 0);
}

/** XP for a national tournament: the title, the final, the semi-final. */
export function tournamentXp(place: 0 | 1 | 2 | 3): number {
  return place === 1 ? 800 : place === 2 ? 400 : place === 3 ? 250 : 0;
}

/**
 * Which countries (by their rank, 0 = the strongest) may offer the manager the national team: a rookie is asked by the smaller ones, a
 * better title by better ones, and the best managers in the world by the strongest of all.
 */
export function offerRange(level: number): [number, number] {
  if (level >= MAX_LEVEL) return [0, 4];
  if (level >= 70) return [0, 8];
  if (level >= 50) return [3, 14];
  if (level >= 30) return [8, 22];
  return [14, 32];
}
