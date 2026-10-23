// Drives the user's match while it's watched. The match runs on a copy of the
// game, a minute or two ahead of what's on screen, so the manager's
// substitutions and instructions land in the next minute. It stops at every
// set piece the user takes. The real result is counted later by finishWeek,
// which replays the same seed with the same choices and commands.
import {createMatch, type MatchRun, type Team} from "./match";
import {Rng} from "./rng";
import type {SetPiece, SetPieceInput} from "./setpieces";
import type {GameState, InstructionKey, InstructionLevel, Instructions, MatchCommand, MatchReport, Player, Side} from "./types";

export type SetPieceRole = "shooter" | "keeper";

/** A command before it's given a minute. */
export type CommandInput = MatchCommand extends infer C ? (C extends MatchCommand ? Omit<C, "minute"> : never) : never;

export class LiveMatch {
  readonly report: MatchReport;
  readonly userSide: Side;
  /** The set piece waiting for the user, if any. */
  pending: SetPiece | null = null;
  done = false;
  /** Whether the user takes their own corners (there are many of them). */
  manualCorners = true;
  /** The next minute the engine will simulate; frames exist up to the one before. */
  nextMinute = 0;
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
    // Shared with the generator, which reads it before every minute.
    this.commands = [...(live.commands ?? [])];
    const match = createMatch(this.copy, new Rng(live.seed), fixture, true, this.commands);
    this.report = match.report;
    this.run = match.run;
    this.teams = match.teams;
    this.inputs = {...live.inputs};
    this.userSide = this.report.homeId === state.userClubId ? "home" : "away";
    // Start the generator; it parks before minute 1.
    this.resume(undefined);
  }

  /** What the user does at this set piece, or null if the computer takes it. */
  role(sp: SetPiece): SetPieceRole | null {
    if (sp.side === this.userSide) return sp.kind === "corner" && !this.manualCorners ? null : "shooter";
    // Opponents' free kicks and corners play themselves; their penalties are the user's to save.
    return sp.kind === "penalty" ? "keeper" : null;
  }

  /** Simulates up to and including `minute`, unless a set piece needs the user first. */
  advanceTo(minute: number): void {
    while (!this.done && !this.pending && this.nextMinute <= minute) {
      this.resume(undefined);
    }
  }

  /** Runs the generator until it stops at the next minute, a user set piece or the end. */
  private resume(input: SetPieceInput | null | undefined): void {
    let next = this.run.next(input);
    while (!next.done) {
      const step = next.value;
      if (step.type === "minute") {
        // Parked before this minute; frames exist up to the one before.
        this.nextMinute = step.minute;
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
    this.done = true;
    this.nextMinute = 91;
  }

  /** Answers the pending set piece; null lets the computer decide. */
  answer(input: SetPieceInput | null): void {
    const sp = this.pending;
    if (!sp) return;
    if (input) this.inputs[sp.index] = input;
    this.pending = null;
    this.resume(input);
  }

  /** Lets the computer decide the rest, e.g. when skipping to the end. */
  playOut(): void {
    this.auto = true;
    if (this.pending) this.answer(null);
    this.advanceTo(91);
  }

  /** The command as it will be stored: it takes effect in the next simulated minute. */
  command(cmd: CommandInput): MatchCommand {
    const full = {...cmd, minute: this.nextMinute} as MatchCommand;
    this.commands.push(full);
    return full;
  }

  team(side: Side = this.userSide): Team {
    return this.teams[side];
  }

  /** The player as they are in the running match (fitness drops as it goes). */
  player(id: string): Player | undefined {
    return this.copy.players[id];
  }

  instructions(id: string): Instructions {
    return this.teams[this.userSide].instructions[id] ?? this.pendingInstructions(id);
  }

  /** Instructions given but not applied yet still show as set. */
  private pendingInstructions(id: string): Instructions {
    const out: Instructions = {};
    for (const c of this.commands) {
      if (c.type === "instruct" && c.playerId === id && c.minute >= this.nextMinute) out[c.key] = c.level;
    }
    return out;
  }

  /** Current level of one instruction, counting ones still waiting for the next minute. */
  level(id: string, key: InstructionKey): InstructionLevel {
    const waiting = this.pendingInstructions(id)[key];
    return waiting ?? this.teams[this.userSide].instructions[id]?.[key] ?? 0;
  }

  /** Bench players still waiting for a pending substitution can't be used twice. */
  pendingSubs(): MatchCommand[] {
    return this.commands.filter((c) => c.type === "sub" && c.minute >= this.nextMinute);
  }
}
