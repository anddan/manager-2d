// The friends' cup: managers on different devices put their teams into one cup and play each
// other. Everything here is plain game logic (no network): a snapshot of a team to send, the
// fixture list (everyone meets everyone once), a match between two snapshots, and the table.
//
// A match is played in a ground of its own, built only from the two snapshots and a shared
// seed, so whoever plays it gets the same result. The cup's creator plays each round and
// stores the results; the others read them.
import {MIN_PLAYERS} from "./constants";
import {newGame} from "./generate";
import {shortName} from "./helpers";
import {pickBestLineup, repairLineup} from "./lineup";
import {simulateMatch} from "./match";
import {clubSlots} from "./constants";
import {Rng} from "./rng";
import type {Club, CupFixture, GameState, Player} from "./types";

/** What of a club goes into the cup: how it looks, how it plays, and its players (picked or on the bench). */
export interface TeamSnapshot {
  manager: string;
  club: Pick<Club, "name" | "short" | "color" | "color2" | "formation" | "mentality" | "lineup" | "bench" | "capacity" | "reputation"> & {
    roles?: Club["roles"];
    customSlots?: Club["customSlots"];
    stadium?: Club["stadium"];
  };
  players: Player[];
}

/** The user's team as it stands, to send to the cup. */
export function snapshotTeam(state: GameState): TeamSnapshot {
  const club = state.clubs[state.userClubId];
  const ids = [...club.lineup, ...club.bench].filter((id) => id && state.players[id]?.clubId === club.id);
  return {
    manager: state.managerName,
    club: {
      name: club.name,
      short: club.short,
      color: club.color,
      color2: club.color2,
      formation: club.formation,
      mentality: club.mentality,
      lineup: [...club.lineup],
      bench: [...club.bench],
      capacity: club.capacity,
      reputation: club.reputation,
      ...(club.roles ? {roles: {...club.roles}} : {}),
      ...(club.customSlots ? {customSlots: club.customSlots.map((s) => ({...s}))} : {}),
      ...(club.stadium ? {stadium: structuredClone(club.stadium)} : {}),
    },
    players: [...new Set(ids)].map((id) => structuredClone(state.players[id])),
  };
}

/** A team is fit to send with at least the fewest who may start a match. */
export function snapshotReady(snap: TeamSnapshot): boolean {
  return snap.players.length >= MIN_PLAYERS;
}

/**
 * Who meets whom, round by round: everyone once (the circle method, home and away in turns).
 * With an odd number one sits each round out.
 */
export function friendFixtures(ids: string[]): [string, string][][] {
  const list = ids.length % 2 ? [...ids, ""] : [...ids];
  const n = list.length;
  const rotating = list.slice(1);
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const order = [list[0], ...rotating];
    const round: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = order[i];
      const b = order[n - 1 - i];
      if (!a || !b) continue;
      const aHome = i === 0 ? r % 2 === 0 : i % 2 === 1;
      round.push(aHome ? [a, b] : [b, a]);
    }
    rounds.push(round);
    rotating.unshift(rotating.pop()!);
  }
  return rounds;
}

export interface FriendGoal {
  minute: number;
  side: "home" | "away";
  name: string;
}

export interface FriendResult {
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  goals: FriendGoal[];
}

/** The ground the friends' matches are played in: the same on every device (a fixed league to build on). */
let template: GameState | null = null;
function ground(): GameState {
  template ??= newGame("Kompiscup", 0, 4242);
  return structuredClone(template);
}

