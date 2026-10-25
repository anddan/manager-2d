// The weekly loop, in two halves so the user's match can be played live:
//   startWeek:  injuries heal -> other matches -> the user's match is set up
//   (the user watches and plays the match: penalties, free kicks)
//   finishWeek: the user's match counts -> training -> moods -> market -> money -> season end
// advanceWeek does both at once, with the computer deciding every set piece.
import {CUP_WEEKS, DIAMONDS_SEASON, ENERGY_COST_MATCH, FORMATIONS, SEASON_WEEKS} from "./constants";
import {payPrizeMoney, seasonBoardReview, setSeasonBudgets, weeklyFinances} from "./finance";
import {assignRoles, createFreeAgents, createPlayer} from "./generate";
import {finishCupStage, setupCup, userCupResult} from "./cup";
import {taskProgress} from "./daily";
import {tutorialMatchSeed} from "./tutorial";
import {addMessage, cupFixturesInStage, currentCupStage, currentRound, findFixture, fixturesInRound, fullName, leagueClubs, playerName} from "./helpers";
import {makeFixtures, standings} from "./league";
import {pickBestLineup, repairLineup} from "./lineup";
import {applyMatch, simulateMatch} from "./match";
import {spendEnergy} from "./monetization";
import {updatePromises, weeklyMorale} from "./morale";
import {clubStrength, marketValue} from "./ratings";
import {Rng, clamp} from "./rng";
import {weeklyTraining} from "./training";
import {weeklyTransfers} from "./transfers";
import {POSITIONS, type Fixture, type GameState, type MatchReport} from "./types";

export type StartResult = {ok: true; live: boolean} | {ok: false; reason: string};
export type AdvanceResult = {ok: true; report?: MatchReport} | {ok: false; reason: string};

/**
 * First half of the week. Plays every other match in the round and, if the
 * user has a match, sets it up in `state.liveMatch` to be played live.
 */
export function startWeek(state: GameState, rng: Rng, now: number, opts = {useEnergy: true}): StartResult {
  if (state.gameOver) return {ok: false, reason: "err.gameOver"};
  if (state.liveMatch) return {ok: true, live: true};
  // Old saves have no cup yet: set one up if this season's hasn't started, else wait for the next.
  if ((!state.cup || state.cup.season !== state.season) && state.week <= CUP_WEEKS[0]) setupCup(state, rng);
  const round = currentRound(state);
  const stage = currentCupStage(state);
  const fixtures: Fixture[] = round !== null ? fixturesInRound(state, round) : stage !== null ? cupFixturesInStage(state, stage) : [];
  const userPlays = fixtures.some((f) => f.homeId === state.userClubId || f.awayId === state.userClubId);
  if (userPlays && opts.useEnergy && !spendEnergy(state.monetization, ENERGY_COST_MATCH, now)) {
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

  if (fixtures.length === 0) return {ok: true, live: false};
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
      let seed = rng.int(1, 2 ** 31 - 1);
      // The guide's first match: one with a penalty to take and a win.
      if (state.tutorial && !state.tutorial.firstMatch) {
        state.tutorial.firstMatch = true;
        seed = tutorialMatchSeed(state, f, f.homeId === state.userClubId ? "home" : "away", seed);
      }
      state.liveMatch = {fixtureId: f.id, seed, inputs: {}, commands: []};
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
    const f = findFixture(state, live.fixtureId)!;
    const user = state.clubs[state.userClubId];
    const managed = f.homeId === user.id ? "home" : "away";
    const report = simulateMatch(state, new Rng(live.seed), f, true, live.inputs, live.commands ?? [], managed);
    applyMatch(state, report);
    state.liveMatch = null;
    userReport = report;
    // Today's tasks: a win, goals.
    const ours = f.homeId === user.id ? report.homeGoals : report.awayGoals;
    const theirs = f.homeId === user.id ? report.awayGoals : report.homeGoals;
    if (ours > theirs) taskProgress(state, "win");
    taskProgress(state, "goals", ours);
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
  const stage = currentCupStage(state);
  const played: Fixture[] = round !== null ? fixturesInRound(state, round) : stage !== null ? cupFixturesInStage(state, stage) : [];
  const homeClubs = new Set(played.map((f) => f.homeId));
  if (stage !== null) finishCupStage(state, rng, stage);
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
  seasonBoardReview(state);
  const userPosition = order.indexOf(state.userClubId) + 1;
  const cup = userCupResult(state);
  state.history.push({season: state.season, championId: order[0], userPosition, ...(cup !== undefined ? {cup} : {})});
  if (userPosition === 1) state.celebrations = [...(state.celebrations ?? []), {kind: "league", season: state.season}];
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
    if (p.clubId && !state.clubs[p.clubId]?.guest && p.contract.expiresSeason <= state.season) {
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
  for (const club of leagueClubs(state)) {
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

  state.fixtures = makeFixtures(state, rng, leagueClubs(state).map((c) => c.id));
  state.finance.season = {};
  state.monetization.exchangesThisSeason = 0;
  setSeasonBudgets(state);
  for (const club of leagueClubs(state)) {
    if (club.id !== state.userClubId) assignRoles(state, club.id);
    repairLineup(state, club);
  }
  setupCup(state, rng, order);
  addMessage(state, {kind: "news", key: "msg.newSeason", params: {season: state.season}});
}
