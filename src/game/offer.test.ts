// The parts of a contract offer the agent won't accept are named, so the form can mark them.
import {describe, expect, it} from "vitest";
import {offerShortfalls, type ContractOffer} from "./contracts";

const demand: ContractOffer = {wage: 10_000, years: 3, signingBonus: 50_000, goalBonus: 500, appearanceBonus: 300, releaseClause: null, role: "key"};

describe("offerShortfalls", () => {
  it("names nothing when the offer meets the demand", () => {
    expect(offerShortfalls(demand, {...demand})).toEqual([]);
    expect(offerShortfalls(demand, {...demand, wage: 12_000, role: "key"})).toEqual([]);
  });

  it("names the parts that fall short", () => {
    const bad = offerShortfalls(demand, {...demand, wage: 9_000, years: 2, signingBonus: 10_000, role: "rotation"});
    expect(bad).toEqual(expect.arrayContaining(["wage", "years", "signingBonus", "role"]));
    expect(bad).not.toContain("goalBonus");
  });
});
