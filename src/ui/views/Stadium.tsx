// The stadium, seen from above: tap a stand (or the kiosks, or the shop) to see
// what the next level gives and build it. Locked until the league is won.
import {Icon, iconize, type IconName} from "../Icon";
import {useState} from "react";
import {
  ITEM_FAIR,
  ITEM_PART,
  SALE_ITEMS,
  itemPrice,
  itemTakings,
  kioskTakings,
  setItemPrice,
  shopTakings,
  type SaleItem,
  GYM_BOOST,
  ACADEMY_BOOST,
  REHAB_CHANCE,
  REHAB_REST,
  SHOP_MAX,
  KIOSK_MAX,
  STAND_MAX,
  TRAINING_BOOST,
  STAND_SEATS,
  STANDS,
  buildWeeks,
  ensureStadium,
  isStand,
  partLevel,
  partMax,
  stadiumCapacity,
  stadiumUnlocked,
  startBuild,
  upgradeCost,
  type StadiumPart,
  type StadiumState,
  type Stand,
} from "../../game/stadium";
import {difficulty, userClub} from "../../game/helpers";
import type {TKey} from "../../i18n";
import {useT} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Card, Hint} from "../common";

export function Stadium() {
  const {t} = useT();
  const game = useGameState();
  const club = userClub(game);
  if (!stadiumUnlocked(game)) {
    const best = game.history.length ? Math.min(...game.history.map((h) => h.userPosition)) : undefined;
    const preview: StadiumState = {stands: {north: 0, south: 0, west: 0, east: 0}, kiosks: 0, shop: 0, base: club.capacity};
    return (
      <Card title={<><Icon name="stadium" size={20} /> {iconize(t("stadium.lockedTitle"))}</>}>
        <div className="stadium-locked">
          <StadiumDrawing st={preview} color={club.color} trim={club.color2} />
          <div className="stadium-lock-badge" aria-hidden>🔒</div>
        </div>
        <Hint><StadiumHelp /></Hint>
        <p>{iconize(t("stadium.lockedText"))}</p>
        <p className="muted small">{best !== undefined ? t("stadium.bestFinish", {place: best}) : t("stadium.noFinish")}</p>
      </Card>
    );
  }
  return <StadiumBuilder />;
}

