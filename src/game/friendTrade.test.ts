// Trading with friends: a player leaves one game and joins another; the money moves; nothing twice.
import {describe, expect, it} from "vitest";
import {canPay, cannotLeave, diamondPrice, sendAway, settleOnce, takeIn, tradeMoney, tradePay, TRADE_MIN_SQUAD} from "./friendTrade";
import {newGame} from "./generate";

const squad = (g: ReturnType<typeof newGame>) => Object.values(g.players).filter((p) => p.clubId === g.userClubId);

describe("trading with friends", () => {
  it("moves a player from one game to another, out of the line-up and with a new id", () => {
    const seller = newGame("Anna", 2, 51);
    const buyer = newGame("Bo", 3, 52);
    const id = seller.clubs[seller.userClubId].lineup[3];
    expect(cannotLeave(seller, id)).toBeNull();
    const before = squad(seller).length;
    const p = sendAway(seller, id);
    expect(seller.players[id]).toBeUndefined();
    expect(squad(seller).length).toBe(before - 1);
    expect(seller.clubs[seller.userClubId].lineup).not.toContain(id);
    const n = squad(buyer).length;
    const newId = takeIn(buyer, p);
    expect(squad(buyer).length).toBe(n + 1);
    expect(buyer.players[newId]).toMatchObject({firstName: p.firstName, lastName: p.lastName, clubId: buyer.userClubId, loan: null});
    expect(buyer.players[newId].contract.expiresSeason).toBe(buyer.season + 2);
  }, 30_000);

  it("pays and is paid, settles each trade once, and keeps enough players", () => {
    const g = newGame("Cia", 1, 53);
    const cash = g.clubs[g.userClubId].cash;
    tradeMoney(g, -1_000_000);
    tradeMoney(g, 400_000);
    expect(g.clubs[g.userClubId].cash).toBe(cash - 600_000);
    expect(settleOnce(g, "o1")).toBe(true);
    expect(settleOnce(g, "o1")).toBe(false);
    for (const p of squad(g).slice(TRADE_MIN_SQUAD)) sendAway(g, p.id);
    expect(cannotLeave(g, squad(g)[0].id)).toBe("trade.squadSmall");
    expect(cannotLeave(g, "nobody")).toBe("trade.gone");
  }, 30_000);
  it("sells for money or diamonds", () => {
    const g = newGame("Dan", 1, 54);
    const d = g.monetization.diamonds;
    const cash = g.clubs[g.userClubId].cash;
    expect(canPay(g, "diamonds", d)).toBe(true);
    expect(canPay(g, "diamonds", d + 1)).toBe(false);
    tradePay(g, "diamonds", -d);
    tradePay(g, "diamonds", 50);
    expect(g.monetization.diamonds).toBe(50);
    tradePay(g, "money", 200_000);
    expect(g.clubs[g.userClubId].cash).toBe(cash + 200_000);
    const p = squad(g)[0];
    expect([20, 50, 100, 175]).toContain(diamondPrice(p));
  }, 30_000);
});
