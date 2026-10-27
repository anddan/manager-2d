// The friends' cup number in the menu: what there is to do.
import {describe, expect, it} from "vitest";
import {friendCupTodo} from "./friendCupBadge";
import {deviceId, matchKey, type FriendCupDoc, type FriendRoundDoc, type TradeOfferDoc} from "./friendCupApi";

const member = {manager: "M", club: {name: "C", short: "C", color: "#000", color2: "#fff"}, joinedAt: 1};

describe("the friends' cup number", () => {
  it("counts offers, unseen matches, a round to play, the pack and the prize", () => {
    const me = deviceId();
    const cup: FriendCupDoc = {code: "ABCDEF", name: "T", creator: me, createdAt: 0, members: {[me]: member, x: member}, round: 0, seed: 1};
    expect(friendCupTodo("ABCDEF", cup, [], [], new Set())).toBe(1); // can start it
    const started = {...cup, order: [me, "x"]};
    expect(friendCupTodo("ABCDEF", started, [], [], new Set())).toBe(1); // a round to play
    const rounds: FriendRoundDoc[] = [{round: 1, playedAt: 0, results: [{home: me, away: "x", homeGoals: 2, awayGoals: 0, goals: []}]}];
    const done = {...started, round: 1};
    const offer = {id: "o", from: "x", to: me, playerId: "p", playerName: "P", price: 1, status: "open", createdAt: 0} as TradeOfferDoc;
    // Unseen match + pack + an offer (the prize waits until the match is seen).
    expect(friendCupTodo("ABCDEF", done, rounds, [offer], new Set())).toBe(3);
    // Seen: pack + prize + offer.
    expect(friendCupTodo("ABCDEF", done, rounds, [offer], new Set([matchKey("ABCDEF", 1, 0)]))).toBe(3);
    expect(friendCupTodo("ABCDEF", {...done, packsTaken: {[me]: true}, prizeClaimed: "money"}, rounds, [], new Set([matchKey("ABCDEF", 1, 0)]))).toBe(0);
  });
});
