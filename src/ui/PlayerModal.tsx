// Player details. Own players: condition, mood, talks, focus, listing.
import {moneyBurst, pressedElement} from "./effects";
import {setShirt, shirtHolder} from "../game/shirts";
import {wornGear} from "../game/gear";
import {nationalSlots, setNationalSlot, shownSquad} from "../game/national";
// Others: scouting, bids, loans and free-agent offers.
import {Icon, iconize} from "./Icon";
import {useEffect, useRef, useState, type ReactNode} from "react";
import {profileName, shortName} from "../game/helpers";
import {DIAMONDS_SCOUT_COST, SCOUT_COST, clubSlots} from "../game/constants";
import {startNegotiation} from "../game/contracts";
import {GiftPicture} from "./GiftArt";

/** The presents that are things (not money): each has its own place round the card. */
const CARD_GIFTS = ["watch", "gaming", "motorcycle", "sportsCar", "mansion"];
import {GIFTS, GIFT_VARIANTS, giveGift, hasMansion, parseGift, happinessFactors, answerTransferRequest, talkToPlayer, TALKS, type GiftId} from "../game/morale";
import {
  askingPrice,
  completeLoan,
  evaluateBid,
  evaluateLoanRequest,
  isKnown,
  quickSaleOffer,
  quickSell,
  scoutPlayer,
  type BidResult,
} from "../game/transfers";
import {ATTRIBUTES, type ManagerLook, type Player, type Position} from "../game/types";
import {useT, type TKey} from "../i18n";
import {useGame, useGameState} from "../store";
import {Bar, Delta, Face, Flag, FormArrow, Modal, NumberInput, Ovr, PosBadge, StatusIcons, Hint} from "./common";
import {PlayerCard} from "./PlayerCard";
import {KitAvatar, editableLook, lookFromEditor} from "./Avatar";
import {ManagerEditor} from "./ManagerEditor";
import {GearCard, GearPanel} from "./Gear";
import {TraitChips} from "./Traits";
import {FocusPicker} from "./FocusPicker";
import {SellToFriend} from "./FriendSale";
import {totalGearBonus} from "../game/gear";
import {dayFormParts, effectiveRating, familiarity} from "../game/ratings";

/**
 * A player's profile. With `preview` it only shows them (a friend's player for sale, lent into
 * the game for the look): no actions of its own, the given buttons at the bottom instead.
 */
