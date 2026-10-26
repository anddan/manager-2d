// Bank loans for the user's club: money now, paid back week by week with interest.
// One loan at a time; the bigger ones run longer and cost more. It can be paid off
// early (what's left, no more) when the cash is there.
import {book, addMessage} from "./helpers";
import type {Club, GameState} from "./types";

export interface BankLoan {
  /** What was borrowed. */
  amount: number;
  /** Paid back each week. */
  weekly: number;
  weeksLeft: number;
}

/** The three loans on offer: how much (times the base), over how many weeks, at what interest in all. */
export const LOAN_OPTIONS = [
  {size: 1, weeks: 10, interest: 0.05},
  {size: 2, weeks: 20, interest: 0.1},
  {size: 4, weeks: 30, interest: 0.15},
] as const;

/** What the bank lends a club: by its sponsor money (a measure of how big it is). */
function loanBase(club: Club): number {
  return Math.max(500_000, Math.round((club.sponsorWeekly * 10) / 100_000) * 100_000);
}

/** The loans the club could take now, with what each costs. */
export function loanOffers(club: Club): {index: number; amount: number; weeks: number; weekly: number; total: number}[] {
  return LOAN_OPTIONS.map((o, index) => {
    const amount = loanBase(club) * o.size;
    const total = Math.round(amount * (1 + o.interest));
    return {index, amount, weeks: o.weeks, weekly: Math.ceil(total / o.weeks), total};
  });
}

/** Takes loan `index` (see loanOffers). Returns an error key, or null. */
export function takeLoan(state: GameState, index: number): string | null {
  const club = state.clubs[state.userClubId];
  if (club.loan) return "loan.already";
  const offer = loanOffers(club)[index];
  if (!offer) return "loan.already";
  club.loan = {amount: offer.amount, weekly: offer.weekly, weeksLeft: offer.weeks};
  book(state, club.id, "loan", offer.amount);
  return null;
}

/** What is still owed on the club's loan. */
export function loanLeft(club: Club): number {
  return club.loan ? club.loan.weekly * club.loan.weeksLeft : 0;
}

/** Pays off the whole loan now. Returns an error key, or null. */
export function repayLoan(state: GameState): string | null {
  const club = state.clubs[state.userClubId];
  if (!club.loan) return null;
  const left = loanLeft(club);
  if (club.cash < left) return "loan.noCash";
  book(state, club.id, "loanRepay", -left);
  delete club.loan;
  addMessage(state, {kind: "finance", key: "msg.loanPaid", params: {}});
  return null;
}

/** A week's repayment (with the rest of the week's money). */
export function weeklyLoan(state: GameState): void {
  const club = state.clubs[state.userClubId];
  const loan = club.loan;
  if (!loan) return;
  book(state, club.id, "loanRepay", -loan.weekly);
  loan.weeksLeft--;
  if (loan.weeksLeft <= 0) {
    delete club.loan;
    addMessage(state, {kind: "finance", key: "msg.loanPaid", params: {}});
  }
}
