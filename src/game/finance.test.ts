// The board and debts: warnings for long spells in the red, then the sack.
import {describe, expect, it} from "vitest";
import {BOARD_WARNINGS, DEBT_WARNING_WEEKS, weeklyFinances} from "./finance";
import {newGame} from "./generate";
import {Rng} from "./rng";
import {startWeek} from "./week";

describe("the board", () => {
  it("warns about debts, then sacks the manager", () => {
    const g = newGame("Debt", 3, 7);
    const club = g.clubs[g.userClubId];
    club.cash = -50_000_000;
    for (let week = 1; week < DEBT_WARNING_WEEKS * BOARD_WARNINGS; week++) {
      weeklyFinances(g, []);
      expect(g.gameOver).toBeUndefined();
    }
    expect(g.inbox.filter((m) => m.key === "msg.boardWarning")).toHaveLength(BOARD_WARNINGS - 1);
    weeklyFinances(g, []);
    expect(g.gameOver?.reason).toBe("debt");
    // No more weeks once sacked.
    expect(startWeek(g, new Rng(1), Date.now(), {useEnergy: false}).ok).toBe(false);
  });

  it("stops counting once the club is back in the black", () => {
    const g = newGame("Debt", 3, 7);
    const club = g.clubs[g.userClubId];
    club.cash = -50_000_000;
    for (let week = 0; week < DEBT_WARNING_WEEKS - 1; week++) weeklyFinances(g, []);
    club.cash = 50_000_000;
    weeklyFinances(g, []);
    expect(g.board).toEqual({debtWeeks: 0, warnings: 0});
  });

  it("puts each board warning in front of the manager, not just in the inbox", () => {
    const g = newGame("Board", 3, 1);
    g.clubs[g.userClubId].cash = -5_000_000;
    for (let week = 0; week < DEBT_WARNING_WEEKS; week++) weeklyFinances(g, []);
    expect(g.boardAlert).toEqual({n: 1, max: BOARD_WARNINGS, cash: expect.any(Number)});
  });
});
