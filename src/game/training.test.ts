// Training: a player set to rest has a light recovery week, whatever the squad does.
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {Rng} from "./rng";
import {trainPlayer} from "./training";

describe("training", () => {
  it("lets one player rest while the others work hard", () => {
    const g = newGame("Vila", 2, 61);
    const club = g.clubs[g.userClubId];
    const [a, b] = Object.values(g.players).filter((p) => p.clubId === club.id && p.injuryWeeks === 0);
    a.fitness = b.fitness = 60;
    a.individualFocus = "rest";
    for (let i = 0; i < 20; i++) {
      trainPlayer(new Rng(i), club, a, {focus: "physical", intensity: "hard"});
      expect(a.injuryWeeks).toBe(0);
    }
    trainPlayer(new Rng(1), club, b, {focus: "physical", intensity: "hard"});
    expect(a.fitness).toBe(100);
    expect(b.fitness).toBeLessThanOrEqual(60);
  });
});
