// Weekly club finances: gate money, sponsors, wages, instalments and running
// costs. The user's club gets an itemised report each week.
import {PRIZE_MONEY} from "./constants";
import {addMessage, book} from "./helpers";
import {leaguePosition, recentPointsPerGame} from "./league";
import {wageBill} from "./ratings";
import {clamp} from "./rng";
import type {Club, FinanceLines, GameState} from "./types";

/** Share of seats sold: reputation, current form and table position. */
export function attendanceRate(state: GameState, club: Club): number {
  const position = leaguePosition(state, club.id);
  const tableBoost = (Object.keys(state.clubs).length / 2 - position) * 0.012;
  const formBoost = (recentPointsPerGame(state, club.id) - 1.4) * 0.05;
  return clamp(0.45 + club.reputation / 220 + tableBoost + formBoost, 0.3, 1);
}

export function ticketIncome(state: GameState, club: Club): number {
  return Math.round(club.capacity * attendanceRate(state, club) * club.ticketPrice);
}

export function operatingCost(club: Club): number {
  return Math.round(25_000 + club.facilities * 9_000 + club.capacity * 0.8);
}

/** Runs one week of money for every club. `homeClubs` played at home. */
export function weeklyFinances(state: GameState, homeClubs: Set<string>): void {
  for (const club of Object.values(state.clubs)) {
    if (homeClubs.has(club.id)) book(state, club.id, "tickets", ticketIncome(state, club));
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
  if (user.cash < 0 && state.absWeek % 4 === 0) {
    addMessage(state, {kind: "finance", key: "msg.boardDebt", params: {cash: user.cash}});
  }
  if (user.cash < -2_000_000) user.transferBudget = Math.min(user.transferBudget, 0);
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
  for (const club of Object.values(state.clubs)) {
    club.transferBudget = Math.max(0, Math.round((club.cash * 0.4) / 50_000) * 50_000);
    const income = club.sponsorWeekly + ticketIncome(state, club) / 2;
    const target = Math.round((income * 0.62) / 1_000) * 1_000;
    // Never below the current bill by much, or the board would force a fire sale.
    club.wageBudget = Math.max(target, Math.round((wageBill(state, club.id) * 0.98) / 1_000) * 1_000);
  }
}
