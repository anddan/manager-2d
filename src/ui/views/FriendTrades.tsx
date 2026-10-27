// Buying and swapping players with friends in the friends' cup. An offer is made from a friend's
// team (tap a player); the friend says yes or no in the cup room. The buyer pays (or lets their
// swap player go) when making it, and gets the player, or their own back, once it's answered.
import {useEffect, useState} from "react";
import {cannotLeave, roomForOne, sendAway, settleOnce, takeIn, tradeMoney} from "../../game/friendTrade";
import {listName, shortName} from "../../game/helpers";
import {marketValue, overall} from "../../game/ratings";
import type {Player} from "../../game/types";
import {useT, type TKey} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Card, Hint, Modal} from "../common";
import {Icon, iconize} from "../Icon";
import {closeOffer, deviceId, makeOffer, watchOffers, type FriendCupDoc, type TradeOfferDoc} from "../friendCupApi";

/** The offers to and from this device in a cup, as they come in. */
export function useOffers(code: string): TradeOfferDoc[] {
  const [offers, setOffers] = useState<TradeOfferDoc[]>([]);
  useEffect(() => watchOffers(code, setOffers), [code]);
  return offers;
}

/**
 * Settles the offers this device made once they're answered: the player comes in, or (a no)
 * the money and the swap player come back. Each only once.
 */
export function useSettleTrades(offers: TradeOfferDoc[], clubName: (id: string) => string): void {
  const game = useGameState();
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  useEffect(() => {
    const me = deviceId();
    for (const o of offers) {
      if (o.from !== me || (o.status !== "accepted" && o.status !== "declined") || game.friendTrades?.[o.id]) continue;
      const done = act((g) => {
        if (!settleOnce(g, o.id)) return false;
        if (o.status === "accepted" && o.player) {
          takeIn(g, JSON.parse(o.player) as Player);
        } else {
          tradeMoney(g, o.price);
          if (o.swap) takeIn(g, JSON.parse(o.swap) as Player);
        }
        return true;
      });
      if (done) {
        if (o.status === "accepted") notify("friends.tradeGot", {player: o.playerName}, "good");
        else notify("friends.tradeDeclined", {club: clubName(o.to)}, "error");
      }
    }
  }, [offers, game.friendTrades, act, notify, clubName]);
}

