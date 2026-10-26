// The Champions Cup: the best clubs from every league. First four groups of
// four, everyone playing everyone once; the top two of each go through to a
// knockout bracket (quarters, semis, final), one match a tie with penalties if
// it's level. One round in each cup week (CUP_WEEKS).
//
// The clubs from other leagues are guests: built fresh each season with
// squads at their level, and kept out of the league table, the market and
// the weekly money.
import {CUP_DIAMONDS, CUP_ENTRY, CUP_FROM_LEAGUE, CUP_GROUP_DAYS, CUP_GROUP_WIN, CUP_GROUPS, CUP_PRIZE, CUP_QUALIFY, CUP_SIZE} from "./constants";
import {buildClub} from "./generate";
import {addMessage, book, cupFixturesInStage, leagueClubs, newId} from "./helpers";
import {LEAGUES, leagueById} from "./leagues";
import {clubStrength} from "./ratings";
import {Rng, clamp} from "./rng";
import type {CupFixture, GameState} from "./types";


export const GROUP_NAMES = ["A", "B", "C", "D"];
/** What each cup week is called (by stage). */
export const CUP_STAGES = ["cup.md1", "cup.md2", "cup.md3", "cup.qf", "cup.sf", "cup.final"] as const;
/** How far a club got: the group stage, quarters, semis, the final; one past the end is winning it. */
export const CUP_ROUNDS = ["cup.group", "cup.qf", "cup.sf", "cup.final"] as const;
/** The quarter-finals: group winners against the runners-up of the neighbouring group. [group, place] pairs, home first. */
const QUARTERS: [[number, number], [number, number]][] = [
  [[0, 0], [1, 1]],
  [[1, 0], [0, 1]],
  [[2, 0], [3, 1]],
  [[3, 0], [2, 1]],
];

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
  const groups = drawGroups(state, rng, clubIds);
  state.cup = {season: state.season, clubIds, groups, fixtures: groups.flatMap((g, i) => groupFixtures(state, g, i))};
  for (const id of fromLeague) book(state, id, "prize", CUP_ENTRY);
  const mine = groups.findIndex((g) => g.includes(state.userClubId));
  if (mine >= 0) {
    const rivals = groups[mine].filter((id) => id !== state.userClubId).map((id) => state.clubs[id].name).join(", ");
    addMessage(state, {kind: "news", key: "msg.cupGroup", params: {group: GROUP_NAMES[mine], rivals}});
  } else {
    addMessage(state, {kind: "news", key: "msg.cupMissed", params: {}});
  }
}

/**
 * The groups: the clubs in four pots by strength, one from each pot in every
 * group, so no group gets all the big names.
 */
function drawGroups(state: GameState, rng: Rng, clubIds: string[]): string[][] {
  const ranked = [...clubIds].sort((a, b) => clubStrength(state, b) - clubStrength(state, a));
  const groups: string[][] = Array.from({length: CUP_GROUPS}, () => []);
  for (let pot = 0; pot * CUP_GROUPS < ranked.length; pot++) {
    const drawn = rng.shuffle(ranked.slice(pot * CUP_GROUPS, pot * CUP_GROUPS + CUP_GROUPS));
    drawn.forEach((id, g) => groups[g].push(id));
  }
  return groups;
}

/** A group's three matchdays: everyone plays everyone once. */
function groupFixtures(state: GameState, ids: string[], group: number): CupFixture[] {
  const [a, b, c, d] = ids;
  const days: [string, string][][] = [
    [[a, b], [c, d]],
    [[a, c], [d, b]],
    [[d, a], [b, c]],
  ];
  return days.flatMap((pairs, stage) =>
    pairs.map(([homeId, awayId]) => ({id: newId(state, "f"), round: stage + 1, stage, group, homeId, awayId, played: false, homeGoals: 0, awayGoals: 0}))
  );
}

