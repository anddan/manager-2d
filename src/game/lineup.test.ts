// Picking the best eleven and the bench.
import {describe, expect, it} from "vitest";
import {clubSlots} from "./constants";
import {newGame} from "./generate";
import {NEIGHBOURS, isAvailable, pickBestLineup} from "./lineup";

describe("best eleven", () => {
  it("puts one keeper on the bench, not more", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const g = newGame("Bench", seed % 6, seed);
      for (const club of Object.values(g.clubs)) {
        const {lineup, bench} = pickBestLineup(g, club, clubSlots(club));
        const keepers = bench.filter((id) => g.players[id].position === "GK");
        const spareKeepers = Object.values(g.players).filter((p) => p.clubId === club.id && p.position === "GK" && !lineup.includes(p.id));
        expect(keepers.length).toBe(Math.min(1, spareKeepers.length));
      }
    }
  });

  it("puts players in their own position when there is one, or a better one from the same line or next to it", () => {
    const line: Record<string, string> = {GK: "gk", CB: "back", FB: "back", DM: "mid", CM: "mid", AM: "mid", W: "front", ST: "front"};
    const g = newGame("Positions", 3, 9);
    for (const club of Object.values(g.clubs)) {
      const slots = clubSlots(club);
      const {lineup} = pickBestLineup(g, club, slots);
      const spare = (pos: string) => Object.values(g.players).filter((p) => p.clubId === club.id && p.position === pos && isAvailable(p) && !lineup.includes(p.id));
      slots.forEach((slot, i) => {
        const p = g.players[lineup[i]];
        if (p.position === slot.pos) return;
        // Out of position only when nobody in that position was left over, or when a player from the same
        // line (a striker out wide, a holder in the middle) is the better pick for that place.
        const left = spare(slot.pos);
        if (left.length > 0) expect(line[p.position] === line[slot.pos] || NEIGHBOURS[slot.pos].includes(p.position), club.name + " " + slot.pos + " " + p.position).toBe(true);
      });
    }
  });

  it("still fills the eleven when every centre-back is out, with the nearest stand-in", () => {
    const g = newGame("Positions", 3, 9);
    const club = g.clubs[g.userClubId];
    for (const p of Object.values(g.players)) if (p.clubId === club.id && p.position === "CB") p.injuryWeeks = 3;
    const slots = clubSlots(club);
    const {lineup} = pickBestLineup(g, club, slots);
    expect(lineup.every(Boolean)).toBe(true);
    slots.forEach((slot, i) => {
      if (slot.pos === "CB") expect(["FB", "DM"]).toContain(g.players[lineup[i]].position);
    });
  });
});

describe("the best eleven weighs the whole team at once", () => {
  it("plays a 100 striker out wide before a weak winger, and keeps a keeper in goal", async () => {
    const {newGame} = await import("./generate");
    const {FORMATIONS} = await import("./constants");
    const {pickBestLineup} = await import("./lineup");
    const {effectiveRating} = await import("./ratings");
    const g = newGame("Elva", 3, 77);
    const club = g.clubs[g.userClubId];
    const squad = Object.values(g.players).filter((p) => p.clubId === club.id);
    // One striker on 100 on the bench side, the wingers weak: the striker takes a wing place.
    const star = squad.find((p) => p.position === "ST")!;
    for (const a of Object.keys(star.attrs)) (star.attrs as Record<string, number>)[a] = a === "goalkeeping" ? 20 : 99;
    for (const p of squad.filter((x) => x.position === "W")) for (const a of Object.keys(p.attrs)) (p.attrs as Record<string, number>)[a] = 40;
    const slots = FORMATIONS["4-3-3"];
    const {lineup} = pickBestLineup(g, club, slots);
    expect(lineup).toContain(star.id);
    expect(lineup.every(Boolean)).toBe(true);
    expect(new Set(lineup).size).toBe(11);
    // A keeper in goal.
    expect(g.players[lineup[0]].position).toBe("GK");
    // Nobody on the bench would do better in the place of a starter they could swap with.
    const bench = squad.filter((p) => !lineup.includes(p.id));
    slots.forEach((slot, i) => {
      const starter = g.players[lineup[i]];
      for (const b of bench.filter((x) => x.position === slot.pos)) expect(effectiveRating(starter, slot.pos)).toBeGreaterThanOrEqual(effectiveRating(b, slot.pos) * 0.99 - 1);
    });
  }, 30_000);
});
