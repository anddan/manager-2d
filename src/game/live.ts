// Drives the user's match while it's watched. The match runs on a copy of the
// game, a minute or two ahead of what's on screen, so the manager's
// substitutions and instructions land in the next minute. It stops at every
// set piece the user takes, when one of the user's players is injured (the
// manager has to pick who comes on) and at half-time. The real result is
// counted later by finishWeek, which replays the same seed with the same
// choices and commands.
import {matchLength} from "./clock";
import {bestSub, createMatch, ordersFor, type MatchRun, type Team} from "./match";
import {Rng} from "./rng";
import type {SetPiece, SetPieceInput} from "./setpieces";
import type {GameState, InstructionKey, InstructionLevel, Instructions, MatchCommand, MatchReport, Player, Position, Side} from "./types";

export type SetPieceRole = "shooter" | "keeper";

/** A command before it's given a minute. */
export type CommandInput = MatchCommand extends infer C ? (C extends MatchCommand ? Omit<C, "minute"> : never) : never;

/** Where the engine is waiting for the manager, other than at set pieces. */
export type LiveStop =
  | {type: "injury"; minute: number; playerId: string; pos: Position}
  | {type: "halftime"; minute: number};

export class LiveMatch {
  readonly report: MatchReport;
  readonly userSide: Side;
  /** The set piece waiting for the user, if any. */
  pending: SetPiece | null = null;
  /** An injury or half-time waiting for the user, if any. */
  stop: LiveStop | null = null;
  done = false;
  /** Whether the user takes set pieces themselves; off, the computer plays them all. */
  manualSetPieces = true;
  /**
   * The minute the engine is parked before, or is in the middle of when it's
   * stopped at a set piece, an injury or half-time.
   */
  nextMinute = 0;
  /** True when parked between minutes; false when stopped inside `nextMinute`. */
  private parked = true;
  private run: MatchRun["run"];
  private teams: MatchRun["teams"];
  private copy: GameState;
  private inputs: Record<number, SetPieceInput>;
  private commands: MatchCommand[];
  private auto = false;

  constructor(state: GameState) {
    const live = state.liveMatch;
    if (!live) throw new Error("No live match");
    // A copy, so fitness and injuries during playback don't touch the save.
    this.copy = structuredClone(state);
    const fixture = this.copy.fixtures.find((f) => f.id === live.fixtureId)!;
    this.userSide = fixture.homeId === state.userClubId ? "home" : "away";
    // Shared with the generator, which reads it before every minute.
    this.commands = [...(live.commands ?? [])];
    const match = createMatch(this.copy, new Rng(live.seed), fixture, true, this.commands, this.userSide);
    this.report = match.report;
    this.run = match.run;
    this.teams = match.teams;
    this.inputs = {...live.inputs};
    // Start the generator; it parks before minute 1.
    this.resume(undefined);
  }

  /** What the user does at this set piece, or null if the computer takes it. */
  role(sp: SetPiece): SetPieceRole | null {
    if (!this.manualSetPieces) return null;
    if (sp.side === this.userSide) return "shooter";
    // Opponents' free kicks and corners play themselves; their penalties are the user's to save.
    return sp.kind === "penalty" ? "keeper" : null;
  }

  /** Simulates up to and including `minute`, unless the user is needed first. */
  advanceTo(minute: number): void {
    while (!this.done && !this.pending && !this.stop && this.nextMinute <= minute) {
      this.resume(undefined);
    }
  }

  /** Time up to which the replay frames are complete. */
  shownUpTo(): number {
    if (this.done) return matchLength(this.report);
    // Waiting for a set piece: its build-up is drawn, up to the ball going out or the foul.
    if (this.pending) {
      const last = this.report.frames[this.report.frames.length - 1];
      return Math.max(this.pending.minute - 1, last?.minute ?? 0);
    }
    return this.parked ? Math.max(0, this.nextMinute - 1) : this.nextMinute;
  }

