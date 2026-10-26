// The guide: its steps move on in order, and the first match shows off the game.
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {simulateMatch} from "./match";
import {Rng} from "./rng";
import {TUTORIAL_STEPS, TUTORIAL_VERSION, tutorialMatchSeed, tutorialNext, tutorialSkip, upgradeTutorial} from "./tutorial";

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

  it("keeps an older save's place in the guide, and a finished guide finished", () => {
    const g = newGame("Guide", 3, 4);
    g.tutorial = {step: 5}; // "play" in the first order.
    upgradeTutorial(g);
    expect(TUTORIAL_STEPS[g.tutorial.step]).toBe("play");
    g.tutorial = {step: 2}; // "bestXI", before the new steps.
    upgradeTutorial(g);
    expect(TUTORIAL_STEPS[g.tutorial.step]).toBe("bestXI");
    g.tutorial = {step: 9}; // "zoom" in the first order: gone, so the step after it.
    upgradeTutorial(g);
    expect(TUTORIAL_STEPS[g.tutorial.step]).toBe("talk");
    g.tutorial = {step: 12}; // Done with the first order.
    upgradeTutorial(g);
    expect(g.tutorial.step).toBe(TUTORIAL_STEPS.length);
    g.tutorial = {step: 12, v: 2}; // "talk" in the second order.
    upgradeTutorial(g);
    expect(TUTORIAL_STEPS[g.tutorial.step]).toBe("talk");
    g.tutorial = {step: 5, v: TUTORIAL_VERSION}; // Already today's order.
    upgradeTutorial(g);
    expect(TUTORIAL_STEPS[g.tutorial.step]).toBe("club");
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
