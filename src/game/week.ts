// The weekly loop, in two halves so the user's match can be played live:
//   startWeek:  injuries heal -> other matches -> the user's match is set up
//   (the user watches and plays the match: penalties, free kicks)
//   finishWeek: the user's match counts -> training -> moods -> market -> money -> season end
// advanceWeek does both at once, with the computer deciding every set piece.
import {DIAMONDS_SEASON, ENERGY_COST_MATCH, FORMATIONS, SEASON_WEEKS} from "./constants";
import {payPrizeMoney, setSeasonBudgets, weeklyFinances} from "./finance";
import {assignRoles, createFreeAgents, createPlayer} from "./generate";
import {addMessage, currentRound, fixturesInRound, fullName, playerName} from "./helpers";
import {makeFixtures, standings} from "./league";
import {pickBestLineup, repairLineup} from "./lineup";
import {applyMatch, simulateMatch} from "./match";
import {spendEnergy} from "./monetization";
import {updatePromises, weeklyMorale} from "./morale";
import {clubStrength, marketValue} from "./ratings";
import {Rng, clamp} from "./rng";
import {weeklyTraining} from "./training";
import {weeklyTransfers} from "./transfers";
import {POSITIONS, type GameState, type MatchReport} from "./types";

export type StartResult = {ok: true; live: boolean} | {ok: false; reason: string};
export type AdvanceResult = {ok: true; report?: MatchReport} | {ok: false; reason: string};

/**
 * First half of the week. Plays every other match in the round and, if the
 * user has a match, sets it up in `state.liveMatch` to be played live.
 */
export function startWeek(state: GameState, rng: Rng, now: number, opts = {useEnergy: true}): StartResult {
  if (state.liveMatch) return {ok: true, live: true};
  const round = currentRound(state);
  if (round !== null && opts.useEnergy && !spendEnergy(state.monetization, ENERGY_COST_MATCH, now)) {
    return {ok: false, reason: "err.noEnergy"};
  }

  // Healing happens across the week, before the next match.
  for (const p of Object.values(state.players)) {
    if (p.injuryWeeks > 0) {
      p.injuryWeeks--;
      if (p.injuryWeeks === 0 && p.clubId === state.userClubId) {
        addMessage(state, {kind: "player", key: "msg.recovered", params: {name: playerName(state, p.id)}, action: {type: "player", playerId: p.id}});
      }
    }
  }

  if (round === null) return {ok: true, live: false};
  const fixtures = fixturesInRound(state, round);
  for (const f of fixtures) {
    prepareAiTeam(state, f.homeId, f.awayId);
    prepareAiTeam(state, f.awayId, f.homeId);
  }
  const user = state.clubs[state.userClubId];
  if (repairLineup(state, user)) {
    addMessage(state, {kind: "match", key: "msg.lineupFixed", params: {}});
  }
  let live = false;
  for (const f of fixtures) {
    if (f.homeId === state.userClubId || f.awayId === state.userClubId) {
      // Fixed seed: reloading mid-match replays the same match, not a new one.
      state.liveMatch = {fixtureId: f.id, seed: rng.int(1, 2 ** 31 - 1), inputs: {}, commands: []};
      live = true;
    } else {
      applyMatch(state, simulateMatch(state, rng, f, false));
    }
  }
  return {ok: true, live};
}

/**
 * Second half of the week. Counts the user's live match (replayed from its
 * seed and the user's set-piece choices), then runs the rest of the week.
 */
export function finishWeek(state: GameState, rng: Rng): MatchReport | undefined {
  let userReport: MatchReport | undefined;
  const live = state.liveMatch;
  if (live) {
    const f = state.fixtures.find((x) => x.id === live.fixtureId)!;
    const user = state.clubs[state.userClubId];
    const managed = f.homeId === user.id ? "home" : "away";
    const report = simulateMatch(state, new Rng(live.seed), f, true, live.inputs, live.commands ?? [], managed);
    applyMatch(state, report);
    state.liveMatch = null;
    userReport = report;
    state.reports.unshift(report);
    if (state.reports.length > 6) state.reports.length = 6;
    updatePromises(state, user.lineup);
    const opponent = state.clubs[f.homeId === user.id ? f.awayId : f.homeId];
    addMessage(state, {
      kind: "match",
      key: "msg.matchResult",
      params: {home: state.clubs[f.homeId].name, away: state.clubs[f.awayId].name, hg: report.homeGoals, ag: report.awayGoals, opponent: opponent.name},
      action: {type: "match", fixtureId: f.id},
    });
    for (const e of report.events) {
      if (e.type === "injury" && e.playerId && state.players[e.playerId].clubId === user.id) {
        addMessage(state, {
          kind: "player",
          key: "msg.injured",
          params: {name: playerName(state, e.playerId), weeks: state.players[e.playerId].injuryWeeks},
          action: {type: "player", playerId: e.playerId},
        });
      }
    }
  }

  const round = currentRound(state);
  const homeClubs = new Set(round === null ? [] : fixturesInRound(state, round).map((f) => f.homeId));
  weeklyTraining(state, rng);
  weeklyMorale(state, rng);
  weeklyTransfers(state, rng);
  weeklyFinances(state, homeClubs);
  for (const p of Object.values(state.players)) p.value = marketValue(p, state.season);

  state.monetization.extraTrainingsThisWeek = 0;
  state.week++;
  state.absWeek++;
  if (state.week > SEASON_WEEKS) endSeason(state, rng);
  return userReport;
}

