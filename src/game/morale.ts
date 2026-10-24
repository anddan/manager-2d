// Happiness (long-term) and what unhappy players do about it, plus the
// manager's talks and the promises they create.
import {addMessage, newId, playerName} from "./helpers";
import {recentPointsPerGame} from "./league";
import {deservedRole, expectedWage, overall, teamOvr} from "./ratings";
import {Rng, clamp} from "./rng";
import type {GameState, MatchReport, Player, SquadRole} from "./types";

const EXPECTED_STARTS: Record<SquadRole, number> = {key: 0.75, rotation: 0.45, reserve: 0.2, youth: 0.1};
const ROLE_RANK: Record<SquadRole, number> = {key: 3, rotation: 2, reserve: 1, youth: 0};

export interface HappinessFactor {
  key: string;
  value: number;
}

/** Why a player feels the way they do; also the target happiness drifts to. */
export function happinessFactors(state: GameState, p: Player): HappinessFactor[] {
  const club = p.clubId ? state.clubs[p.clubId] : undefined;
  if (!club) return [];
  const factors: HappinessFactor[] = [];
  const played = p.recentStarts.length;
  if (played > 0) {
    const share = p.recentStarts.filter(Boolean).length / played;
    factors.push({key: "playingTime", value: clamp((share - EXPECTED_STARTS[p.contract.role]) * 30, -18, 8)});
  }
  factors.push({key: "results", value: clamp((recentPointsPerGame(state, club.id) - 1.4) * 6, -8, 8)});
  const wageRatio = p.contract.wage / expectedWage(p);
  factors.push({key: "wage", value: clamp((wageRatio - 1) * 25, -15, 8)});
  if (club.id === state.userClubId) {
    const t = state.training.intensity;
    if (t !== "normal") factors.push({key: "training", value: t === "hard" ? -4 * (1.2 - p.professionalism / 100) : 1.5});
  }
  const deserved = deservedRole(state, p, club);
  if (ROLE_RANK[deserved] > ROLE_RANK[p.contract.role]) factors.push({key: "role", value: -6});
  if (p.rejectedTransferWeeks > 0) factors.push({key: "rejectedTransfer", value: -15});
  if (p.brokenPromises > 0) factors.push({key: "brokenPromise", value: -12 * p.brokenPromises});
  const yearsLeft = p.contract.expiresSeason - state.season;
  if (yearsLeft <= 0 && ROLE_RANK[deserved] >= 2) factors.push({key: "contract", value: -6});
  factors.push({key: "relation", value: (p.relation - 50) * 0.2});
  return factors.filter((f) => Math.abs(f.value) >= 0.5).map((f) => ({...f, value: Math.round(f.value)}));
}

export function targetHappiness(state: GameState, p: Player): number {
  return clamp(62 + happinessFactors(state, p).reduce((s, f) => s + f.value, 0), 0, 100);
}

/** Weekly mood update for every club player, with consequences. */
export function weeklyMorale(state: GameState, rng: Rng): void {
  const unhappyStars: Record<string, number> = {};
  for (const p of Object.values(state.players)) {
    if (!p.clubId) continue;
    p.happiness = clamp(p.happiness + (targetHappiness(state, p) - p.happiness) * 0.25, 0, 100);
    // Morale drifts back towards how happy they are.
    p.morale = clamp(p.morale + (p.happiness - p.morale) * 0.1, 0, 100);
    p.form = clamp(p.form + (50 - p.form) * 0.05, 0, 100);
    if (p.rejectedTransferWeeks > 0) p.rejectedTransferWeeks--;
    if (p.brokenPromises > 0 && rng.chance(0.06)) p.brokenPromises--;
    if (p.happiness < 30 && (p.contract.role === "key" || overall(p) >= 70)) {
      unhappyStars[p.clubId] = (unhappyStars[p.clubId] ?? 0) + 1;
    }
    if (p.clubId === state.userClubId) userConsequences(state, rng, p);
    else if (p.happiness < 25 && !p.transferListed) p.transferListed = true;
  }

  // Unhappy key players sour the dressing room.
  for (const [clubId, count] of Object.entries(unhappyStars)) {
    for (const p of Object.values(state.players)) {
      if (p.clubId === clubId) p.morale = clamp(p.morale - 2 * count, 0, 100);
    }
    if (clubId === state.userClubId && count >= 2 && rng.chance(0.4)) {
      addMessage(state, {kind: "player", key: "msg.badAtmosphere", params: {count}});
    }
  }
}

