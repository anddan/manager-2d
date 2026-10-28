// Selling a player to a friend with a code: put up from the player's profile (they leave the
// club then), bought by whoever types the code in under Transfers → Friend trades. The seller's money
// comes in by itself once they're bought; until then they can be taken back.
import {useEffect, useState, type ReactNode} from "react";
import {canPay, cannotLeave, diamondPrice, roomForOne, sendAway, settleOnce, takeIn, tradePay, type TradeCurrency} from "../game/friendTrade";
import {shortName} from "../game/helpers";
import {marketValue, overall} from "../game/ratings";
import type {FriendSaleEntry, GameState, Player} from "../game/types";
import {useT, type TKey} from "../i18n";
import {GameOverride, useGame, useGameState} from "../store";
import {Card, Flag, Hint, Modal, PosBadge} from "./common";
import {diamondBurst, moneyBurst} from "./effects";
import {Icon, iconize} from "./Icon";
import {PackReveal} from "./PackReveal";
import {PlayerModal} from "./PlayerModal";
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
    // The player leaves now, kit and all; they come back if the sale can't be put up.
    const gone = act((g) => sendAway(g, player.id));
    try {
      const code = await createSale(gone, name, amount, currency, game.clubs[game.userClubId].name);
      act((g) => {
        g.friendSales = {...g.friendSales, [code]: {...glance(player), name, price: amount, currency}};
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

  const mineLooks = Object.entries(game.friendLooks ?? {});
  // Off the saved list (declined, bought or gone).
  const forget = (c: string) =>
    act((g) => {
      if (g.friendLooks) delete g.friendLooks[c];
    });
  const look = async (c = code.trim().toUpperCase()) => {
    setBusy(true);
    try {
      const s = await fetchSale(c);
      if (!s) {
        forget(c);
        throw new Error("sale.noSale");
      }
      if (s.status !== "open") {
        forget(c);
        throw new Error("sale.gone");
      }
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
      forget(s.code);
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
  // Closed without deciding: kept on the list to come back to.
  const keep = (x: SaleDoc) => {
    act((g) => {
      g.friendLooks = {...g.friendLooks, [x.code]: {...glance(JSON.parse(x.player) as Player), name: x.playerName, price: x.price, currency: x.currency}};
    });
    setSale(null);
  };
  // One of your own up for sale: their profile, from the sale (they're not in the club now).
  const [ownSale, setOwnSale] = useState<SaleDoc | null>(null);
  const viewOwn = async (c: string) => {
    setBusy(true);
    try {
      const s = await fetchSale(c);
      if (!s) throw new Error("sale.noSale");
      setOwnSale(s);
    } catch (e) {
      notify(fail(e), undefined, "error");
    } finally {
      setBusy(false);
    }
  };
  const decline = (c: string) => {
    forget(c);
    setSale(null);
  };
  const price = (n: number, c?: TradeCurrency) => (c === "diamonds" ? iconize(`${n} 💎`) : money(n));
  const copy = (c: string) => navigator.clipboard?.writeText(c).then(() => notify("friends.copied", undefined, "good"), () => undefined);
  const shown = sale ? (JSON.parse(sale.player) as Player) : null;

  return (
    <div className="code-sales">
      <section>
        <h3><Icon name="tag" size={20} /> {iconize(t("sale.buyTitle"))}</h3>
        <Hint>{iconize(t("sale.buyHint"))}</Hint>
        <div className="btn-row">
          <input className="input friends-code-input" value={code} maxLength={6} placeholder="ABC123" onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button className="btn primary" disabled={busy || code.trim().length < 6} onClick={() => look()}><Icon name="search" size={16} /> {iconize(t("sale.show"))}</button>
        </div>
      </section>
      {mineLooks.length > 0 && (
        <section>
          <h3><Icon name="eye" size={20} /> {iconize(t("sale.looked"))}</h3>
          <ul className="plain-list friends-offers">
            {mineLooks.map(([c, l]) => (
              <li key={c} className="friends-offer">
                <SaleRow entry={l} price={price(l.price, l.currency)} onOpen={() => look(c)} />
                <button className="btn small" disabled={busy} onClick={() => forget(c)}><Icon name="close" size={14} /> {iconize(t("sale.decline"))}</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {mine.length > 0 && (
        <section>
          <h3><Icon name="handshake" size={20} /> {iconize(t("sale.mine"))}</h3>
          <p className="muted small">{iconize(t("sale.mineHint"))}</p>
          <ul className="plain-list friends-offers">
            {mine.map(([c, s]) => (
              <li key={c} className="friends-offer">
                <SaleRow entry={s} price={price(s.price, s.currency)} onOpen={() => viewOwn(c)} />
                <button className="btn small" onClick={() => copy(c)}><Icon name="clip" size={14} /> {c}</button>
                <button className="btn small" disabled={busy} onClick={() => takeBack(c)}><Icon name="undo" size={14} /> {iconize(t("friends.withdraw"))}</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {arrived && <PackReveal playerId={arrived} title={<><Icon name="handshake" size={20} /> {iconize(t("sale.boughtTitle"))}</>} onClose={() => setArrived(null)} />}
      {/* The whole profile of the friend's player, lent into the game to be looked at. */}
      {sale && shown && (
        <GameOverride.Provider value={lent(game, shown, sale.clubName ?? t("sale.friendClub"))}>
          <PlayerModal
            playerId={LENT_ID}
            preview={{
              onClose: () => keep(sale),
              footer: (
                <>
                  <button className="btn" onClick={() => decline(sale.code)}><Icon name="close" size={16} /> {iconize(t("sale.decline"))}</button>
                  <button className="btn primary" disabled={busy} onClick={() => buy(sale)}><Icon name="handshake" size={16} /> {t("sale.buyFor")} {price(sale.price, sale.currency)}</button>
                </>
              ),
            }}
          />
        </GameOverride.Provider>
      )}
      {ownSale && (
        <GameOverride.Provider value={lent(game, JSON.parse(ownSale.player) as Player, game.clubs[game.userClubId].name)}>
          <PlayerModal
            playerId={LENT_ID}
            preview={{
              onClose: () => setOwnSale(null),
              footer: (
                <>
                  <button className="btn" disabled={busy} onClick={() => { takeBack(ownSale.code); setOwnSale(null); }}><Icon name="undo" size={16} /> {iconize(t("friends.withdraw"))}</button>
                  <button className="btn primary" onClick={() => copy(ownSale.code)}><Icon name="clip" size={16} /> {ownSale.code}</button>
                </>
              ),
            }}
          />
        </GameOverride.Provider>
      )}
    </div>
  );
}

/** Who a listed player is at a glance: position, country and total. */
function glance(p: Player): Pick<FriendSaleEntry, "ovr" | "pos" | "nat"> {
  return {ovr: overall(p), pos: p.position, nat: p.nationality};
}

/** A listed player: position, flag, name and total (tap for the profile), and the price. */
function SaleRow({entry, price, onOpen}: {entry: FriendSaleEntry; price: ReactNode; onOpen: () => void}) {
  return (
    <button className="sale-row" onClick={onOpen}>
      {entry.pos && <PosBadge pos={entry.pos} />}
      {entry.nat && <Flag code={entry.nat} size={15} />}
      <strong className="sale-row-name">{entry.name}</strong>
      {entry.ovr !== undefined && <span className="sale-row-ovr">{entry.ovr}</span>}
      <span className="muted">{price}</span>
    </button>
  );
}

const LENT_ID = "friend-sale";
const LENT_CLUB = "friend-club";

/** The game with a friend's player (and their club, by name) lent into it, to show their profile. */
function lent(game: GameState, player: Player, clubName: string): GameState {
  const own = game.clubs[game.userClubId];
  return {
    ...game,
    players: {...game.players, [LENT_ID]: {...player, id: LENT_ID, lookId: player.lookId ?? player.id, clubId: LENT_CLUB}},
    clubs: {...game.clubs, [LENT_CLUB]: {...own, id: LENT_CLUB, name: clubName, short: clubName.slice(0, 3).toUpperCase(), color: "#64748b", color2: "#e2e8f0"}},
    scouted: {...game.scouted, [LENT_ID]: game.absWeek},
  };
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
