// Boots and gloves in the UI: each pair as a card (basic, silver, gold or special, like
// the player cards) with a picture and what it gives; the shop's rack to buy from; and
// the part of a player's profile where they're put on and taken off.
import {Icon, iconize} from "./Icon";
import {Hint} from "./common";
import {useState} from "react";
import {GEAR_ATTRS, GEAR_KIND_COLOR, GEAR_KINDS, SHIN_PROTECT, gearIn, gearSlot, type GearSlot, GEAR_PRICE, GEAR_TIERS, buyGear, equipGear, gearBonus, gearFits, unequipGear, type GearItem, type GearKind, type GearTier} from "../game/gear";
import type {Attribute, Player} from "../game/types";
import {freeBootsOffered, takeFreeBoots} from "../game/tutorial";
import {useT} from "../i18n";
import {useGame, useGameState} from "../store";

/** The tier's trim: studs, stripe and strap. */
const TRIM: Record<GearTier, string> = {common: "#f8fafc", silver: "#cbd5e1", gold: "#facc15", special: "url(#gear-rainbow)"};

/** A boot from the side (or a keeper's glove), in the kind's colour with the tier's trim. */
export function GearPicture({item, size = 84}: {item: GearItem; size?: number}) {
  const body = GEAR_KIND_COLOR[item.kind];
  const trim = TRIM[item.tier];
  const rainbow = (
    <defs>
      <linearGradient id="gear-rainbow" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#ec4899" />
        <stop offset="0.5" stopColor="#facc15" />
        <stop offset="1" stopColor="#22d3ee" />
      </linearGradient>
    </defs>
  );
  if (item.kind === "shin") {
    return (
      <svg viewBox="0 0 56 70" width={size * 0.8} height={size} className="gear-picture" aria-hidden>
        {rainbow}
        {/* A shield for the shin: the shell, a gloss, ribs, a stripe in the tier's colour, and the strap. */}
        <path d="M9 7 Q28 0 47 7 L46 44 Q45 60 28 67 Q11 60 10 44 Z" fill={body} stroke="#0f172a" strokeWidth={1.5} strokeLinejoin="round" />
        <path d="M14 12 Q28 7 42 12 L41 30 Q28 26 15 30 Z" fill="#fff" opacity={0.28} />
        {[22, 28, 34].map((x) => (
          <line key={x} x1={x} y1={16} x2={x} y2={54} stroke="#0f172a" strokeOpacity={0.18} strokeWidth={1.4} strokeLinecap="round" />
        ))}
        <path d="M14 46 L28 36 L32 41 L43 33" fill="none" stroke={trim} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
        <rect x={7} y={20} width={42} height={6} rx={2} fill="#0f172a" opacity={0.85} />
      </svg>
    );
  }
  if (item.kind === "gloves") {
    return (
      <svg viewBox="0 0 70 70" width={size} height={size} className="gear-picture" aria-hidden>
        {rainbow}
        {/* Fingers (with stiff finger saves), the palm, the thumb; a wide strap at the wrist with the tier's colour. */}
        {[17, 27.5, 38, 48.5].map((x, i) => (
          <g key={x}>
            <rect x={x} y={9 - (i === 1 || i === 2 ? 4 : 0) + (i === 3 ? 3 : 0)} width={9.5} height={30} rx={4.75} fill={body} stroke="#0f172a" strokeWidth={1.3} />
            <line x1={x + 4.75} y1={13 - (i === 1 || i === 2 ? 4 : 0) + (i === 3 ? 3 : 0)} x2={x + 4.75} y2={30} stroke="#0f172a" strokeOpacity={0.25} strokeWidth={1.2} strokeLinecap="round" />
          </g>
        ))}
        <path d="M15 30 Q15 24 22 24 L54 24 Q60 24 60 31 L59 50 Q58 54 54 54 L20 54 Q16 54 16 50 Z" fill={body} stroke="#0f172a" strokeWidth={1.3} />
        <rect x={5} y={31} width={22} height={10} rx={5} transform="rotate(-40 16 36)" fill={body} stroke="#0f172a" strokeWidth={1.3} />
        <path d="M22 28 Q38 25 54 28" fill="none" stroke="#fff" strokeOpacity={0.45} strokeWidth={2.4} strokeLinecap="round" />
        <path d="M24 46 L34 34 L38 40 L52 30" fill="none" stroke={trim} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        <rect x={16} y={51} width={43} height={13} rx={4} fill="#0f172a" />
        <rect x={19} y={54} width={37} height={7} rx={2.5} fill={trim} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 64" width={size} height={size * 0.64} className="gear-picture" aria-hidden>
      {rainbow}
      {/* A low, sleek boot pointing right: knit sock collar, the upper with its gloss and speed stripe,
          a heel counter in the tier's colour, and a thin plate with bladed studs. */}
      <path d="M14 34 Q13 20 21 15 L33 15 Q37 19 36 27 L30 35 Z" fill={body} stroke="#0f172a" strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M14 34 Q13 20 21 15 L33 15 Q37 19 36 27 L30 35 Z" fill="#0f172a" opacity={0.28} />
      {[19, 23, 27].map((y) => (
        <line key={y} x1={15} y1={y} x2={34} y2={y - 1} stroke="#fff" strokeOpacity={0.18} strokeWidth={1} />
      ))}
      <path d="M9 47 Q8 34 15 28 Q22 22 34 24 Q48 26 60 30 Q80 34 93 41 Q98 44 93 47 Z" fill={body} stroke="#0f172a" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M20 29 Q40 26 60 32 Q76 36 88 41" fill="none" stroke="#fff" strokeOpacity={0.4} strokeWidth={2.2} strokeLinecap="round" />
      <path d="M9 47 Q8 36 13 31 L19 33 Q15 39 16 47 Z" fill={trim} stroke="#0f172a" strokeWidth={1.1} />
      <path d="M26 44 L44 34 L48 39 L74 31" fill="none" stroke={trim} strokeWidth={4.2} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 46 L94 46 Q97 48 93 50.5 L11 50.5 Q6 50 7 46 Z" fill="#0f172a" />
      <path d="M12 48.2 L90 48.2" stroke={trim} strokeWidth={1} strokeOpacity={0.9} />
      {[14, 23, 56, 66, 76, 86].map((x, i) => (
        <path key={x} d={i < 2 ? `M${x - 2.5} 50.5 L${x + 2.5} 50.5 L${x + 1.5} 57 L${x - 1.5} 57 Z` : `M${x - 3} 50.5 L${x + 3} 50.5 L${x + 0.8} 56.5 L${x - 0.8} 56.5 Z`} fill="#0f172a" stroke={trim} strokeWidth={0.8} strokeLinejoin="round" />
      ))}
    </svg>
  );
}

/** A pair as a card: the bonus big, the picture, the name, and every attribute it lifts. */
export function GearCard({item, small}: {item: GearItem; small?: boolean}) {
  const {t} = useT();
  const bonus = Object.entries(gearBonus(item)) as [Attribute, number][];
  return (
    <div className={`fut-card gear-card tier-${item.tier === "common" ? "common" : item.tier}${small ? " small" : ""}`}>
      <div className="fut-top">
        <div className="fut-rating">
          <span className="fut-ovr">+{bonus[0][1]}</span>
          <span className="fut-pos">{iconize(t(`gear.tier.${item.tier}`))}</span>
        </div>
        <div className="fut-portrait"><GearPicture item={item} size={item.kind === "gloves" ? (small ? 40 : 58) : item.kind === "shin" ? (small ? 36 : 50) : small ? 58 : 84} /></div>
      </div>
      <div className="fut-name">{iconize(t(`gear.kind.${item.kind}`))}</div>
      <div className="gear-card-stats">
        {bonus.map(([a, n]) => (
          <div key={a} className="fut-stat">
            <strong>+{n}</strong>
            <span>{iconize(t(`attr.${a}`))}</span>
          </div>
        ))}
        {item.kind === "shin" && (
          <div className="fut-stat">
            <strong className="nowrap">−{Math.round(SHIN_PROTECT[item.tier] * 100)}&nbsp;%</strong>
            <span>{iconize(t("gear.injuries"))}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** The shop's rack: pick a kind, then one of its four cards, for club money or diamonds. */
export function GearShop() {
  const {t, money} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  const setView = useGame((s) => s.setView);
  const [kind, setKind] = useState<GearKind>("speed");
  const cash = game.clubs[game.userClubId].cash;
  const diamonds = game.monetization.diamonds;
  // The guide's present: basic boots are free while it shows the Shop.
  const free = freeBootsOffered(game);
  const buy = (item: GearItem) => {
    if (free && item.tier === "common" && gearSlot(item.kind) === "feet" && item.kind !== "gloves") {
      act((g) => takeFreeBoots(g, item.kind));
      return notify("gear.freeTaken", undefined, "good");
    }
    const err = act((g) => buyGear(g, item));
    notify(err ?? "gear.bought", undefined, err ? "error" : "good");
  };
  return (
    <>
      <Hint>{iconize(t("gear.hint"))}</Hint>
      <div className="gear-kinds" role="tablist">
        {GEAR_KINDS.map((k) => (
          <button key={k} role="tab" aria-selected={k === kind} className={k === kind ? "gear-kind-tab on" : "gear-kind-tab"} onClick={() => setKind(k)}>
            <GearPicture item={{kind: k, tier: "common"}} size={k === "shin" ? 24 : 34} />
            <span>{iconize(t(`gear.kind.${k}`))}</span>
          </button>
        ))}
      </div>
      <p className="muted small">
        {iconize(t("gear.lifts", {attrs: GEAR_ATTRS[kind].map((a) => t(`attr.${a}`)).join(", ")}))} ·{" "}
        <button className="link" onClick={() => setView("storage")}><Icon name="boot" size={18} /> {iconize(t("gear.inBag", {n: game.gearBag?.length ?? 0}))}</button>
      </p>
      <div className="gear-cards">
        {GEAR_TIERS.map((tier) => {
          const price = GEAR_PRICE[tier];
          const gift = free && tier === "common" && kind !== "gloves" && kind !== "shin";
          const afford = gift || (price.diamonds ? diamonds >= price.diamonds : cash >= (price.money ?? 0));
          return (
            <div key={tier} className={gift ? "gear-offer free" : "gear-offer"}>
              <GearCard item={{kind, tier}} />
              <button className="ppack-btn" disabled={!afford} onClick={() => buy({kind, tier})}>
                {gift ? <><Icon name="gift" size={18} /> {iconize(t("gear.free"))}</> : `${price.diamonds ? `💎 ${price.diamonds}` : `💰 ${money(price.money ?? 0)}`} · ${t("gear.buy")}`}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** In a player's profile: boots (or gloves) and shin guards, each with what's on and what in the bag fits. */
export function GearPanel({player: p}: {player: Player}) {
  return (
    <div className="gear-panel">
      <GearSlotPanel player={p} slot="feet" />
      <GearSlotPanel player={p} slot="shin" />
    </div>
  );
}

function GearSlotPanel({player: p, slot}: {player: Player; slot: GearSlot}) {
  const {t} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  const gloves = p.position === "GK";
  const worn = gearIn(p, slot);
  const bag = (game.gearBag ?? []).map((item, i) => ({item, i})).filter(({item}) => gearSlot(item.kind) === slot && gearFits(p, item.kind));
  const putOn = (i: number) => {
    const err = act((g) => equipGear(g, p.id, i));
    if (err) notify(err, undefined, "error");
  };
  const title = slot === "shin" ? <><Icon name="shin" size={18} /> {iconize(t("gear.kind.shin"))}</> : gloves ? <><Icon name="glove" size={18} /> {iconize(t("gear.gloves"))}</> : <><Icon name="boot" size={18} /> {iconize(t("gear.boots"))}</>;
  return (
    <section className="gear-slot">
      <h4>{title}</h4>
      {worn ? (
        <div className="gear-offer">
          <GearCard item={worn} small />
          <button className="btn small" onClick={() => act((g) => unequipGear(g, p.id, slot))}>{iconize(t("gear.takeOff"))}</button>
        </div>
      ) : (
        <p className="muted small">{iconize(t(slot === "shin" ? "gear.noneShin" : gloves ? "gear.noneGloves" : "gear.noneBoots"))}</p>
      )}
      {bag.length > 0 && (
        <>
          <h4 className="muted small"><Icon name="boot" size={18} /> {iconize(t("gear.bag"))}</h4>
          <div className="gear-cards">
            {bag.map(({item, i}) => (
              <div key={i} className="gear-offer">
                <GearCard item={item} small />
                <button className="btn small primary" onClick={() => putOn(i)}>{iconize(t("gear.putOn"))}</button>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