function userConsequences(state: GameState, rng: Rng, p: Player): void {
  const name = playerName(state, p.id);
  const sinceComplaint = state.absWeek - p.lastComplaintWeek;
  if (sinceComplaint < 6) return;
  const factors = happinessFactors(state, p);
  const get = (key: string) => factors.find((f) => f.key === key)?.value ?? 0;

  if (p.happiness < 25 && !p.wantsToLeave) {
    p.wantsToLeave = true;
    p.lastComplaintWeek = state.absWeek;
    addMessage(state, {kind: "player", key: "msg.transferRequest", params: {name}, action: {type: "transferRequest", playerId: p.id}});
  } else if (p.happiness < 45 && get("playingTime") <= -8 && rng.chance(0.5)) {
    p.lastComplaintWeek = state.absWeek;
    addMessage(state, {kind: "player", key: "msg.wantsPlayingTime", params: {name}, action: {type: "player", playerId: p.id}});
  } else if (p.happiness < 50 && get("wage") <= -6 && rng.chance(0.4)) {
    p.lastComplaintWeek = state.absWeek;
    addMessage(state, {kind: "player", key: "msg.wantsRaise", params: {name}, action: {type: "contract", playerId: p.id}});
  }
}

export const TALKS = ["praise", "criticize", "promisePlayingTime"] as const;
export type Talk = (typeof TALKS)[number];

/** Result key for the UI, e.g. "talk.praise.good". */
export function talkToPlayer(state: GameState, rng: Rng, playerId: string, talk: Talk): string {
  const p = state.players[playerId];
  if (state.absWeek - p.lastTalkWeek < 1) return "talk.tooSoon";
  p.lastTalkWeek = state.absWeek;
  const goodForm = p.form >= 55;
  const poorForm = p.form < 45;

  if (talk === "praise") {
    if (goodForm) {
      p.happiness = clamp(p.happiness + 4, 0, 100);
      p.morale = clamp(p.morale + 6, 0, 100);
      p.relation = clamp(p.relation + 3, 0, 100);
      return "talk.praise.good";
    }
    p.relation = clamp(p.relation + 1, 0, 100);
    return "talk.praise.hollow";
  }

  if (talk === "criticize") {
    if (poorForm && rng.chance(p.professionalism / 100)) {
      p.morale = clamp(p.morale + 6, 0, 100);
      p.relation = clamp(p.relation + 1, 0, 100);
      return "talk.criticize.works";
    }
    const hit = poorForm ? 1 : 1.6;
    p.morale = clamp(p.morale - 8 * hit, 0, 100);
    p.relation = clamp(p.relation - 6 * hit, 0, 100);
    p.happiness = clamp(p.happiness - 4 * hit, 0, 100);
    return poorForm ? "talk.criticize.hurt" : "talk.criticize.unfair";
  }

  if (state.promises.some((pr) => pr.playerId === playerId)) return "talk.promise.exists";
  state.promises.push({id: newId(state, "pr"), playerId, matchesLeft: 5, requiredStarts: 3, starts: 0});
  p.happiness = clamp(p.happiness + 8, 0, 100);
  p.relation = clamp(p.relation + 3, 0, 100);
  if (p.wantsToLeave && p.happiness >= 35) p.wantsToLeave = false;
  return "talk.promise.made";
}

// The team talk after a match. What lands depends on how the result compares
// with what was expected (team strengths, home or away): praise after a poor
// display rings hollow, a telling-off after a fine win is unfair, and the same
// words every week wear thin.

export const TEAM_TALKS = ["praise", "calm", "demand", "disappointed"] as const;
export type TeamTalk = (typeof TEAM_TALKS)[number];
export const PLAYER_TALKS = ["praise", "criticize"] as const;
export type PlayerTalk = (typeof PLAYER_TALKS)[number];
/** How a talk went down: 1 it hit home, 0 shrugged off, -1 it backfired. */
export type TalkFit = -1 | 0 | 1;

