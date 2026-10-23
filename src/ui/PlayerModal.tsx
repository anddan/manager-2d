// Player details. Own players: condition, mood, talks, focus, listing.
// Others: scouting, bids, loans and free-agent offers.
import {useState} from "react";
import {DIAMONDS_SCOUT_COST, SCOUT_COST} from "../game/constants";
import {startNegotiation} from "../game/contracts";
import {happinessFactors, answerTransferRequest, talkToPlayer, TALKS} from "../game/morale";
import {
  askingPrice,
  completeLoan,
  evaluateBid,
  evaluateLoanRequest,
  isKnown,
  scoutPlayer,
  type BidResult,
} from "../game/transfers";
import {ATTRIBUTES, type Player} from "../game/types";
import {useT} from "../i18n";
import {useGame, useGameState} from "../store";
import {Bar, Delta, Face, Flag, Modal, Ovr, Pot, PosBadge, StatusIcons} from "./common";
import {PlayerCard} from "./PlayerCard";

export function PlayerModal({playerId}: {playerId: string}) {
  const {t} = useT();
  const game = useGameState();
  const openPlayer = useGame((s) => s.openPlayer);
  const p = game.players[playerId];
  if (!p) return null;
  const own = p.clubId === game.userClubId || p.loan?.parentClubId === game.userClubId;
  const known = isKnown(game, p);
  const club = p.clubId ? game.clubs[p.clubId] : null;

  return (
    <Modal wide onClose={() => openPlayer(null)} title={<><Flag code={p.nationality} /> {p.firstName} {p.lastName} <StatusIcons player={p} /></>}>
      <div className="player-top">
        <PlayerCard game={game} player={p} />
        <div className="player-head">
          <PosBadge pos={p.position} />
          <span>{t("pl.age", {age: p.age})}</span>
          <span>{club ? club.name : t("pl.freeAgent")}</span>
          <span className="rating-pill">{t("col.ovr")} <Ovr game={game} player={p} /></span>
          <span className="rating-pill">{t("col.pot")} <Pot game={game} player={p} /></span>
        </div>
      </div>

      <div className="player-grid">
        <section>
          <h3>{t("pl.attributes")}</h3>
          <table className="attr-table">
            <thead>
              <tr><th /><th /><th title={t("pl.lastWeek")}>{t("pl.week")}</th><th title={t("pl.thisSeason")}>{t("pl.season")}</th></tr>
            </thead>
            <tbody>
              {ATTRIBUTES.map((a) => (
                <tr key={a}>
                  <td>{t(`attr.${a}`)}</td>
                  <td className="num strong">{known ? Math.round(p.attrs[a]) : "?"}</td>
                  <td>{known && <Delta value={p.weeklyChange[a]} digits={2} />}</td>
                  <td>{known && <Delta value={p.attrs[a] - p.seasonStartAttrs[a]} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          {own && <Condition player={p} />}
          <h3>{t("pl.stats")}</h3>
          <dl className="kv">
            <dt>{t("pl.apps")}</dt><dd>{p.stats.apps} ({p.stats.starts})</dd>
            <dt>{t("pl.goals")}</dt><dd>{p.stats.goals}</dd>
            <dt>{t("pl.assists")}</dt><dd>{p.stats.assists}</dd>
            <dt>{t("pl.cards")}</dt><dd>🟨 {p.stats.yellow} 🟥 {p.stats.red}</dd>
            <dt>{t("pl.avgRating")}</dt><dd>{p.stats.apps ? (p.stats.ratingSum / p.stats.apps).toFixed(2) : "–"}</dd>
          </dl>
          <ContractInfo player={p} />
        </section>
      </div>

      {own ? <OwnActions player={p} /> : <MarketActions player={p} />}
    </Modal>
  );
}

function Condition({player: p}: {player: Player}) {
  const {t, tx} = useT();
  const game = useGameState();
  const factors = happinessFactors(game, p);
  return (
    <>
      <h3>{t("pl.condition")}</h3>
      <dl className="kv bars">
        <dt>{t("col.form")}</dt><dd><Bar value={p.form} /></dd>
        <dt>{t("col.fitness")}</dt><dd><Bar value={p.fitness} /></dd>
        <dt>{t("pl.morale")}</dt><dd><Bar value={p.morale} /></dd>
        <dt>{t("pl.sharpness")}</dt><dd><Bar value={p.sharpness} /></dd>
        <dt>{t("col.happiness")}</dt><dd><Bar value={p.happiness} /> <Face value={p.happiness} /></dd>
        <dt>{t("pl.relation")}</dt><dd><Bar value={p.relation} /></dd>
      </dl>
      {factors.length > 0 && (
        <ul className="factors">
          {factors.map((f) => (
            <li key={f.key} className={f.value >= 0 ? "pos-factor" : "neg-factor"}>
              {f.value > 0 ? "+" : ""}{f.value} {tx(`happy.${f.key}`)}
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
  if (!p.clubId) return null;
  const known = isKnown(game, p);
  return (
    <>
      <h3>{t("pl.contract")}</h3>
      <dl className="kv">
        <dt>{t("col.value")}</dt><dd>{money(p.value)}</dd>
        {known && <><dt>{t("col.wage")}</dt><dd>{money(p.contract.wage)} {t("common.perWeek")}</dd></>}
        <dt>{t("pl.expires")}</dt><dd>{p.contract.expiresSeason}</dd>
        {known && <><dt>{t("col.role")}</dt><dd>{t(`role.${p.contract.role}`)}</dd></>}
        {known && p.contract.releaseClause !== null && <><dt>{t("pl.releaseClause")}</dt><dd>{money(p.contract.releaseClause)}</dd></>}
        {p.loan && <><dt>{t("pl.loan")}</dt><dd>{game.clubs[p.loan.parentClubId].name} → {game.clubs[p.clubId].name}</dd></>}
      </dl>
    </>
  );
}

function OwnActions({player: p}: {player: Player}) {
  const {t, tx} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  const setNegotiation = useGame((s) => s.setNegotiation);
  if (p.loan && p.clubId !== game.userClubId) return <p className="muted">{t("pl.awayOnLoan")}</p>;
  const talkedThisWeek = game.absWeek - p.lastTalkWeek < 1;

  const talk = (kind: (typeof TALKS)[number]) => {
    const key = act((g, rng) => talkToPlayer(g, rng, p.id, kind));
    notify(key, {name: p.lastName}, key.endsWith("good") || key.endsWith("works") || key.endsWith("made") ? "good" : "info");
  };

  const negotiate = () => {
    const neg = startNegotiation(game, p.id, game.userClubId, "renewal");
    if ("refused" in neg) notify(neg.refused, {name: p.lastName}, "error");
    else setNegotiation(neg);
  };

  return (
    <div className="actions-panel">
      {p.wantsToLeave && !p.transferListed && (
        <div className="callout warn">
          <p>{t("pl.wantsOut", {name: p.lastName})}</p>
          <button className="btn" onClick={() => act((g) => answerTransferRequest(g, p.id, true))}>{t("pl.acceptRequest")}</button>
          <button className="btn" onClick={() => act((g) => answerTransferRequest(g, p.id, false))}>{t("pl.rejectRequest")}</button>
        </div>
      )}
      <h3>{t("pl.talk")}</h3>
      <div className="btn-row">
        {TALKS.map((k) => (
          <button key={k} className="btn" disabled={talkedThisWeek} onClick={() => talk(k)}>{t(`talk.${k}`)}</button>
        ))}
        <button className="btn" onClick={negotiate}>✍️ {t("pl.discussContract")}</button>
      </div>
      {talkedThisWeek && <p className="muted small">{tx("talk.tooSoon")}</p>}
      {game.promises.filter((pr) => pr.playerId === p.id).map((pr) => (
        <p key={pr.id} className="muted small">🤝 {t("pl.promiseStatus", {starts: pr.starts, required: pr.requiredStarts, left: pr.matchesLeft})}</p>
      ))}

      <h3>{t("pl.development")}</h3>
      <label className="field inline">
        <span>{t("pl.individualFocus")}</span>
        <select
          value={p.individualFocus ?? ""}
          onChange={(e) => act((g) => { g.players[p.id].individualFocus = (e.target.value || null) as Player["individualFocus"]; })}
        >
          <option value="">{t("common.none")}</option>
          {ATTRIBUTES.map((a) => <option key={a} value={a}>{t(`attr.${a}`)}</option>)}
        </select>
      </label>

      <h3>{t("pl.market")}</h3>
      <div className="btn-row">
        <label className="toggle">
          <input type="checkbox" checked={p.transferListed} onChange={(e) => act((g) => { g.players[p.id].transferListed = e.target.checked; })} />
          {t("pl.transferList")}
        </label>
        <label className="toggle">
          <input type="checkbox" checked={p.loanListed} onChange={(e) => act((g) => { g.players[p.id].loanListed = e.target.checked; })} />
          {t("pl.loanList")}
        </label>
      </div>
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
    else notify(instant ? "toast.scouted" : "toast.scoutOrdered", {name: p.lastName}, "good");
  };

  const toContract = (agreedFee: number) => {
    const neg = startNegotiation(game, p.id, game.userClubId, p.clubId ? "transfer" : "freeAgent", agreedFee);
    if ("refused" in neg) {
      notify(neg.refused, {name: p.lastName}, "error");
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
      notify("tr.loanRefused", {name: p.lastName}, "error");
      return;
    }
    act((g) => completeLoan(g, p.id, g.userClubId, wageShare));
    notify("tr.loanDone", {name: p.lastName}, "good");
  };

  return (
    <div className="actions-panel">
      <h3>{t("pl.scouting")}</h3>
      {known ? (
        <p className="muted">✅ {t("pl.scouted")}</p>
      ) : (
        <div className="btn-row">
          <button className="btn" disabled={scouting} onClick={() => scout(false)}>
            🔍 {scouting ? t("pl.scoutingNow") : t("pl.scout", {cost: SCOUT_COST})}
          </button>
          <button className="btn" onClick={() => scout(true)}>⚡ {t("pl.scoutInstant", {cost: DIAMONDS_SCOUT_COST})}</button>
        </div>
      )}

      {!p.clubId ? (
        <>
          <h3>{t("pl.freeAgent")}</h3>
          <button className="btn primary" onClick={() => toContract(0)}>✍️ {t("pl.offerContract")}</button>
        </>
      ) : (
        <>
          <h3>{t("pl.makeBid")}</h3>
          <p className="muted">{t("pl.askingHint", {price: asking})} · {t("fin.transferBudget")}: {money(user.transferBudget)}</p>
          <div className="form-grid">
            <label className="field">
              <span>{t("pl.fee")}</span>
              <input type="number" min={0} step={10_000} value={fee} onChange={(e) => setFee(Math.max(0, Number(e.target.value)))} />
            </label>
            <label className="field">
              <span>{t("pl.upfront")}</span>
              <select value={upfront} onChange={(e) => setUpfront(Number(e.target.value))}>
                {UPFRONT.map((u) => <option key={u} value={u}>{Math.round(u * 100)} %</option>)}
              </select>
            </label>
            {upfront < 1 && (
              <label className="field">
                <span>{t("pl.installments")}</span>
                <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
                  {INSTALLMENTS.filter((w) => w > 0).map((w) => <option key={w} value={w}>{t("pl.weeks", {n: w})}</option>)}
                </select>
              </label>
            )}
          </div>
          {overBudget && <p className="callout error">{t("pl.overTransferBudget")}</p>}
          <div className="btn-row">
            <button className="btn primary" disabled={overBudget || fee <= 0} onClick={() => bid(fee)}>{t("pl.sendBid")} ({money(fee)})</button>
          </div>
          {result?.status === "counter" && (
            <div className="callout">
              <p>{t("pl.counter", {club: game.clubs[p.clubId].name, fee: result.fee})}</p>
              <button className="btn" disabled={result.fee > user.transferBudget} onClick={() => { setFee(result.fee); bid(result.fee); }}>
                {t("pl.acceptCounter")}
              </button>
            </div>
          )}
          {result?.status === "rejected" && <p className="callout error">{tx(result.reason)}</p>}
          {result?.status === "accepted" && <p className="callout good">{t("pl.bidAccepted")}</p>}

          <h3>{t("pl.loanIn")}</h3>
          <div className="btn-row">
            <select value={wageShare} onChange={(e) => setWageShare(Number(e.target.value))} aria-label={t("pl.wageShare")}>
              {[0.25, 0.5, 0.75, 1].map((s) => <option key={s} value={s}>{t("pl.payWage", {pct: Math.round(s * 100)})}</option>)}
            </select>
            <button className="btn" disabled={!!p.loan} onClick={loan}>🔁 {t("pl.requestLoan")}</button>
          </div>
          <p className="muted small">{t("pl.loanHint")}</p>
        </>
      )}
    </div>
  );
}
