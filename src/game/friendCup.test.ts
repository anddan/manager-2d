// The friends' cup: everyone meets once, a match is the same wherever it's played, the table adds up.
import {describe, expect, it} from "vitest";
import {friendFixtures, friendTable, playFriendMatch, playFriendRound, snapshotTeam} from "./friendCup";
import {newGame} from "./generate";

describe("the friends' cup", () => {
  it("has everyone meet everyone once, an odd one out sitting out", () => {
    for (const n of [2, 3, 4, 5, 8]) {
      const ids = Array.from({length: n}, (_, i) => `m${i}`);
      const rounds = friendFixtures(ids);
      const met = new Set(rounds.flat().map(([a, b]) => [a, b].sort().join("-")));
      expect(met.size).toBe((n * (n - 1)) / 2);
      for (const round of rounds) {
        const seen = round.flat();
        expect(new Set(seen).size).toBe(seen.length);
      }
    }
  });

  it("plays the same match from the same two teams and seed", () => {
    const a = snapshotTeam(newGame("Anna", 2, 11));
    const b = snapshotTeam(newGame("Bo", 5, 12));
    const one = playFriendMatch(a, b, 777);
    const two = playFriendMatch(structuredClone(a), structuredClone(b), 777);
    expect([one.homeGoals, one.awayGoals, one.goals]).toEqual([two.homeGoals, two.awayGoals, two.goals]);
    expect(one.goals.length).toBe(one.homeGoals + one.awayGoals);
  }, 30_000);

  it("counts the table, and a team never sent loses 0–3", () => {
    const a = snapshotTeam(newGame("Anna", 2, 13));
    const results = playFriendRound([["A", "B"]], {A: a}, 5);
    expect(results[0]).toMatchObject({homeGoals: 3, awayGoals: 0});
    const table = friendTable(["A", "B"], results);
    expect(table[0]).toMatchObject({id: "A", points: 3, won: 1});
    expect(table[1]).toMatchObject({id: "B", points: 0, lost: 1});
  }, 30_000);
});
