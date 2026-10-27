// Trading players with friends in the friends' cup: a player bought for money, or swapped for
// one of your own. Plain game logic here: a player leaving for a friend's game, a player coming
// in from one, and the money. The offers themselves travel online (see ui/friendCupApi.ts).
//
// The buyer puts up their side when they make the offer (the money is paid, or their player
// leaves), so it's there when the seller says yes; if the seller says no, it comes back.
import {MIN_PLAYERS, SQUAD_MAX} from "./constants";
import {unequipGear} from "./gear";
import {book, newId} from "./helpers";
import {PLAYER_PACKS} from "./packs";
import {overall} from "./ratings";
import {clamp} from "./rng";
import type {GameState, Player} from "./types";

/** How many must stay in a squad after a player is sold or swapped away. */
export const TRADE_MIN_SQUAD = Math.max(MIN_PLAYERS, 11);

function squadSize(state: GameState): number {
  return Object.values(state.players).filter((p) => p.clubId === state.userClubId).length;
}

/** Can this player of yours leave (sold, or given in a swap)? An error key if not. */
export function cannotLeave(state: GameState, playerId: string): string | null {
  const p = state.players[playerId];
  if (!p || p.clubId !== state.userClubId) return "trade.gone";
  if (p.loan) return "trade.onLoan";
  if (squadSize(state) <= TRADE_MIN_SQUAD) return "trade.squadSmall";
  return null;
}

/** Room in the squad for one more? */
export function roomForOne(state: GameState): boolean {
  return squadSize(state) < SQUAD_MAX;
}

/** A player of yours leaves for a friend's game: gear back in the bag, out of the team. Returns them as they go. */
export function sendAway(state: GameState, playerId: string): Player {
  const club = state.clubs[state.userClubId];
  unequipGear(state, playerId);
  const p = structuredClone(state.players[playerId]);
  club.lineup = club.lineup.map((id) => (id === playerId ? "" : id));
  club.bench = club.bench.filter((id) => id !== playerId);
  if (club.roles) for (const [role, id] of Object.entries(club.roles)) if (id === playerId) delete club.roles[role as keyof typeof club.roles];
  state.incomingBids = state.incomingBids.filter((b) => b.playerId !== playerId);
  state.promises = state.promises.filter((pr) => pr.playerId !== playerId);
  delete state.players[playerId];
  return p;
}

/** A player from a friend's game joins your squad (with a new id here, and a fresh contract). */
export function takeIn(state: GameState, player: Player): string {
  const id = newId(state, "p");
  state.players[id] = {
    ...structuredClone(player),
    id,
    clubId: state.userClubId,
    gear: undefined,
    shin: undefined,
    loan: null,
    transferListed: false,
    loanListed: false,
    wantsToLeave: false,
    rejectedTransferWeeks: 0,
    brokenPromises: 0,
    recentStarts: [],
    relation: 50,
    happiness: clamp(Math.max(player.happiness, 60) + 10, 0, 100),
    individualFocus: null,
    contract: {...player.contract, expiresSeason: state.season + 2, releaseClause: null},
  };
  state.scouted[id] = state.absWeek;
  return id;
}

/** Money for a trade: paid (negative) or received. */
export function tradeMoney(state: GameState, amount: number): void {
  if (amount) book(state, state.userClubId, amount < 0 ? "transfers" : "sales", amount);
}

/** What a player is sold for to a friend: club money or diamonds. */
export type TradeCurrency = "money" | "diamonds";

/** Pays (negative) or receives an amount in money or diamonds. */
export function tradePay(state: GameState, currency: TradeCurrency, amount: number): void {
  if (currency === "diamonds") state.monetization.diamonds += amount;
  else tradeMoney(state, amount);
}

/** Is there enough to pay it? */
export function canPay(state: GameState, currency: TradeCurrency, amount: number): boolean {
  return (currency === "diamonds" ? state.monetization.diamonds : state.clubs[state.userClubId].cash) >= amount;
}

/** A fair price in diamonds: what a shop pack of their level costs. */
export function diamondPrice(player: Player): number {
  const ovr = overall(player);
  return ovr >= 85 ? PLAYER_PACKS.special.price : ovr >= 75 ? PLAYER_PACKS.gold.price : ovr >= 65 ? PLAYER_PACKS.silver.price : PLAYER_PACKS.bronze.price;
}

/** Marks a trade as settled here; false if it already was. */
export function settleOnce(state: GameState, offerId: string): boolean {
  state.friendTrades ??= {};
  if (state.friendTrades[offerId]) return false;
  state.friendTrades[offerId] = true;
  return true;
}
