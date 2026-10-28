// Player details. Own players: condition, mood, talks, focus, listing.
// Others: scouting, bids, loans and free-agent offers.
import {Icon, iconize} from "./Icon";
import {useState, type ReactNode} from "react";
import {profileName, shortName} from "../game/helpers";
import {DIAMONDS_SCOUT_COST, SCOUT_COST} from "../game/constants";
import {startNegotiation} from "../game/contracts";
import {happinessFactors, answerTransferRequest, talkToPlayer, TALKS} from "../game/morale";
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
import {ATTRIBUTES, type ManagerLook, type Player} from "../game/types";
import {useT} from "../i18n";
import {useGame, useGameState} from "../store";
import {Bar, Delta, Face, Flag, FormArrow, Modal, NumberInput, Ovr, PosBadge, StatusIcons} from "./common";
import {PlayerCard} from "./PlayerCard";
import {KitAvatar, editableLook, lookFromEditor} from "./Avatar";
import {ManagerEditor} from "./ManagerEditor";
import {GearCard, GearPanel} from "./Gear";
import {FocusPicker} from "./FocusPicker";
import {SellToFriend} from "./FriendSale";
import {totalGearBonus} from "../game/gear";

/**
 * A player's profile. With `preview` it only shows them (a friend's player for sale, lent into
 * the game for the look): no actions of its own, the given buttons at the bottom instead.
 */
