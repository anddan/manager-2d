// Energy, diamonds and the (mock) shop.
import {Icon, iconize} from "../Icon";
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
import {LEGENDS, LEGEND_PRICE_DIAMONDS, buyLegend, buySecretLegend, legendOwned, legendPlayer, type Legend} from "../../game/legend";
import {chime} from "../sound";
import {exchangeDiamonds, grantMoneyPack, grantPack, mockPaymentProvider, recordPurchase, refillEnergy, regenerateEnergy, type MoneyPackId, type PackId} from "../../game/monetization";
import {DIAMOND_PACK, PLAYER_PACKS, PLAYER_PACK_IDS, openDiamondPack, openPack, pickFromPack, type PlayerPackId} from "../../game/packs";
import {useT} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Card, Modal, Hint} from "../common";
import {ENERGY_VIDEOS_PER_DAY, videoForEnergy} from "../../game/daily";
import {today} from "../DailyTasks";
import {VideoAd} from "../VideoAd";
import {PackReveal} from "../PackReveal";
import {PlayerCard} from "../PlayerCard";
import {GearShop} from "../Gear";
import {energyBurst} from "../effects";
import {PackArt} from "../PackArt";

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
    if (!err) energyBurst(null, 1);
    notify(err ?? "toast.videoEnergy", undefined, err ? "error" : "good");
  };
  // The player from the last pack opened, shown until closed.
  const [opened, setOpened] = useState<{playerId: string; pack: PlayerPackId} | null>(null);
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
    const n = act((g) => {
      const got = grantPack(g.monetization, packId);
      recordPurchase(g, {diamonds: got}, priceEur);
      return got;
    });
    notify("toast.purchased", {n}, "good");
  };

  const open = (pack: PlayerPackId) => {
    const res = act((g, rng) => openPack(g, rng, pack));
    if ("error" in res) notify(res.error, undefined, "error");
    else setOpened({playerId: res.playerId, pack});
  };

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

  // The legends: each bought once (then shown as he plays for you); the secret one any number of times.
  const buyNamed = (l: Legend) => {
    const err = act((g) => buyLegend(g, l.id));
    if (err) return notify(err, undefined, "error");
    chime();
    setRevealed({playerId: l.id, title: "shop.legendTitle"});
  };
  const buySecret = () => {
    const res = act((g, rng) => buySecretLegend(g, rng));
    if ("error" in res) return notify(res.error, undefined, "error");
    chime();
    setRevealed({playerId: res.playerId, title: "shop.secretTitle"});
  };
  const [revealed, setRevealed] = useState<{playerId: string; title: "shop.legendTitle" | "shop.secretTitle"} | null>(null);
  // The secret legend's grey card: no name, no country, no position until bought.
  const secret = {...legendPlayer(game, null), id: "legend-secret", firstName: "?", lastName: "?", nationality: ""};

  const buyMoney = async (packId: MoneyPackId, priceEur: number) => {
    setBuying(packId);
    // Same mock checkout as the diamonds.
    const result = await mockPaymentProvider.purchase(packId, priceEur);
    setBuying(null);
    if (!result.ok) return notify("shop.purchaseFailed", undefined, "error");
    const amount = act((g) => {
      const got = grantMoneyPack(g, packId);
      recordPurchase(g, {money: got}, priceEur);
      return got;
    });
    notify("toast.moneyPurchased", {money: amount}, "good");
  };

  const price = (eur: number) => new Intl.NumberFormat(lang === "sv" ? "sv-SE" : lang === "es" ? "es-ES" : "en-GB", {style: "currency", currency: "EUR"}).format(eur);

  return (
    <div className="grid">
      {/* The balance, big and clear, at the top of the shop. */}
      <div className="shop-balance span-2">
        <span className="shop-balance-label">{iconize(t("shop.yourDiamonds"))}</span>
        <strong><Icon name="diamond" size={22} /> {num(m.diamonds)}</strong>
      </div>
      <Card title={<><Icon name="bolt" size={20} /> {iconize(t("shop.energy"))}</>}>
        <div className="energy-count"><Icon name="bolt" size={26} /> <strong>{m.energy}/{ENERGY_MAX}</strong></div>
        <Hint>{iconize(t("shop.energyHint", {time: Math.round(ENERGY_REGEN_MS / 60_000), match: ENERGY_COST_MATCH, training: ENERGY_COST_EXTRA_TRAINING}))}</Hint>
        <div className="btn-row wrap">
          <button className="btn primary" disabled={m.energy >= ENERGY_MAX} onClick={refill}><Icon name="diamond" size={18} /> {iconize(t("shop.refill", {cost: DIAMONDS_REFILL_COST}))}</button>
          {/* A video for one energy point, a few times a day. */}
          <button className="btn" disabled={m.energy >= ENERGY_MAX || videosLeft <= 0} onClick={() => setWatching(true)}>
            <Icon name="video" size={18} /> {iconize(t("video.energy"))} <small className="muted">({t("video.left", {n: videosLeft})})</small>
          </button>
        </div>
        {watching && <VideoAd onReward={energyVideo} onClose={() => setWatching(false)} />}
      </Card>

      <Card title={<><Icon name="boot" size={20} /> {iconize(t("gear.title"))}</>} className="span-2">
        <GearShop />
      </Card>

      <Card title={<><Icon name="diamond" size={20} /> {iconize(t("shop.diamonds"))}</>}>
        <Hint>{iconize(t("shop.earnHint", {win: DIAMONDS_PER_WIN, daily: DIAMONDS_DAILY_BONUS, champion: DIAMONDS_SEASON.champion}))}</Hint>
        <h3>{iconize(t("shop.exchange"))}</h3>
        <p className="muted small">{iconize(t("shop.exchangeHint", {diamonds: EXCHANGE.diamonds, money: EXCHANGE.money, left: EXCHANGE.maxPerSeason - m.exchangesThisSeason}))}</p>
        <button className="btn" disabled={m.exchangesThisSeason >= EXCHANGE.maxPerSeason} onClick={exchange}>
          <Icon name="diamond" size={16} /> {EXCHANGE.diamonds} → <Icon name="coins" size={16} />
        </button>
      </Card>

      <Card title={<><Icon name="gift" size={20} /> {iconize(t("pack.title"))}</>} className="span-2">
        <Hint>{iconize(t("pack.hint"))}</Hint>
        <div className="ppacks">
          {PLAYER_PACK_IDS.map((id) => {
            const pack = PLAYER_PACKS[id];
            return (
              <div key={id} className="ppack-offer">
                <PackArt tier={id} name={t(`pack.${id}`)} range={t("pack.range", {min: pack.min, max: pack.max})} />
                <button className="ppack-btn" disabled={m.diamonds < pack.price} onClick={() => open(id)}>
                  <Icon name="diamond" size={16} /> {pack.price} · {iconize(t("pack.open"))}
                </button>
              </div>
            );
          })}
          {/* The diamond pack: club money, pick one of four. */}
          <div className="ppack-offer">
            <PackArt tier="diamond" name={t("pack.diamond")} range={t("pack.range", {min: DIAMOND_PACK.min, max: DIAMOND_PACK.max})} note={t("pack.diamondNote", {n: DIAMOND_PACK.choices})} />
            {game.packChoice ? (
              <button className="ppack-btn" onClick={() => setChoosing(true)}>{iconize(t("pack.choose"))}</button>
            ) : (
              <button className="ppack-btn" disabled={game.clubs[game.userClubId].cash < DIAMOND_PACK.price} onClick={openDiamond}>
                <Icon name="coins" size={16} /> {money(DIAMOND_PACK.price)} · {iconize(t("pack.open"))}
              </button>
            )}
          </div>
        </div>
      </Card>
      {opened && <PackReveal playerId={opened.playerId} pack={opened.pack} onClose={() => setOpened(null)} />}

      {choosing && choices.length > 0 && (
        <Modal wide title={<><Icon name="diamond" size={20} /> {iconize(t("pack.diamond"))}</>} onClose={() => setChoosing(false)}>
          <p className="muted">{iconize(t("pack.pickHint", {n: choices.length}))}</p>
          <div className="pack-choices">
            {choices.map((p, i) => (
              <div key={p.id} className="pack-choice" ref={(el) => { cardRefs.current[i] = el; }}>
                <PlayerCard game={game} player={p} reveal stage={cardStage(i)} forClubId={game.userClubId} />
                {allShown && <button className="btn primary" onClick={() => pick(p.id)}>{iconize(t("pack.pick", {name: fullName(p)}))}</button>}
              </div>
            ))}
          </div>
          {!allShown && (
            <div className="btn-row dialog-actions">
              <button className="btn" onClick={() => setSeq(choices.length * 6)}>{iconize(t("pack.showAll"))}</button>
            </div>
          )}
        </Modal>
      )}

      <Card title={<><Icon name="star" size={20} /> {iconize(t("shop.legend"))}</>} className="span-2">
        <Hint>{iconize(t("shop.legendHint", {price: LEGEND_PRICE_DIAMONDS}))}</Hint>
        <div className="legends">
          {LEGENDS.map((l) => {
            const owned = legendOwned(game, l.id);
            const p = owned ? game.players[l.id] : legendPlayer(game, null, l);
            return (
              <div key={l.id} className="legend-offer">
                <PlayerCard game={game} player={p} reveal kit={l.kit} />
                <strong className="legend-name">{fullName(p)}</strong>
                {owned ? (
                  <p className="callout good"><Icon name="check" size={16} /> {iconize(t("shop.legendOwned"))}</p>
                ) : (
                  <button className="ppack-btn" disabled={m.diamonds < LEGEND_PRICE_DIAMONDS} onClick={() => buyNamed(l)}>
                    <Icon name="diamond" size={16} /> {LEGEND_PRICE_DIAMONDS} · {iconize(t("shop.legendBuy"))}
                  </button>
                )}
              </div>
            );
          })}
          {/* The secret legend: grey until bought, then someone new each time. */}
          <div className="legend-offer secret">
            <PlayerCard game={game} player={secret} reveal stage={0} />
            <strong className="legend-name">{iconize(t("shop.secretLegend"))}</strong>
            <button className="ppack-btn" disabled={m.diamonds < LEGEND_PRICE_DIAMONDS} onClick={buySecret}>
              <Icon name="diamond" size={16} /> {LEGEND_PRICE_DIAMONDS} · {iconize(t("shop.legendBuy"))}
            </button>
          </div>
        </div>
        {m.diamonds < LEGEND_PRICE_DIAMONDS && <p className="muted small">{iconize(t("shop.legendNeed", {n: LEGEND_PRICE_DIAMONDS - m.diamonds}))}</p>}
      </Card>
      {revealed && <PackReveal playerId={revealed.playerId} title={<><Icon name="star" size={20} /> {iconize(t(revealed.title))}</>} onClose={() => setRevealed(null)} />}

      <Card title={<><Icon name="coins" size={20} /> {iconize(t("shop.buyMoney"))}</>} className="span-2">
        <p className="muted small">{iconize(t("shop.buyMoneyHint"))}</p>
        <div className="packs">
          {MONEY_PACKS.map((pack) => (
            <div key={pack.id} className="pack">
              <div className="pack-amount"><Icon name="coins" size={22} /> {money(pack.money)}</div>
              {pack.bonus > 0 && <div className="pack-bonus">+{money(pack.bonus)} {iconize(t("shop.bonus"))}</div>}
              <button className="btn primary" disabled={buying !== null} onClick={() => buyMoney(pack.id, pack.priceEur)}>
                {buying === pack.id ? "…" : price(pack.priceEur)}
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card title={<><Icon name="cart" size={20} /> {iconize(t("shop.buy"))}</>} className="span-2">
        <p className="callout">{iconize(t("shop.mockNotice"))}</p>
        <div className="packs">
          {DIAMOND_PACKS.map((pack) => (
            <div key={pack.id} className="pack">
              <div className="pack-amount"><Icon name="diamond" size={22} /> {pack.diamonds}</div>
              {pack.bonus > 0 && <div className="pack-bonus">+{pack.bonus} {iconize(t("shop.bonus"))}</div>}
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
