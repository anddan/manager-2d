// Happiness (long-term) and what unhappy players do about it, plus the
// manager's talks and the promises they create.
import {addMessage, newId, playerName} from "./helpers";
import {recentPointsPerGame} from "./league";
import {deservedRole, expectedWage, overall} from "./ratings";
import {Rng, clamp} from "./rng";
import type {GameState, Player, SquadRole} from "./types";

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
