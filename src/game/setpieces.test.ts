// Set pieces: realistic conversion when the computer decides, choices that
// matter when the user does, and a live match that counts the same as it played.
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {LiveMatch} from "./live";
import {Rng} from "./rng";
import {resolveSetPiece, type SetPiece, type SetPieceInput} from "./setpieces";
import {finishWeek, startWeek} from "./week";
import type {Player} from "./types";

const game = newGame("SetPieces", 5, 31);
const players = Object.values(game.players);
const striker = players.filter((p) => p.position === "ST").sort((a, b) => b.attrs.finishing - a.attrs.finishing)[0];
const keeper = players.filter((p) => p.position === "GK").sort((a, b) => b.attrs.goalkeeping - a.attrs.goalkeeping)[0];

function rate(kind: SetPiece["kind"], input: (i: number) => SetPieceInput | null, taker: Player = striker, n = 4000) {
  const rng = new Rng(1);
  const results = {goal: 0, saved: 0, missed: 0, blocked: 0, cleared: 0};
  for (let i = 0; i < n; i++) {
    const sp: SetPiece = {index: 0, kind, minute: 10, side: "home", takerId: taker.id, keeperId: keeper.id, wallSide: i % 2 ? 1 : -1, spot: {x: 89.5, y: 50}};
    results[resolveSetPiece(rng, sp, input(i), taker, keeper).result]++;
  }
  return {goal: results.goal / n, saved: results.saved / n, missed: results.missed / n, blocked: results.blocked / n};
}

describe("set pieces", () => {
  it("scores most penalties and few free kicks when the computer decides", () => {
    const pen = rate("penalty", () => null);
    const fk = rate("freekick", () => null);
    console.log("auto penalty", pen, "auto free kick", fk);
    expect(pen.goal).toBeGreaterThan(0.65);
    expect(pen.goal).toBeLessThan(0.88);
    expect(fk.goal).toBeGreaterThan(0.05);
    expect(fk.goal).toBeLessThan(0.25);
  });

  it("misses when the user aims well wide, and scores more aiming for the corners", () => {
    expect(rate("penalty", () => ({aim: {x: 1.6, y: 0.4}})).missed).toBeGreaterThan(0.9);
    const middle = rate("penalty", () => ({aim: {x: 0, y: 0.3}}));
    const corner = rate("penalty", () => ({aim: {x: 0.8, y: 0.6}}));
    expect(corner.goal).toBeGreaterThan(middle.goal);
  });

  it("makes accurate takers more reliable than poor ones", () => {
    const poor = players.filter((p) => p.position === "CB").sort((a, b) => a.attrs.finishing - b.attrs.finishing)[0];
    const aim = () => ({aim: {x: 0.85, y: 0.7}});
    expect(rate("penalty", aim, striker).missed).toBeLessThan(rate("penalty", aim, poor).missed);
  });

  it("saves more when the user's keeper guesses right", () => {
    // The computer's penalty aim is left or right at random; diving the right way pays off.
    const rng = new Rng(9);
    let right = 0;
    let wrong = 0;
    for (let i = 0; i < 3000; i++) {
      const sp: SetPiece = {index: 0, kind: "penalty", minute: 10, side: "away", takerId: striker.id, keeperId: keeper.id, wallSide: 1, spot: {x: 10.5, y: 50}};
      const probe = resolveSetPiece(new Rng(i + 1), sp, null, striker, keeper);
      const side = Math.sign(probe.shot.x) || 1;
      if (resolveSetPiece(new Rng(i + 1), sp, {dive: side * 0.6}, striker, keeper).result === "saved") right++;
      if (resolveSetPiece(new Rng(i + 1), sp, {dive: -side * 0.6}, striker, keeper).result === "saved") wrong++;
      rng.next();
    }
    expect(right).toBeGreaterThan(wrong * 3);
  });
});

describe("live match", () => {
  it("counts the same result as it showed, with the user's choices", () => {
    // Play weeks until a live match with a user set piece shows up.
    const g = structuredClone(game);
    const rng = new Rng(4);
    for (let week = 0; week < 40; week++) {
      const started = startWeek(g, rng, Date.now(), {useEnergy: false});
      if (!started.ok) throw new Error(started.reason);
      if (!started.live) {
        finishWeek(g, rng);
        continue;
      }
      const live = new LiveMatch(g);
      let answered = 0;
      const playTo = (minute: number) => {
        live.advanceTo(minute);
        while (live.pending) {
          const input: SetPieceInput = live.role(live.pending) === "shooter" ? {aim: {x: -0.7, y: 0.5}, target: "far"} : {dive: 0.6};
          g.liveMatch!.inputs[live.pending.index] = input;
          live.answer(input);
          answered++;
          live.advanceTo(minute);
        }
      };
      playTo(55);
      // The manager makes a change and gives an instruction just before the hour.
      const team = live.team();
      const out = team.onPitch.find((o) => team.slots[o.slot].pos !== "GK")!;
      const inId = team.bench[0];
      const sub = live.command({type: "sub", outId: out.id, inId});
      const instruct = live.command({type: "instruct", playerId: team.onPitch[3].id, key: "shooting", level: 1});
      g.liveMatch!.commands = [sub, instruct];
      playTo(90);
      expect(live.done).toBe(true);
      expect(live.report.events.some((e) => e.type === "sub" && e.otherId === inId)).toBe(true);
      expect(live.report.events.some((e) => e.type === "instruction" && e.note === "shooting+")).toBe(true);

      // A reload mid-match must replay the same match from the saved choices.
      const resumed = new LiveMatch(g);
      resumed.advanceTo(90);
      expect(resumed.done).toBe(true);
      expect([resumed.report.homeGoals, resumed.report.awayGoals]).toEqual([live.report.homeGoals, live.report.awayGoals]);

      const counted = finishWeek(g, rng)!;
      expect([counted.homeGoals, counted.awayGoals]).toEqual([live.report.homeGoals, live.report.awayGoals]);
      expect(counted.setPieces?.length).toBe(live.report.setPieces?.length);
      expect(g.liveMatch).toBeNull();
      if (answered > 0) return;
    }
    throw new Error("No user set piece in 40 weeks");
  });
});
