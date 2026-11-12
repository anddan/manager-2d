// The tick engine's balance over a batch of matches. The numbers are not the real game's (shots, tackles and dribbles may run high, it is more
// fun to watch); the play is what should be true to football: who passes where, who tackles, how a keeper gets the ball out, how a cross is met.
// Run alone with `TICK_STATS=fil.json npx vitest run --pool=vmThreads src/game/tickStats.test.ts` to write the averages to a file.
import {writeFileSync} from "node:fs";
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {simulateMatch} from "./match";
import {Rng} from "./rng";

const N = Number(process.env.TICK_MATCHES ?? 12);

describe("the tick engine's balance", () => {
  const game = newGame("Balance", 2, 9);

  it("plays matches that are fun and still football", () => {
    const sum: Record<string, number> = {};
    const add = (k: string, v: number) => { sum[k] = (sum[k] ?? 0) + v; };
    let frames = 0;
    let t0 = Date.now();
    for (let seed = 1; seed <= N; seed++) {
      const r = simulateMatch(structuredClone(game), new Rng(seed * 7919), game.fixtures[seed % game.fixtures.length], true, {}, [], undefined, "tick");
      add("goals", r.homeGoals + r.awayGoals);
      add("shots", r.shots![0] + r.shots![1]);
      add("onTarget", r.onTarget![0] + r.onTarget![1]);
      add("xg", (r.xg?.[0] ?? 0) + (r.xg?.[1] ?? 0));
      add("possessionGap", Math.abs(r.possessionHome - 50));
      for (const [k, v] of Object.entries(r.stats ?? {})) add(k, v[0] + v[1]);
      for (const e of r.events) if (["yellow", "red", "saved", "blocked", "missed"].includes(e.type)) add("ev_" + e.type, 1);
      frames += r.frames.length;
      for (const f of r.frames) {
        if (f.slide) add("f_slide", 1);
        if (f.foul) add("f_foul", 1);
        if (f.skill) add("f_skill", 1);
        if (f.flight) add("f_" + f.flight, 1);
        if (f.kind) add("k_" + f.kind, 1);
      }
    }
    const avg = Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, Math.round((v / N) * 100) / 100]));
    avg.frames = Math.round(frames / N);
    avg.msPerMatch = Math.round((Date.now() - t0) / N);
    if (process.env.TICK_STATS) writeFileSync(process.env.TICK_STATS, JSON.stringify(avg, null, 1));
    // Broad limits: goals the way a game of football gives them, not the way a shooting gallery does.
    expect(avg.goals).toBeGreaterThan(2);
    expect(avg.goals).toBeLessThan(5);
    expect(avg.shots).toBeGreaterThan(18);
    expect(avg.passesOk / avg.passes).toBeGreaterThan(0.6);
    expect(avg.passesOk / avg.passes).toBeLessThan(0.93);
    // A man clear on goal shoots, and scores about three times in ten (more or less by his finishing; few shots per batch, so wide limits).
    expect(avg.freeShots).toBeGreaterThan(2);
    expect(avg.freeGoals / avg.freeShots).toBeGreaterThan(0.1);
    expect(avg.freeGoals / avg.freeShots).toBeLessThan(0.6);
  }, 300000);
});
