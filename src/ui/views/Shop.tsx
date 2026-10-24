// Energy, diamonds and the (mock) shop.
import {useEffect, useRef, useState} from "react";
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
import {DIAMOND_PACK, PLAYER_PACKS, PLAYER_PACK_IDS, openDiamondPack, openPack, pickFromPack, type PlayerPackId} from "../../game/packs";
import {useT} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Card, Modal} from "../common";
import {ENERGY_VIDEOS_PER_DAY, videoForEnergy} from "../../game/daily";
import {today} from "../DailyTasks";
import {VideoAd} from "../VideoAd";
import {PlayerCard} from "../PlayerCard";

export function Shop() {
  const {t, lang, money, num} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  const [buying, setBuying] = useState<PackId | MoneyPackId | null>(null);
  const [watching, setWatching] = useState(false);
  const videosLeft = ENERGY_VIDEOS_PER_DAY - (game.daily?.day === today() ? game.daily.energyVideos : 0);
  const energyVideo = () => {
    setWatching(false);
    const err = act((g) => videoForEnergy(g, today(), Date.now()));
    notify(err ?? "toast.videoEnergy", undefined, err ? "error" : "good");
  };
  // The player from the last pack opened, shown until closed.
  const [opened, setOpened] = useState<{playerId: string; pack: PlayerPackId} | null>(null);
  // How much of the new card is showing (see PlayerCard's stage); 6 is all of it.
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!opened || stage >= 6) return;
    // A longer wait before the overall, for the suspense.
    const id = setTimeout(() => setStage((s) => s + 1), stage === 0 ? 900 : stage === 3 ? 1300 : 750);
    return () => clearTimeout(id);
  }, [opened, stage]);
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

  const open = (pack: PlayerPackId) => {
    const res = act((g, rng) => openPack(g, rng, pack));
    if ("error" in res) notify(res.error, undefined, "error");
    else {
      setStage(0);
      setOpened({playerId: res.playerId, pack});
    }
  };
  const openedPlayer = opened ? game.players[opened.playerId] : undefined;

  // The diamond pack: four to pick from. Shown while choosing; reopened from the tile if closed.
  const [choosing, setChoosing] = useState(false);
  // One card at a time: `seq` counts reveal steps over all four, six per card.
  const [seq, setSeq] = useState(0);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const openDiamond = () => {
    const fresh = !game.packChoice;
    const res = act((g, rng) => openDiamondPack(g, rng));
    if ("error" in res) return notify(res.error, undefined, "error");
    if (fresh) setSeq(0);
    setChoosing(true);
  };
  const pick = (playerId: string) => {
    const name = fullName(game.players[playerId]);
    if (act((g) => pickFromPack(g, playerId))) notify("pack.got", {name}, "good");
    setChoosing(false);
  };
  const choices = (game.packChoice ?? []).map((id) => game.players[id]).filter(Boolean);
  const allShown = seq >= choices.length * 6;
  const cardStage = (i: number) => Math.max(0, Math.min(6, seq - i * 6));
  // Each card as one pack, then the next; the one being revealed scrolled into view.
  useEffect(() => {
    if (!choosing || allShown) return;
    const local = seq % 6;
    if (local === 0) cardRefs.current[Math.floor(seq / 6)]?.scrollIntoView({behavior: "smooth", block: "nearest"});
    const id = setTimeout(() => setSeq((s) => s + 1), local === 0 ? 900 : local === 3 ? 1300 : 750);
    return () => clearTimeout(id);
  }, [choosing, seq, allShown]);

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
      {/* The balance, big and clear, at the top of the shop. */}
      <div className="shop-balance span-2">
        <span className="shop-balance-label">{t("shop.yourDiamonds")}</span>
        <strong>💎 {num(m.diamonds)}</strong>
      </div>
      <Card title={`⚡ ${t("shop.energy")}`}>
        <div className="energy-meter" aria-label={`${m.energy}/${ENERGY_MAX}`}>
          {Array.from({length: ENERGY_MAX}, (_, i) => <span key={i} className={i < m.energy ? "pip on" : "pip"}>⚡</span>)}
        </div>
        <p className="muted">{t("shop.energyHint", {time: `${Math.floor(ENERGY_REGEN_MS / 60_000)}:${String(Math.round((ENERGY_REGEN_MS % 60_000) / 1000)).padStart(2, "0")}`, match: ENERGY_COST_MATCH, training: ENERGY_COST_EXTRA_TRAINING})}</p>
        <div className="btn-row wrap">
          <button className="btn primary" disabled={m.energy >= ENERGY_MAX} onClick={refill}>💎 {t("shop.refill", {cost: DIAMONDS_REFILL_COST})}</button>
          {/* A video for one energy point, a few times a day. */}
          <button className="btn" disabled={m.energy >= ENERGY_MAX || videosLeft <= 0} onClick={() => setWatching(true)}>
            🎬 {t("video.energy")} <small className="muted">({t("video.left", {n: videosLeft})})</small>
          </button>
        </div>
        {watching && <VideoAd onReward={energyVideo} onClose={() => setWatching(false)} />}
      </Card>

      <Card title={`💎 ${t("shop.diamonds")}`}>
        <p className="muted">{t("shop.earnHint", {win: DIAMONDS_PER_WIN, daily: DIAMONDS_DAILY_BONUS, champion: DIAMONDS_SEASON.champion})}</p>
        <h3>{t("shop.exchange")}</h3>
        <p className="muted small">{t("shop.exchangeHint", {diamonds: EXCHANGE.diamonds, money: EXCHANGE.money, left: EXCHANGE.maxPerSeason - m.exchangesThisSeason})}</p>
        <button className="btn" disabled={m.exchangesThisSeason >= EXCHANGE.maxPerSeason} onClick={exchange}>
          💎 {EXCHANGE.diamonds} → 💰
        </button>
      </Card>

      <Card title={`🎁 ${t("pack.title")}`} className="span-2">
        <p className="muted">{t("pack.hint")}</p>
        <div className="ppacks">
          {PLAYER_PACK_IDS.map((id) => {
            const pack = PLAYER_PACKS[id];
            return (
              <div key={id} className={`ppack ppack-${id}`}>
                <strong>{t(`pack.${id}`)}</strong>
                <span className="ppack-range">{t("pack.range", {min: pack.min, max: pack.max})}</span>
                <button className="ppack-btn" disabled={m.diamonds < pack.price} onClick={() => open(id)}>
                  💎 {pack.price} · {t("pack.open")}
                </button>
              </div>
            );
          })}
          {/* The diamond pack: club money, pick one of four. */}
          <div className="ppack ppack-diamond">
            <strong>💠 {t("pack.diamond")}</strong>
            <span className="ppack-range">{t("pack.range", {min: DIAMOND_PACK.min, max: DIAMOND_PACK.max})}</span>
            <span className="ppack-note">{t("pack.diamondNote", {n: DIAMOND_PACK.choices})}</span>
            {game.packChoice ? (
              <button className="ppack-btn" onClick={() => setChoosing(true)}>{t("pack.choose")}</button>
            ) : (
              <button className="ppack-btn" disabled={game.clubs[game.userClubId].cash < DIAMOND_PACK.price} onClick={openDiamond}>
                💰 {money(DIAMOND_PACK.price)} · {t("pack.open")}
              </button>
            )}
          </div>
        </div>
      </Card>
      {opened && openedPlayer && (
        <Modal title={`🎁 ${t(`pack.${opened.pack}`)}`} onClose={() => setOpened(null)}>
          <div className="pack-reveal">
            <div className="pack-flip">
              <PlayerCard game={game} player={openedPlayer} reveal stage={stage} />
            </div>
            {stage >= 6 ? (
              <>
                <h3 className="pack-got">{t("pack.got", {name: fullName(openedPlayer)})}</h3>
                <button className="btn primary" onClick={() => setOpened(null)}>{t("pack.great")}</button>
              </>
            ) : (
              <button className="btn" onClick={() => setStage(6)}>{t("pack.showAll")}</button>
            )}
          </div>
        </Modal>
      )}

      {choosing && choices.length > 0 && (
        <Modal wide title={`💠 ${t("pack.diamond")}`} onClose={() => setChoosing(false)}>
          <p className="muted">{t("pack.pickHint", {n: choices.length})}</p>
          <div className="pack-choices">
            {choices.map((p, i) => (
              <div key={p.id} className="pack-choice" ref={(el) => { cardRefs.current[i] = el; }}>
                <PlayerCard game={game} player={p} reveal stage={cardStage(i)} forClubId={game.userClubId} />
                {allShown && <button className="btn primary" onClick={() => pick(p.id)}>{t("pack.pick", {name: fullName(p)})}</button>}
              </div>
            ))}
          </div>
          {!allShown && (
            <div className="btn-row tt-actions">
              <button className="btn" onClick={() => setSeq(choices.length * 6)}>{t("pack.showAll")}</button>
            </div>
          )}
        </Modal>
      )}

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
