// Going in hard: more fouls (free kicks for the other side) and more cards; and some tackles are slides.
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {simulateMatch} from "./match";
import {Rng} from "./rng";
import type {MatchCommand} from "./types";

describe("tackling hard", () => {
  const game = newGame("Fouls", 3, 7);
  const fixture = game.fixtures.find((f) => f.homeId === game.userClubId)!;

  it("brings more cards and more free kicks for the other side", () => {
    const hard: MatchCommand[] = [{minute: 1, type: "instructTeam", key: "tackling", level: 1}];
    let cardsCalm = 0;
    let cardsHard = 0;
    let kicksCalm = 0;
    let kicksHard = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const calm = simulateMatch(structuredClone(game), new Rng(seed), fixture, false, {}, [], "home");
      const rough = simulateMatch(structuredClone(game), new Rng(seed), fixture, false, {}, hard, "home");
      const cards = (r: typeof calm) => r.events.filter((e) => (e.type === "yellow" || e.type === "red") && e.side === "home").length;
      const kicks = (r: typeof calm) => (r.setPieces ?? []).filter((s) => s.side === "away" && s.kind === "freekick").length;
      cardsCalm += cards(calm);
      cardsHard += cards(rough);
      kicksCalm += kicks(calm);
      kicksHard += kicks(rough);
    }
    expect(cardsHard).toBeGreaterThan(cardsCalm * 1.3);
    expect(kicksHard).toBeGreaterThan(kicksCalm);
  }, 60000);

  it("wins some balls back with a slide, never the keeper", () => {
    const r = simulateMatch(structuredClone(game), new Rng(4), fixture, true);
    const slides = r.frames.filter((f) => f.slide);
    expect(slides.length).toBeGreaterThan(0);
    for (const f of slides) {
      expect(f.kind).toBe("tackle");
      expect(game.players[f.playerId!].position).not.toBe("GK");
    }
  });
});