export interface MatchVerdict {
  result: "W" | "D" | "L";
  /** Goal difference against what the strengths said: + better than expected. */
  surprise: number;
  /** "better" | "expected" | "worse", for the UI. */
  how: "better" | "expected" | "worse";
}

/** How the user's match went compared with what was expected. */
export function matchVerdict(state: GameState, report: MatchReport): MatchVerdict {
  const home = report.homeId === state.userClubId;
  const us = home ? report.homeGoals : report.awayGoals;
  const them = home ? report.awayGoals : report.homeGoals;
  const opponent = home ? report.awayId : report.homeId;
  // About a goal for every five points of team strength, and a little for home.
  const expected = clamp((teamOvr(state, state.userClubId) - teamOvr(state, opponent)) / 5 + (home ? 0.3 : -0.3), -4, 4);
  const surprise = us - them - expected;
  return {
    result: us > them ? "W" : us === them ? "D" : "L",
    surprise,
    how: surprise >= 1.2 ? "better" : surprise <= -1.2 ? "worse" : "expected",
  };
}

/** Whether a team talk suits the match. */
export function talkFit(talk: TeamTalk, v: MatchVerdict): TalkFit {
  switch (talk) {
    case "praise":
      // Deserved after a win (unless scraped against much weaker) or a draw against the odds.
      if (v.result === "W") return v.how === "worse" ? 0 : 1;
      if (v.how === "better") return v.result === "D" ? 1 : 0;
      return v.result === "D" ? 0 : -1;
    case "calm":
      // Never wrong; right after a draw, or a defeat that was no disgrace.
      if (v.result === "D" || (v.result === "L" && v.how !== "worse")) return 1;
      return 0;
    case "demand":
      // "You can do better": they didn't do what they could. Unfair after a fine display.
      if (v.how === "worse" && !(v.result === "L" && v.surprise <= -3)) return 1;
      if (v.how === "better" || (v.result === "W" && v.how === "expected")) return -1;
      return 0;
    case "disappointed":
      // A poor defeat deserves it; a win never does.
      if (v.result === "L" && v.how !== "better") return v.how === "worse" ? 1 : 0;
      if (v.result === "W" || v.how === "better") return -1;
      return 0;
  }
}

export interface TalkResult {
  fit: TalkFit;
  /** "tt.react.<talk>.<good|meh|bad>" */
  key: string;
  /** Average morale change among those who played. */
  morale: number;
  /** Heard it too often lately. */
  worn: boolean;
  player?: {id: string; key: string};
}

const FIT_NAME = {1: "good", 0: "meh", [-1]: "bad"} as const;

/**
 * The manager's words after the match: one for the team, and optionally one
 * for a single player who played. Players who played feel it fully, the
 * bench half. Tough talk works on professionals; praise works on everyone,
 * when it's deserved.
 */
export function teamTalk(state: GameState, rng: Rng, report: MatchReport, talk: TeamTalk, single?: {playerId: string; talk: PlayerTalk}): TalkResult {
  const v = matchVerdict(state, report);
  const fit = talkFit(talk, v);
  // The same words again: each of the last three times takes some of the effect away.
  const history = state.talkHistory ?? [];
  const repeats = history.slice(-3).filter((t) => t === talk).length;
  const wear = 1 / (1 + repeats * 0.7);
  state.talkHistory = [...history, talk].slice(-5);

  const side = report.homeId === state.userClubId ? "home" : "away";
  const played = new Set(report.lineups[side].filter((id) => report.ratings[id] !== undefined));
  let total = 0;
  let count = 0;
  for (const p of Object.values(state.players)) {
    if (p.clubId !== state.userClubId) continue;
    const share = played.has(p.id) || report.ratings[p.id] !== undefined ? 1 : 0.5;
    const tough = talk === "demand" || talk === "disappointed";
    let morale = 0;
    let happiness = 0;
    let relation = 0;
    if (fit === 1) {
      morale = (tough ? 2 + (6 * p.professionalism) / 100 : 6) * wear;
      happiness = tough ? (p.professionalism < 40 ? -1 : 0) : 2 * wear;
      relation = 1;
    } else if (fit === 0) {
      morale = talk === "calm" || talk === "praise" ? 1 * wear : tough ? (p.professionalism - 50) / 25 : 0;
    } else {
      // Praise after a poor game: they know better. Tough words after a good one: unfair.
      morale = talk === "praise" ? -2 : -7;
      happiness = talk === "praise" ? 0 : -4;
      relation = talk === "praise" ? -1 : -3;
    }
    p.morale = clamp(p.morale + morale * share, 0, 100);
    p.happiness = clamp(p.happiness + happiness * share, 0, 100);
    p.relation = clamp(p.relation + relation * share, 0, 100);
    if (share === 1) {
      total += morale;
      count++;
    }
  }

  const result: TalkResult = {fit, key: `tt.react.${talk}.${FIT_NAME[fit]}`, morale: count ? total / count : 0, worn: repeats >= 2 && fit >= 0};
  if (single && state.players[single.playerId]) result.player = {id: single.playerId, key: playerTalk(state, rng, report, single.playerId, single.talk)};
  return result;
}