export function PlayerModal({playerId, preview}: {playerId: string; preview?: {onClose: () => void; footer: ReactNode}}) {
  const {t} = useT();
  const game = useGameState();
  const openPlayer = useGame((s) => s.openPlayer);
  const slot = useGame((s) => s.profileSlot);
  const fromNational = useGame((s) => s.profileNational);
  const act = useGame((s) => s.act);
  const p = game.players[playerId];
  // A scouting report is read once the profile is opened.
  useEffect(() => {
    if (!preview && game.scouted[playerId] !== undefined && !game.scoutedSeen?.includes(playerId)) act((g) => { (g.scoutedSeen ??= []).push(playerId); });
  }, [playerId, preview, game.scouted, game.scoutedSeen, act]);
  if (!p) return null;
  const own = !preview && (p.clubId === game.userClubId || p.loan?.parentClubId === game.userClubId);
  const known = !!preview || isKnown(game, p);
  // A player of the country the manager coaches: their kit can be handled from here, whatever club they play for.
  const national = !preview && !!game.national && p.nationality === game.national.country && !!p.clubId;
  const club = p.clubId ? game.clubs[p.clubId] : null;
  // Boots or gloves on: their bonus shown beside the attribute.
  const gear = totalGearBonus(p);
  // Opened from their spot in the tactics: they can be taken out of it from here.
  // Opened from a spot in the tactics: the position they play there (maybe not their own).
  const nat = fromNational && !!game.national;
  const spotPos = !preview && slot !== null ? (nat ? nationalSlots(game.national!)[slot]?.pos : clubSlots(game.clubs[game.userClubId])[slot]?.pos) : undefined;
  const playsAs = spotPos && spotPos !== p.position ? spotPos : undefined;
  const inSpot = !preview && slot !== null && (nat ? shownSquad(game, game.national!).lineup[slot] === p.id : game.clubs[game.userClubId].lineup[slot] === p.id);
  const takeOut = () => {
    act((g) => {
      if (nat) {
        if (slot !== null) setNationalSlot(g, slot, "");
        return;
      }
      const c = g.clubs[g.userClubId];
      c.lineup = c.lineup.map((id, i) => (i === slot ? "" : id));
    });
    openPlayer(null);
  };

  return (
    <Modal
      wide
      onClose={preview?.onClose ?? (() => openPlayer(null))}
      title={
        <>
          <Flag code={p.nationality} /> {profileName(p)} <StatusIcons player={p} />
          {inSpot && <button className="btn small danger pm-take-out" onClick={takeOut}><Icon name="close" size={14} /> {iconize(t("tac.clearShort"))}</button>}
        </>
      }
    >
      <div className="player-top">
        {/* The presents they have been given, round the card. */}
        <div className={hasMansion(p) ? "card-gifts has-mansion" : "card-gifts"}>
          <PlayerCard game={game} player={p} />
          {/* Each kind has its own place; more colours of the same kind stand a little behind each other, with a number for how many of that colour. */}
          {CARD_GIFTS.flatMap((id) => {
            const owned = new Map<string, number>();
            for (const kept of p.gifts ?? []) {
              const g = parseGift(kept);
              if (g.id === id) owned.set(g.variant ?? "", (owned.get(g.variant ?? "") ?? 0) + 1);
            }
            return [...owned].map(([variant, n], i) => (
              <span key={`${id}:${variant}`} className={`card-gift pos-${CARD_GIFTS.indexOf(id)}`} style={{"--i": i, zIndex: CARD_GIFTS.indexOf(id) < 2 ? 10 + i : 10 - i} as React.CSSProperties} title={`${t(`gift.${id}` as TKey)}${variant ? ` · ${t(`gift.v.${variant}` as TKey)}` : ""}`}>
                <GiftPicture id={id} variant={variant || undefined} width={id === "mansion" ? 150 : 92} />
                {n > 1 && <span className="gift-count">{n}</span>}
              </span>
            ));
          })}
        </div>
        <div className="player-head">
          <dl className="pm-facts">
            <div className="pm-fact"><dt>{iconize(t("pl.position"))}</dt><dd><PosBadge pos={p.position} />{playsAs && own && <> <span className="muted">→</span> <PosBadge pos={playsAs} /> <Effect factor={familiarity(p, playsAs)} /></>}</dd></div>
            <div className="pm-fact" title={t("col.ovrHint")}><dt>{iconize(t("col.ovr"))}</dt><dd className="strong"><Ovr game={game} player={p} /></dd></div>
            <div className="pm-fact"><dt>{iconize(t("pl.nation"))}</dt><dd><Flag code={p.nationality} named size={18} /></dd></div>
            <div className="pm-fact"><dt>{iconize(t("col.age"))}</dt><dd>{iconize(t("pl.age", {age: p.age}))}</dd></div>
            <div className={p.shirt !== undefined && p.clubId ? "pm-fact" : "pm-fact wide"}><dt>{iconize(t("pl.club"))}</dt><dd>{club ? club.name : t("pl.freeAgent")}</dd></div>
            {/* The shirt number shares the row with the club. */}
            {p.shirt !== undefined && p.clubId && (
              <div className="pm-fact"><dt>{iconize(t("pl.shirt"))}</dt><dd>{own && !p.loan ? <ShirtPicker player={p} /> : <span className="strong">{p.shirt}</span>}</dd></div>
            )}
          </dl>
          {own && <Nickname key={p.id} player={p} />}
          {known && <TraitChips player={p} />}
        </div>
      </div>

      <div className="player-grid">
        <section>
          <h3>{iconize(t("pl.attributes"))}</h3>
          <table className="attr-table">
            <thead>
              <tr><th /><th /><th title={t("pl.lastWeek")}>{iconize(t("pl.week"))}</th><th title={t("pl.thisSeason")}>{iconize(t("pl.season"))}</th></tr>
            </thead>
            <tbody>
              {ATTRIBUTES.map((a) => (
                <tr key={a}>
                  <td>{iconize(t(`attr.${a}`))}</td>
                  <td className="num strong">{known ? Math.round(p.attrs[a]) : "?"}{known && gear[a] ? <small className="gear-plus"> +{gear[a]}</small> : null}</td>
                  <td>{known && <Delta value={p.weeklyChange[a]} digits={2} />}</td>
                  <td>{known && <Delta value={p.attrs[a] - p.seasonStartAttrs[a]} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          {own && <Condition player={p} pos={playsAs ?? p.position} />}
          {/* The kit (boots, gloves, shin guards), before the statistics. */}
          {((own && p.clubId === game.userClubId) || national) && (
            <Fold title={<><Icon name="shirt" size={20} /> {iconize(t("gear.equipment"))}{wornGear(p).length > 0 && <span className="fold-count"> ({wornGear(p).length})</span>}</>}>
              <GearPanel player={p} />
            </Fold>
          )}
          {/* A player looked at before buying: what kit they come with (just to see). */}
          {!(own && p.clubId === game.userClubId) && !national && (p.gear || p.shin) && (
            <Fold open title={<><Icon name="shirt" size={20} /> {iconize(t("gear.equipment"))}</>}>
              <div className="gear-cards">
                {p.gear && <GearCard item={p.gear} small />}
                {p.shin && <GearCard item={p.shin} small />}
              </div>
            </Fold>
          )}
          <Fold title={<><Icon name="chart" size={20} /> {iconize(t("pl.stats"))}</>}>
            <dl className="kv">
              <dt>{iconize(t("pl.apps"))}</dt><dd>{p.stats.apps} ({p.stats.starts})</dd>
              <dt>{iconize(t("pl.goals"))}</dt><dd>{p.stats.goals}</dd>
              <dt>{iconize(t("pl.assists"))}</dt><dd>{p.stats.assists}</dd>
              <dt>{iconize(t("pl.cards"))}</dt><dd>{iconize(`🟨 ${p.stats.yellow} 🟥 ${p.stats.red}`)}</dd>
              <dt>{iconize(t("pl.avgRating"))}</dt><dd>{p.stats.apps ? (p.stats.ratingSum / p.stats.apps).toFixed(2) : "–"}</dd>
            </dl>
          </Fold>
          <ContractInfo player={p} />
        </section>
      </div>

      {preview ? <div className="btn-row dialog-actions pm-preview-actions">{preview.footer}</div> : own ? <OwnActions player={p} /> : <MarketActions player={p} />}
    </Modal>
  );
}

/** Their shirt number: a list of 1–99 (a number someone has says who; picking it swaps), and what they wish for. */
function ShirtPicker({player: p}: {player: Player}) {
  const {t} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const wish = p.wantShirt;
  return (
    <span className="shirt-pick">
      <select aria-label={t("pl.shirt")} value={p.shirt} onChange={(e) => act((g) => setShirt(g, p.id, Number(e.target.value)))}>
        {Array.from({length: 99}, (_, i) => i + 1).map((n) => {
          const holder = n === p.shirt ? undefined : shirtHolder(game, p.clubId!, n, p.id);
          return <option key={n} value={n}>{n}{n === wish ? " ★" : ""}{holder ? ` · ${shortName(holder)}` : ""}</option>;
        })}
      </select>
      {wish !== undefined && (
        <small className={p.shirt === wish ? "shirt-got" : "shirt-wish"} title={t(p.shirt === wish ? "pl.shirtGot" : "pl.shirtWants", {n: wish})}>
          <Icon name={p.shirt === wish ? "check" : "warn"} size={14} /> {wish}
        </small>
      )}
    </span>
  );
}

/** What one part does to the rating on the day: "+12 %" (green), "−3 %" (red), nothing when it's none. */
function Effect({factor}: {factor: number}) {
  const pct = Math.round((factor - 1) * 100);
  if (pct === 0) return <span className="effect-pct">±0 %</span>;
  return <span className={pct > 0 ? "effect-pct up" : "effect-pct down"}>{pct > 0 ? `+${pct}` : `−${-pct}`} %</span>;
}

/** What the manager calls the player. Shown instead of their name everywhere but here. */
function Nickname({player: p}: {player: Player}) {
  const {t} = useT();
  const act = useGame((s) => s.act);
  const [value, setValue] = useState(p.nickname ?? "");
  const save = (nickname: string) =>
    act((g) => {
      const name = nickname.trim().slice(0, 20);
      if (name) g.players[p.id].nickname = name;
      else delete g.players[p.id].nickname;
    });
  return (
    <form
      className="nickname"
      onSubmit={(e) => {
        e.preventDefault();
        save(value);
      }}
    >
      <label>
        <span><Icon name="pen" size={18} /> {iconize(t("pl.nickname"))}</span>
        <input value={value} maxLength={20} placeholder={p.lastName} onChange={(e) => setValue(e.target.value)} onBlur={() => save(value)} />
      </label>
      {p.nickname && (
        <button type="button" className="btn small" onClick={() => { setValue(""); save(""); }}>{iconize(t("pl.nicknameClear"))}</button>
      )}
    </form>
  );
}

function Condition({player: p, pos}: {player: Player; pos: Position}) {
  const {t, tx} = useT();
  const game = useGameState();
  const factors = happinessFactors(game, p);
  const d = dayFormParts(p, pos);
  return (
    <>
      {/* The (i) right by the heading (a profile has no card head to put it in). */}
      {/* An injury: what it is, and how long they're out. */}
      {p.injuryWeeks > 0 && (
        <div className="injury-callout" role="status">
          <Icon name="medical" size={22} />
          <div>
            <strong>{p.injury ? iconize(tx(`injury.${p.injury.kind}`)) : iconize(t("injury.unknown"))}</strong>
            <span>{iconize(t("injury.out", {weeks: p.injuryWeeks}))}{p.injury && p.injury.total > p.injuryWeeks ? ` · ${t("injury.of", {total: p.injury.total})}` : ""}</span>
            {p.injury && <small className="muted">{iconize(t(`injury.from.${p.injury.source}`))}</small>}
          </div>
        </div>
      )}
      <h3 className="inline-hint-head">{iconize(t("pl.condition"))} <Hint>{iconize(t("pl.dayFormHint"))}</Hint></h3>
      {/* Each part with what it does to the rating on the day, and the result at the bottom. */}
      <dl className="kv bars">
        {pos !== p.position && <><dt>{iconize(t("pl.playsAs"))}</dt><dd><PosBadge pos={p.position} /> <span className="muted">→</span> <PosBadge pos={pos} /> <Effect factor={d.position} /></dd></>}
        {d.gear >= 0.5 && <><dt>{iconize(t("gear.equipment"))}</dt><dd><span className="effect-pct up">+{Math.round(d.gear)}</span></dd></>}
        <dt>{iconize(t("col.form"))}</dt><dd><FormArrow form={p.form} size={20} /> <Effect factor={d.form} /></dd>
        <dt>{iconize(t("col.fitness"))}</dt><dd><Bar value={p.fitness} /> <Effect factor={d.fitness} /></dd>
        <dt>{iconize(t("pl.morale"))}</dt><dd><Bar value={p.morale} /> <Effect factor={d.morale} /></dd>
        <dt>{iconize(t("pl.sharpness"))}</dt><dd><Bar value={p.sharpness} /> <Effect factor={d.sharpness} /></dd>
        <dt>{iconize(t("col.happiness"))}</dt><dd><Bar value={p.happiness} /> <Face value={p.happiness} /> <Effect factor={d.attitude} /></dd>
        <dt>{iconize(t("pl.relation"))}</dt><dd><Bar value={p.relation} /></dd>
        <dt className="strong">{iconize(t("pl.dayForm"))}</dt>
        <dd className="day-form">{Math.round(d.base - d.gear)} <span className="muted">→</span> <strong>{Math.round(effectiveRating(p, pos))}</strong></dd>
      </dl>

      {factors.length > 0 && (
        <ul className="factors">
          {factors.map((f) => (
            <li key={f.key} className={f.value >= 0 ? "pos-factor" : "neg-factor"}>
              {f.value > 0 ? "+" : ""}{f.value} {iconize(tx(`happy.${f.key}`))}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ContractInfo({player: p}: {player: Player}) {
  const {t, money} = useT();
  const game = useGameState();
  const notify = useGame((s) => s.notify);
  const setNegotiation = useGame((s) => s.setNegotiation);
  if (!p.clubId) return null;
  const known = isKnown(game, p);
  // Our own player (not one out on loan): the contract can be talked over right here.
  const ours = p.clubId === game.userClubId && !p.loan;
  // Our player whose contract runs out at the end of this season: warned about, so it is not forgotten.
  const expiring = p.clubId === game.userClubId && p.contract.expiresSeason <= game.season;
  const negotiate = () => {
    const neg = startNegotiation(game, p.id, game.userClubId, "renewal");
    if ("refused" in neg) notify(neg.refused, {name: shortName(p)}, "error");
    else setNegotiation(neg);
  };
  return (
    <Fold title={<><Icon name="pen" size={20} /> {iconize(t("pl.contract"))}{expiring && <span className="fold-warn"> <Icon name="warn" size={16} /> {t("pl.expiresSoon")}</span>}</>}>
      <dl className="kv">
        <dt>{iconize(t("col.value"))}</dt><dd>{money(p.value)}</dd>
        {known && <><dt>{iconize(t("col.wage"))}</dt><dd>{money(p.contract.wage)} {iconize(t("common.perWeek"))}</dd></>}
        <dt>{iconize(t("pl.expires"))}</dt><dd className={expiring ? "fold-warn" : undefined}>{p.contract.expiresSeason}</dd>
        {known && <><dt>{iconize(t("col.role"))}</dt><dd>{iconize(t(`role.${p.contract.role}`))}</dd></>}
        {known && p.contract.releaseClause !== null && <><dt>{iconize(t("pl.releaseClause"))}</dt><dd>{money(p.contract.releaseClause)}</dd></>}
        {p.loan && <><dt>{iconize(t("pl.loan"))}</dt><dd>{game.clubs[p.loan.parentClubId].name} → {game.clubs[p.clubId].name}</dd></>}
      </dl>
      {ours && <button className="btn small" onClick={negotiate}><Icon name="pen" size={16} /> {iconize(t("pl.discussContract"))}</button>}
    </Fold>
  );
}

const STAT_LABELS = {morale: "pl.morale", sharpness: "pl.sharpness", form: "col.form", happiness: "col.happiness", relation: "pl.relation"} as const;

/** One stat that went up after a present: the bar rises from where it was, with a +N floating up beside it. */
function GainRow({label, from, to, delay}: {label: string; from: number; to: number; delay: number}) {
  const [now, setNow] = useState(from);
  useEffect(() => {
    const timer = window.setTimeout(() => setNow(to), 250 + delay);
    return () => window.clearTimeout(timer);
  }, [to, delay]);
  return (
    <li className="gain-row">
      <span className="gain-label">{label}</span>
      <span className="gain-bar"><span className="gain-fill" style={{width: `${now}%`}} /></span>
      <strong className="gain-plus" style={{animationDelay: `${250 + delay}ms`}}>+{Math.round(to - from)}</strong>
    </li>
  );
}

function OwnActions({player: p}: {player: Player}) {
  const {t, tx} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  const setNegotiation = useGame((s) => s.setNegotiation);
  if (p.loan && p.clubId !== game.userClubId) return <p className="muted">{iconize(t("pl.awayOnLoan"))}</p>;
  const talkedThisWeek = game.absWeek - p.lastTalkWeek < 1;
  // The dialog for a bonus or a present.
  const [giving, setGiving] = useState(false);
  // After a present: what went up (from, to), shown with the bars rising.
  const [gained, setGained] = useState<{id: GiftId; variant?: string; stats: {key: "morale" | "sharpness" | "form" | "happiness" | "relation"; from: number; to: number}[]} | null>(null);
  // The present being looked at: its effect shows on the bars at the top.
  const [looking, setLooking] = useState<GiftId | null>(null);
  // The present picked (a click picks it, the buy button gives it: two clicks, so no one is bought by mistake).
  const [picked, setPicked] = useState<GiftId | null>(null);
  // The colour chosen for each present (the usual one until changed).
  const [colours, setColours] = useState<Record<string, string>>({});
  const colourOf = (id: string) => colours[id] ?? GIFT_VARIANTS[id]?.[0];
  const stepColour = (id: string, d: number) => {
    const all = GIFT_VARIANTS[id];
    if (all) setColours({...colours, [id]: all[(all.indexOf(colourOf(id)) + d + all.length) % all.length]});
  };
  const {money} = useT();
  const give = (id: GiftId) => {
    const before = {morale: p.morale, sharpness: p.sharpness, form: p.form, happiness: p.happiness, relation: p.relation};
    const key = act((g) => giveGift(g, p.id, id, colourOf(id)));
    if (key !== "talk.bonus.paid") return notify(key, {name: shortName(p), gift: t(`gift.${id}`)}, "error");
    const gift = GIFTS.find((x) => x.id === id)!;
    const up = (k: keyof typeof before) => ({key: k, from: before[k], to: Math.min(100, before[k] + gift[k])});
    setGained({id, variant: colourOf(id), stats: [up("morale"), up("sharpness"), ...(gift.form > 0 ? [up("form")] : []), up("happiness"), up("relation")]});
    notify(key, {name: shortName(p), gift: t(`gift.${id}`)}, "good");
  };
  const closeGifts = () => {
    setGiving(false);
    setGained(null);
    setPicked(null);
    setLooking(null);
  };

  const talk = (kind: (typeof TALKS)[number]) => {
    const key = act((g, rng) => talkToPlayer(g, rng, p.id, kind));
    notify(key, {name: shortName(p)}, key.endsWith("good") || key.endsWith("works") || key.endsWith("made") ? "good" : "info");
  };

  const negotiate = () => {
    const neg = startNegotiation(game, p.id, game.userClubId, "renewal");
    if ("refused" in neg) notify(neg.refused, {name: shortName(p)}, "error");
    else setNegotiation(neg);
  };

  return (
    <div className="actions-panel">
      {p.wantsToLeave && !p.transferListed && (
        <div className="callout warn">
          <p>{iconize(t("pl.wantsOut", {name: shortName(p)}))}</p>
          <button className="btn" onClick={() => act((g) => answerTransferRequest(g, p.id, true))}>{iconize(t("pl.acceptRequest"))}</button>
          <button className="btn" onClick={() => act((g) => answerTransferRequest(g, p.id, false))}>{iconize(t("pl.rejectRequest"))}</button>
        </div>
      )}
      <Fold title={<><Icon name="chat" size={20} /> {iconize(t("pl.talk"))}</>}>
      <div className="btn-row">
        {TALKS.map((k) => (
          <button key={k} className="btn" disabled={talkedThisWeek} onClick={() => talk(k)}>{iconize(t(`talk.${k}`))}</button>
        ))}
        <button className="btn" disabled={talkedThisWeek} onClick={() => setGiving(true)}><Icon name="coins" size={18} /> {iconize(t("talk.bonus"))}</button>
        <button className="btn" onClick={negotiate}><Icon name="pen" size={18} /> {iconize(t("pl.discussContract"))}</button>
      </div>
      {talkedThisWeek && <p className="muted small">{iconize(tx("talk.tooSoon"))}</p>}
      {giving && (
        <Modal title={<><Icon name="coins" size={20} /> {iconize(t("talk.bonus.title", {name: shortName(p)}))}</>} onClose={closeGifts}>
          {gained ? (
            <div className="gift-result">
              <div className="gift-result-art"><GiftPicture id={gained.id} variant={gained.variant} width={110} /></div>
              <ul className="gift-gains">
                {gained.stats.map((st, i) => (
                  <GainRow key={st.key} label={t(STAT_LABELS[st.key])} from={st.from} to={st.to} delay={i * 220} />
                ))}
              </ul>
              <div className="btn-row dialog-actions">
                <button className="btn primary" onClick={closeGifts}>{iconize(t("pack.great"))}</button>
              </div>
            </div>
          ) : (
          <>
          <div className="gift-hint-row">
            <span className="muted small">{iconize(t("talk.bonus.pick"))}</span>
            <Hint inline>{iconize(t("talk.bonus.hint"))}</Hint>
          </div>
          {/* How they are now, and what the present you are looking at would add. */}
          <ul className="gift-preview">
            {(["morale", "sharpness", "form", "happiness", "relation"] as const).map((k) => {
              const shown = picked ?? looking;
              const add = shown ? GIFTS.find((g) => g.id === shown)![k] : 0;
              const now = p[k];
              return (
                <li key={k} className="pv-row">
                  <span className="pv-label">{t(STAT_LABELS[k])}</span>
                  <span className="pv-bar">
                    <span className="pv-now" style={{width: `${now}%`}} />
                    {add > 0 && <span className="pv-add" style={{left: `${now}%`, width: `${Math.min(add, 100 - now)}%`}} />}
                  </span>
                  <span className="pv-num">{Math.round(now)}{add > 0 && <strong className="pos-num"> +{Math.min(add, Math.round(100 - now))}</strong>}</span>
                </li>
              );
            })}
          </ul>
          <ul className="gift-list" onMouseLeave={() => setLooking(null)}>
            {GIFTS.map((g) => (
              <li key={g.id} className="gift-item">
                <button className={`${picked === g.id ? "gift picked" : "gift"}${GIFT_VARIANTS[g.id] ? " has-colours" : ""}`} aria-pressed={picked === g.id} disabled={game.clubs[game.userClubId].cash < g.cost || (g.id === "mansion" && hasMansion(p))} onClick={() => setPicked(picked === g.id ? null : g.id)} onMouseEnter={() => setLooking(g.id)} onFocus={() => setLooking(g.id)} onBlur={() => setLooking(null)}>
                  <span className="gift-icon"><GiftPicture id={g.id} variant={colourOf(g.id)} width={74} /></span>
                  <span className="gift-name">
                    <strong>{iconize(t(`gift.${g.id}`))}</strong>
                    {/* What it changes: morale, match sharpness, satisfaction and the bond with the manager. */}
                    {g.id === "mansion" ? <small className="muted gift-effects"><span>{hasMansion(p) ? t("gift.mansionOwned") : t("gift.mansionNote")}</span></small> : (<small className="muted gift-effects"><span>{t("pl.morale")} +{g.morale}</span><span>{t("pl.sharpness")} +{g.sharpness}</span>{g.form > 0 && <span>{t("col.form")} +{g.form}</span>}<span>{t("col.happiness")} +{g.happiness}</span><span>{t("pl.relation")} +{g.relation}</span></small>)}
                  </span>
                  <span className="gift-price">{money(g.cost)}</span>
                </button>
                {/* The colour: the little arrows under the picture go through them. */}
                {GIFT_VARIANTS[g.id] && (
                  <span className="gift-arrows" title={t(`gift.v.${colourOf(g.id)}` as TKey)}>
                    <button type="button" aria-label={t("gift.prevColour")} onClick={() => stepColour(g.id, -1)}><Icon name="chevron" size={18} /></button>
                    <button type="button" aria-label={t("gift.nextColour")} onClick={() => stepColour(g.id, 1)}><Icon name="chevron" size={18} /></button>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div className="btn-row dialog-actions">
            <button className="btn primary" disabled={!picked} onClick={() => picked && give(picked)}>
              <Icon name="coins" size={18} /> {picked ? iconize(t("talk.bonus.buy", {gift: t(`gift.${picked}` as TKey), price: GIFTS.find((g) => g.id === picked)!.cost})) : iconize(t("talk.bonus.pick"))}
            </button>
          </div>
          </>
          )}
        </Modal>
      )}
      {game.promises.filter((pr) => pr.playerId === p.id).map((pr) => (
        <p key={pr.id} className="muted small"><Icon name="handshake" size={18} /> {iconize(t("pl.promiseStatus", {starts: pr.starts, required: pr.requiredStarts, left: pr.matchesLeft}))}</p>
      ))}
      </Fold>

      <Fold title={<><Icon name="trend" size={20} /> {iconize(t("pl.development"))}{p.individualFocus && <span className="fold-count"> ({p.individualFocus === "rest" ? t("train.rest") : t(`attr.${p.individualFocus}`)})</span>}</>}>
      <div className="field inline">
        <span>{iconize(t("pl.individualFocus"))}</span>
        <FocusPicker player={p} />
      </div>
      </Fold>

      <Fold title={<><Icon name="tag" size={20} /> {iconize(t("pl.market"))}</>}>
      <div className="btn-row">
        <label className="toggle">
          <input type="checkbox" checked={p.transferListed} onChange={(e) => act((g) => { g.players[p.id].transferListed = e.target.checked; })} />
          {iconize(t("pl.transferList"))}
        </label>
        <label className="toggle">
          <input type="checkbox" checked={p.loanListed} onChange={(e) => act((g) => { g.players[p.id].loanListed = e.target.checked; })} />
          {iconize(t("pl.loanList"))}
        </label>
      </div>
      <QuickSale player={p} />
      <div className="btn-row"><SellToFriend player={p} /></div>
      </Fold>

      <LookEditor player={p} />
    </div>
  );
}

/** A heading that folds its part of the profile open and shut (shut to start with). */
function Fold({title, children, open = false}: {title: ReactNode; children: ReactNode; open?: boolean}) {
  return (
    <details className="pm-fold" open={open}>
      <summary><h3>{title}</h3></summary>
      <div className="pm-fold-body">{children}</div>
    </details>
  );
}

/** Change how one of your players looks: the manager's look editor, drawn in the club's kit. */
function LookEditor({player: p}: {player: Player}) {
  const {t} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const club = p.clubId ? game.clubs[p.clubId] : null;
  if (!club) return null;
  const keeper = p.position === "GK";
  const draw = (look: ManagerLook, size: number) => <KitAvatar look={lookFromEditor(p, look)} keeper={keeper} shirt={club.color} trim={club.color2} size={size} />;
  const set = (look: ManagerLook) =>
    act((g) => {
      g.players[p.id].look = {skin: look.skin, hair: look.hair, style: look.style, beard: look.beard, eyes: look.eyes, glasses: look.glasses, lashes: look.lashes, highlights: look.highlights, shape: look.shape, ears: look.ears, browStyle: look.browStyle, headband: look.headband};
    });
  return (
    <Fold title={<><Icon name="palette" size={20} /> {iconize(t("pl.look"))}</>}>
      <ManagerEditor look={editableLook(p)} onChange={set} draw={draw} noSuit />
      {p.look && (
        <button className="btn small" onClick={() => act((g) => { delete g.players[p.id].look; })}><Icon name="undo" size={18} /> {iconize(t("pl.lookReset"))}</button>
      )}
    </Fold>
  );
}

/** Sell now to the club that pays most, for less than waiting for bids would bring. Asks first. */
/** Sell at once to the best offer, asked once more. `onSold`: what to do after (e.g. close a pack). */
export function QuickSale({player: p, onSold, confirmNow}: {player: Player; onSold?: () => void; /** Already past the first button (after a pack the choice to sell was just made): straight to the price to confirm. */ confirmNow?: boolean}) {
  const {t, money} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  const openPlayer = useGame((s) => s.openPlayer);
  const [sure, setSure] = useState(!!confirmNow);
  if (p.clubId !== game.userClubId || p.loan) return null;
  const offer = quickSaleOffer(game, p.id);
  if (!offer) return <p className="muted small">{iconize(t("pl.noBuyer"))}</p>;
  const club = game.clubs[offer.clubId].name;
  const sell = () => {
    const from = pressedElement();
    const err = act((g) => quickSell(g, p.id));
    if (err) return notify(err, undefined, "error");
    notify("toast.sold", {name: shortName(p), club, fee: offer.fee}, "good");
    if (offer.fee > 0) moneyBurst(from, money(offer.fee));
    openPlayer(null);
    onSold?.();
  };
  return (
    <div className="quick-sale">
      <p className="muted small">{iconize(t("pl.quickSaleHint", {club, fee: money(offer.fee)}))}</p>
      {sure ? (
        <div className="btn-row dialog-actions">
          <button className="btn" onClick={() => setSure(false)}>{iconize(t("common.cancel"))}</button>
          <button className="btn primary" onClick={sell}>{iconize(t("pl.quickSaleYes", {fee: money(offer.fee)}))}</button>
        </div>
      ) : (
        <button className="btn" onClick={() => setSure(true)}><Icon name="coins" size={18} /> {iconize(t("pl.quickSale"))}</button>
      )}
    </div>
  );
}

const UPFRONT = [1, 0.5, 0.25];
const INSTALLMENTS = [0, 26, 52];

function MarketActions({player: p}: {player: Player}) {
  const {t, tx, money} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  const setNegotiation = useGame((s) => s.setNegotiation);
  const user = game.clubs[game.userClubId];
  const asking = askingPrice(game, p);
  const [fee, setFee] = useState(() => Math.max(10_000, Math.round(asking * 0.85 / 10_000) * 10_000));
  const [upfront, setUpfront] = useState(1);
  const [weeks, setWeeks] = useState(26);
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<BidResult | null>(null);
  // The answer takes a moment, shown as waiting on the button, so a click is never missed.
  const [waiting, setWaiting] = useState(false);
  const answerRef = useRef<HTMLDivElement>(null);
  const [wageShare, setWageShare] = useState(0.75);
  const known = isKnown(game, p);
  const scouting = game.scoutQueue.includes(p.id);
  const overBudget = fee > user.transferBudget;

  const scout = (instant: boolean) => {
    const err = act((g) => scoutPlayer(g, p.id, instant));
    if (err) notify(err, undefined, "error");
    else notify(instant ? "toast.scouted" : "toast.scoutOrdered", {name: shortName(p)}, "good");
  };

  const toContract = (agreedFee: number) => {
    const neg = startNegotiation(game, p.id, game.userClubId, p.clubId ? "transfer" : "freeAgent", agreedFee);
    if ("refused" in neg) {
      notify(neg.refused, {name: shortName(p)}, "error");
      return;
    }
    neg.upfrontShare = upfront;
    neg.installmentWeeks = upfront < 1 ? weeks : 0;
    setNegotiation(neg);
  };

  const bid = (amount: number) => {
    if (waiting) return;
    setWaiting(true);
    setResult(null);
    setTimeout(() => {
      const r = evaluateBid(game, {playerId: p.id, fee: amount, upfrontShare: upfront, installmentWeeks: upfront < 1 ? weeks : 0}, round);
      setRound((n) => n + 1);
      setResult(r);
      setWaiting(false);
      if (r.status === "accepted") toContract(amount);
      else setTimeout(() => answerRef.current?.scrollIntoView({block: "nearest", behavior: "smooth"}), 50);
    }, 900);
  };

  const loan = () => {
    if (!evaluateLoanRequest(game, p.id, wageShare)) {
      notify("tr.loanRefused", {name: shortName(p)}, "error");
      return;
    }
    act((g) => completeLoan(g, p.id, g.userClubId, wageShare));
    notify("tr.loanDone", {name: shortName(p)}, "good");
  };

  return (
    <div className="actions-panel">
      <h3>{iconize(t("pl.scouting"))}</h3>
      {known ? (
        <p className="muted"><Icon name="check" size={18} /> {iconize(t("pl.scouted"))}</p>
      ) : (
        <div className="btn-row">
          <button className="btn" disabled={scouting} onClick={() => scout(false)}>
            🔍 {scouting ? t("pl.scoutingNow") : t("pl.scout", {cost: SCOUT_COST})}
          </button>
          <button className="btn" onClick={() => scout(true)}><Icon name="bolt" size={18} /> {iconize(t("pl.scoutInstant", {cost: DIAMONDS_SCOUT_COST}))}</button>
        </div>
      )}

      {!p.clubId ? (
        <>
          <h3>{iconize(t("pl.freeAgent"))}</h3>
          <button className="btn primary" onClick={() => toContract(0)}><Icon name="pen" size={18} /> {iconize(t("pl.offerContract"))}</button>
        </>
      ) : (
        <>
          <h3>{iconize(t("pl.makeBid"))}</h3>
          <p className="muted">{iconize(t("pl.askingHint", {price: asking}))} · {iconize(t("fin.transferBudget"))}: {money(user.transferBudget)}</p>
          <div className="form-grid">
            <label className="field">
              <span>{iconize(t("pl.fee"))}</span>
              <NumberInput step={10_000} value={fee} onChange={setFee} />
            </label>
            <label className="field">
              <span>{iconize(t("pl.upfront"))}</span>
              <select value={upfront} onChange={(e) => setUpfront(Number(e.target.value))}>
                {UPFRONT.map((u) => <option key={u} value={u}>{Math.round(u * 100)} %</option>)}
              </select>
            </label>
            {upfront < 1 && (
              <label className="field">
                <span>{iconize(t("pl.installments"))}</span>
                <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
                  {INSTALLMENTS.filter((w) => w > 0).map((w) => <option key={w} value={w}>{iconize(t("pl.weeks", {n: w}))}</option>)}
                </select>
              </label>
            )}
          </div>
          {overBudget && <p className="callout error">{iconize(t("pl.overTransferBudget"))}</p>}
          <div className="btn-row">
            <button className="btn primary" disabled={overBudget || fee <= 0 || waiting} onClick={() => bid(fee)}>{waiting ? <><span className="spinner" aria-hidden /> {iconize(t("common.agentThinking"))}</> : <>{iconize(t("pl.sendBid"))} ({money(fee)})</>}</button>
          </div>
          <div ref={answerRef} />
          {result?.status === "counter" && (
            <div className="callout fresh" key={round}>
              <p>{iconize(t("pl.counter", {club: game.clubs[p.clubId].name, fee: result.fee}))}</p>
              <button className="btn" disabled={result.fee > user.transferBudget} onClick={() => { setFee(result.fee); bid(result.fee); }}>
                {iconize(t("pl.acceptCounter"))}
              </button>
            </div>
          )}
          {result?.status === "rejected" && <p className="callout error fresh" key={round}>{iconize(tx(result.reason))}</p>}
          {result?.status === "accepted" && <p className="callout good fresh">{iconize(t("pl.bidAccepted"))}</p>}

          <h3>{iconize(t("pl.loanIn"))}</h3>
          <div className="btn-row">
            <select value={wageShare} onChange={(e) => setWageShare(Number(e.target.value))} aria-label={t("pl.wageShare")}>
              {[0.25, 0.5, 0.75, 1].map((s) => <option key={s} value={s}>{iconize(t("pl.payWage", {pct: Math.round(s * 100)}))}</option>)}
            </select>
            <button className="btn" disabled={!!p.loan} onClick={loan}><Icon name="swap" size={18} /> {iconize(t("pl.requestLoan"))}</button>
          </div>
          <p className="muted small">{iconize(t("pl.loanHint"))}</p>
        </>
      )}
    </div>
  );
}
