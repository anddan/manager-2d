// Small helpers shared by the systems.
import {CUP_GROUP_DAYS, CUP_WEEKS, PRESEASON_WEEKS, SEASON_WEEKS} from "./constants";
import type {Club, CupFixture, Fixture, FinanceCategory, GameState, Message, Player} from "./types";

export function newId(state: GameState, prefix: string): string {
  state.nextId += 1;
  return `${prefix}${state.nextId}`;
}

export function userClub(state: GameState): Club {
  return state.clubs[state.userClubId];
}

/** League round played in a week of the season, or null (preseason, or a Champions Cup week). */
export function roundInWeek(week: number): number | null {
  if (CUP_WEEKS.includes(week)) return null;
  const round = week - PRESEASON_WEEKS - CUP_WEEKS.filter((w) => w < week).length;
  return round >= 1 ? round : null;
}

/** League round played this week, or null in preseason and Champions Cup weeks. */
export function currentRound(state: GameState): number | null {
  return roundInWeek(state.week);
}

/** Champions Cup stage played this week (0–2 group matchdays, 3 quarters … 5 final), or null. */
export function currentCupStage(state: GameState): number | null {
  const stage = CUP_WEEKS.indexOf(state.week);
  return stage >= 0 ? stage : null;
}

export function isCupFixture(f: Fixture): f is CupFixture {
  return "stage" in f;
}

/** A cup tie that needs a winner on the day (penalties if level): the knockout, not the groups. */
export function isKnockout(f: Fixture): f is CupFixture {
  return isCupFixture(f) && f.stage >= CUP_GROUP_DAYS;
}

/** The week of the season a fixture is played in. */
export function fixtureWeek(f: Fixture): number {
  if (isCupFixture(f)) return CUP_WEEKS[f.stage];
  for (let week = 1; week <= SEASON_WEEKS; week++) if (roundInWeek(week) === f.round) return week;
  return SEASON_WEEKS;
}

export function fixturesInRound(state: GameState, round: number): Fixture[] {
  return state.fixtures.filter((f) => f.round === round);
}

export function cupFixturesInStage(state: GameState, stage: number): CupFixture[] {
  return state.cup?.fixtures.filter((f) => f.stage === stage) ?? [];
}

/** A league or Champions Cup fixture by id. */
export function findFixture(state: GameState, id: string): Fixture | undefined {
  return state.fixtures.find((f) => f.id === id) ?? state.cup?.fixtures.find((f) => f.id === id);
}

/** The user's next unplayed fixture, league or cup. */
export function nextUserFixture(state: GameState): Fixture | undefined {
  const mine = (f: Fixture) => !f.played && (f.homeId === state.userClubId || f.awayId === state.userClubId);
  const all: Fixture[] = [...state.fixtures.filter(mine), ...(state.cup?.fixtures.filter(mine) ?? [])];
  return all.sort((a, b) => fixtureWeek(a) - fixtureWeek(b))[0];
}

/** The clubs in the user's league (not Champions Cup guests). */
export function leagueClubs(state: GameState): Club[] {
  return Object.values(state.clubs).filter((c) => !c.guest);
}

export function addMessage(
  state: GameState,
  msg: Omit<Message, "id" | "absWeek" | "read">
): Message {
  const message: Message = {...msg, id: newId(state, "m"), absWeek: state.absWeek, read: false};
  state.inbox.unshift(message);
  // Keep saves small.
  if (state.inbox.length > 150) state.inbox.length = 150;
  return message;
}

/** Books money for a club; the user's club also gets a report line. */
export function book(state: GameState, clubId: string, category: FinanceCategory, amount: number): void {
  state.clubs[clubId].cash += amount;
  if (clubId === state.userClubId) {
    const current = state.finance.current;
    current[category] = (current[category] ?? 0) + amount;
  }
}

// Player names. A nickname the manager gave a player replaces their name
// everywhere except their own profile, which shows both.
type Named = Pick<Player, "firstName" | "lastName" | "nickname">;

/** "Holmström", or the nickname. */
export function shortName(p: Named): string {
  return p.nickname || p.lastName;
}

/** "Melker Holmström", or the nickname. */
export function fullName(p: Named): string {
  return p.nickname || `${p.firstName} ${p.lastName}`;
}

/** "M. Holmström" for lists, or the nickname. */
export function listName(p: Named): string {
  return p.nickname || `${p.firstName.charAt(0)}. ${p.lastName}`;
}

/** "Melker Holmström (Ronaldo)" for the player's profile. */
export function profileName(p: Named): string {
  return p.nickname ? `${p.firstName} ${p.lastName} (${p.nickname})` : `${p.firstName} ${p.lastName}`;
}

export function playerName(state: GameState, id: string): string {
  const p = state.players[id];
  return p ? fullName(p) : "?";
}