/** The cup room's trades: offers to answer, offers waiting, and the last ones done. */
export function TradeOffers({code, cup, offers}: {code: string; cup: FriendCupDoc; offers: TradeOfferDoc[]}) {
  const {t, money} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  const [busy, setBusy] = useState(false);
  const me = deviceId();
  const club = (id: string) => cup.members[id]?.club.name ?? "?";
  const fail = (e: unknown) =>
    notify(e instanceof Error && /^(friends|trade)\./.test(e.message) ? (e.message as TKey) : "friends.err.offline", undefined, "error");

  const accept = async (o: TradeOfferDoc) => {
    const err = cannotLeave(game, o.playerId);
    if (err) return notify(err as TKey, undefined, "error");
    // As they leave: without their boots (those stay here).
    const player: Player = {...structuredClone(game.players[o.playerId]), gear: undefined, shin: undefined};
    setBusy(true);
    try {
      if (!(await closeOffer(code, o.id, "accepted", JSON.stringify(player)))) throw new Error("trade.notOpen");
      act((g) => {
        if (!settleOnce(g, o.id)) return;
        sendAway(g, o.playerId);
        tradeMoney(g, o.price);
        if (o.swap) takeIn(g, JSON.parse(o.swap) as Player);
      });
      notify("friends.tradeDone", undefined, "good");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const close = async (o: TradeOfferDoc, status: "declined" | "cancelled") => {
    setBusy(true);
    try {
      if (!(await closeOffer(code, o.id, status))) throw new Error("trade.notOpen");
      // Withdrawn: the buyer's own side comes straight back.
      if (status === "cancelled") {
        act((g) => {
          if (!settleOnce(g, o.id)) return;
          tradeMoney(g, o.price);
          if (o.swap) takeIn(g, JSON.parse(o.swap) as Player);
        });
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const what = (o: TradeOfferDoc) =>
    o.swap
      ? t(o.price ? "friends.wantsSwapPlus" : "friends.wantsSwap", {club: club(o.from), swap: o.swapName ?? "?", player: o.playerName, price: o.price})
      : t("friends.wantsBuy", {club: club(o.from), player: o.playerName, price: o.price});
  const toMe = offers.filter((o) => o.to === me && o.status === "open");
  const mine = offers.filter((o) => o.from === me && o.status === "open");
  const done = offers.filter((o) => o.status === "accepted" || o.status === "declined").slice(0, 5);

  return (
    <Card title={<><Icon name="handshake" size={20} /> {iconize(t("friends.trades"))}</>} className="span-2">
      <Hint>{iconize(t("friends.tradeHint"))}</Hint>
      {toMe.length + mine.length + done.length === 0 && <p className="muted small">{iconize(t("friends.noOffers"))}</p>}
      <ul className="plain-list friends-offers">
        {toMe.map((o) => (
          <li key={o.id} className="friends-offer incoming">
            <span>{what(o)}</span>
            <div className="btn-row">
              <button className="btn small" disabled={busy} onClick={() => close(o, "declined")}><Icon name="close" size={14} /> {iconize(t("friends.decline"))}</button>
              <button className="btn primary small" disabled={busy} onClick={() => accept(o)}><Icon name="check" size={14} /> {iconize(t("friends.accept"))}</button>
            </div>
          </li>
        ))}
        {mine.map((o) => (
          <li key={o.id} className="friends-offer">
            <span>{t("friends.yourOffer", {player: o.playerName, club: club(o.to)})}{o.price ? ` · ${money(o.price)}` : ""}{o.swapName ? ` · ⇄ ${o.swapName}` : ""}</span>
            <span className="muted small">{iconize(t("friends.awaiting"))}</span>
            <button className="btn small" disabled={busy} onClick={() => close(o, "cancelled")}><Icon name="undo" size={14} /> {iconize(t("friends.withdraw"))}</button>
          </li>
        ))}
        {done.map((o) => (
          <li key={o.id} className="friends-offer done muted small">
            <Icon name={o.status === "accepted" ? "check" : "close"} size={14} /> {what(o)} – {iconize(t(o.status === "accepted" ? "friends.acceptedShort" : "friends.declinedShort"))}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Making an offer for a friend's player: a price, and if you like one of yours in swap. */
export function OfferDialog({code, seller, player, onClose}: {code: string; seller: string; player: Player; onClose: () => void}) {
  const {t, money} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  const [price, setPrice] = useState(() => marketValue(player, game.season));
  const [swap, setSwap] = useState("");
  const [busy, setBusy] = useState(false);
  const cash = game.clubs[game.userClubId].cash;
  const mine = Object.values(game.players)
    .filter((p) => p.clubId === game.userClubId && !p.loan)
    .sort((a, b) => overall(b) - overall(a));

  const send = async () => {
    const amount = Math.max(0, Math.round(price || 0));
    if (!amount && !swap) return notify("friends.offerBad", undefined, "error");
    if (amount > cash) return notify("trade.noMoney", undefined, "error");
    if (swap) {
      const err = cannotLeave(game, swap);
      if (err) return notify(err as TKey, undefined, "error");
    } else if (!roomForOne(game)) return notify("shop.squadFull", undefined, "error");
    setBusy(true);
    // Your side is put up now: paid, and the swap player gone (they come back if the answer is no).
    const swapName = swap ? shortName(game.players[swap]) : undefined;
    const given = act((g) => {
      tradeMoney(g, -amount);
      return swap ? sendAway(g, swap) : null;
    });
    try {
      await makeOffer(code, {
        to: seller,
        playerId: player.id,
        playerName: shortName(player),
        price: amount,
        ...(given ? {swap: JSON.stringify(given), swapName} : {}),
      });
      notify("friends.offerSent", undefined, "good");
      onClose();
    } catch {
      act((g) => {
        tradeMoney(g, amount);
        if (given) takeIn(g, given);
      });
      notify("friends.err.offline", undefined, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={iconize(t("friends.offerTitle", {name: listName(player)}))} compact onClose={onClose}>
      <label className="field">
        <span>{iconize(t("friends.price"))}</span>
        <input className="input" type="number" min={0} step={50_000} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        <small className="muted">{money(Math.max(0, price || 0))} · {iconize(t("friends.yourCash", {cash}))}</small>
      </label>
      <label className="field">
        <span>{iconize(t("friends.swapFor"))}</span>
        <select value={swap} onChange={(e) => setSwap(e.target.value)}>
          <option value="">{t("friends.noSwap")}</option>
          {mine.map((p) => (
            <option key={p.id} value={p.id}>{`${shortName(p)} · ${t(`pos.${p.position}`)} · ${overall(p)}`}</option>
          ))}
        </select>
      </label>
      <p className="muted small">{iconize(t("friends.offerNote"))}</p>
      <div className="btn-row dialog-actions">
        <button className="btn" onClick={onClose}>{iconize(t("common.cancel"))}</button>
        <button className="btn primary" disabled={busy} onClick={send}><Icon name="handshake" size={16} /> {iconize(t("friends.sendOffer"))}</button>
      </div>
    </Modal>
  );
}
