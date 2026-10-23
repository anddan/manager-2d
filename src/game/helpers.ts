// Small helpers shared by the systems.
import {PRESEASON_WEEKS} from "./constants";
import type {Club, Fixture, FinanceCategory, GameState, Message} from "./types";

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

export function playerName(state: GameState, id: string): string {
  const p = state.players[id];
  return p ? `${p.firstName} ${p.lastName}` : "?";
}