export function PlayerModal({playerId, preview}: {playerId: string; preview?: {onClose: () => void; footer: ReactNode}}) {
  const {t} = useT();
  const game = useGameState();
  const openPlayer = useGame((s) => s.openPlayer);
  const slot = useGame((s) => s.profileSlot);
  const act = useGame((s) => s.act);
  const p = game.players[playerId];
  if (!p) return null;
  const own = !preview && (p.clubId === game.userClubId || p.loan?.parentClubId === game.userClubId);
  const known = !!preview || isKnown(game, p);
  const club = p.clubId ? game.clubs[p.clubId] : null;
  // Boots or gloves on: their bonus shown beside the attribute.
  const gear = totalGearBonus(p);
  // Opened from their spot in the tactics: they can be taken out of it from here.
  const inSpot = !preview && slot !== null && game.clubs[game.userClubId].lineup[slot] === p.id;
  const takeOut = () => {
    act((g) => {
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
        <PlayerCard game={game} player={p} />
        <div className="player-head">
          <dl className="pm-facts">
            <div className="pm-fact"><dt>{iconize(t("pl.position"))}</dt><dd><PosBadge pos={p.position} /></dd></div>
            <div className="pm-fact" title={t("col.ovrHint")}><dt>{iconize(t("col.ovr"))}</dt><dd className="strong"><Ovr game={game} player={p} /></dd></div>
            <div className="pm-fact"><dt>{iconize(t("pl.nation"))}</dt><dd><Flag code={p.nationality} named size={18} /></dd></div>
            <div className="pm-fact"><dt>{iconize(t("col.age"))}</dt><dd>{iconize(t("pl.age", {age: p.age}))}</dd></div>
            <div className="pm-fact wide"><dt>{iconize(t("pl.club"))}</dt><dd>{club ? club.name : t("pl.freeAgent")}</dd></div>
          </dl>
          {own && <Nickname key={p.id} player={p} />}
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
          {own && <Condition player={p} />}
          {/* The kit (boots, gloves, shin guards), before the statistics. */}
          {own && p.clubId === game.userClubId && (
            <Fold title={<><Icon name="shirt" size={20} /> {iconize(t("gear.equipment"))}</>}>
              <GearPanel player={p} />
            </Fold>
          )}
          {/* A player looked at before buying: what kit they come with (just to see). */}
          {!own && (p.gear || p.shin) && (
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
              <dt>{iconize(t("pl.cards"))}</dt><dd>🟨 {p.stats.yellow} 🟥 {p.stats.red}</dd>
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

function Condition({player: p}: {player: Player}) {
  const {t, tx} = useT();
  const game = useGameState();
  const factors = happinessFactors(game, p);
  return (
    <>
      <h3>{iconize(t("pl.condition"))}</h3>
      <dl className="kv bars">
        <dt>{iconize(t("col.form"))}</dt><dd><FormArrow form={p.form} size={20} /></dd>
        <dt>{iconize(t("col.fitness"))}</dt><dd><Bar value={p.fitness} /></dd>
        <dt>{iconize(t("pl.morale"))}</dt><dd><Bar value={p.morale} /></dd>
        <dt>{iconize(t("pl.sharpness"))}</dt><dd><Bar value={p.sharpness} /></dd>
        <dt>{iconize(t("col.happiness"))}</dt><dd><Bar value={p.happiness} /> <Face value={p.happiness} /></dd>
        <dt>{iconize(t("pl.relation"))}</dt><dd><Bar value={p.relation} /></dd>
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
  const negotiate = () => {
    const neg = startNegotiation(game, p.id, game.userClubId, "renewal");
    if ("refused" in neg) notify(neg.refused, {name: shortName(p)}, "error");
    else setNegotiation(neg);
  };
  return (
    <Fold title={<><Icon name="pen" size={20} /> {iconize(t("pl.contract"))}</>}>
      <dl className="kv">
        <dt>{iconize(t("col.value"))}</dt><dd>{money(p.value)}</dd>
        {known && <><dt>{iconize(t("col.wage"))}</dt><dd>{money(p.contract.wage)} {iconize(t("common.perWeek"))}</dd></>}
        <dt>{iconize(t("pl.expires"))}</dt><dd>{p.contract.expiresSeason}</dd>
        {known && <><dt>{iconize(t("col.role"))}</dt><dd>{iconize(t(`role.${p.contract.role}`))}</dd></>}
        {known && p.contract.releaseClause !== null && <><dt>{iconize(t("pl.releaseClause"))}</dt><dd>{money(p.contract.releaseClause)}</dd></>}
        {p.loan && <><dt>{iconize(t("pl.loan"))}</dt><dd>{game.clubs[p.loan.parentClubId].name} → {game.clubs[p.clubId].name}</dd></>}
      </dl>
      {ours && <button className="btn small" onClick={negotiate}><Icon name="pen" size={16} /> {iconize(t("pl.discussContract"))}</button>}
    </Fold>
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
        <button className="btn" onClick={negotiate}><Icon name="pen" size={18} /> {iconize(t("pl.discussContract"))}</button>
      </div>
      {talkedThisWeek && <p className="muted small">{iconize(tx("talk.tooSoon"))}</p>}
      {game.promises.filter((pr) => pr.playerId === p.id).map((pr) => (
        <p key={pr.id} className="muted small"><Icon name="handshake" size={18} /> {iconize(t("pl.promiseStatus", {starts: pr.starts, required: pr.requiredStarts, left: pr.matchesLeft}))}</p>
      ))}
      </Fold>

      <Fold title={<><Icon name="trend" size={20} /> {iconize(t("pl.development"))}</>}>
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
      g.players[p.id].look = {skin: look.skin, hair: look.hair, style: look.style, beard: look.beard, eyes: look.eyes, glasses: look.glasses, lashes: look.lashes};
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
export function QuickSale({player: p, onSold}: {player: Player; onSold?: () => void}) {
  const {t, money} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  const openPlayer = useGame((s) => s.openPlayer);
  const [sure, setSure] = useState(false);
  if (p.clubId !== game.userClubId || p.loan) return null;
  const offer = quickSaleOffer(game, p.id);
  if (!offer) return <p className="muted small">{iconize(t("pl.noBuyer"))}</p>;
  const club = game.clubs[offer.clubId].name;
  const sell = () => {
    const err = act((g) => quickSell(g, p.id));
    if (err) return notify(err, undefined, "error");
    notify("toast.sold", {name: shortName(p), club, fee: offer.fee}, "good");
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
    const r = evaluateBid(game, {playerId: p.id, fee: amount, upfrontShare: upfront, installmentWeeks: upfront < 1 ? weeks : 0}, round);
    setRound(round + 1);
    setResult(r);
    if (r.status === "accepted") toContract(amount);
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
            <button className="btn primary" disabled={overBudget || fee <= 0} onClick={() => bid(fee)}>{iconize(t("pl.sendBid"))} ({money(fee)})</button>
          </div>
          {result?.status === "counter" && (
            <div className="callout">
              <p>{iconize(t("pl.counter", {club: game.clubs[p.clubId].name, fee: result.fee}))}</p>
              <button className="btn" disabled={result.fee > user.transferBudget} onClick={() => { setFee(result.fee); bid(result.fee); }}>
                {iconize(t("pl.acceptCounter"))}
              </button>
            </div>
          )}
          {result?.status === "rejected" && <p className="callout error">{iconize(tx(result.reason))}</p>}
          {result?.status === "accepted" && <p className="callout good">{iconize(t("pl.bidAccepted"))}</p>}

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
