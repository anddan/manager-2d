// Legends: hand-made 99s sold only for diamonds (Léon Dani, Theo Bergqvist). They aren't in the
// world until bought, so no other club can sign them and they never turn up among the free
// agents. Their wages are part of the price. And the secret legend: a grey card whose name,
// country and position are only drawn when it's bought (a new one each time).
import {SQUAD_MAX, SQUAD_TEMPLATE} from "./constants";
import {createPlayer} from "./generate";
import {marketValue} from "./ratings";
import type {Rng} from "./rng";
import {ATTRIBUTES, POSITIONS, type Attributes, type GameState, type Player, type Position} from "./types";

export const LEGEND_ID = "legend-leon-dani";
export const THEO_ID = "legend-theo-bergqvist";
export const LEGEND_PRICE_DIAMONDS = 1000;

export interface Legend {
  id: string;
  firstName: string;
  lastName: string;
  nationality: string;
  position: Position;
  age: number;
  /** The card's colours (and the shirt on it before he has a club), when not the usual. */
  kit?: {color: string; trim: string; theme: string};
}

export const LEGENDS: Legend[] = [
  {id: LEGEND_ID, firstName: "Léon", lastName: "Dani", nationality: "SE", position: "ST", age: 24},
  // Blond, in green and white.
  {id: THEO_ID, firstName: "Theo", lastName: "Bergqvist", nationality: "SE", position: "AM", age: 22, kit: {color: "#00843d", trim: "#ffffff", theme: "hammarby"}},
];

/** A legend as he arrives at a club. */
export function legendPlayer(state: GameState, clubId: string | null, legend: Legend = LEGENDS[0]): Player {
  const attrs = Object.fromEntries(ATTRIBUTES.map((a) => [a, a === "goalkeeping" ? 20 : 99])) as Attributes;
  const player: Player = {
    id: legend.id,
    firstName: legend.firstName,
    lastName: legend.lastName,
    age: legend.age,
    nationality: legend.nationality,
    position: legend.position,
    attrs,
    potential: 99,
    form: 70,
    fitness: 100,
    morale: 90,
    sharpness: 80,
    happiness: 90,
    relation: 80,
    professionalism: 99,
    clubId,
    contract: legendContract(state),
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
  player.value = marketValue(player, state.season);
  return player;
}

function legendContract(state: GameState): Player["contract"] {
  return {wage: 0, expiresSeason: state.season + 5, signingBonus: 0, goalBonus: 0, appearanceBonus: 0, releaseClause: null, role: "key"};
}

/** Whether the user's club already has this legend (each is bought once per game). */
export function legendOwned(state: GameState, id = LEGEND_ID): boolean {
  return !!state.players[id];
}

/** Pays for a legend: an error key, or null when paid. */
function payForLegend(state: GameState): string | null {
  const m = state.monetization;
  if (m.diamonds < LEGEND_PRICE_DIAMONDS) return "shop.notEnoughDiamonds";
  const squad = Object.values(state.players).filter((p) => p.clubId === state.userClubId).length;
  if (squad >= SQUAD_MAX) return "shop.squadFull";
  m.diamonds -= LEGEND_PRICE_DIAMONDS;
  return null;
}

/** Buys a legend for diamonds; returns an error key, or null when he has joined. */
export function buyLegend(state: GameState, id = LEGEND_ID): string | null {
  const legend = LEGENDS.find((l) => l.id === id);
  if (!legend) return "shop.legendOwned";
  if (legendOwned(state, id)) return "shop.legendOwned";
  const err = payForLegend(state);
  if (err) return err;
  state.players[id] = legendPlayer(state, state.userClubId, legend);
  state.scouted[id] = state.absWeek;
  return null;
}

/**
 * The secret legend: someone from anywhere, in any position, between 92 and 99, drawn when
 * bought. Returns the new player's id, or an error key.
 */
export function buySecretLegend(state: GameState, rng: Rng): {playerId: string} | {error: string} {
  const err = payForLegend(state);
  if (err) return {error: err};
  const position = rng.weighted([...POSITIONS], (p) => SQUAD_TEMPLATE[p]);
  const level = rng.int(92, 99);
  const p = createPlayer(state, rng, {position, level, age: rng.int(21, 29), clubId: state.userClubId, season: state.season});
  p.potential = Math.max(p.potential, level);
  p.professionalism = 95;
  p.contract = legendContract(state);
  p.value = marketValue(p, state.season);
  state.scouted[p.id] = state.absWeek;
  return {playerId: p.id};
}