/** A word with one player about their game: judged on their match rating. */
function playerTalk(state: GameState, rng: Rng, report: MatchReport, playerId: string, talk: PlayerTalk): string {
  const p = state.players[playerId];
  const rating = report.ratings[playerId] ?? 6;
  const scored = report.events.some((e) => e.type === "goal" && e.playerId === playerId);
  p.lastTalkWeek = state.absWeek;
  if (talk === "praise") {
    if (rating >= 7.2 || scored) {
      p.happiness = clamp(p.happiness + 4, 0, 100);
      p.morale = clamp(p.morale + 6, 0, 100);
      p.relation = clamp(p.relation + 3, 0, 100);
      return "tt.player.praise.good";
    }
    if (rating < 6.2) {
      p.relation = clamp(p.relation - 1, 0, 100);
      return "tt.player.praise.bad";
    }
    p.morale = clamp(p.morale + 2, 0, 100);
    return "tt.player.praise.meh";
  }
  if (rating >= 6.8 || scored) {
    p.morale = clamp(p.morale - 10, 0, 100);
    p.happiness = clamp(p.happiness - 8, 0, 100);
    p.relation = clamp(p.relation - 8, 0, 100);
    return "tt.player.criticize.bad";
  }
  if (rating < 6.1 && rng.chance(p.professionalism / 100)) {
    p.morale = clamp(p.morale + 5, 0, 100);
    return "tt.player.criticize.good";
  }
  p.morale = clamp(p.morale - 5, 0, 100);
  p.happiness = clamp(p.happiness - 3, 0, 100);
  return "tt.player.criticize.meh";
}

/** After each user match: count starts and judge promises that are due. */
export function updatePromises(state: GameState, lineup: string[]): void {
  const kept: typeof state.promises = [];
  for (const pr of state.promises) {
    const p = state.players[pr.playerId];
    if (!p || p.clubId !== state.userClubId) continue; // Gone, promise void.
    if (lineup.includes(pr.playerId)) pr.starts++;
    pr.matchesLeft--;
    const name = playerName(state, p.id);
    if (pr.starts >= pr.requiredStarts) {
      p.happiness = clamp(p.happiness + 10, 0, 100);
      p.relation = clamp(p.relation + 8, 0, 100);
      addMessage(state, {kind: "player", key: "msg.promiseKept", params: {name}});
    } else if (pr.matchesLeft <= 0) {
      p.brokenPromises++;
      p.happiness = clamp(p.happiness - 20, 0, 100);
      p.relation = clamp(p.relation - 20, 0, 100);
      addMessage(state, {kind: "player", key: "msg.promiseBroken", params: {name}, action: {type: "player", playerId: p.id}});
    } else {
      kept.push(pr);
    }
  }
  state.promises = kept;
}

/** The manager answers a transfer request. */
export function answerTransferRequest(state: GameState, playerId: string, accept: boolean): void {
  const p = state.players[playerId];
  if (accept) {
    p.transferListed = true;
  } else {
    p.wantsToLeave = false;
    p.rejectedTransferWeeks = 10;
    p.relation = clamp(p.relation - 10, 0, 100);
    p.happiness = clamp(p.happiness - 8, 0, 100);
  }
}
