// Picking the best eleven and the bench.
import {describe, expect, it} from "vitest";
import {clubSlots} from "./constants";
import {newGame} from "./generate";
import {pickBestLineup} from "./lineup";

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
});
