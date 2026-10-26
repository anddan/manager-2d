// Weekly club finances: gate money, sponsors, wages, instalments and running
// costs. The user's club gets an itemised report each week.
import {PRIZE_MONEY} from "./constants";
import {addMessage, book, isCupFixture, leagueClubs} from "./helpers";
import {leaguePosition, recentPointsPerGame} from "./league";
import {wageBill} from "./ratings";
import {clamp} from "./rng";
import type {Club, FinanceLines, Fixture, GameState} from "./types";

/** Lowest and highest ticket price a club can set. */
export const TICKET_PRICE = {min: 5, max: 250};

/** Goals per game in a club's last five matches (both ends): fans like a show. */
function goalsPerGame(state: GameState, clubId: string): number {
  const recent = state.fixtures
    .filter((f) => f.played && (f.homeId === clubId || f.awayId === clubId))
    .sort((a, b) => b.round - a.round)
    .slice(0, 5);
  if (recent.length === 0) return 2.6;
  return recent.reduce((n, f) => n + f.homeGoals + f.awayGoals, 0) / recent.length;
}

/**
 * How many want to come at a fair price (0.3 to about 1.1 of the seats):
 * the club's standing, how it's going (form and table), and goals.
 */
export function crowdDemand(state: GameState, club: Club): number {
  if (club.guest) return clamp(0.5 + club.reputation / 200, 0.3, 1.1);
  const position = leaguePosition(state, club.id);
  const tableBoost = (leagueClubs(state).length / 2 - position) * 0.012;
  const formBoost = (recentPointsPerGame(state, club.id) - 1.4) * 0.06;
  const goalsBoost = clamp((goalsPerGame(state, club.id) - 2.6) * 0.04, -0.06, 0.08);
  return clamp(0.45 + club.reputation / 220 + tableBoost + formBoost + goalsBoost, 0.3, 1.1);
}

/**
 * How big a match is for the fans (1 = an ordinary league game): the
 * opponent's name, a clash at the top, and Champions Cup nights, the final most.
 */
export function matchAppeal(state: GameState, fixture: Fixture): number {
  if (isCupFixture(fixture)) return [1.3, 1.3, 1.35, 1.55, 1.8, 2.2][fixture.stage] ?? 1.3;
  const home = state.clubs[fixture.homeId];
  const away = state.clubs[fixture.awayId];
  let appeal = 1 + clamp((away.reputation - home.reputation) / 200, -0.1, 0.2);
  const top = (id: string) => leaguePosition(state, id) <= 3;
  if (top(home.id) && top(away.id)) appeal += 0.2;
  return appeal;
}

/** What the fans think a ticket is worth: more for a big club and a big match. */
export function fairPrice(club: Club, appeal = 1): number {
  return (10 + club.reputation * 0.12) * appeal;
}

/**
 * The crowd at a home match: demand, made bigger by a big match, then the
 * price. At the fair price demand decides it; dearer, seats stay empty; cheaper
 * fills it (but each ticket brings in less). Rounded to tens.
 */
export function crowdFor(state: GameState, club: Club, fixture?: Fixture, price?: number): {fans: number; rate: number; appeal: number; price: number} {
  const {appeal, demand} = pull(state, club, fixture);
  const paid = price ?? matchPrice(state, club, fixture);
  const priceEffect = clamp(Math.pow(fairPrice(club, appeal) / Math.max(1, paid), PRICE_EFFECT.power), PRICE_EFFECT.min, PRICE_EFFECT.max);
  const rate = clamp(demand * priceEffect, 0.03, 1);
  return {fans: Math.round((club.capacity * rate) / 10) * 10, rate, appeal, price: paid};
}

/** How hard the price bites: (fair / price) to this power, kept between min and max. */
const PRICE_EFFECT = {power: 1.4, min: 0.08, max: 1.8};

/** A match's pull and the demand for it at a fair price. */
function pull(state: GameState, club: Club, fixture?: Fixture): {appeal: number; demand: number} {
  const appeal = fixture ? matchAppeal(state, fixture) : 1;
  return {appeal, demand: crowdDemand(state, club) * (0.8 + 0.2 * appeal)};
}

/**
 * The best price for a match: the highest that still fills the ground. (Dearer
 * loses more fans than it gains per ticket; cheaper only gives money away.) If
 * it can't be filled at all, as low as still pulls more people in.
 */
export function autoPrice(state: GameState, club: Club, fixture?: Fixture): number {
  const {appeal, demand} = pull(state, club, fixture);
  const fair = fairPrice(club, appeal);
  const fill = fair * Math.pow(demand, 1 / PRICE_EFFECT.power);
  const lowest = fair / Math.pow(PRICE_EFFECT.max, 1 / PRICE_EFFECT.power);
  // Whole euros: the few around it, whichever brings in most (seats come in tens).
  const around = clamp(Math.floor(Math.max(fill, lowest)), TICKET_PRICE.min, TICKET_PRICE.max);
  let best = around;
  let bestIncome = -1;
  for (let p = Math.max(TICKET_PRICE.min, around - 2); p <= Math.min(TICKET_PRICE.max, around + 3); p++) {
    const income = crowdFor(state, club, fixture, p).fans * p;
    if (income > bestIncome) {
      bestIncome = income;
      best = p;
    }
  }
  return best;
}

