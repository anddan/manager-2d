// Energy, diamonds and the (mock) shop.
import {useState} from "react";
import {
  DIAMOND_PACKS,
  DIAMONDS_DAILY_BONUS,
  DIAMONDS_PER_WIN,
  DIAMONDS_REFILL_COST,
  DIAMONDS_SEASON,
  ENERGY_COST_EXTRA_TRAINING,
  ENERGY_COST_MATCH,
  ENERGY_MAX,
  ENERGY_REGEN_MS,
  EXCHANGE,
  MONEY_PACKS,
} from "../../game/constants";
import {fullName} from "../../game/helpers";
import {LEGEND_ID, LEGEND_PRICE_DIAMONDS, buyLegend, legendOwned, legendPlayer} from "../../game/legend";
import {exchangeDiamonds, grantMoneyPack, grantPack, mockPaymentProvider, refillEnergy, regenerateEnergy, type MoneyPackId, type PackId} from "../../game/monetization";
import {useT} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Card} from "../common";
import {PlayerCard} from "../PlayerCard";

export function Shop() {
  const {t, lang, money} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  const [buying, setBuying] = useState<PackId | MoneyPackId | null>(null);
  const m = {...game.monetization};
  regenerateEnergy(m, Date.now());

  const refill = () => {
    const err = act((g) => refillEnergy(g.monetization, Date.now()));
    notify(err ?? "toast.refilled", undefined, err ? "error" : "good");
  };

  const exchange = () => {
    const err = act((g) => exchangeDiamonds(g));
    notify(err ?? "toast.exchanged", {money: EXCHANGE.money}, err ? "error" : "good");
  };

  const buy = async (packId: PackId, priceEur: number) => {
    setBuying(packId);
    // Mock checkout: approves instantly. Swap for Stripe / in-app purchases before release.
    const result = await mockPaymentProvider.purchase(packId, priceEur);
    setBuying(null);
    if (!result.ok) return notify("shop.purchaseFailed", undefined, "error");
    const n = act((g) => grantPack(g.monetization, packId));
    notify("toast.purchased", {n}, "good");
  };

  const owned = legendOwned(game);
  const legend = owned ? game.players[LEGEND_ID] : legendPlayer(game, null);
  const buyLeon = () => {
    const err = act((g) => buyLegend(g));
    notify(err ?? "toast.legendJoined", {name: fullName(legend)}, err ? "error" : "good");
  };

  const buyMoney = async (packId: MoneyPackId, priceEur: number) => {
    setBuying(packId);
    // Same mock checkout as the diamonds.
    const result = await mockPaymentProvider.purchase(packId, priceEur);
    setBuying(null);
    if (!result.ok) return notify("shop.purchaseFailed", undefined, "error");
    const amount = act((g) => grantMoneyPack(g, packId));
    notify("toast.moneyPurchased", {money: amount}, "good");
  };

  const price = (eur: number) => new Intl.NumberFormat(lang === "sv" ? "sv-SE" : lang === "es" ? "es-ES" : "en-GB", {style: "currency", currency: "EUR"}).format(eur);

  return (
    <div className="grid">
      <Card title={`⚡ ${t("shop.energy")}`}>
        <div className="energy-meter" aria-label={`${m.energy}/${ENERGY_MAX}`}>
          {Array.from({length: ENERGY_MAX}, (_, i) => <span key={i} className={i < m.energy ? "pip on" : "pip"}>⚡</span>)}
        </div>
        <p className="muted">{t("shop.energyHint", {minutes: ENERGY_REGEN_MS / 60_000, match: ENERGY_COST_MATCH, training: ENERGY_COST_EXTRA_TRAINING})}</p>
        <button className="btn primary" disabled={m.energy >= ENERGY_MAX} onClick={refill}>💎 {t("shop.refill", {cost: DIAMONDS_REFILL_COST})}</button>
      </Card>

      <Card title={`💎 ${t("shop.diamonds")}: ${m.diamonds}`}>
        <p className="muted">{t("shop.earnHint", {win: DIAMONDS_PER_WIN, daily: DIAMONDS_DAILY_BONUS, champion: DIAMONDS_SEASON.champion})}</p>
        <h3>{t("shop.exchange")}</h3>
        <p className="muted small">{t("shop.exchangeHint", {diamonds: EXCHANGE.diamonds, money: EXCHANGE.money, left: EXCHANGE.maxPerSeason - m.exchangesThisSeason})}</p>
        <button className="btn" disabled={m.exchangesThisSeason >= EXCHANGE.maxPerSeason} onClick={exchange}>
          💎 {EXCHANGE.diamonds} → 💰
        </button>
      </Card>

      <Card title={`⭐ ${t("shop.legend")}`} className="span-2">
        <div className="legend">
          <PlayerCard game={game} player={legend} reveal />
          <div className="legend-info">
            <h3>{fullName(legend)}</h3>
            <p className="muted">{t("shop.legendHint", {price: LEGEND_PRICE_DIAMONDS})}</p>
            {owned ? (
              <p className="callout good">✅ {t("shop.legendOwned")}</p>
            ) : (
              <button className="btn primary big" disabled={m.diamonds < LEGEND_PRICE_DIAMONDS} onClick={buyLeon}>
                💎 {LEGEND_PRICE_DIAMONDS} · {t("shop.legendBuy")}
              </button>
            )}
            {!owned && m.diamonds < LEGEND_PRICE_DIAMONDS && <p className="muted small">{t("shop.legendNeed", {n: LEGEND_PRICE_DIAMONDS - m.diamonds})}</p>}
          </div>
        </div>
      </Card>

      <Card title={`💰 ${t("shop.buyMoney")}`} className="span-2">
        <p className="muted small">{t("shop.buyMoneyHint")}</p>
        <div className="packs">
          {MONEY_PACKS.map((pack) => (
            <div key={pack.id} className="pack">
              <div className="pack-amount">💰 {money(pack.money)}</div>
              {pack.bonus > 0 && <div className="pack-bonus">+{money(pack.bonus)} {t("shop.bonus")}</div>}
              <button className="btn primary" disabled={buying !== null} onClick={() => buyMoney(pack.id, pack.priceEur)}>
                {buying === pack.id ? "…" : price(pack.priceEur)}
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card title={`🛒 ${t("shop.buy")}`} className="span-2">
        <p className="callout">{t("shop.mockNotice")}</p>
        <div className="packs">
          {DIAMOND_PACKS.map((pack) => (
            <div key={pack.id} className="pack">
              <div className="pack-amount">💎 {pack.diamonds}</div>
              {pack.bonus > 0 && <div className="pack-bonus">+{pack.bonus} {t("shop.bonus")}</div>}
              <button className="btn primary" disabled={buying !== null} onClick={() => buy(pack.id, pack.priceEur)}>
                {buying === pack.id ? "…" : price(pack.priceEur)}
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
