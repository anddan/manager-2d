// The team talk after a match: the right words depend on the result against
// what was expected, and the same words every week wear thin.
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {simulateMatch} from "./match";
import {talkFit, teamTalk, type MatchVerdict} from "./morale";
import {Rng} from "./rng";

const v = (result: MatchVerdict["result"], how: MatchVerdict["how"], surprise = how === "better" ? 2 : how === "worse" ? -2 : 0): MatchVerdict => ({result, how, surprise});

describe("team talk", () => {
  it("fits the words to the result", () => {
    expect(talkFit("praise", v("W", "expected"))).toBe(1);
    expect(talkFit("praise", v("L", "worse"))).toBe(-1);
    expect(talkFit("praise", v("D", "better"))).toBe(1);
    expect(talkFit("demand", v("W", "worse"))).toBe(1);
    expect(talkFit("demand", v("W", "better"))).toBe(-1);
    expect(talkFit("disappointed", v("L", "worse"))).toBe(1);
    expect(talkFit("disappointed", v("W", "expected"))).toBe(-1);
    expect(talkFit("calm", v("L", "expected"))).toBe(1);
    // "Calm" is never wrong.
    for (const r of ["W", "D", "L"] as const) for (const h of ["better", "expected", "worse"] as const) expect(talkFit("calm", v(r, h))).toBeGreaterThanOrEqual(0);
  });

  it("lifts morale when deserved, hurts when not, and wears thin when repeated", () => {
    const g = newGame("Talk", 3, 9);
    const f = g.fixtures.find((x) => x.homeId === g.userClubId || x.awayId === g.userClubId)!;
    const report = simulateMatch(g, new Rng(4), f, true);
    const fits = (["praise", "calm", "demand", "disappointed"] as const).map((t) => ({t, fit: teamTalk(structuredClone(g), new Rng(1), report, t).fit}));
    const right = fits.find((x) => x.fit === 1)!;
    const wrong = fits.find((x) => x.fit === -1);
    expect(right).toBeDefined();
    const first = teamTalk(structuredClone(g), new Rng(1), report, right.t);
    expect(first.morale).toBeGreaterThan(0);
    if (wrong) expect(teamTalk(structuredClone(g), new Rng(1), report, wrong.t).morale).toBeLessThan(0);
    // The fourth time in a row it does much less.
    const again = structuredClone(g);
    let last = first;
    for (let i = 0; i < 4; i++) last = teamTalk(again, new Rng(1), report, right.t);
    expect(last.morale).toBeLessThan(first.morale * 0.6);
    expect(last.worn).toBe(true);
  });
});
