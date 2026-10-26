// Bank loans: the money comes at once, goes back week by week with interest, and can be paid off early.
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {weeklyFinances} from "./finance";
import {loanLeft, loanOffers, repayLoan, takeLoan} from "./loans";

describe("bank loans", () => {
  it("pays out at once and is paid back with interest", () => {
    const g = newGame("Loan", 3, 7);
    const club = g.clubs[g.userClubId];
    const offer = loanOffers(club)[1];
    const before = club.cash;
    expect(takeLoan(g, 1)).toBeNull();
    expect(club.cash).toBe(before + offer.amount);
    expect(takeLoan(g, 0)).toBe("loan.already");
    expect(offer.total).toBeGreaterThan(offer.amount);
    for (let w = 0; w < offer.weeks; w++) weeklyFinances(g, []);
    expect(club.loan).toBeUndefined();
    const repaid = g.finance.weeks.reduce((s, wk) => s + (wk.lines.loanRepay ?? 0), 0);
    expect(-repaid).toBeGreaterThanOrEqual(Math.min(offer.total, offer.weekly * 12) - 1);
  });

  it("can be paid off early, only with the cash for it", () => {
    const g = newGame("Loan", 3, 8);
    const club = g.clubs[g.userClubId];
    takeLoan(g, 0);
    const left = loanLeft(club);
    club.cash = left - 1;
    expect(repayLoan(g)).toBe("loan.noCash");
    club.cash = left + 100;
    expect(repayLoan(g)).toBeNull();
    expect(club.loan).toBeUndefined();
    expect(club.cash).toBe(100);
  });
});
