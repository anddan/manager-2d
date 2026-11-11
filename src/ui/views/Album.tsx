// The collector's album: everything there is to get. What is had and not opened yet is a sealed box (tap to open
// it for diamonds, with a blue number in the menu until all are opened); what isn't had is greyed out, and says
// what it is so it can be hunted down. A few at the end are very rare.
import {useEffect, useRef, useState, type ReactNode} from "react";
import {ALBUM_PACKS, RARES, TROPHIES, albumGear, albumGifts, albumProgress, claimable, claimItem, ownedKeys, rewardOf, updateAlbum} from "../../game/album";
import {GEAR_COLOR, GEAR_KINDS, GEAR_PRICE, GEAR_TIERS, type GearKind, type GearTier} from "../../game/gear";
import {GIFTS, GIFT_VARIANTS} from "../../game/morale";
import {MANAGER_TITLES, MAX_LEVEL, TITLE_COUNT, managerStanding, offerRange, xpAtLevel} from "../../game/manager";
import {useT, type TKey} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Card, FoldButton, Hint, Modal} from "../common";
import {confettiBurst, diamondBurst, screenFlash} from "../effects";
import {GearPicture} from "../Gear";
import {GiftPicture} from "../GiftArt";
import {Icon, iconize} from "../Icon";
import {fanfare} from "../sound";

/** A trophy's medal: the metal it is made of. */
const MEDAL: Record<string, string> = {league: "#facc15", cup: "#facc15", wc1: "#facc15", ec1: "#facc15", wc2: "#cbd5e1", ec2: "#cbd5e1", wc3: "#d97706", ec3: "#d97706"};
const PACK_BG: Record<string, string> = {bronze: "#b45309", silver: "#94a3b8", gold: "#eab308", special: "#ec4899", diamond: "#38bdf8", kit: "#7c3aed"};
const RARE_ICON: Record<string, "trophy" | "star" | "stadium" | "coins" | "user" | "sprout" | "boot" | "sparkle" | "fire"> = {dynasty: "fire", double: "trophy", dream: "stadium", rich: "coins", legend: "user", prodigy: "sprout", cars: "star", wardrobe: "boot", king: "sparkle"};

const kindOf = (key: string) => key.split(":")[0];
const idOf = (key: string) => key.split(":").slice(1).join(":");

/** An item's picture. */
function Picture({itemKey, size = 1}: {itemKey: string; size?: number}) {
  const kind = kindOf(itemKey);
  const id = idOf(itemKey);
  const [a, b] = id.split(":");
  if (kind === "gift") return <GiftPicture id={a} variant={b} width={Math.round(58 * size)} />;
  if (kind === "gear") return <span className="album-ring" style={{borderColor: GEAR_COLOR[b as GearTier], width: 58 * size, height: 58 * size}}><GearPicture item={{kind: a as GearKind, tier: b as GearTier}} size={Math.round((a === "gloves" ? 40 : 46) * size)} /></span>;
  if (kind === "trophy") return <span className="album-medal" style={{color: MEDAL[id] ?? "#a78bfa"}}><Icon name={id.startsWith("award") ? "star" : "trophy"} size={Math.round(38 * size)} /></span>;
  if (kind === "pack") return <span className="album-pack" style={{background: PACK_BG[id], width: 44 * size, height: 56 * size}}><Icon name={id === "diamond" ? "diamond" : id === "kit" ? "boot" : "gift"} size={Math.round(30 * size)} /></span>;
  return <span className="album-medal rare" style={{color: "#f0abfc"}}><Icon name={RARE_ICON[id] ?? "star"} size={Math.round(40 * size)} /></span>;
}

function Tile({state, label, onClick, children}: {state: "locked" | "new" | "have"; label: string; onClick: () => void; children: ReactNode}) {
  return (
    <button type="button" className={`album-tile ${state}`} onClick={onClick} aria-label={label}>
      <span className="album-pic">{state === "new" ? <span className="album-sealed"><Icon name="gift" size={40} /></span> : children}</span>
      {state === "new" && <span className="album-newtag">NY!</span>}
      <span className="album-name">{label}</span>
    </button>
  );
}