/** A whole week in one go; the computer decides the user's set pieces. */
export function advanceWeek(state: GameState, rng: Rng, now: number, opts = {useEnergy: true}): AdvanceResult {
  const started = startWeek(state, rng, now, opts);
  if (!started.ok) return started;
  return {ok: true, report: finishWeek(state, rng)};
}

/** AI picks its best eleven and a mentality based on the opponent. */
function prepareAiTeam(state: GameState, clubId: string, opponentId: string): void {
  if (clubId === state.userClubId) return;
  const club = state.clubs[clubId];
  const diff = clubStrength(state, clubId) - clubStrength(state, opponentId);
  club.mentality = diff > 4 ? "attacking" : diff < -4 ? "defensive" : "balanced";
  const picked = pickBestLineup(state, club, FORMATIONS[club.formation]);
  club.lineup = picked.lineup;
  club.bench = picked.bench;
}

function endSeason(state: GameState, rng: Rng): void {
  const table = standings(state);
  const order = table.map((row) => row.club.id);
  payPrizeMoney(state, order);
  const userPosition = order.indexOf(state.userClubId) + 1;
  state.history.push({season: state.season, championId: order[0], userPosition});
  const m = state.monetization;
  m.diamonds += userPosition === 1 ? DIAMONDS_SEASON.champion : userPosition <= 3 ? DIAMONDS_SEASON.top3 : DIAMONDS_SEASON.rest;
  addMessage(state, {
    kind: "news",
    key: "msg.seasonEnd",
    params: {season: state.season, champion: state.clubs[order[0]].name, position: userPosition},
  });

  // Loans come home, then expiring contracts end.
  for (const p of Object.values(state.players)) {
    if (p.loan) {
      p.clubId = p.loan.parentClubId;
      p.loan = null;
    }
  }
  const leaving: string[] = [];
  for (const p of Object.values(state.players)) {
    if (p.clubId && p.contract.expiresSeason <= state.season) {
      if (p.clubId === state.userClubId) leaving.push(`${fullName(p)}`);
      p.clubId = null;
      p.transferListed = false;
      p.wantsToLeave = false;
    }
  }
  if (leaving.length > 0) addMessage(state, {kind: "player", key: "msg.contractsExpired", params: {names: leaving.join(", ")}});

  // Birthdays and retirements.
  const retired: string[] = [];
  for (const p of Object.values(state.players)) {
    p.age++;
    if (p.age >= 34 && rng.chance(clamp(0.35 * (p.age - 33), 0, 0.95))) {
      if (p.clubId === state.userClubId) retired.push(`${fullName(p)}`);
      delete state.players[p.id];
    }
  }
  if (retired.length > 0) addMessage(state, {kind: "player", key: "msg.retired", params: {names: retired.join(", ")}});

  // Drop anything pointing at players who left or retired.
  state.incomingBids = state.incomingBids.filter((b) => state.players[b.playerId]?.clubId === state.userClubId);
  state.promises = state.promises.filter((pr) => state.players[pr.playerId]?.clubId === state.userClubId);
  state.scoutQueue = state.scoutQueue.filter((id) => state.players[id]);

  state.season++;
  state.week = 1;

  // Academy intake: two or three hopefuls per club.
  for (const club of Object.values(state.clubs)) {
    const level = clubStrength(state, club.id);
    const count = rng.int(2, 3);
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const p = createPlayer(state, rng, {
        position: rng.pick(POSITIONS),
        level: Math.round(level - rng.range(16, 24)),
        age: rng.int(16, 17),
        clubId: club.id,
        season: state.season,
        potential: Math.round(clamp(level + rng.normal(0, 8) + club.facilities, 45, 92)),
      });
      p.contract.expiresSeason = state.season + 2;
      p.contract.role = "youth";
      if (club.id === state.userClubId) {
        names.push(`${fullName(p)}`);
        state.scouted[p.id] = state.absWeek;
      }
    }
    if (club.id === state.userClubId) addMessage(state, {kind: "player", key: "msg.youthIntake", params: {names: names.join(", ")}});
  }

  const freeAgents = Object.values(state.players).filter((p) => !p.clubId).length;
  if (freeAgents < 40) createFreeAgents(state, rng, 20);

  for (const p of Object.values(state.players)) {
    p.stats = {apps: 0, starts: 0, goals: 0, assists: 0, yellow: 0, red: 0, ratingSum: 0};
    p.yellowCount = 0;
    p.suspension = 0;
    p.seasonStartAttrs = {...p.attrs};
    p.value = marketValue(p, state.season);
  }

  state.fixtures = makeFixtures(state, rng, Object.keys(state.clubs));
  state.finance.season = {};
  state.monetization.exchangesThisSeason = 0;
  setSeasonBudgets(state);
  for (const club of Object.values(state.clubs)) {
    if (club.id !== state.userClubId) assignRoles(state, club.id);
    repairLineup(state, club);
  }
  addMessage(state, {kind: "news", key: "msg.newSeason", params: {season: state.season}});
}
