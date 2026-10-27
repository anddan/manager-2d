// Player names: plenty of them, and no two players at a club with the same surname.
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {LEAGUES} from "./leagues";
import {NATIONALITIES} from "./names";

describe("player names", () => {
  it("has a good pool of names for every nationality", () => {
    for (const [code, n] of Object.entries(NATIONALITIES)) {
      expect(new Set(n.last).size, code).toBeGreaterThanOrEqual(28);
      expect(new Set(n.first).size, code).toBeGreaterThanOrEqual(20);
      expect(new Set(n.female).size, code).toBeGreaterThanOrEqual(14);
    }
  });

  it("gives every club's players different surnames", () => {
    for (const league of LEAGUES) {
      const g = newGame("Names", 3, 11, undefined, "men", league.id);
      for (const club of Object.values(g.clubs)) {
        const names = Object.values(g.players).filter((p) => p.clubId === club.id).map((p) => p.lastName);
        expect(new Set(names).size, `${league.id} ${club.name}`).toBe(names.length);
      }
    }
  }, 20_000);
});
