// Léon Dani: a hand-made legend, 99 overall, sold only for diamonds. He isn't
// in the world until bought, so no other club can sign him and he never turns
// up among the free agents. His wages are part of the price.
import {SQUAD_MAX} from "./constants";
import {marketValue} from "./ratings";
import {ATTRIBUTES, type Attributes, type GameState, type Player} from "./types";

export const LEGEND_ID = "legend-leon-dani";
export const LEGEND_PRICE_DIAMONDS = 500;

/** Léon Dani as he arrives at a club. */
export function legendPlayer(state: GameState, clubId: string | null): Player {
  const attrs = Object.fromEntries(ATTRIBUTES.map((a) => [a, a === "goalkeeping" ? 20 : 99])) as Attributes;
  const player: Player = {
    id: LEGEND_ID,
    firstName: "Léon",
    lastName: "Dani",
    age: 24,
    nationality: "SE",
    position: "ST",
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
    contract: {
      wage: 0,
      expiresSeason: state.season + 5,
      signingBonus: 0,
      goalBonus: 0,
      appearanceBonus: 0,
      releaseClause: null,
      role: "key",
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
  player.value = marketValue(player, state.season);
  return player;
}

/** Whether the user's club already has him (bought once per game). */
export function legendOwned(state: GameState): boolean {
  return !!state.players[LEGEND_ID];
}

/** Buys him for diamonds; returns an error key, or null when he has joined. */
export function buyLegend(state: GameState): string | null {
  if (legendOwned(state)) return "shop.legendOwned";
  const m = state.monetization;
  if (m.diamonds < LEGEND_PRICE_DIAMONDS) return "shop.notEnoughDiamonds";
  const squad = Object.values(state.players).filter((p) => p.clubId === state.userClubId).length;
  if (squad >= SQUAD_MAX) return "shop.squadFull";
  m.diamonds -= LEGEND_PRICE_DIAMONDS;
  state.players[LEGEND_ID] = legendPlayer(state, state.userClubId);
  state.scouted[LEGEND_ID] = state.absWeek;
  return null;
}
