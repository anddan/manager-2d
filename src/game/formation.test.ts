// A formation change during a match: the players on the pitch move to the places of the new one,
// the replay is told (slotChanges), and the match still plays through.
import {describe, expect, it} from "vitest";
import {FORMATIONS} from "./constants";
import {newGame} from "./generate";
import {simulateMatch} from "./match";
import {Rng} from "./rng";

describe("changing formation mid-match", () => {
  it("moves the team into the new formation, keeping the keeper in goal", () => {
    const g = newGame("Form", 3, 11);
    const fixture = g.fixtures.find((f) => !f.played && (f.homeId === g.userClubId || f.awayId === g.userClubId))!;
    const side = fixture.homeId === g.userClubId ? "home" : "away";
    const club = g.clubs[g.userClubId];
    const to = club.formation === "4-4-2" ? "4-3-3" : "4-4-2";
    const report = simulateMatch(structuredClone(g), new Rng(11), fixture, true, {}, [{minute: 30, type: "formation", formation: to}], side);
    const change = report.slotChanges?.find((c) => c.side === side);
    expect(change).toBeDefined();
    expect(change!.minute).toBe(30);
    expect(change!.slots).toHaveLength(11);
    // Same places as the new formation, only in another order.
    const key = (s: {pos: string; x: number; y: number}) => `${s.pos}:${s.x}:${s.y}`;
    expect(change!.slots.map(key).sort()).toEqual(FORMATIONS[to].map(key).sort());
    // The keeper still stands in goal.
    expect(change!.slots.filter((s) => s.pos === "GK")).toHaveLength(1);
  });
});

describe("swapping and moving players mid-match", () => {
  const setup = () => {
    const g = newGame("Swap", 3, 12);
    const fixture = g.fixtures.find((f) => !f.played && (f.homeId === g.userClubId || f.awayId === g.userClubId))!;
    const side = fixture.homeId === g.userClubId ? "home" : "away";
    return {g, fixture, side} as const;
  };

  it("swaps the places of two outfield players", () => {
    const {g, fixture, side} = setup();
    const club = g.clubs[g.userClubId];
    const [a, b] = [club.lineup[1], club.lineup[9]];
    const report = simulateMatch(structuredClone(g), new Rng(12), fixture, true, {}, [{minute: 20, type: "swap", aId: a, bId: b}], side);
    const change = report.slotChanges!.find((c) => c.side === side)!;
    const before = report.slots![side];
    expect(change.slots[1]).toEqual(before[9]);
    expect(change.slots[9]).toEqual(before[1]);
  });

  it("moves a player to another spot, with the role that spot has", () => {
    const {g, fixture, side} = setup();
    const club = g.clubs[g.userClubId];
    const report = simulateMatch(structuredClone(g), new Rng(12), fixture, true, {}, [{minute: 20, type: "place", playerId: club.lineup[9], x: 30, y: 50}], side);
    const change = report.slotChanges!.find((c) => c.side === side)!;
    expect(change.slots[9]).toMatchObject({x: 30, y: 50, pos: "CB"});
  });
});
