import {describe, expect, it} from "vitest";
import {announceAwards, seasonAwards} from "./awards";
import {newGame} from "./generate";
import {leagueClubs} from "./helpers";

describe("season awards", () => {
  it("gives the awards by the season's ratings, and lights up a win for one of ours", () => {
    const g = newGame("Awards", 3, 41);
    const mine = Object.values(g.players).filter((p) => p.clubId === g.userClubId);
    const star = mine.find((p) => p.position !== "GK")!;
    star.stats = {apps: 20, starts: 20, goals: 15, assists: 5, yellow: 0, red: 0, ratingSum: 20 * 9.5};
    const keeper = Object.values(g.players).find((p) => p.position === "GK" && p.clubId && p.clubId !== g.userClubId)!;
    keeper.stats = {apps: 20, starts: 20, goals: 0, assists: 0, yellow: 0, red: 0, ratingSum: 20 * 8};
    const order = leagueClubs(g).map((c) => c.id);
    const awards = seasonAwards(g, order);
    expect(awards.player).toBe(star.id);
    expect(awards.keeper).toBe(keeper.id);
    expect(order).toContain(awards.managerClub);
    announceAwards(g, awards);
    const mail = g.inbox[0];
    expect(mail.key).toBe("msg.awards");
    expect(mail.highlight).toBe(true);
    expect(g.celebrations?.some((c) => c.kind === "award")).toBe(true);
  });
});
