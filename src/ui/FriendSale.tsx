// Selling a player to a friend with a code: put up from the player's profile (they leave the
// club then), bought by whoever types the code in under Transfers → Friend trades. The seller's money
// comes in by itself once they're bought; until then they can be taken back.
import {useEffect, useState} from "react";
import {canPay, cannotLeave, diamondPrice, roomForOne, sendAway, settleOnce, takeIn, tradePay, type TradeCurrency} from "../game/friendTrade";
import {shortName} from "../game/helpers";
import {marketValue} from "../game/ratings";
import type {Player} from "../game/types";
import {useT, type TKey} from "../i18n";
import {useGame, useGameState} from "../store";
import {Card, Hint, Modal} from "./common";
import {diamondBurst, moneyBurst} from "./effects";
import {Icon, iconize} from "./Icon";
import {PackReveal} from "./PackReveal";
import {PlayerCard} from "./PlayerCard";
import {chime} from "./sound";
import {buySale, cancelSale, clearSale, createSale, deviceId, fetchSale, watchSale, type SaleDoc} from "./friendCupApi";

const fail = (e: unknown): TKey => (e instanceof Error && /^(friends|trade|sale)\./.test(e.message) ? (e.message as TKey) : "friends.err.offline");

/** In an own player's profile: set a price and sell; a code comes back for a friend to buy with. */
export function SellToFriend({player}: {player: Player}) {
  const {t} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  const openPlayer = useGame((s) => s.openPlayer);
  const setView = useGame((s) => s.setView);
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState<TradeCurrency>("money");
  const [price, setPrice] = useState(() => marketValue(player, game.season));
  // Switching what it's sold for puts a fair price in that.
  const pick = (c: TradeCurrency) => {
    setCurrency(c);
    setPrice(c === "diamonds" ? diamondPrice(player) : marketValue(player, game.season));
  };
  const [busy, setBusy] = useState(false);
  if (player.clubId !== game.userClubId || player.loan) return null;

  const sell = async () => {
    const err = cannotLeave(game, player.id);
    if (err) return notify(err as TKey, undefined, "error");
    const amount = Math.max(0, Math.round(price || 0));
    const name = shortName(player);
    setBusy(true);
    // The player leaves now (their boots stay); they come back if the sale can't be put up.
    const gone = act((g) => sendAway(g, player.id));
    try {
      const code = await createSale({...gone, gear: undefined, shin: undefined}, name, amount, currency);
      act((g) => {
        g.friendSales = {...g.friendSales, [code]: {name, price: amount, currency}};
      });
      notify("sale.listed", {name, code}, "good");
      openPlayer(null);
      setView("codes");
    } catch (e) {
      act((g) => {
        takeIn(g, gone);
      });
      notify(fail(e), undefined, "error");
      setBusy(false);
    }
  };

  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}><Icon name="handshake" size={16} /> {iconize(t("sale.sellFriend"))}</button>
      {open && (
        <Modal title={iconize(t("sale.sellFriend"))} compact onClose={() => setOpen(false)}>
          <p className="muted small">{iconize(t("sale.sellHint"))}</p>
          {/* Sold for club money or diamonds. */}
          <div className="sale-currency" role="radiogroup">
            <button className={currency === "money" ? "btn small primary" : "btn small"} role="radio" aria-checked={currency === "money"} onClick={() => pick("money")}><Icon name="coins" size={16} /> {iconize(t("sale.money"))}</button>
            <button className={currency === "diamonds" ? "btn small primary" : "btn small"} role="radio" aria-checked={currency === "diamonds"} onClick={() => pick("diamonds")}><Icon name="diamond" size={16} /> {iconize(t("sale.diamonds"))}</button>
          </div>
          <label className="field">
            <span>{iconize(t(currency === "diamonds" ? "sale.priceDiamonds" : "friends.price"))}</span>
            <input className="input" type="number" min={0} step={currency === "diamonds" ? 5 : 50_000} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          </label>
          <div className="btn-row dialog-actions">
            <button className="btn" onClick={() => setOpen(false)}>{iconize(t("common.cancel"))}</button>
            <button className="btn primary" disabled={busy} onClick={sell}><Icon name="tag" size={16} /> {iconize(t("sale.sell"))}</button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** The page under Transfers: selling with a code. */
export function CodeSalesPage() {
  const {t} = useT();
  return (
    <Card title={<><Icon name="tag" size={20} /> {iconize(t("nav.codes"))}</>}>
      <CodeSales />
    </Card>
  );
}

/** Under Transfers: buy with a code from a friend, and your own players up for sale with their codes. */
export function CodeSales() {
  const {t, money} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  const [code, setCode] = useState("");
  const [sale, setSale] = useState<SaleDoc | null>(null);
  const [busy, setBusy] = useState(false);
  // The player just bought, being revealed.
  const [arrived, setArrived] = useState<string | null>(null);
  const mine = Object.entries(game.friendSales ?? {});

  const look = async () => {
    setBusy(true);
    try {
      const s = await fetchSale(code.trim().toUpperCase());
      if (!s) throw new Error("sale.noSale");
      if (s.status !== "open") throw new Error("sale.gone");
      if (s.seller === deviceId()) throw new Error("sale.own");
      setSale(s);
    } catch (e) {
      notify(fail(e), undefined, "error");
    } finally {
      setBusy(false);
    }
  };
  const buy = async (s: SaleDoc) => {
    const cur = s.currency ?? "money";
    if (!canPay(game, cur, s.price)) return notify(cur === "diamonds" ? "shop.notEnoughDiamonds" : "trade.noMoney", undefined, "error");
    if (!roomForOne(game)) return notify("shop.squadFull", undefined, "error");
    setBusy(true);
    try {
      const bought = await buySale(s.code);
      if (!bought) throw new Error("sale.gone");
      const id = act((g) => {
        if (!settleOnce(g, `sale:${s.code}`)) return null;
        tradePay(g, bought.currency ?? "money", -bought.price);
        return takeIn(g, JSON.parse(bought.player) as Player);
      });
      chime();
      // The new player shown as from a pack: the card bit by bit.
      if (id) setArrived(id);
      notify("sale.bought", {name: bought.playerName}, "good");
      setSale(null);
      setCode("");
    } catch (e) {
      notify(fail(e), undefined, "error");
    } finally {
      setBusy(false);
    }
  };
  const takeBack = async (c: string) => {
    setBusy(true);
    try {
      const s = await cancelSale(c);
      if (!s) throw new Error("sale.gone");
      act((g) => {
        if (!g.friendSales?.[c]) return;
        delete g.friendSales[c];
        takeIn(g, JSON.parse(s.player) as Player);
      });
      notify("sale.cancelled", {name: s.playerName}, "good");
    } catch (e) {
      notify(fail(e), undefined, "error");
    } finally {
      setBusy(false);
    }
  };
  const price = (n: number, c?: TradeCurrency) => (c === "diamonds" ? iconize(`${n} 💎`) : money(n));
  const copy = (c: string) => navigator.clipboard?.writeText(c).then(() => notify("friends.copied", undefined, "good"), () => undefined);
  // A friend's player, lent their own club for the card's crest.
  const shown = sale ? (JSON.parse(sale.player) as Player) : null;

  return (
    <div className="code-sales">
      <section>
        <h3><Icon name="tag" size={20} /> {iconize(t("sale.buyTitle"))}</h3>
        <Hint>{iconize(t("sale.buyHint"))}</Hint>
        <div className="btn-row">
          <input className="input friends-code-input" value={code} maxLength={6} placeholder="ABC123" onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button className="btn primary" disabled={busy || code.trim().length < 6} onClick={look}><Icon name="search" size={16} /> {iconize(t("sale.show"))}</button>
        </div>
      </section>
      {mine.length > 0 && (
        <section>
          <h3><Icon name="handshake" size={20} /> {iconize(t("sale.mine"))}</h3>
          <p className="muted small">{iconize(t("sale.mineHint"))}</p>
          <ul className="plain-list friends-offers">
            {mine.map(([c, s]) => (
              <li key={c} className="friends-offer">
                <span><strong>{s.name}</strong> · {price(s.price, s.currency)}</span>
                <button className="btn small" onClick={() => copy(c)}><Icon name="clip" size={14} /> {c}</button>
                <button className="btn small" disabled={busy} onClick={() => takeBack(c)}><Icon name="undo" size={14} /> {iconize(t("friends.withdraw"))}</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {arrived && <PackReveal playerId={arrived} title={<><Icon name="handshake" size={20} /> {iconize(t("sale.boughtTitle"))}</>} onClose={() => setArrived(null)} />}
      {sale && shown && (
        <Modal title={iconize(t("sale.buyTitle"))} compact onClose={() => setSale(null)}>
          <div className="friends-card">
            <PlayerCard game={{...game, clubs: {...game.clubs, [shown.clubId ?? "x"]: {...game.clubs[game.userClubId], id: shown.clubId ?? "x", short: "?", color: "#64748b", color2: "#e2e8f0"}}}} player={shown} reveal />
          </div>
          <div className="btn-row dialog-actions">
            <button className="btn" onClick={() => setSale(null)}>{iconize(t("common.cancel"))}</button>
            <button className="btn primary" disabled={busy} onClick={() => buy(sale)}><Icon name="handshake" size={16} /> {t("sale.buyFor")} {price(sale.price, sale.currency)}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Watches this manager's players up for sale; when one is bought, the money (or diamonds) come in, once. */
export function FriendSalesWatcher() {
  const game = useGameState();
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  const {money} = useT();
  const codes = Object.keys(game.friendSales ?? {}).sort().join(",");
  useEffect(() => {
    if (!codes) return;
    const stops = codes.split(",").map((code) =>
      watchSale(code, (sale) => {
        if (sale?.status !== "sold") return;
        const paid = act((g) => {
          const s = g.friendSales?.[code];
          if (!s) return null;
          delete g.friendSales![code];
          tradePay(g, sale.currency ?? "money", sale.price);
          return s;
        });
        if (paid) {
          if (sale.currency === "diamonds") {
            notify("sale.soldDiamonds", {name: paid.name, n: sale.price}, "good");
            diamondBurst(null, sale.price);
          } else {
            notify("sale.sold", {name: paid.name, price: sale.price}, "good");
            moneyBurst(null, money(sale.price));
          }
          void clearSale(code).catch(() => undefined);
        }
      })
    );
    return () => stops.forEach((stop) => stop());
  }, [codes, act, notify, money]);
  return null;
}
