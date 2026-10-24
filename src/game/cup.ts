// The Champions Cup: the best clubs from every league, knockout, one match a
// tie with penalties if it's level. Round of 16, quarters, semis and a final,
// one each in the cup weeks (CUP_WEEKS), about every month and a half.
//
// The clubs from other leagues are guests: built fresh each season with
// squads at their level, and kept out of the league table, the market and
// the weekly money.
import {CUP_DIAMONDS, CUP_ENTRY, CUP_FROM_LEAGUE, CUP_PRIZE, CUP_SIZE} from "./constants";
import {buildClub} from "./generate";
import {addMessage, book, cupFixturesInStage, leagueClubs, newId} from "./helpers";
import {LEAGUES, leagueById} from "./leagues";
import {clubStrength} from "./ratings";
import {Rng, clamp} from "./rng";
import type {CupFixture, GameState} from "./types";

export const CUP_STAGES = ["cup.r16", "cup.qf", "cup.sf", "cup.final"] as const;

/** Removes last season's guests: their clubs, players and anything pointing at them. */
function dropGuests(state: GameState): void {
  const guests = new Set(Object.values(state.clubs).filter((c) => c.guest).map((c) => c.id));
  if (guests.size === 0) return;
  for (const p of Object.values(state.players)) {
    if (p.clubId && guests.has(p.clubId)) {
      delete state.players[p.id];
      delete state.scouted[p.id];
    }
  }
  for (const id of guests) delete state.clubs[id];
  state.reports = state.reports.filter((r) => state.clubs[r.homeId] && state.clubs[r.awayId]);
}

/**
 * Sets up this season's cup. `order` is the user's league, best first: last
 * season's table, or reputation in the first season. The top four go in;
 * the rest of the field are the top clubs of the other leagues.
 */
export function setupCup(state: GameState, rng: Rng, order?: string[]): void {
  dropGuests(state);
  const home = leagueClubs(state);
  const ranked = order?.filter((id) => state.clubs[id]) ?? home.slice().sort((a, b) => b.reputation - a.reputation).map((c) => c.id);
  const fromLeague = ranked.slice(0, CUP_FROM_LEAGUE);
  // The first season has no table yet: the manager's club gets a wildcard.
  if (!order && !fromLeague.includes(state.userClubId)) fromLeague[fromLeague.length - 1] = state.userClubId;

  // The other leagues: their champions first, then runners-up, and so on.
  const others = LEAGUES.filter((l) => l.id !== leagueById(state.leagueId).id);
  const guests: string[] = [];
  for (let rank = 0; guests.length < CUP_SIZE - fromLeague.length && rank < 14; rank++) {
    for (const league of others) {
      if (guests.length >= CUP_SIZE - fromLeague.length || !league.clubs[rank]) continue;
      const club = buildClub(state, rng, league.clubs[rank], rank, league.clubs.length, league.home ?? null, {guest: true, country: league.flag});
      guests.push(club.id);
    }
  }

  const clubIds = [...fromLeague, ...guests];
  state.cup = {season: state.season, clubIds, fixtures: draw(state, rng, clubIds, 0)};
  for (const id of fromLeague) book(state, id, "prize", CUP_ENTRY);
  const opponent = opponentOf(state, 0);
  if (opponent) {
    addMessage(state, {kind: "news", key: "msg.cupDraw", params: {stage: CUP_STAGES[0], opponent: state.clubs[opponent].name}});
  } else {
    addMessage(state, {kind: "news", key: "msg.cupMissed", params: {}});
  }
}

/** Pairs the clubs at random; the first drawn is at home. */
function draw(state: GameState, rng: Rng, clubIds: string[], stage: number): CupFixture[] {
  const ids = rng.shuffle([...clubIds]);
  const fixtures: CupFixture[] = [];
  for (let i = 0; i + 1 < ids.length; i += 2) {
    fixtures.push({id: newId(state, "f"), round: stage + 1, stage, homeId: ids[i], awayId: ids[i + 1], played: false, homeGoals: 0, awayGoals: 0});
  }
  return fixtures;
}

/** The user's opponent in a stage, if they're in it. */
function opponentOf(state: GameState, stage: number): string | undefined {
  const f = cupFixturesInStage(state, stage).find((x) => x.homeId === state.userClubId || x.awayId === state.userClubId);
  return f ? (f.homeId === state.userClubId ? f.awayId : f.homeId) : undefined;
}

/**
 * A shoot-out: five each, then sudden death. Stronger sides score a little
 * more often. Returns the score.
 */
