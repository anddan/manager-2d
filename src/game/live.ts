// Drives the user's match while it's watched. The match runs on a copy of the
// game, stops at every penalty or free kick the user takes part in, and
// continues once they've chosen. The real result is counted later by
// finishWeek, which replays the same seed with the same choices.
import {createMatch, type MatchRun} from "./match";
import {Rng} from "./rng";
import type {SetPiece, SetPieceInput} from "./setpieces";
import type {GameState, MatchReport} from "./types";

export type SetPieceRole = "shooter" | "keeper";

export class LiveMatch {
  readonly report: MatchReport;
  /** The set piece waiting for the user, if any. */
  pending: SetPiece | null = null;
  done = false;
  private run: MatchRun["run"];
  private inputs: Record<number, SetPieceInput>;
  private auto = false;
  private userClubId: string;

  constructor(state: GameState) {
    const live = state.liveMatch;
    if (!live) throw new Error("No live match");
    // A copy, so fitness and injuries during playback don't touch the save.
    const copy = structuredClone(state);
    const fixture = copy.fixtures.find((f) => f.id === live.fixtureId)!;
    const match = createMatch(copy, new Rng(live.seed), fixture, true);
    this.report = match.report;
    this.run = match.run;
    this.inputs = {...live.inputs};
    this.userClubId = state.userClubId;
    this.step(undefined);
  }

  /** What the user does at this set piece, or null if it's not theirs. */
  role(sp: SetPiece): SetPieceRole | null {
    const takers = sp.side === "home" ? this.report.homeId : this.report.awayId;
    if (takers === this.userClubId) return "shooter";
    // Opponents' free kicks play themselves; their penalties are the user's to save.
    return sp.kind === "penalty" ? "keeper" : null;
  }

  /** Runs until the next set piece that needs the user, or the end. */
  private step(input: SetPieceInput | null | undefined): void {
    let next = this.run.next(input);
    while (!next.done) {
      const sp = next.value;
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
  }

  /** Answers the pending set piece; null lets the computer decide. */
  answer(input: SetPieceInput | null): void {
    const sp = this.pending;
    if (!sp) return;
    if (input) this.inputs[sp.index] = input;
    this.pending = null;
    this.step(input);
  }

  /** Lets the computer decide the rest, e.g. when skipping to the end. */
  playOut(): void {
    this.auto = true;
    if (this.pending) this.answer(null);
  }
}
