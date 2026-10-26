// Builds a fresh world: clubs, squads, free agents and fixtures.
import {
  DIAMONDS_START,
  ENERGY_MAX,
  FIRST_SEASON,
  FORMATIONS,
  SAVE_VERSION,
  SQUAD_TEMPLATE,
} from "./constants";
import {leagueById, type ClubTemplate} from "./leagues";
import {NATIONALITIES} from "./names";
import {POSITION_WEIGHTS, expectedWage, marketValue, overall, wageBill} from "./ratings";
import {Rng, clamp} from "./rng";
import {pickBestLineup} from "./lineup";
import {makeFixtures} from "./league";
import {setupCup} from "./cup";
import {addMessage, newId} from "./helpers";
import {
  ATTRIBUTES,
  FORMATION_IDS,
  POSITIONS,
  type Attributes,
  type Club,
  type GameState,
  type ManagerLook,
  type Player,
  type PlayersGender,
  type Position,
  type SquadRole,
} from "./types";

/** Stars per club, strongest club first: 2, 1, 1, 1, 1, then none. */
const STARS_PER_CLUB = [2, 1, 1, 1, 1];
const STAR_POSITIONS: Position[] = ["ST", "ST", "AM", "W", "W", "CM", "CB", "GK"];

interface PlayerSpec {
  position: Position;
  /** Target overall. */
  level: number;
  age: number;
  clubId: string | null;
  season: number;
  potential?: number;
  /** Where most come from; defaults to the user's league's country. Null means the usual Nordic mix. */
  home?: string | null;
}

/** A nationality; in a league with a home country, about 60% are from there. */
function pickNationality(state: GameState, rng: Rng, from?: string | null): string {
  const codes = Object.keys(NATIONALITIES);
  const home = from === undefined ? leagueById(state.leagueId).home : (from ?? undefined);
  const others = codes.reduce((s, c) => s + (c === home ? 0 : NATIONALITIES[c].weight), 0);
  return rng.weighted(codes, (c) => (c === home ? others * 1.5 : NATIONALITIES[c].weight));
}

/** Attributes shaped by the position, scaled so the overall lands on `level`. */
function makeAttributes(rng: Rng, pos: Position, level: number): Attributes {
  const weights = POSITION_WEIGHTS[pos];
  const attrs = {} as Attributes;
  for (const attr of ATTRIBUTES) {
    const w = weights[attr] ?? 0;
    // Important attributes sit above the level, unimportant ones below.
    let value = level + (w - 0.1) * 60 + rng.normal(0, 6);
    if (attr === "goalkeeping" && pos !== "GK") value = rng.range(5, 20);
    if (pos === "GK" && (attr === "finishing" || attr === "defending")) value = rng.range(10, 30);
    attrs[attr] = value;
  }
  // Shift the weighted attributes onto the target. Attributes stop at 99, so
  // for the very best players the rest of the gap goes to those with room left.
  for (const attr of ATTRIBUTES) attrs[attr] = clamp(attrs[attr], 1, 99);
  for (let i = 0; i < 8; i++) {
    let rating = 0;
    for (const [a, w] of Object.entries(weights)) rating += attrs[a as keyof Attributes] * (w ?? 0);
    const diff = level - rating;
    if (Math.abs(diff) < 0.05) break;
    const open = (Object.keys(weights) as (keyof Attributes)[]).filter((a) => (diff > 0 ? attrs[a] < 99 : attrs[a] > 1));
    const openWeight = open.reduce((s, a) => s + (weights[a] ?? 0), 0);
    if (openWeight <= 0) break;
    for (const a of open) attrs[a] = clamp(attrs[a] + diff / openWeight, 1, 99);
  }
  for (const attr of ATTRIBUTES) attrs[attr] = clamp(Math.round(attrs[attr] * 10) / 10, 1, 99);
  return attrs;
}

/** The surnames not yet used at the club (all of them if every one is taken, or for a free agent). */
function freshSurnames(state: GameState, clubId: string | null | undefined, surnames: string[]): string[] {
  if (!clubId) return surnames;
  const used = new Set(Object.values(state.players).filter((p) => p.clubId === clubId).map((p) => p.lastName));
  const fresh = surnames.filter((n) => !used.has(n));
  return fresh.length > 0 ? fresh : surnames;
}