function StadiumBuilder() {
  const {t, num} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  const club = userClub(game);
  // Shown as it is, or as a fresh one before the first build.
  const st: StadiumState = club.stadium ?? {stands: {north: 0, south: 0, west: 0, east: 0}, kiosks: 0, shop: 0, base: club.capacity};
  const [picked, setPicked] = useState<StadiumPart | null>(null);
  const build = (part: StadiumPart) => {
    const err = act((g) => {
      ensureStadium(g.clubs[g.userClubId]);
      return startBuild(g, part);
    });
    if (err) notify(err, undefined, "error");
    else notify("stadium.started", undefined, "good");
  };
  const partName = (part: StadiumPart) => t(`stadium.part.${part}` as TKey);
  return (
    <div className="grid">
      {(st.kiosks > 0 || st.shop > 0) && <ItemPrices st={st} attendance={club.capacity} />}
      <Card title={<><Icon name="stadium" size={20} /> {iconize(t("stadium.title"))}</>}>
        <Hint><StadiumHelp /></Hint>
        <StadiumDrawing st={st} color={club.color} trim={club.color2} picked={picked} onPick={setPicked} />
        <dl className="kv">
          <dt>{iconize(t("stadium.capacity"))}</dt><dd><strong>{iconize(t("stadium.seats", {n: stadiumCapacity(st)}))}</strong></dd>
        </dl>
        {st.project && <p className="stadium-project">{iconize(t("stadium.building", {part: `stadium.part.${st.project.part}`, weeks: st.project.weeksLeft}))}</p>}
      </Card>

      <Card title={picked ? partName(picked) : t("stadium.title")}>
        <Hint><StadiumHelp upgrades /></Hint>
        {!picked && <p className="muted">{iconize(t("stadium.pick"))}</p>}
        <ul className="stadium-parts">
          {([...STANDS, "kiosks", "shop", "training", "gym", "rehab", "academy"] as StadiumPart[]).map((part) => {
            const level = partLevel(st, part);
            const max = partMax(part);
            const cost = upgradeCost(st, part);
            const open = picked === part;
            const gain = isStand(part)
              ? t("stadium.standGain", {n: STAND_SEATS[part]})
              : part === "kiosks"
                ? t("stadium.kioskGain", {spend: kioskTakings(st, 1000, Math.min(level + 1, max)) / 1000})
                : part === "shop"
                  ? t("stadium.shopGain", {weekly: shopTakings(st, Math.min(level + 1, max))})
                  : part === "training"
                    ? t("stadium.trainGain", {pct: Math.round(TRAINING_BOOST * Math.min(level + 1, max) * 100)})
                    : part === "gym"
                      ? t("stadium.gymGain", {pct: Math.round(GYM_BOOST * Math.min(level + 1, max) * 100)})
                      : part === "rehab"
                        ? t("stadium.rehabGain", {pct: Math.round(REHAB_CHANCE * Math.min(level + 1, max) * 100), rest: Math.round(REHAB_REST * Math.min(level + 1, max) * 100)})
                        : t("stadium.academyGain", {pct: Math.round(ACADEMY_BOOST * Math.min(level + 1, max) * 100)});
            const building = st.project?.part === part;
            return (
              <li key={part} className={`stadium-part ${open ? "open" : ""}`}>
                <button className="stadium-part-head" onClick={() => setPicked(open ? null : part)} aria-expanded={open}>
                  <span className="stadium-part-icon" aria-hidden><Icon name={partIcon(part)} size={20} /></span>
                  <span className="stadium-part-name">{partName(part)}</span>
                  <span className="stadium-levels" aria-label={t("stadium.level", {level, max})}>
                    {Array.from({length: max}, (_, i) => <span key={i} className={i < level ? "on" : building && i === level ? "building" : ""} />)}
                  </span>
                </button>
                {open && (
                  <div className="stadium-part-body">
                    <p className="small">{iconize(t("stadium.level", {level, max}))}{cost !== undefined && <> · {gain}</>}</p>
                    {/* What this part does. */}
                    <p className="muted small stadium-part-info"><Icon name="info" size={14} /> {iconize(t(`stadium.help.${isStand(part) ? "stands" : part}` as TKey))}</p>
                    {cost === undefined ? (
                      <p className="strong">{iconize(t("stadium.maxed"))}</p>
                    ) : (
                      <>
                        <button className="btn primary" disabled={!!st.project || club.cash < cost} onClick={() => build(part)}>
                          <Icon name="hammer" size={18} /> {iconize(t("stadium.build", {cost}))}
                        </button>
                        <p className="muted small">{st.project ? t("stadium.busy") : club.cash < cost ? t("stadium.noMoney") : t("stadium.buildTime", {weeks: buildWeeks(part)})}</p>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="muted small">{num(stadiumCapacity(st))} / {num(st.base + STANDS.reduce((n, s) => n + STAND_MAX * STAND_SEATS[s], 0))}</p>
      </Card>
    </div>
  );
}

/**
 * The kiosks' and the shop's prices: each item with its price (up and down), the fair price, and
 * what it brings in (at the kiosks per full home match, at the shop per week).
 */
const ITEM_ICONS: Record<SaleItem, "hotdog" | "cup" | "scarf" | "shirt"> = {hotdog: "hotdog", drink: "cup", scarf: "scarf", shirt: "shirt"};

function ItemPrices({st, attendance}: {st: StadiumState; attendance: number}) {
  const {t, money} = useT();
  const act = useGame((s) => s.act);
  const helped = difficulty(useGameState()) !== "hard";
  const items = SALE_ITEMS.filter((i) => (ITEM_PART[i] === "kiosks" ? st.kiosks : st.shop) > 0);
  const set = (item: SaleItem, price: number) => act((g) => setItemPrice(g, item, price));
  const step = (item: SaleItem) => (ITEM_FAIR[item] >= 20 ? 5 : 1);
  return (
    <Card title={<><Icon name="tag" size={20} /> {iconize(t("stadium.prices"))}</>}>
      <Hint>{iconize(t("stadium.pricesHint"))}</Hint>
      <ul className="item-prices">
        {items.map((item) => {
          const price = itemPrice(st, item);
          return (
            <li key={item} className="item-price">
              <span className="item-price-name"><Icon name={ITEM_ICONS[item]} size={18} /> {iconize(t(`stadium.item.${item}` as TKey))}</span>
              <span className="price-stepper">
                <button className="btn small" aria-label={t("fin.priceDown")} disabled={price <= Math.ceil(ITEM_FAIR[item] / 5)} onClick={() => set(item, price - step(item))}>▼</button>
                <strong>{money(price)}</strong>
                <button className="btn small" aria-label={t("fin.priceUp")} disabled={price >= ITEM_FAIR[item] * 3} onClick={() => set(item, price + step(item))}>▲</button>
              </span>
              {/* The fair price and the takings: help on easy and medium only. */}
              {helped && <small className="muted">{iconize(t("stadium.itemFair", {fair: ITEM_FAIR[item]}))} · {iconize(t(ITEM_PART[item] === "kiosks" ? "stadium.itemPerMatch" : "stadium.itemPerWeek", {x: itemTakings(st, item, attendance)}))}</small>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/**
 * The stadium from above: the pitch, a stand on each side that gets deeper with
 * every level (rows of seats in the club's colours), kiosks in the corners and
 * the shop by the entrance. Under construction: dashed, with a crane.
 */
/** The icon of a part: the same in the drawing, the list and the help. */
function partIcon(part: StadiumPart): IconName {
  return isStand(part) ? "chair" : part === "kiosks" ? "hotdog" : part === "shop" ? "bag" : part === "training" ? "run" : part === "gym" ? "dumbbell" : part === "rehab" ? "medical" : "sprout";
}

/** The buildings under the arena: the training ground, the gym, the rehab centre and the academy. */
const FACILITIES: StadiumPart[] = ["training", "gym", "rehab", "academy"];

function StadiumDrawing({st, color, trim, picked, onPick}: {st: StadiumState; color: string; trim: string; picked?: StadiumPart | null; onPick?: (p: StadiumPart) => void}) {
  const pitch = {x: 70, y: 50, w: 100, h: 66};
  const depth = (s: Stand) => 6 + st.stands[s] * 5;
  const gap = 3;
  const stand = (s: Stand) => {
    const d = depth(s);
    const rect =
      s === "north" ? {x: pitch.x, y: pitch.y - gap - d, w: pitch.w, h: d}
      : s === "south" ? {x: pitch.x, y: pitch.y + pitch.h + gap, w: pitch.w, h: d}
      : s === "west" ? {x: pitch.x - gap - d, y: pitch.y, w: d, h: pitch.h}
      : {x: pitch.x + pitch.w + gap, y: pitch.y, w: d, h: pitch.h};
    const horizontal = s === "north" || s === "south";
    const rows = Math.max(1, Math.floor(d / 2.5));
    const building = st.project?.part === s;
    return (
      <g key={s} className={`stadium-stand ${picked === s ? "picked" : ""} ${building ? "building" : ""}`} onClick={onPick ? () => onPick(s) : undefined} role={onPick ? "button" : undefined}>
        <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={2} fill={st.stands[s] > 0 ? color : "#94a3b8"} opacity={st.stands[s] > 0 ? 0.95 : 0.8} />
        {/* Rows of seats. */}
        {Array.from({length: rows}, (_, i) => {
          const k = (i + 0.5) / rows;
          return horizontal ? (
            <line key={i} x1={rect.x + 2} x2={rect.x + rect.w - 2} y1={rect.y + rect.h * k} y2={rect.y + rect.h * k} stroke={trim} strokeWidth={0.6} opacity={0.7} />
          ) : (
            <line key={i} y1={rect.y + 2} y2={rect.y + rect.h - 2} x1={rect.x + rect.w * k} x2={rect.x + rect.w * k} stroke={trim} strokeWidth={0.6} opacity={0.7} />
          );
        })}
        <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={2} fill="none" className="stadium-stand-outline" />
        {building && <g transform={`translate(${rect.x + rect.w / 2 - 5} ${rect.y + rect.h / 2 - 5})`} className="stadium-hammer"><Icon name="hammer" size={10} /></g>}
      </g>
    );
  };
  const outer = {
    x: pitch.x - gap - depth("west") - 14,
    y: pitch.y - gap - depth("north") - 14,
    w: pitch.w + 2 * gap + depth("west") + depth("east") + 28,
    h: pitch.h + 2 * gap + depth("north") + depth("south") + 28,
  };
  // As in the match: the kiosks top left, top right, bottom right (in that order), the shop bottom left. A square in each corner.
  const SQ = 20;
  const corners = [
    {x: outer.x + 2, y: outer.y + 2},
    {x: outer.x + outer.w - SQ - 2, y: outer.y + 2},
    {x: outer.x + outer.w - SQ - 2, y: outer.y + outer.h - SQ - 8},
  ];
  const shopAt = {x: outer.x + 2, y: outer.y + outer.h - SQ - 8};
  const building = (part: StadiumPart) => st.project?.part === part;
  return (
    <svg className="stadium-svg" viewBox="0 0 240 214" role="img" aria-label="stadium">
      <rect x={outer.x} y={outer.y} width={outer.w} height={outer.h} rx={18} className="stadium-ground" />
      <rect x={pitch.x} y={pitch.y} width={pitch.w} height={pitch.h} className="stadium-pitch" />
      <g className="stadium-lines">
        <rect x={pitch.x + 2} y={pitch.y + 2} width={pitch.w - 4} height={pitch.h - 4} fill="none" />
        <line x1={pitch.x + pitch.w / 2} x2={pitch.x + pitch.w / 2} y1={pitch.y + 2} y2={pitch.y + pitch.h - 2} />
        <circle cx={pitch.x + pitch.w / 2} cy={pitch.y + pitch.h / 2} r={8} fill="none" />
      </g>
      {STANDS.map(stand)}
      {/* The kiosks in the corners (a stall for each level) and the shop by the entrance: a square each, with the shop's levels under it. */}
      <g className={`stadium-extra ${picked === "kiosks" ? "picked" : ""}`} onClick={onPick ? () => onPick("kiosks") : undefined} role={onPick ? "button" : undefined}>
        {corners.map((c, i) => (
          <g key={i} opacity={i < st.kiosks || (building("kiosks") && i === st.kiosks) ? 1 : 0.45} className={i < st.kiosks ? "stadium-square built" : "stadium-square"}>
            <rect x={c.x} y={c.y} width={SQ} height={SQ} rx={4} className="stadium-facility-box" />
            <g transform={`translate(${c.x + 3} ${c.y + 3})`}><Icon name={building("kiosks") && i === st.kiosks ? "hammer" : "hotdog"} size={14} /></g>
          </g>
        ))}
        {/* The kiosks' level (how many stalls of the three) under each of them. */}
        {corners.map((c, i) => Array.from({length: KIOSK_MAX}, (_, d) => <circle key={`${i}-${d}`} cx={c.x + SQ / 2 + (d - (KIOSK_MAX - 1) / 2) * 6} cy={c.y + SQ + 4} r={1.800} className={d < st.kiosks ? "stadium-pip on" : "stadium-pip"} />))}
      </g>
      <g className={`stadium-extra ${picked === "shop" ? "picked" : ""}`} onClick={onPick ? () => onPick("shop") : undefined} role={onPick ? "button" : undefined}>
        <g opacity={st.shop > 0 || building("shop") ? 1 : 0.45} className={st.shop > 0 ? "stadium-square built" : "stadium-square"}>
          <rect x={shopAt.x} y={shopAt.y} width={SQ} height={SQ} rx={4} className="stadium-facility-box" />
          <g transform={`translate(${shopAt.x + 3} ${shopAt.y + 3})`}><Icon name={building("shop") && st.shop === 0 ? "hammer" : "bag"} size={14} /></g>
        </g>
        {Array.from({length: SHOP_MAX}, (_, d) => <circle key={d} cx={shopAt.x + SQ / 2 + (d - (SHOP_MAX - 1) / 2) * 6} cy={shopAt.y + SQ + 4} r={1.800} className={d < st.shop ? "stadium-pip on" : "stadium-pip"} />)}
      </g>
      {/* The training ground, the gym, the rehab centre and the academy: a building each under the arena, dim until built, with a dot for every level. */}
      {FACILITIES.map((part, i) => {
        const level = partLevel(st, part);
        const max = partMax(part);
        const x = 7 + i * 58;
        const y = 168;
        const busy = building(part);
        return (
          <g key={part} className={`stadium-facility ${picked === part ? "picked" : ""} ${busy ? "building" : ""} ${level > 0 ? "built" : ""}`} onClick={onPick ? () => onPick(part) : undefined} role={onPick ? "button" : undefined}>
            <rect x={x} y={y} width={54} height={31} rx={5} className="stadium-facility-box" />
            <g transform={`translate(${x + 17} ${y + 5.500})`} opacity={level > 0 || busy ? 1 : 0.4}><Icon name={busy ? "hammer" : partIcon(part)} size={20} /></g>
            {Array.from({length: max}, (_, d) => <circle key={d} cx={x + 27 + (d - (max - 1) / 2) * 7} cy={y + 38} r={2} className={d < level ? "stadium-pip on" : "stadium-pip"} />)}
          </g>
        );
      })}
    </svg>
  );
}

/** What each part of the stadium does, and how it shows in home matches. */
function StadiumHelp({upgrades = false}: {upgrades?: boolean}) {
  const {t} = useT();
  // Two (i): the arena itself (stands and the home match), and the things to upgrade.
  const keys = upgrades ? (["kiosks", "shop", "training", "gym", "rehab", "academy"] as const) : (["stands", "match"] as const);
  return (
    <>
      {!upgrades && <p>{iconize(t("stadium.help.intro"))}</p>}
      <dl className="tt-help">
        {keys.map((k) => (
          <div key={k}>
            <dt><Icon name={k === "stands" ? "stadium" : k === "match" ? "ball" : partIcon(k)} size={16} /> {iconize(t(`stadium.help.${k}.title`))}</dt>
            <dd>{iconize(t(`stadium.help.${k}`))}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
