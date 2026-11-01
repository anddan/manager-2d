// Questions that have to be answered before the game goes on (the setting can turn it off): bids on our
// players, a player's wish to leave, a country's offer.
import type {GameState, Message} from "../game/types";

const KEY = "manager2d.forceDecisions";

export function readForceDecisions(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function writeForceDecisions(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Only for now.
  }
}

/** The mails waiting for an answer. */
export function pendingDecisions(game: GameState): Message[] {
  return game.inbox.filter((m) => {
    if (m.resolved || !m.action) return false;
    switch (m.action.type) {
      case "incomingBid": {
        const id = m.action.bidId;
        return game.incomingBids.some((b) => b.id === id);
      }
      case "transferRequest":
        return game.players[m.action.playerId]?.clubId === game.userClubId;
      case "nationalOffer":
        return !game.national;
      // The awards are only to be read: they never hold the game back.
      case "ack":
        return false;
      default:
        return false;
    }
  });
}