/** The price for a match: the club's own, or on auto the best one moved by the manager's percent. */
export function matchPrice(state: GameState, club: Club, fixture?: Fixture): number {
  if (!club.ticketAuto) return club.ticketPrice;
  const adjusted = autoPrice(state, club, fixture) * (1 + (club.ticketAdjust ?? 0) / 100);
  return clamp(Math.round(adjusted), TICKET_PRICE.min, TICKET_PRICE.max);
}

/** How far the manager may move an automatic price, in percent. */
export const TICKET_ADJUST = {min: -50, max: 50, step: 5};

/** Share of seats sold at the next home match (or an ordinary one). */
export function attendanceRate(state: GameState, club: Club, fixture?: Fixture): number {
  return crowdFor(state, club, fixture).rate;
}

export function ticketIncome(state: GameState, club: Club, fixture?: Fixture): number {
  const crowd = crowdFor(state, club, fixture);
  return crowd.fans * crowd.price;
}

export function operatingCost(club: Club): number {
  return Math.round(25_000 + club.facilities * 9_000 + club.capacity * 0.8);
}

/** Runs one week of money for every club. `played`: this week's matches (the home side keeps the gate). */
export function weeklyFinances(state: GameState, played: Fixture[]): void {
  const gates = new Map(played.map((f) => [f.homeId, f.gate ?? ticketIncome(state, state.clubs[f.homeId], f)]));
  for (const club of leagueClubs(state)) {
    const gate = gates.get(club.id);
    if (gate !== undefined) book(state, club.id, "tickets", gate);
    book(state, club.id, "sponsor", club.sponsorWeekly);
    book(state, club.id, "wages", -wageBill(state, club.id));
    book(state, club.id, "operations", -operatingCost(club));
    for (const inst of club.installments) {
      book(state, club.id, "transfers", -inst.amount);
      book(state, inst.toClubId, "sales", inst.amount);
      inst.weeksLeft--;
    }
    club.installments = club.installments.filter((i) => i.weeksLeft > 0);
    // Struggling AI clubs tighten the purse.
    if (club.id !== state.userClubId && club.cash < 0) club.transferBudget = 0;
  }

  const user = state.clubs[state.userClubId];
  closeReport(state);
  boardPatience(state, user.cash);
  if (user.cash < -2_000_000) user.transferBudget = Math.min(user.transferBudget, 0);
}

/** Weeks in a row in the red before the board gives a warning. */
export const DEBT_WARNING_WEEKS = 4;
/** The warning that ends it: the manager is sacked. */
export const BOARD_WARNINGS = 3;

/**
 * The board watches the money. Every few weeks in a row in the red is a
 * warning; at the third the manager is sacked (game over). Getting back into
 * the black stops the count, and a season ending in the black wipes one
 * warning (see seasonBoardReview).
 */
function boardPatience(state: GameState, cash: number): void {
  const board = (state.board ??= {debtWeeks: 0, warnings: 0});
  if (cash >= 0) {
    board.debtWeeks = 0;
    return;
  }
  board.debtWeeks++;
  if (board.debtWeeks === 1) addMessage(state, {kind: "finance", key: "msg.boardDebt", params: {cash}});
  if (board.debtWeeks % DEBT_WARNING_WEEKS !== 0) return;
  board.warnings++;
  if (board.warnings >= BOARD_WARNINGS) {
    state.gameOver = {season: state.season, week: state.week, reason: "debt"};
    return;
  }
  addMessage(state, {kind: "finance", key: "msg.boardWarning", params: {n: board.warnings, max: BOARD_WARNINGS, cash, left: BOARD_WARNINGS - board.warnings}});
}

/** At the end of a season: finishing it in the black earns back one warning. */
export function seasonBoardReview(state: GameState): void {
  const board = state.board;
  if (board && board.warnings > 0 && state.clubs[state.userClubId].cash >= 0) board.warnings--;
}

/** Moves this week's lines into history and the season totals. */
function closeReport(state: GameState): void {
  const lines = state.finance.current;
  state.finance.weeks.unshift({season: state.season, week: state.week, lines});
  if (state.finance.weeks.length > 12) state.finance.weeks.length = 12;
  for (const [k, v] of Object.entries(lines) as [keyof FinanceLines, number][]) {
    state.finance.season[k] = (state.finance.season[k] ?? 0) + v;
  }
  state.finance.current = {};
}

export function sumLines(lines: FinanceLines): {income: number; expenses: number; net: number} {
  let income = 0;
  let expenses = 0;
  for (const v of Object.values(lines)) {
    if (v === undefined) continue;
    if (v >= 0) income += v;
    else expenses += v;
  }
  return {income, expenses, net: income + expenses};
}

/** Prize money by final position. */
export function payPrizeMoney(state: GameState, order: string[]): void {
  order.forEach((clubId, i) => book(state, clubId, "prize", PRIZE_MONEY[i] ?? PRIZE_MONEY[PRIZE_MONEY.length - 1]));
}

/** New season budgets: part of the cash for transfers, wages from expected income. */
export function setSeasonBudgets(state: GameState): void {
  for (const club of leagueClubs(state)) {
    club.transferBudget = Math.max(0, Math.round((club.cash * 0.4) / 50_000) * 50_000);
    const income = club.sponsorWeekly + ticketIncome(state, club) / 2;
    const target = Math.round((income * 0.62) / 1_000) * 1_000;
    // Never below the current bill by much, or the board would force a fire sale.
    club.wageBudget = Math.max(target, Math.round((wageBill(state, club.id) * 0.98) / 1_000) * 1_000);
  }
}
