// Small helpers shared by the systems.
import {PRESEASON_WEEKS} from "./constants";
import type {Club, Fixture, FinanceCategory, GameState, Message, Player} from "./types";

export function newId(state: GameState, prefix: string): string {
  state.nextId += 1;
  return `${prefix}${state.nextId}`;
}

export function userClub(state: GameState): Club {
  return state.clubs[state.userClubId];
}

/** League round played this week, or null in preseason. */
export function currentRound(state: GameState): number | null {
  const round = state.week - PRESEASON_WEEKS;
  return round >= 1 ? round : null;
}

export function fixturesInRound(state: GameState, round: number): Fixture[] {
  return state.fixtures.filter((f) => f.round === round);
}

/** The user's next unplayed fixture. */
export function nextUserFixture(state: GameState): Fixture | undefined {
  return state.fixtures.find(
    (f) => !f.played && (f.homeId === state.userClubId || f.awayId === state.userClubId)
  );
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