export function createPlayer(state: GameState, rng: Rng, spec: PlayerSpec): Player {
  const nationality = pickNationality(state, rng, spec.home);
  const names = NATIONALITIES[nationality];
  const attrs = makeAttributes(rng, spec.position, spec.level);
  const youngRoom = Math.max(0, 24 - spec.age) * rng.range(0.8, 3.2);
  const potential = Math.round(clamp(spec.potential ?? spec.level + youngRoom + rng.range(0, 3), spec.level, 99));
  // Mixed leagues draw a coin per player; the others draw nothing, so men's leagues come out as before.
  const mode = state.playersGender ?? "men";
  const female = mode === "women" || (mode === "mix" && rng.chance(0.5));
  const player: Player = {
    id: newId(state, "p"),
    firstName: rng.pick(female ? names.female : names.first),
    lastName: rng.pick(freshSurnames(state, spec.clubId, names.last)),
    age: spec.age,
    ...(female ? {gender: "f" as const} : {}),
    nationality,
    position: spec.position,
    attrs,
    potential,
    form: rng.int(40, 60),
    fitness: rng.int(85, 100),
    morale: rng.int(55, 75),
    sharpness: rng.int(50, 70),
    happiness: rng.int(55, 80),
    relation: 50,
    professionalism: rng.int(20, 95),
    clubId: spec.clubId,
    contract: {
      wage: 0,
      expiresSeason: spec.season + rng.int(0, 4),
      signingBonus: 0,
      goalBonus: 0,
      appearanceBonus: 0,
      releaseClause: null,
      role: "rotation",
    },
    injuryWeeks: 0,
    suspension: 0,
    yellowCount: 0,
    stats: {apps: 0, starts: 0, goals: 0, assists: 0, yellow: 0, red: 0, ratingSum: 0},
    value: 0,
    recentStarts: [],
    weeklyChange: {},
    seasonStartAttrs: {...attrs},
    transferListed: false,
    loanListed: false,
    wantsToLeave: false,
    rejectedTransferWeeks: 0,
    brokenPromises: 0,
    lastTalkWeek: -10,
    lastComplaintWeek: -10,
    loan: null,
    individualFocus: null,
  };
  const wage = expectedWage(player) * rng.range(0.85, 1.15);
  player.contract.wage = Math.round(wage / 50) * 50;
  player.contract.goalBonus = ["ST", "W", "AM"].includes(spec.position) ? Math.round(wage * 0.1 / 50) * 50 : 0;
  player.contract.appearanceBonus = Math.round(wage * 0.05 / 50) * 50;
  player.value = marketValue(player, spec.season);
  state.players[player.id] = player;
  return player;
}

function randomAge(rng: Rng): number {
  return Math.round(clamp(rng.normal(25.5, 4), 18, 35));
}

/** Gives every player in the squad a contract role by rank. */
export function assignRoles(state: GameState, clubId: string): void {
  const squad = Object.values(state.players)
    .filter((p) => p.clubId === clubId)
    .sort((a, b) => overall(b) - overall(a));
  squad.forEach((p, i) => {
    let role: SquadRole = i < 11 ? "key" : i < 17 ? "rotation" : "reserve";
    if (p.age <= 19 && i >= 11) role = "youth";
    p.contract.role = role;
  });
}

export function createSquad(state: GameState, rng: Rng, club: Club, avg: number, home?: string | null): void {
  for (const pos of POSITIONS) {
    for (let i = 0; i < SQUAD_TEMPLATE[pos]; i++) {
      // The first two at each position are near starter level, the rest backups.
      const starterish = i < Math.ceil(SQUAD_TEMPLATE[pos] / 2);
      const level = Math.round(avg + (starterish ? rng.range(0, 6) : rng.range(-10, -2)));
      createPlayer(state, rng, {position: pos, level, age: randomAge(rng), clubId: club.id, season: state.season, home});
    }
  }
  // Two academy talents per club.
  for (let i = 0; i < 2; i++) {
    createPlayer(state, rng, {
      position: rng.pick(POSITIONS.filter((p) => p !== "GK")),
      level: Math.round(avg - rng.range(14, 22)),
      age: rng.int(17, 19),
      clubId: club.id,
      season: state.season,
      home,
    });
  }
  assignRoles(state, club.id);
}

/** Free agents to sign: mostly modest, a few bargains. */
export function createFreeAgents(state: GameState, rng: Rng, count: number): void {
  for (let i = 0; i < count; i++) {
    createPlayer(state, rng, {
      position: rng.pick(POSITIONS),
      level: Math.round(clamp(rng.normal(55, 7), 40, 72)),
      age: Math.round(clamp(rng.normal(27, 5), 18, 35)),
      clubId: null,
      season: state.season,
    });
  }
}

/**
 * A club with its squad, the `rank`-th strongest of `leagueSize`: reputation
 * from about 88 down to 40, and stars at the biggest clubs. `home` is where
 * most of the players come from (see PlayerSpec.home).
 */