/** The opening: a shaking box, a flash, then what was in it and the diamonds it gave. */
function OpenDialog({itemKey, onClose, label}: {itemKey: string; onClose: () => void; label: string}) {
  const {t} = useT();
  const act = useGame((s) => s.act);
  const [phase, setPhase] = useState<"closed" | "opening" | "open">("closed");
  const [reward, setReward] = useState(0);
  const prizeRef = useRef<HTMLDivElement>(null);
  const rare = kindOf(itemKey) === "rare";
  const open = () => {
    if (phase !== "closed") return;
    const n = act((g) => claimItem(g, itemKey));
    setReward(n);
    setPhase("opening");
    window.setTimeout(() => setPhase("open"), 1100);
  };
  useEffect(() => {
    if (phase !== "open") return;
    try { fanfare(rare); } catch { /* no sound */ }
    screenFlash(rare ? "#f0abfc" : "#fde047");
    confettiBurst(rare ? 170 : 80);
    const timer = window.setTimeout(() => diamondBurst(prizeRef.current, reward), 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  return (
    <Modal compact title={<><Icon name="gift" size={20} /> {iconize(t("album.opening"))}</>} onClose={() => phase !== "opening" && onClose()}>
      <div className={rare ? "album-open rare" : "album-open"}>
        {phase !== "open" ? (
          <button type="button" className={phase === "opening" ? "album-box opening" : "album-box"} onClick={open} aria-label={t("album.open")}>
            <Icon name="gift" size={110} />
          </button>
        ) : (
          <div className="album-reveal">
            <div className="wheel-rays" aria-hidden />
            <div className="album-reveal-body">
              <div className="wheel-win-title">{iconize(t(rare ? "wheel.jackpot" : "wheel.win"))}</div>
              <div ref={prizeRef} className="album-reveal-pic"><Picture itemKey={itemKey} size={2.2} /></div>
              <div className="wheel-win-name">{label}</div>
              <p className="album-gems">{iconize(t("album.got", {n: reward}))}</p>
            </div>
          </div>
        )}
        {phase === "closed" && <p className="muted">{iconize(t("album.sealed"))}</p>}
        {phase === "open" && <div className="btn-row dialog-actions"><button className="btn primary" onClick={onClose}>{iconize(t("wheel.great"))}</button></div>}
      </div>
    </Modal>
  );
}

export function Album() {
  const {t, money} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const [picked, setPicked] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  // The manager's titles: which one is looked at.
  const [titlePicked, setTitlePicked] = useState<number | null>(null);
  // Each collection can be folded away (all open to begin with) and says how many of it you have, like "4/12".
  const [shut, setShut] = useState<Record<string, boolean>>({});
  // The rare ones reached are noted when the album is opened.
  useEffect(() => { act((g) => updateAlbum(g)); }, [act]);
  const owned = ownedKeys(game);
  const fresh = new Set(claimable(game));
  const { have, total } = albumProgress(game);
  const stateOf = (key: string) => (fresh.has(key) ? "new" : owned.has(key) ? "have" : "locked");

  const nameOf = (key: string): string => {
    const kind = kindOf(key);
    const id = idOf(key);
    const [a, b] = id.split(":");
    if (kind === "trophy") return t(`album.trophy.${id}` as TKey);
    if (kind === "gift") return b ? `${t(`gift.${a}` as TKey)} · ${t(`gift.v.${b}` as TKey)}` : t(`gift.${a}` as TKey);
    if (kind === "gear") return `${t(`gear.kind.${a}` as TKey)} · ${t(`gear.tier.${b}` as TKey)}`;
    if (kind === "pack") return id === "kit" ? t("gear.pack") : t(`pack.${id}` as TKey);
    return t(`album.rare.${id}` as TKey);
  };
  /** What it is and how to get it (the greyed ones say it so they can be hunted down). */
  const describe = (key: string): string => {
    const kind = kindOf(key);
    const id = idOf(key);
    const [a, b] = id.split(":");
    if (kind === "trophy") return t(`album.what.trophy.${id}` as TKey);
    if (kind === "rare") return t(`album.what.rare.${id}` as TKey);
    if (kind === "gift" && !b) return t("album.what.mansion", {cost: money(GIFTS.find((g) => g.id === a)?.cost ?? 0)});
    if (kind === "gift") return t("album.what.gift", {name: t(`gift.${a}` as TKey), colour: t(`gift.v.${b}` as TKey), cost: money(GIFTS.find((g) => g.id === a)?.cost ?? 0)});
    if (kind === "gear") {
      const price = GEAR_PRICE[b as GearTier];
      return price.diamonds ? t("album.what.gear.diamonds", {n: price.diamonds}) : t("album.what.gear.money", {price: money(price.money ?? 0)});
    }
    return t(id === "diamond" ? "album.what.diamondPack" : id === "kit" ? "album.what.kitPack" : "album.what.pack", {pack: nameOf(key)});
  };
  const mystery = (key: string) => kindOf(key) === "rare" && !owned.has(key);

  const tile = (key: string, label?: string) => {
    const st = stateOf(key);
    const shown = mystery(key) ? "???" : (label ?? nameOf(key));
    return (
      <Tile key={key} state={st} label={shown} onClick={() => (st === "new" ? setOpening(key) : setPicked(key))}>
        <Picture itemKey={key} />
      </Tile>
    );
  };

  const standing = managerStanding(game);
  /** One title: what it is, what it gives and what it needs. */
  const titleDetail = () => {
    if (titlePicked === null) return null;
    const n = titlePicked;
    const lv = MANAGER_TITLES[n - 1].level;
    const have = n <= standing.title;
    const authority = (lv - 1) / (MAX_LEVEL - 1);
    const reward = MANAGER_TITLES[n - 1].reward;
    const [from, to] = offerRange(lv);
    return (
      <Modal compact title={<><Icon name="star" size={20} /> {t(`mgr.level.${n}` as TKey, {name: game.managerName})}</>} onClose={() => setTitlePicked(null)}>
        <div className={have ? "album-big have" : "album-big"}><span className="album-medal title-medal big"><b>{lv}</b></span></div>
        <p className="muted">{iconize(t("mgr.levelN", {n: lv}))} · {have ? t("album.title.have") : t("album.title.needs", {level: lv, xp: xpAtLevel(lv)})}</p>
        <p className="album-gems small">{iconize(reward?.diamonds ? t("album.title.rewardDiamonds", {n: reward.diamonds}) : reward?.money ? t("album.title.rewardMoney", {money: reward.money}) : t("album.title.start"))}{have && reward ? " ✓" : ""}</p>
        {n > 1 && <p className="small">{iconize(t("album.title.effect", {forza: Math.round(authority * 80), orders: Math.round(authority * 50)}))}</p>}
        {n > 1 && <p className="small muted">{iconize(t("album.title.offers", {from: from + 1, to}))}</p>}
        <div className="btn-row dialog-actions"><button className="btn primary" onClick={() => setTitlePicked(null)}>{t("common.close")}</button></div>
      </Modal>
    );
  };

  const next = [...fresh][0];
  const detail = () => {
    if (!picked) return null;
    const st = stateOf(picked);
    const times = game.album?.trophies?.[idOf(picked)] ?? 0;
    return (
      <Modal compact title={<><Icon name="star" size={20} /> {mystery(picked) ? "???" : nameOf(picked)}</>} onClose={() => setPicked(null)}>
        <div className={st === "locked" ? "album-big" : "album-big have"}><Picture itemKey={picked} size={2.6} /></div>
        <p className={st === "locked" ? "muted" : ""}>{iconize(st === "locked" ? describe(picked) : kindOf(picked) === "trophy" && times > 0 ? `${describe(picked)} ${t("album.timesWon", {n: times})}` : describe(picked))}</p>
        <p className="album-gems small">{iconize(t("album.reward", {n: rewardOf(picked)}))}{st === "have" ? " ✓" : ""}</p>
        <div className="btn-row dialog-actions"><button className="btn primary" onClick={() => setPicked(null)}>{t("common.close")}</button></div>
      </Modal>
    );
  };

  const count = (keys: string[]) => `${keys.filter((k) => owned.has(k)).length}/${keys.length}`;
  const toggle = (id: string) => <FoldButton open={!shut[id]} onClick={() => setShut((v) => ({...v, [id]: !v[id]}))} />;
  return (
    <div className="grid">
      <Card
        title={<><Icon name="trophy" size={18} /> {iconize(t("album.title"))} <Hint>{iconize(t("album.hint"))}</Hint></>}
        className="span-2"
        actions={next ? <button className="btn primary small album-next" onClick={() => setOpening(next)}>{iconize(t("album.openNext", {n: fresh.size}))}</button> : undefined}
      >
        <div className="album-progress">
          <strong>{iconize(t("album.progress", {have, total}))}</strong>
          <span className="album-bar"><span style={{width: `${(have / total) * 100}%`}} /></span>
        </div>
      </Card>

      <Card title={<><Icon name="star" size={18} /> {iconize(t("album.section.titles"))} ({standing.title}/{TITLE_COUNT})</>} actions={toggle("titles")} className="span-2">
        {!shut.titles && (
          <div className="album-grid">
            {MANAGER_TITLES.map((_, i) => i + 1).map((n) => (
              <button key={n} type="button" className={`album-tile ${n <= standing.title ? "have" : "locked"}`} onClick={() => setTitlePicked(n)} aria-label={t(`mgr.level.${n}` as TKey, {name: game.managerName})}>
                <span className="album-pic"><span className={MANAGER_TITLES[n - 1].level >= 100 ? "album-medal title-medal wide" : "album-medal title-medal"}><b>{MANAGER_TITLES[n - 1].level}</b></span></span>
                <span className="album-name">{t(`mgr.level.${n}` as TKey, {name: game.managerName})}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card title={<><Icon name="trophy" size={18} /> {iconize(t("album.section.trophies"))} ({count(TROPHIES.map((k) => `trophy:${k}`))})</>} actions={toggle("trophies")} className="span-2">
        {!shut.trophies && <div className="album-grid">{TROPHIES.map((k) => tile(`trophy:${k}`))}</div>}
      </Card>

      <Card title={<><Icon name="sparkle" size={18} /> {iconize(t("album.section.rare"))} ({count(RARES.map((k) => `rare:${k}`))})</>} actions={toggle("rare")} className="span-2 album-rare-card">
        {!shut.rare && <div className="album-grid">{RARES.map((k) => tile(`rare:${k}`))}</div>}
      </Card>

      <Card title={<><Icon name="gift" size={18} /> {iconize(t("album.section.gifts"))} ({count(albumGifts().map((k) => `gift:${k}`))})</>} actions={toggle("gifts")} className="span-2">
        {!shut.gifts && Object.keys(GIFT_VARIANTS).map((id) => (
          <div key={id} className="album-group">
            <h3>{t(`gift.${id}` as TKey)}</h3>
            <div className="album-grid">{albumGifts().filter((g) => g.startsWith(`${id}:`)).map((k) => tile(`gift:${k}`, t(`gift.v.${k.split(":")[1]}` as TKey)))}</div>
          </div>
        ))}
        {/* The house: one only, with no colours. */}
        {!shut.gifts && <div className="album-group">
          <h3>{t("gift.mansion")}</h3>
          <div className="album-grid">{tile("gift:mansion", t("gift.mansion"))}</div>
        </div>}
      </Card>

      <Card title={<><Icon name="boot" size={18} /> {iconize(t("album.section.gear"))} ({count(albumGear().map((k) => `gear:${k}`))})</>} actions={toggle("gear")} className="span-2">
        {!shut.gear && GEAR_KINDS.map((kind) => (
          <div key={kind} className="album-group">
            <h3>{t(`gear.kind.${kind}` as TKey)}</h3>
            <div className="album-grid">{GEAR_TIERS.filter((tier) => albumGear().includes(`${kind}:${tier}`)).map((tier) => tile(`gear:${kind}:${tier}`, t(`gear.tier.${tier}` as TKey)))}</div>
          </div>
        ))}
      </Card>

      <Card title={<><Icon name="gift" size={18} /> {iconize(t("album.section.packs"))} ({count(ALBUM_PACKS.map((k) => `pack:${k}`))})</>} actions={toggle("packs")} className="span-2">
        {!shut.packs && <div className="album-grid">{ALBUM_PACKS.map((k) => tile(`pack:${k}`))}</div>}
      </Card>
      {detail()}
      {titleDetail()}
      {opening && <OpenDialog itemKey={opening} label={nameOf(opening)} onClose={() => setOpening(null)} />}
    </div>
  );
}
