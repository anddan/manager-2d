// Measures the prototype (see tickSim.ts). Writes what it found to the file named by PROTO_OUT (or tickSim.txt).
import {writeFileSync} from "node:fs";
import {describe, expect, it} from "vitest";
import {TickSim} from "./tickSim";

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))];

function time(hz: number, heavy: boolean, runs: number, record: boolean): {ms: number[]; sim: TickSim} {
  const ms: number[] = [];
  let last!: TickSim;
  for (let r = 0; r < runs; r++) {
    const t0 = performance.now();
    const sim = new TickSim({hz, minutes: 95, heavy, seed: 100 + r, record});
    sim.advance(sim.total);
    ms.push(performance.now() - t0);
    last = sim;
  }
  return {ms, sim: last};
}

// Only when asked for (PROTO_OUT=fil npx vitest run src/game/proto): it takes a while and is not part of the game.
describe.skipIf(!process.env.PROTO_OUT)("tick simulation prototype", () => {
  it("measures", () => {
    const out: string[] = [];
    // Warm up (the first runs are slower while the engine learns the code).
    time(5, false, 4, false);

    for (const [name, hz, heavy] of [["4 Hz", 4, false], ["5 Hz", 5, false], ["10 Hz", 10, false], ["5 Hz, heavy", 5, true], ["10 Hz, heavy", 10, true]] as const) {
      const {ms, sim} = time(hz, heavy, 12, false);
      out.push(`${name}: ${sim.total} steps, per match median ${median(ms).toFixed(0)} ms, p95 ${pct(ms, 0.95).toFixed(0)} ms, min ${Math.min(...ms).toFixed(0)} ms, ${(median(ms) * 1000 / sim.total).toFixed(1)} us per step (passes ${sim.passes}, tackles ${sim.tackles}, shots ${sim.shots}, goals ${sim.goals.join("-")})`);
    }

    // The time with everything kept (for replays and for the viewer).
    const rec = time(5, false, 6, true);
    out.push(`5 Hz, recording: median ${median(rec.ms).toFixed(0)} ms, kept ${(rec.sim.track!.byteLength / 1e6).toFixed(2)} MB per match`);

    // The same seed gives the same match.
    const a = new TickSim({hz: 5, minutes: 95, heavy: false, seed: 7, record: false});
    a.advance(a.total);
    const b = new TickSim({hz: 5, minutes: 95, heavy: false, seed: 7, record: false});
    b.advance(b.total);
    const c = new TickSim({hz: 5, minutes: 95, heavy: false, seed: 8, record: false});
    c.advance(c.total);
    out.push(`repeatable: same seed ${a.hash() === b.hash() ? "same" : "DIFFERENT"}, other seed ${a.hash() === c.hash() ? "same (!)" : "different"}`);

    // Watching a match as it is played: a few steps per frame. The worst frame is what could be felt.
    for (const [hz, perFrame] of [[5, 6], [5, 30], [10, 12]] as const) {
      const sim = new TickSim({hz, minutes: 95, heavy: true, seed: 5, record: true});
      const frames: number[] = [];
      while (!sim.done) {
        const t0 = performance.now();
        sim.advance(perFrame);
        frames.push(performance.now() - t0);
      }
      out.push(`played in front of you at ${hz} Hz with ${perFrame} steps a frame (heavy, recording): median ${median(frames).toFixed(3)} ms, p99 ${pct(frames, 0.99).toFixed(3)} ms, worst ${Math.max(...frames).toFixed(2)} ms (a frame is 16.7 ms)`);
    }

    // A round of matches in one go (what "next week" would cost if all of them were played like this).
    for (const matches of [5, 10, 20]) {
      const t0 = performance.now();
      for (let m = 0; m < matches; m++) {
        const sim = new TickSim({hz: 5, minutes: 95, heavy: false, seed: 300 + m, record: false});
        sim.advance(sim.total);
      }
      out.push(`${matches} matches in a row at 5 Hz: ${(performance.now() - t0).toFixed(0)} ms`);
    }

    writeFileSync(process.env.PROTO_OUT ?? "tickSim.txt", out.join("\n") + "\n");
    expect(out.length).toBeGreaterThan(5);
  }, 600000);
});
