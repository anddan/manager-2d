// How a goal is celebrated: the scorer runs to the corner flag or the fans, or slides on his knees, or the team gathers round him.
import {describe, expect, it} from "vitest";
import {FORMATIONS} from "../game/constants";
import {newGame} from "../game/generate";
import {simulateMatch} from "../game/match";
import {Rng} from "../game/rng";
import {kickoffTargets, planCelebration, type Celebration, type Ctx} from "./MatchViewer";

describe("celebrating a goal", () => {
  const game = newGame("Joy", 2, 9);
  const report = simulateMatch(game, new Rng(3), game.fixtures[0], true);
  const ctx: Ctx = {report, frames: report.frames, slots: {home: FORMATIONS[report.formations.home], away: FORMATIONS[report.formations.away]}, players: game.players};
  const ids = report.lineups.home.filter((id) => id && report.ratings[id] !== undefined) as string[];
  const bodies: Record<string, {x: number; y: number}> = {};
  ids.forEach((id, i) => { bodies[id] = {x: 70 + (i % 4) * 6, y: 15 + i * 6}; });
  const kickoff = kickoffTargets(ctx, 30, undefined);

  it("is one of a few ways, the same for the same goal, and every way ends with the team back in their places", () => {
    const seen = new Set<Celebration>();
    for (let seed = 0; seed < 400; seed++) {
      const scorer = ids[seed % ids.length];
      const plan = planCelebration(ctx, 30, "home", scorer, bodies, {x: 100, y: 40}, seed * 37, kickoff);
      expect(plan).toEqual(planCelebration(ctx, 30, "home", scorer, bodies, {x: 100, y: 40}, seed * 37, kickoff));
      seen.add(plan.kind);
      expect(Number.isFinite(plan.duration)).toBe(true);
      expect(plan.duration).toBeLessThan(9000);
      if (plan.stages) {
        expect(plan.stages[plan.stages.length - 1].until).toBe(Infinity);
        for (const st of plan.stages) for (const p of Object.values(st.targets)) {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThanOrEqual(100);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeLessThanOrEqual(100);
        }
        // The first stage has the scorer somewhere else than the kick-off place.
        expect(plan.stages[0].targets[scorer]).not.toEqual(kickoff[scorer]);
      }
      for (const m of plan.moves) expect(m.at).toBeLessThan(plan.duration);
    }
    expect([...seen].sort()).toEqual(["corner", "fans", "huddle", "slide"]);
  });
});
