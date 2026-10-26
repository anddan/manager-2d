// The crowd: the ticket price, how big the match is, and how the team is doing.
import {describe, expect, it} from "vitest";
import {autoPrice, crowdFor, fairPrice, matchAppeal, matchPrice} from "./finance";
import {newGame} from "./generate";
import type {CupFixture} from "./types";

describe("crowd and ticket price", () => {
  const game = newGame("Crowd", 3, 21);
  const club = game.clubs[game.userClubId];
  const fixture = game.fixtures.find((f) => f.homeId === club.id)!;

  it("fills fewer seats the dearer the tickets", () => {
    const cheap = crowdFor(game, club, fixture, 8).fans;
    const fair = crowdFor(game, club, fixture, Math.round(fairPrice(club))).fans;
    const dear = crowdFor(game, club, fixture, 120).fans;
    expect(cheap).toBeGreaterThanOrEqual(fair);
    expect(fair).toBeGreaterThan(dear);
    expect(dear).toBeGreaterThan(0);
    expect(cheap).toBeLessThanOrEqual(club.capacity);
  });

  it("pays best around a full ground, not at the cheapest or dearest price", () => {
    const income = (price: number) => crowdFor(game, club, fixture, price).fans * price;
    const prices = Array.from({length: 120}, (_, i) => i + 5);
    const best = prices.reduce((a, b) => (income(b) > income(a) ? b : a));
    expect(best).toBeGreaterThan(5);
    expect(best).toBeLessThan(124);
    expect(crowdFor(game, club, fixture, best).rate).toBeGreaterThan(0.9);
  });

  it("draws more and takes a higher price for a cup night, the final most", () => {
    const cup = (stage: number): CupFixture => ({...fixture, id: "c" + stage, stage});
    expect(matchAppeal(game, cup(0))).toBeGreaterThan(matchAppeal(game, fixture));
    expect(matchAppeal(game, cup(3))).toBeGreaterThan(matchAppeal(game, cup(0)));
    const price = Math.round(fairPrice(club) * 1.6);
    expect(crowdFor(game, club, cup(3), price).fans).toBeGreaterThan(crowdFor(game, club, fixture, price).fans);
  });

  it("brings more fans when the team is winning and scoring", () => {
    const price = Math.round(fairPrice(club) * 1.5);
    const before = crowdFor(game, club, fixture, price).fans;
    const hot = structuredClone(game);
    hot.fixtures
      .filter((f) => f.homeId === club.id || f.awayId === club.id)
      .slice(0, 5)
      .forEach((f) => {
        f.played = true;
        f.homeGoals = f.homeId === club.id ? 4 : 0;
        f.awayGoals = f.awayId === club.id ? 4 : 0;
      });
    const after = crowdFor(hot, hot.clubs[club.id], hot.fixtures.find((f) => f.id === fixture.id), price).fans;
    expect(after).toBeGreaterThan(before);
  });

  it("on auto, charges the best price for each match and lets the manager move it in percent", () => {
    const auto = structuredClone(club);
    auto.ticketAuto = true;
    const best = autoPrice(game, auto, fixture);
    const income = (price: number) => crowdFor(game, auto, fixture, price).fans * price;
    for (let price = 5; price <= 150; price++) expect(income(best)).toBeGreaterThanOrEqual(income(price) * 0.99);
    expect(matchPrice(game, auto, fixture)).toBe(best);
    auto.ticketAdjust = 20;
    expect(matchPrice(game, auto, fixture)).toBe(Math.round(best * 1.2));
    expect(crowdFor(game, auto, fixture).price).toBe(Math.round(best * 1.2));
    // A cup final costs more than a league game.
    expect(autoPrice(game, auto, {...fixture, id: "final", stage: 3} as never)).toBeGreaterThan(best);
    // Manual: the club's own price, whatever the match.
    const manual = {...club, ticketAuto: false};
    expect(matchPrice(game, manual, fixture)).toBe(manual.ticketPrice);
  });
});