export function shootout(rng: Rng, homeStrength: number, awayStrength: number): [number, number] {
  const p = (s: number) => clamp(0.72 + (s - 70) / 250, 0.6, 0.85);
  const score: [number, number] = [0, 0];
  for (let k = 0; k < 5; k++) {
    if (rng.chance(p(homeStrength))) score[0]++;
    if (rng.chance(p(awayStrength))) score[1]++;
  }
  while (score[0] === score[1]) {
    const h = rng.chance(p(homeStrength));
    const a = rng.chance(p(awayStrength));
    if (h) score[0]++;
    if (a) score[1]++;
  }
  return score;
}

/**
 * Whether a shoot-out is decided, from the score and the kicks each side has
 * taken (home kicks first). In the first five each, as soon as one side can't
 * catch up; after that, sudden death: a pair of kicks with one scored.
 */
export function shootoutOver(score: [number, number], taken: [number, number]): boolean {
  if (taken[0] < 5 || taken[1] < 5) {
    return score[0] + (5 - taken[0]) < score[1] || score[1] + (5 - taken[1]) < score[0];
  }
  return taken[0] === taken[1] && score[0] !== score[1];
}

/**
 * After a cup week's matches: penalties where it was level, prize money for
 * the winners, then the draw for the next stage (or the trophy).
 */
export function finishCupStage(state: GameState, rng: Rng, stage: number): void {
  const cup = state.cup;
  if (!cup) return;
  const fixtures = cupFixturesInStage(state, stage);
  const winners: string[] = [];
  for (const f of fixtures) {
    if (!f.played) continue;
    // Level: penalties, unless the user already took them in the live match.
    if (f.homeGoals === f.awayGoals && !f.penalties) {
      f.penalties = shootout(rng, clubStrength(state, f.homeId), clubStrength(state, f.awayId));
    }
    const homeWon = f.homeGoals > f.awayGoals || (f.homeGoals === f.awayGoals && f.penalties![0] > f.penalties![1]);
    f.winnerId = homeWon ? f.homeId : f.awayId;
    winners.push(f.winnerId);
    if (!state.clubs[f.winnerId].guest) book(state, f.winnerId, "prize", CUP_PRIZE[stage]);

    const user = state.userClubId;
    if (f.homeId === user || f.awayId === user) {
      const won = f.winnerId === user;
      const params = {stage: CUP_STAGES[stage], opponent: state.clubs[f.homeId === user ? f.awayId : f.homeId].name, prize: CUP_PRIZE[stage]};
      if (won && stage === CUP_STAGES.length - 1) {
        state.monetization.diamonds += CUP_DIAMONDS;
        state.celebrations = [...(state.celebrations ?? []), {kind: "cup", season: state.season}];
        addMessage(state, {kind: "news", key: "msg.cupWon", params: {...params, diamonds: CUP_DIAMONDS}});
      } else {
        addMessage(state, {kind: "news", key: won ? "msg.cupThrough" : "msg.cupOut", params});
      }
    }
  }

  if (stage === CUP_STAGES.length - 1) {
    cup.winnerId = winners[0];
    if (winners[0] && winners[0] !== state.userClubId) {
      addMessage(state, {kind: "news", key: "msg.cupChampion", params: {club: state.clubs[winners[0]].name}});
    }
    return;
  }
  cup.fixtures.push(...draw(state, rng, winners, stage + 1));
  const opponent = opponentOf(state, stage + 1);
  if (opponent) addMessage(state, {kind: "news", key: "msg.cupDraw", params: {stage: CUP_STAGES[stage + 1], opponent: state.clubs[opponent].name}});
}

/** How far the user got this season: 0 round of 16 … 3 final, 4 won; undefined if not in it. */
export function userCupResult(state: GameState): number | undefined {
  const cup = state.cup;
  if (!cup || !cup.clubIds.includes(state.userClubId)) return undefined;
  if (cup.winnerId === state.userClubId) return CUP_STAGES.length;
  const mine = cup.fixtures.filter((f) => f.homeId === state.userClubId || f.awayId === state.userClubId);
  return Math.max(0, ...mine.map((f) => f.stage));
}

/** The clubs still in it (not knocked out yet). */
export function cupAlive(state: GameState): string[] {
  const cup = state.cup;
  if (!cup) return [];
  const out = new Set(cup.fixtures.filter((f) => f.winnerId).map((f) => (f.winnerId === f.homeId ? f.awayId : f.homeId)));
  return cup.clubIds.filter((id) => !out.has(id));
}
