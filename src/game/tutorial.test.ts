// The guide: its steps move on in order, and the first match shows off the game.
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {simulateMatch} from "./match";
import {Rng} from "./rng";
import {TUTORIAL_STEPS, tutorialMatchSeed, tutorialNext, tutorialSkip} from "./tutorial";

describe("the guide", () => {
  it("moves on only from the step it's on, and can be skipped", () => {
    const g = newGame("Guide", 3, 4);
    g.tutorial = {step: 0};
    tutorialNext(g, "tactics"); // Not there yet.
    expect(g.tutorial.step).toBe(0);
    tutorialNext(g, "welcome");
    expect(TUTORIAL_STEPS[g.tutorial.step]).toBe("tactics");
    tutorialSkip(g);
    expect(g.tutorial.step).toBe(TUTORIAL_STEPS.length);
  });

  it("picks a first match with a penalty for the user's side and a win", () => {
    const g = newGame("Guide", 3, 4);
    const f = g.fixtures.find((x) => x.homeId === g.userClubId || x.awayId === g.userClubId)!;
    const side = f.homeId === g.userClubId ? "home" : "away";
    const seed = tutorialMatchSeed(g, f, side, 12345);
    const r = simulateMatch(structuredClone(g), new Rng(seed), f, false, {}, [], side);
    expect(r.setPieces?.some((sp) => sp.side === side && sp.kind === "penalty")).toBe(true);
    expect(side === "home" ? r.homeGoals > r.awayGoals : r.awayGoals > r.homeGoals).toBe(true);
  });
});
