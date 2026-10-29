// A substitution given in the dialog can be taken back before it's played.
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {LiveMatch} from "./live";
import {Rng} from "./rng";
import {finishWeek, startWeek} from "./week";

describe("undoing a substitution", () => {
  it("takes back a pending substitution and gives the change back", () => {
    const g = newGame("Undo", 3, 21);
    const rng = new Rng(5);
    let live: LiveMatch | undefined;
    for (let week = 0; week < 40 && !live; week++) {
      const started = startWeek(g, rng, Date.now(), {useEnergy: false});
      if (!started.ok) throw new Error(started.reason);
      if (started.live) live = new LiveMatch(g);
      else finishWeek(g, rng);
    }
    expect(live).toBeDefined();
    const team = live!.team();
    const out = team.onPitch.find((o) => team.slots[o.slot].pos !== "GK")!.id;
    const inn = team.bench[0];
    live!.command({type: "sub", outId: out, inId: inn});
    expect(live!.pendingSubs()).toHaveLength(1);
    const removed = live!.undoSub(out);
    expect(removed).toMatchObject({type: "sub", outId: out, inId: inn});
    expect(live!.pendingSubs()).toHaveLength(0);
    expect(live!.undoSub(out)).toBeUndefined();
  });
});