  /** Runs the generator until it stops at the next minute, something for the user, or the end. */
  private resume(input: SetPieceInput | null | undefined): void {
    this.parked = false;
    let next = this.run.next(input);
    while (!next.done) {
      const step = next.value;
      if (step.type === "minute") {
        this.nextMinute = step.minute;
        this.parked = true;
        return;
      }
      if (step.type === "halftime") {
        this.nextMinute = step.minute;
        if (this.auto) {
          next = this.run.next(undefined);
          continue;
        }
        this.stop = {type: "halftime", minute: step.minute};
        return;
      }
      if (step.type === "injury") {
        this.nextMinute = step.minute;
        // Already decided before a reload, or the computer decides.
        const decided = this.commands.some((c) => c.type === "sub" && c.outId === step.playerId);
        if (!decided && this.auto) this.autoSub(step.playerId, step.pos);
        if (decided || this.auto) {
          next = this.run.next(undefined);
          continue;
        }
        this.stop = {type: "injury", minute: step.minute, playerId: step.playerId, pos: step.pos};
        return;
      }
      const sp = step.sp;
      const saved = this.inputs[sp.index];
      if (saved !== undefined || this.auto || !this.role(sp)) {
        next = this.run.next(saved ?? null);
        continue;
      }
      this.pending = sp;
      return;
    }
    this.pending = null;
    this.stop = null;
    this.done = true;
    this.nextMinute = matchLength(this.report) + 1;
  }

  /** Answers the pending set piece; null lets the computer decide. */
  answer(input: SetPieceInput | null): void {
    const sp = this.pending;
    if (!sp) return;
    if (input) this.inputs[sp.index] = input;
    this.pending = null;
    this.resume(input);
  }

  /** Plays on after half-time or an injury. Give the substitution with `command` first. */
  continue(): void {
    if (!this.stop) return;
    const stop = this.stop;
    this.stop = null;
    if (stop.type === "injury" && !this.commands.some((c) => c.type === "sub" && c.outId === stop.playerId)) {
      this.autoSub(stop.playerId, stop.pos);
    }
    this.resume(undefined);
  }

  /** The assistant's pick for an injured player. */
  private autoSub(outId: string, pos: Position): void {
    const team = this.teams[this.userSide];
    if (team.subsLeft - this.pendingSubs().length <= 0) return;
    const taken = new Set(this.pendingSubs().map((c) => (c.type === "sub" ? c.inId : "")));
    const inId = bestSub(this.copy, team, pos, taken);
    if (inId) this.command({type: "sub", outId, inId});
  }

  /** Lets the computer decide the rest, e.g. when skipping to the end. */
  playOut(): void {
    this.auto = true;
    if (this.pending) this.answer(null);
    if (this.stop) this.continue();
    this.advanceTo(Infinity);
  }

  /** The first minute a command given now can take effect. */
  private commandMinute(): number {
    return this.parked ? this.nextMinute : this.nextMinute + 1;
  }

  /** The command as it will be stored: it takes effect in the next simulated minute. */
  command(cmd: CommandInput): MatchCommand {
    const full = {...cmd, minute: this.commandMinute()} as MatchCommand;
    this.commands.push(full);
    return full;
  }

  /** Every command so far, including any the assistant made. */
  allCommands(): MatchCommand[] {
    return [...this.commands];
  }

  team(side: Side = this.userSide): Team {
    return this.teams[side];
  }

  /** The player as they are in the running match (fitness drops as it goes). */
  player(id: string): Player | undefined {
    return this.copy.players[id];
  }

  instructions(id: string): Instructions {
    return {...ordersFor(this.teams[this.userSide], id), ...this.pendingInstructions(id)};
  }

  /** Instructions given but not applied yet still show as set. */
  private pendingInstructions(id: string): Instructions {
    const out: Instructions = {};
    const from = this.commandMinute();
    for (const c of this.commands) {
      if (c.minute < from) continue;
      if (c.type === "instruct" && c.playerId === id) out[c.key] = c.level;
      // A team order wipes what the player was told about the same thing.
      if (c.type === "instructTeam") out[c.key] = c.level;
    }
    return out;
  }

  /** Current level of one instruction, counting ones still waiting for the next minute. */
  level(id: string, key: InstructionKey): InstructionLevel {
    return this.instructions(id)[key] ?? 0;
  }

  /** The whole team's level for one instruction, counting ones still waiting. */
  teamLevel(key: InstructionKey): InstructionLevel {
    const from = this.commandMinute();
    let lvl = this.teams[this.userSide].teamInstructions[key] ?? 0;
    for (const c of this.commands) if (c.type === "instructTeam" && c.key === key && c.minute >= from) lvl = c.level;
    return lvl;
  }

  /** Bench players still waiting for a pending substitution can't be used twice. */
  pendingSubs(): MatchCommand[] {
    const from = this.commandMinute();
    return this.commands.filter((c) => c.type === "sub" && c.minute >= from);
  }
}
