// The league's fixtures: everyone meets twice, and home and away come in turns.
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";

describe("the fixture list", () => {
  it("never has a club at home (or away) more than three games running", () => {
    const g = newGame("Fixtures", 3, 21);
    const rounds = Math.max(...g.fixtures.map((f) => f.round));
    for (const id of Object.keys(g.clubs).filter((c) => !g.clubs[c].guest)) {
      let prev: boolean | null = null;
      let run = 0;
      let worst = 0;
      for (let r = 1; r <= rounds; r++) {
        const f = g.fixtures.find((x) => x.round === r && (x.homeId === id || x.awayId === id));
        if (!f) continue;
        const home = f.homeId === id;
        run = home === prev ? run + 1 : 1;
        prev = home;
        worst = Math.max(worst, run);
      }
      expect(worst).toBeLessThanOrEqual(3);
    }
  });

  it("has every club meet every other once at home and once away", () => {
    const g = newGame("Fixtures", 3, 22);
    const pairs = new Set(g.fixtures.map((f) => `${f.homeId}>${f.awayId}`));
    const ids = Object.keys(g.clubs).filter((c) => !g.clubs[c].guest);
    for (const a of ids) for (const b of ids) if (a !== b) expect(pairs.has(`${a}>${b}`)).toBe(true);
  });
});