/** Puts a snapshot into the ground as club \`id\` (its players' ids prefixed, so two teams never clash). */
function putTeam(state: GameState, id: string, snap: TeamSnapshot): void {
  const base = state.clubs[Object.keys(state.clubs)[0]];
  const map = (pid: string) => (pid ? `${id}:${pid}` : "");
  const club: Club = {
    ...structuredClone(base),
    ...structuredClone(snap.club),
    id,
    lineup: snap.club.lineup.map(map),
    bench: snap.club.bench.map(map),
    installments: [],
    roles: snap.club.roles
      ? (Object.fromEntries(Object.entries(snap.club.roles).map(([k, v]) => [k, typeof v === "string" ? map(v) : v])) as Club["roles"])
      : undefined,
  };
  delete (club as Partial<Club>).guest;
  state.clubs[id] = club;
  for (const p of snap.players) {
    state.players[map(p.id)] = {...structuredClone(p), id: map(p.id), clubId: id, loan: null};
  }
  // Whoever is missing or can't play: the best of the rest steps in.
  if (lineupGaps(state, club) > 0) {
    if (!repairLineup(state, club) || lineupGaps(state, club) > 0) {
      const best = pickBestLineup(state, club, clubSlots(club));
      club.lineup = best.lineup;
      club.bench = best.bench;
    }
  }
}

function lineupGaps(state: GameState, club: Club): number {
  return club.lineup.filter((pid) => !pid || state.players[pid]?.clubId !== club.id).length;
}

/** A match between two snapshots with a shared seed: the same result wherever it's played. */
export function playFriendMatch(home: TeamSnapshot, away: TeamSnapshot, seed: number): FriendResult & {state: GameState} {
  const state = ground();
  state.userClubId = "fc-nobody";
  putTeam(state, "fcH", home);
  putTeam(state, "fcA", away);
  const fixture: CupFixture = {id: "fc", round: 0, stage: 0, homeId: "fcH", awayId: "fcA", played: false, homeGoals: 0, awayGoals: 0};
  const report = simulateMatch(state, new Rng(seed), fixture, false);
  const goals = report.events
    .filter((e) => e.type === "goal")
    .map((e) => ({minute: e.minute, side: e.side as "home" | "away", name: e.playerId && state.players[e.playerId] ? shortName(state.players[e.playerId]) : "?"}));
  return {home: "", away: "", homeGoals: report.homeGoals, awayGoals: report.awayGoals, goals, state};
}

/** Plays a whole round: each pair's match from their snapshots, with the round's seed. */
export function playFriendRound(pairs: [string, string][], teams: Record<string, TeamSnapshot>, seed: number): FriendResult[] {
  return pairs.map(([home, away], i) => {
    const h = teams[home];
    const a = teams[away];
    // A team that never sent itself loses 0–3.
    if (!h || !a) return {home, away, homeGoals: h ? 3 : 0, awayGoals: a ? 3 : 0, goals: []};
    const {homeGoals, awayGoals, goals} = playFriendMatch(h, a, (seed + i * 7919) >>> 0);
    return {home, away, homeGoals, awayGoals, goals};
  });
}

export interface FriendRow {
  id: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

/** The cup's table from the results so far: points, then goal difference, then goals scored. */
export function friendTable(ids: string[], results: FriendResult[]): FriendRow[] {
  const rows: Record<string, FriendRow> = Object.fromEntries(ids.map((id) => [id, {id, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0}]));
  for (const r of results) {
    const h = rows[r.home];
    const a = rows[r.away];
    if (!h || !a) continue;
    h.played++;
    a.played++;
    h.goalsFor += r.homeGoals;
    h.goalsAgainst += r.awayGoals;
    a.goalsFor += r.awayGoals;
    a.goalsAgainst += r.homeGoals;
    if (r.homeGoals > r.awayGoals) {
      h.won++;
      a.lost++;
      h.points += 3;
    } else if (r.homeGoals < r.awayGoals) {
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
  return Object.values(rows).sort(
    (x, y) => y.points - x.points || y.goalsFor - y.goalsAgainst - (x.goalsFor - x.goalsAgainst) || y.goalsFor - x.goalsFor
  );
}

/** A cup code to share: easy to read out (no 0/O or 1/I). */
export function newCupCode(rng: () => number = Math.random): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({length: 6}, () => letters[Math.floor(rng() * letters.length)]).join("");
}
