// Player packs, bought with diamonds: a random new player straight into the
// squad. Better packs give better players; within a pack the lower end is
// most likely.
import {SQUAD_MAX, SQUAD_TEMPLATE} from "./constants";
import {taskProgress} from "./daily";
import {createPlayer} from "./generate";
import {book} from "./helpers";
import type {Rng} from "./rng";
import {POSITIONS, type GameState} from "./types";

export const PLAYER_PACKS = {
  bronze: {price: 20, min: 50, max: 64},
  silver: {price: 50, min: 65, max: 74},
  gold: {price: 100, min: 75, max: 84},
  special: {price: 175, min: 85, max: 97},
} as const;
export type PlayerPackId = keyof typeof PLAYER_PACKS;
export const PLAYER_PACK_IDS = Object.keys(PLAYER_PACKS) as PlayerPackId[];

/** The diamond pack: paid with club money, four players to pick one from. */
export const DIAMOND_PACK = {price: 10_000_000, min: 80, max: 98, choices: 4} as const;

/** A level in a pack's range: low is common, the top rare. */
function packLevel(rng: Rng, min: number, max: number): number {
  return Math.round(min + (max - min) * rng.next() ** 1.6);
}

/**
 * Opens the diamond pack: pays the club money and draws four players to pick
 * from (kept in \`state.packChoice\` until one is picked, so closing the game
 * doesn't lose them). An error key if it can't be bought (nothing is spent).
 */
export function openDiamondPack(state: GameState, rng: Rng): {playerIds: string[]} | {error: string} {
  if (state.packChoice) return {playerIds: state.packChoice};
  const club = state.clubs[state.userClubId];
  if (club.cash < DIAMOND_PACK.price) return {error: "pack.noMoney"};
  const squad = Object.values(state.players).filter((p) => p.clubId === state.userClubId).length;
  if (squad >= SQUAD_MAX) return {error: "shop.squadFull"};
  book(state, club.id, "transfers", -DIAMOND_PACK.price);
  const ids: string[] = [];
  for (let i = 0; i < DIAMOND_PACK.choices; i++) {
    const position = rng.weighted([...POSITIONS], (p) => SQUAD_TEMPLATE[p]);
    // Without a club until picked: nobody else can sign them (they aren't on the market list either).
    const p = createPlayer(state, rng, {position, level: packLevel(rng, DIAMOND_PACK.min, DIAMOND_PACK.max), age: rng.int(19, 31), clubId: null, season: state.season});
    ids.push(p.id);
  }
  state.packChoice = ids;
  taskProgress(state, "pack");
  return {playerIds: ids};
}

/** Picks one of the diamond pack's four: they join the squad, the other three are gone. */
export function pickFromPack(state: GameState, playerId: string): boolean {
  const ids = state.packChoice;
  if (!ids || !ids.includes(playerId)) return false;
  for (const id of ids) if (id !== playerId) delete state.players[id];
  const p = state.players[playerId];
  p.clubId = state.userClubId;
  p.contract.expiresSeason = state.season + 3;
  state.scouted[p.id] = state.absWeek;
  state.packChoice = undefined;
  return true;
}

/** Opens a pack: the new player's id, or an error key (nothing is spent then). */
export function openPack(state: GameState, rng: Rng, id: PlayerPackId): {playerId: string} | {error: string} {
  const pack = PLAYER_PACKS[id];
  const m = state.monetization;
  if (m.diamonds < pack.price) return {error: "shop.notEnoughDiamonds"};
  const squad = Object.values(state.players).filter((p) => p.clubId === state.userClubId).length;
  if (squad >= SQUAD_MAX) return {error: "shop.squadFull"};
  m.diamonds -= pack.price;

  // Low in the range is common, the top rare.
  const level = packLevel(rng, pack.min, pack.max);
  const position = rng.weighted([...POSITIONS], (p) => SQUAD_TEMPLATE[p]);
  const player = createPlayer(state, rng, {position, level, age: rng.int(19, 31), clubId: state.userClubId, season: state.season});
  player.contract.expiresSeason = state.season + 3;
  state.scouted[player.id] = state.absWeek;
  taskProgress(state, "pack");
  return {playerId: player.id};
}
