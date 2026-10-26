// Picking the best eleven and the bench.
import {describe, expect, it} from "vitest";
import {clubSlots} from "./constants";
import {newGame} from "./generate";
import {isAvailable, pickBestLineup} from "./lineup";

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

  it("puts players in their own position when there is one to put there", () => {
    const g = newGame("Positions", 3, 9);
    for (const club of Object.values(g.clubs)) {
      const slots = clubSlots(club);
      const {lineup} = pickBestLineup(g, club, slots);
      const spare = (pos: string) => Object.values(g.players).some((p) => p.clubId === club.id && p.position === pos && isAvailable(p) && !lineup.includes(p.id));
      slots.forEach((slot, i) => {
        const p = g.players[lineup[i]];
        // Out of position only when nobody in that position was left over.
        if (p.position !== slot.pos) expect(spare(slot.pos), club.name + " " + slot.pos).toBe(false);
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
