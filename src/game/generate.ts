// Builds a fresh world: clubs, squads, free agents and fixtures.
import {
  DIAMONDS_START,
  ENERGY_MAX,
  FIRST_SEASON,
  FORMATIONS,
  SAVE_VERSION,
  SQUAD_TEMPLATE,
} from "./constants";
import {CLUB_TEMPLATES, LEAGUE_NAME, NATIONALITIES} from "./names";
import {POSITION_WEIGHTS, expectedWage, marketValue, overall, wageBill} from "./ratings";
import {Rng, clamp} from "./rng";
import {pickBestLineup} from "./lineup";
import {makeFixtures} from "./league";
import {addMessage, newId} from "./helpers";
import {
  ATTRIBUTES,
  FORMATION_IDS,
  POSITIONS,
  type Attributes,
  type Club,
  type GameState,
  type Player,
  type Position,
  type SquadRole,
} from "./types";

interface PlayerSpec {
  position: Position;
  /** Target overall. */
  level: number;
  age: number;
  clubId: string | null;
  season: number;
  potential?: number;
}

function pickNationality(rng: Rng): string {
  const codes = Object.keys(NATIONALITIES);
  return rng.weighted(codes, (c) => NATIONALITIES[c].weight);
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
  // Two passes of shifting the weighted attributes onto the target.
  for (let i = 0; i < 2; i++) {
    let rating = 0;
    for (const [a, w] of Object.entries(weights)) rating += attrs[a as keyof Attributes] * (w ?? 0);
    const diff = level - rating;
    for (const a of Object.keys(weights) as (keyof Attributes)[]) attrs[a] += diff;
  }
  for (const attr of ATTRIBUTES) attrs[attr] = clamp(Math.round(attrs[attr] * 10) / 10, 1, 99);
  return attrs;
}

export function createPlayer(state: GameState, rng: Rng, spec: PlayerSpec): Player {
  const nationality = pickNationality(rng);
  const names = NATIONALITIES[nationality];
  const attrs = makeAttributes(rng, spec.position, spec.level);
  const youngRoom = Math.max(0, 24 - spec.age) * rng.range(0.8, 3.2);
  const potential = Math.round(clamp(spec.potential ?? spec.level + youngRoom + rng.range(0, 3), spec.level, 96));
  const player: Player = {
    id: newId(state, "p"),
    firstName: rng.pick(names.first),
    lastName: rng.pick(names.last),
    age: spec.age,
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

function createSquad(state: GameState, rng: Rng, club: Club, avg: number): void {
  for (const pos of POSITIONS) {
    for (let i = 0; i < SQUAD_TEMPLATE[pos]; i++) {
      // The first two at each position are near starter level, the rest backups.
      const starterish = i < Math.ceil(SQUAD_TEMPLATE[pos] / 2);
      const level = Math.round(avg + (starterish ? rng.range(0, 6) : rng.range(-10, -2)));
      createPlayer(state, rng, {position: pos, level, age: randomAge(rng), clubId: club.id, season: state.season});
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

export function newGame(managerName: string, clubIndex: number, seed: number): GameState {
  const rng = new Rng(seed);
  const state: GameState = {
    version: SAVE_VERSION,
    rngState: 0,
    managerName,
    userClubId: "",
    leagueName: LEAGUE_NAME,
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
    training: {focus: "technique", intensity: "normal"},
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

  CLUB_TEMPLATES.forEach((t, i) => {
    // Reputation from about 88 down to 40.
    const reputation = Math.round(88 - i * (48 / (CLUB_TEMPLATES.length - 1)));
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
    };
    state.clubs[club.id] = club;
    createSquad(state, rng, club, Math.round(50 + reputation * 0.28));
    club.transferBudget = Math.round((club.cash * 0.45) / 50_000) * 50_000;
    club.wageBudget = Math.round((wageBill(state, club.id) * 1.08) / 1_000) * 1_000;
    const {lineup, bench} = pickBestLineup(state, club, FORMATIONS[club.formation]);
    club.lineup = lineup;
    club.bench = bench;
  });

  createFreeAgents(state, rng, 45);

  const clubIds = Object.keys(state.clubs);
  state.userClubId = clubIds[clamp(clubIndex, 0, clubIds.length - 1)];
  state.fixtures = makeFixtures(state, rng, clubIds);
  for (const id of Object.keys(state.players)) {
    if (state.players[id].clubId === state.userClubId) state.scouted[id] = 0;
  }

  addMessage(state, {
    kind: "news",
    key: "msg.welcome",
    params: {manager: managerName, club: state.clubs[state.userClubId].name, league: LEAGUE_NAME},
  });
  state.rngState = rng.state;
  return state;
}