export interface GroupRow {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

/** A group's table: points, then goal difference, then goals scored. */
export function groupTable(state: GameState, group: number): GroupRow[] {
  const cup = state.cup;
  if (!cup?.groups?.[group]) return [];
  const rows = new Map<string, GroupRow>(cup.groups[group].map((id) => [id, {clubId: id, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0}]));
  for (const f of cup.fixtures) {
    if (f.group !== group || !f.played) continue;
    const h = rows.get(f.homeId);
    const a = rows.get(f.awayId);
    if (!h || !a) continue;
    h.played++;
    a.played++;
    h.goalsFor += f.homeGoals;
    h.goalsAgainst += f.awayGoals;
    a.goalsFor += f.awayGoals;
    a.goalsAgainst += f.homeGoals;
    if (f.homeGoals > f.awayGoals) {
      h.won++;
      a.lost++;
      h.points += 3;
    } else if (f.homeGoals < f.awayGoals) {
      a.won++;
      h.lost++;
      a.points += 3;
    } else {
      h.drawn++;
      a.drawn++;
      h.points++;
      a.points++;
    }
  }
  return [...rows.values()].sort(
    (x, y) => y.points - x.points || y.goalsFor - y.goalsAgainst - (x.goalsFor - x.goalsAgainst) || y.goalsFor - x.goalsFor || clubStrength(state, y.clubId) - clubStrength(state, x.clubId)
  );
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
 * After a cup week's matches. In the groups: prize money for wins, and after
 * the last matchday the quarter-finals. In the knockout: penalties where it
 * was level, prize money for the winners, then the next round (or the trophy).
 */
export function finishCupStage(state: GameState, rng: Rng, stage: number): void {
  const cup = state.cup;
  if (!cup) return;
  const user = state.userClubId;
  const fixtures = cupFixturesInStage(state, stage);

  if (stage < CUP_GROUP_DAYS) {
    for (const f of fixtures) {
      if (!f.played || f.homeGoals === f.awayGoals) continue;
      f.winnerId = f.homeGoals > f.awayGoals ? f.homeId : f.awayId;
      if (!state.clubs[f.winnerId].guest) book(state, f.winnerId, "prize", CUP_GROUP_WIN);
    }
    if (stage < CUP_GROUP_DAYS - 1) return;
    // The groups are done: the top two of each into the quarter-finals.
    const tables = cup.groups.map((_, g) => groupTable(state, g));
    for (const t of tables) for (const row of t.slice(0, 2)) if (!state.clubs[row.clubId].guest) book(state, row.clubId, "prize", CUP_QUALIFY);
    QUARTERS.forEach(([[hg, hp], [ag, ap]], slot) => {
      cup.fixtures.push({id: newId(state, "f"), round: CUP_GROUP_DAYS + 1, stage: CUP_GROUP_DAYS, slot, homeId: tables[hg][hp].clubId, awayId: tables[ag][ap].clubId, played: false, homeGoals: 0, awayGoals: 0});
    });
    const mine = cup.groups.findIndex((g) => g.includes(user));
    if (mine >= 0) {
      const place = tables[mine].findIndex((r) => r.clubId === user) + 1;
      if (place <= 2) {
        const opponent = opponentOf(state, CUP_GROUP_DAYS);
        addMessage(state, {kind: "news", key: "msg.cupGroupThrough", params: {group: GROUP_NAMES[mine], place, prize: CUP_QUALIFY, opponent: opponent ? state.clubs[opponent].name : "?"}});
      } else {
        addMessage(state, {kind: "news", key: "msg.cupGroupOut", params: {group: GROUP_NAMES[mine], place}});
      }
    }
    return;
  }

  const round = stage - CUP_GROUP_DAYS;
  const winners: {slot: number; id: string}[] = [];
  for (const f of fixtures) {
    if (!f.played) continue;
    // Level: penalties, unless the user already took them in the live match.
    if (f.homeGoals === f.awayGoals && !f.penalties) {
      f.penalties = shootout(rng, clubStrength(state, f.homeId), clubStrength(state, f.awayId));
    }
    const homeWon = f.homeGoals > f.awayGoals || (f.homeGoals === f.awayGoals && f.penalties![0] > f.penalties![1]);
    f.winnerId = homeWon ? f.homeId : f.awayId;
    winners.push({slot: f.slot ?? winners.length, id: f.winnerId});
    if (!state.clubs[f.winnerId].guest) book(state, f.winnerId, "prize", CUP_PRIZE[round]);

    if (f.homeId === user || f.awayId === user) {
      const won = f.winnerId === user;
      const params = {stage: CUP_STAGES[stage], opponent: state.clubs[f.homeId === user ? f.awayId : f.homeId].name, prize: CUP_PRIZE[round]};
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
    cup.winnerId = winners[0]?.id;
    if (cup.winnerId && cup.winnerId !== user) {
      addMessage(state, {kind: "news", key: "msg.cupChampion", params: {club: state.clubs[cup.winnerId].name}});
    }
    return;
  }
  // Down the bracket: the winners of slots 0 and 1 meet, 2 and 3, and so on.
  winners.sort((a, b) => a.slot - b.slot);
  for (let i = 0; i + 1 < winners.length; i += 2) {
    cup.fixtures.push({id: newId(state, "f"), round: stage + 2, stage: stage + 1, slot: i / 2, homeId: winners[i].id, awayId: winners[i + 1].id, played: false, homeGoals: 0, awayGoals: 0});
  }
  const opponent = opponentOf(state, stage + 1);
  if (opponent) addMessage(state, {kind: "news", key: "msg.cupDraw", params: {stage: CUP_STAGES[stage + 1], opponent: state.clubs[opponent].name}});
}

/** The user's opponent in a stage, if they're in it. */
function opponentOf(state: GameState, stage: number): string | undefined {
  const f = cupFixturesInStage(state, stage).find((x) => x.homeId === state.userClubId || x.awayId === state.userClubId);
  return f ? (f.homeId === state.userClubId ? f.awayId : f.homeId) : undefined;
}

/** How far the user got this season (an index into CUP_ROUNDS; its length means they won it); undefined if not in it. */
export function userCupResult(state: GameState): number | undefined {
  const cup = state.cup;
  if (!cup || !cup.clubIds.includes(state.userClubId)) return undefined;
  if (cup.winnerId === state.userClubId) return CUP_ROUNDS.length;
  const mine = cup.fixtures.filter((f) => f.homeId === state.userClubId || f.awayId === state.userClubId);
  return Math.max(0, ...mine.map((f) => f.stage - CUP_GROUP_DAYS + 1));
}

/** The clubs still in it: everyone during the groups, then those not knocked out. */
export function cupAlive(state: GameState): string[] {
  const cup = state.cup;
  if (!cup) return [];
  const knockout = cup.fixtures.filter((f) => f.stage >= CUP_GROUP_DAYS);
  if (knockout.length === 0) return cup.clubIds;
  const out = new Set(knockout.filter((f) => f.winnerId).map((f) => (f.winnerId === f.homeId ? f.awayId : f.homeId)));
  return [...new Set(knockout.flatMap((f) => [f.homeId, f.awayId]))].filter((id) => !out.has(id));
}