export function buildClub(state: GameState, rng: Rng, t: ClubTemplate, rank: number, leagueSize: number, home?: string | null, extra: Partial<Club> = {}): Club {
  const reputation = Math.round(88 - rank * (48 / (leagueSize - 1)));
  const club: Club = {
    id: newId(state, "c"),
    ...t,
    reputation,
    capacity: Math.round((8_000 + reputation * 380) / 500) * 500,
    ticketPrice: Math.round(10 + reputation * 0.12),
    facilities: clamp(Math.round(reputation / 20), 1, 5),
    cash: Math.round((1_500_000 + reputation * 110_000) / 50_000) * 50_000,
    transferBudget: 0,
    wageBudget: 0,
    sponsorWeekly: Math.round((15_000 + reputation * 1_600) / 1_000) * 1_000,
    formation: rng.pick(FORMATION_IDS),
    mentality: "balanced",
    lineup: [],
    bench: [],
    installments: [],
    ...extra,
  };
  state.clubs[club.id] = club;
  createSquad(state, rng, club, Math.round(50 + reputation * 0.28), home);
  // The biggest clubs have stars: the very biggest a world-class player (90+).
  const stars = STARS_PER_CLUB[rank] ?? 0;
  for (let s = 0; s < stars; s++) {
    createPlayer(state, rng, {
      position: rng.pick(STAR_POSITIONS),
      level: Math.round(rank === 0 && s === 0 ? rng.range(92, 95) : rng.range(85, 90)),
      age: rng.int(24, 30),
      clubId: club.id,
      season: state.season,
      home,
    });
  }
  if (stars > 0) assignRoles(state, club.id);
  club.transferBudget = Math.round((club.cash * 0.45) / 50_000) * 50_000;
  club.wageBudget = Math.round((wageBill(state, club.id) * 1.08) / 1_000) * 1_000;
  const {lineup, bench} = pickBestLineup(state, club, FORMATIONS[club.formation]);
  club.lineup = lineup;
  club.bench = bench;
  return club;
}

/** World-class free agents (97–99) on the market, per position. */
export const WORLD_CLASS_PER_POSITION = 2;
// Their own random stream, so the rest of the world comes out as before.
const WORLD_CLASS_SALT = 0x5eed97;
const CUP_SALT = 0xc0b;

/**
 * The best players in the world, without a club: a couple at every position,
 * rated 97–99. No transfer fee, but they want wages to match.
 */
function createWorldClass(state: GameState, rng: Rng): void {
  for (const position of POSITIONS) {
    for (let i = 0; i < WORLD_CLASS_PER_POSITION; i++) {
      createPlayer(state, rng, {position, level: rng.int(97, 99), age: rng.int(26, 31), clubId: null, season: state.season});
    }
  }
}

export function newGame(
  managerName: string,
  clubIndex: number,
  seed: number,
  managerLook?: ManagerLook,
  playersGender: PlayersGender = "men",
  leagueId = "nordic"
): GameState {
  const league = leagueById(leagueId);
  const rng = new Rng(seed);
  const state: GameState = {
    version: SAVE_VERSION,
    rngState: 0,
    managerName,
    managerLook,
    playersGender,
    userClubId: "",
    leagueName: league.name,
    leagueId: league.id,
    season: FIRST_SEASON,
    week: 1,
    absWeek: 1,
    clubs: {},
    players: {},
    fixtures: [],
    scouted: {},
    scoutQueue: [],
    inbox: [],
    promises: [],
    incomingBids: [],
    reports: [],
    finance: {weeks: [], season: {}, current: {}},
    training: {focus: "technique", intensity: "normal", auto: true},
    monetization: {
      energy: ENERGY_MAX,
      energyAt: Date.now(),
      diamonds: DIAMONDS_START,
      exchangesThisSeason: 0,
      extraTrainingsThisWeek: 0,
      lastDailyBonus: "",
    },
    history: [],
    nextId: 0,
  };

  league.clubs.forEach((t, i) => buildClub(state, rng, t, i, league.clubs.length));

  createFreeAgents(state, rng, 45);

  // Wonderkids: teenagers who can become the best in the league, spread over random clubs.
  const allClubs = Object.values(state.clubs);
  for (let k = 0; k < 3; k++) {
    const club = rng.pick(allClubs);
    createPlayer(state, rng, {
      position: rng.pick(STAR_POSITIONS),
      level: Math.round(rng.range(60, 67)),
      age: rng.int(17, 18),
      clubId: club.id,
      season: state.season,
      potential: Math.round(rng.range(91, 97)),
    });
    assignRoles(state, club.id);
  }
  // And one experienced star without a club, for whoever can afford the wages.
  createPlayer(state, rng, {position: rng.pick(STAR_POSITIONS), level: Math.round(rng.range(85, 88)), age: rng.int(31, 33), clubId: null, season: state.season});

  const clubIds = Object.keys(state.clubs);
  state.userClubId = clubIds[clamp(clubIndex, 0, clubIds.length - 1)];
  // Prices look after themselves to begin with; the manager can take over in Finance.
  state.clubs[state.userClubId].ticketAuto = true;
  state.fixtures = makeFixtures(state, rng, clubIds);
  createWorldClass(state, new Rng(seed ^ WORLD_CLASS_SALT));
  setupCup(state, new Rng(seed ^ CUP_SALT));
  for (const id of Object.keys(state.players)) {
    if (state.players[id].clubId === state.userClubId) state.scouted[id] = 0;
  }

  addMessage(state, {
    kind: "news",
    key: "msg.welcome",
    params: {manager: managerName, club: state.clubs[state.userClubId].name, league: league.name},
  });
  state.rngState = rng.state;
  return state;
}
