// Set pieces: realistic conversion when the computer decides, choices that
// matter when the user does, and a live match that counts the same as it played.
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {LiveMatch} from "./live";
import {createMatch} from "./match";
import {Rng} from "./rng";
import {resolveSetPiece, type SetPiece, type SetPieceInput} from "./setpieces";
import {finishWeek, startWeek} from "./week";
import type {MatchCommand, Player} from "./types";

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

describe("set piece build-up", () => {
  it("is in the replay before the set piece is taken", () => {
    let checked = 0;
    for (let seed = 1; seed < 6; seed++) {
      const g = structuredClone(game);
      const {run, report} = createMatch(g, new Rng(seed), g.fixtures[0], true);
      let step = run.next();
      while (!step.done) {
        if (step.value.type === "setpiece") {
          const sp = step.value.sp;
          const last = report.frames[report.frames.length - 1];
          const depth = (x: number) => (sp.side === "home" ? x : 100 - x);
          if (sp.kind === "corner") {
            // Out over the goal line on the corner's side.
            expect(last.kind).toBe("out");
            expect(depth(last.x)).toBeGreaterThan(99);
          } else {
            // The foul: in the box for a penalty, by the spot for a free kick.
            expect(last.kind).toBe("dribble");
            expect(Math.hypot(last.x - sp.spot.x, last.y - sp.spot.y)).toBeLessThan(sp.kind === "penalty" ? 14 : 6);
          }
          // In the first part of the set piece's minute.
          expect(last.minute).toBeGreaterThan(sp.minute - 1);
          expect(last.minute).toBeLessThan(sp.minute - 0.3);
          checked++;
        }
        step = run.next(step.value.type === "setpiece" ? null : undefined);
      }
    }
    expect(checked).toBeGreaterThan(10);
  });
});

describe("injuries in a managed team", () => {
  it("wait for the manager's substitute and bring them on the next minute", () => {
    for (let seed = 1; seed < 400; seed++) {
      const g = structuredClone(game);
      const commands: MatchCommand[] = [];
      const {run, teams} = createMatch(g, new Rng(seed), g.fixtures[0], false, commands, "home");
      let step = run.next();
      let injury: {minute: number; playerId: string; inId: string} | null = null;
      while (!step.done) {
        if (step.value.type === "injury" && !injury) {
          const inId = teams.home.bench[teams.home.bench.length - 1];
          injury = {minute: step.value.minute, playerId: step.value.playerId, inId};
          commands.push({minute: step.value.minute + 1, type: "sub", outId: step.value.playerId, inId});
          // Off for treatment until the substitute comes on.
          expect(teams.home.onPitch.some((o) => o.id === injury!.playerId)).toBe(false);
        }
        step = run.next(step.value.type === "setpiece" ? null : undefined);
      }
      if (!injury) continue;
      // Hurt in the very last minute: the match is over before anyone can come on.
      if (injury.minute >= (step.value.events.find((e) => e.type === "fulltime")?.minute ?? 90)) continue;
      const sub = step.value.events.find((e) => e.type === "sub" && e.playerId === injury!.playerId);
      expect(sub?.otherId).toBe(injury.inId);
      expect(sub?.minute).toBe(injury.minute + 1);
      return;
    }
    throw new Error("No injury in 400 matches");
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
      let halftimes = 0;
      const playTo = (minute: number) => {
        live.advanceTo(minute);
        while (live.pending || live.stop) {
          if (live.stop) {
            if (live.stop.type === "halftime") halftimes++;
            else {
              // An injured player: the manager picks the first fit sub on the bench.
              const taken = new Set(live.pendingSubs().map((c) => (c.type === "sub" ? c.inId : "")));
              const inId = live.team().bench.find((id) => !taken.has(id));
              if (inId) live.command({type: "sub", outId: live.stop.playerId, inId});
            }
            live.continue();
          } else if (live.pending) {
            const input: SetPieceInput = live.role(live.pending) === "shooter" ? {aim: {x: -0.7, y: 0.5}, target: "far"} : {dive: 0.6};
            g.liveMatch!.inputs[live.pending.index] = input;
            live.answer(input);
            answered++;
          }
          live.advanceTo(minute);
        }
      };
      playTo(55);
      // The manager makes a change and gives instructions just before the hour.
      const team = live.team();
      const out = team.onPitch.find((o) => team.slots[o.slot].pos !== "GK")!;
      const taken = new Set(live.pendingSubs().map((c) => (c.type === "sub" ? c.inId : "")));
      const inId = team.bench.find((id) => !taken.has(id))!;
      live.command({type: "sub", outId: out.id, inId});
      live.command({type: "instruct", playerId: team.onPitch[3].id, key: "shooting", level: 1});
      live.command({type: "instructTeam", key: "tackling", level: -1});
      playTo(Infinity);
      g.liveMatch!.commands = live.allCommands();
      expect(live.done).toBe(true);
      expect(halftimes).toBe(1);
      expect(live.report.added![0]).toBeGreaterThanOrEqual(1);
      expect(live.report.added![1]).toBeGreaterThanOrEqual(2);
      expect(live.report.events.some((e) => e.type === "sub" && e.otherId === inId)).toBe(true);
      expect(live.report.events.some((e) => e.type === "instruction" && e.note === "shooting+")).toBe(true);
      expect(live.report.events.some((e) => e.type === "instruction" && !e.playerId && e.note === "tackling-")).toBe(true);

      // A reload mid-match must replay the same match from the saved choices.
      const resumed = new LiveMatch(g);
      resumed.advanceTo(Infinity);
      while (resumed.stop) {
        resumed.continue();
        resumed.advanceTo(Infinity);
      }
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
