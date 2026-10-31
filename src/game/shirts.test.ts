import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {fixShirts, setShirt, shirtHolder} from "./shirts";
import {happinessFactors} from "./morale";

describe("shirt numbers", () => {
  it("gives everyone a number of their own in their club", () => {
    const g = newGame("Shirts", 3, 21);
    fixShirts(g);
    const seen = new Set<string>();
    for (const p of Object.values(g.players)) {
      if (!p.clubId) continue;
      expect(p.shirt).toBeGreaterThanOrEqual(1);
      expect(p.shirt).toBeLessThanOrEqual(99);
      const key = `${p.clubId}:${p.shirt}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("repairs a number two players share, and swaps when one is taken", () => {
    const g = newGame("Shirts", 3, 22);
    fixShirts(g);
    const [a, b] = Object.values(g.players).filter((p) => p.clubId === g.userClubId);
    b.shirt = a.shirt;
    fixShirts(g);
    expect(a.shirt).not.toBe(b.shirt);
    const before = a.shirt!;
    const mine = b.shirt!;
    expect(setShirt(g, b.id, before)).toBeNull();
    expect(b.shirt).toBe(before);
    expect(a.shirt).toBe(mine);
    expect(shirtHolder(g, a.clubId!, before)?.id).toBe(b.id);
  });

  it("a player who wants a number and doesn't have it is a little unhappy", () => {
    const g = newGame("Shirts", 3, 23);
    fixShirts(g);
    const p = Object.values(g.players).find((x) => x.clubId === g.userClubId && x.wantShirt !== undefined)!;
    setShirt(g, p.id, p.wantShirt!);
    expect(happinessFactors(g, p).find((f) => f.key === "shirt")!.value).toBeGreaterThan(0);
    setShirt(g, p.id, p.wantShirt === 99 ? 98 : 99);
    expect(happinessFactors(g, p).find((f) => f.key === "shirt")!.value).toBeLessThan(0);
  });
});
