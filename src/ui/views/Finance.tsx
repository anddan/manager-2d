import {TICKET_ADJUST, TICKET_PRICE, crowdFor, fairPrice, operatingCost, sumLines} from "../../game/finance";
import {Icon, iconize} from "../Icon";
import {BoardWarningBanner} from "../BoardWarning";
import {fixtureWeek, userClub} from "../../game/helpers";
import {wageBill} from "../../game/ratings";
import {FINANCE_CATEGORIES, type FinanceLines} from "../../game/types";
import {useT} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Card, Empty, Modal, NumberInput, Hint} from "../common";
import {loanLeft, loanOffers, repayLoan, takeLoan} from "../../game/loans";
import {useState} from "react";

export function Finance() {
  const {t, money} = useT();
  const game = useGameState();
  const club = userClub(game);
  const last = game.finance.weeks[0];
  const bill = wageBill(game, club.id);
  const act = useGame((s) => s.act);
  const setPrice = (price: number) =>
    act((g) => {
      g.clubs[g.userClubId].ticketPrice = Math.max(TICKET_PRICE.min, Math.min(TICKET_PRICE.max, Math.round(price)));
    });
  const adjust = club.ticketAdjust ?? 0;
  const setAdjust = (pct: number) =>
    act((g) => {
      g.clubs[g.userClubId].ticketAdjust = Math.max(TICKET_ADJUST.min, Math.min(TICKET_ADJUST.max, pct));
    });
  // Switching auto off keeps the price it would have charged, as a starting point.
  const toggleAuto = () =>
    act((g) => {
      const c = g.clubs[g.userClubId];
      if (c.ticketAuto) c.ticketPrice = crowd.price;
      c.ticketAuto = !c.ticketAuto;
    });
  // The next home match, league or cup, and the crowd it would get at this price.
  const nextHome = [...game.fixtures, ...(game.cup?.fixtures ?? [])]
    .filter((f) => !f.played && f.homeId === club.id)
    .sort((a, b) => fixtureWeek(a) - fixtureWeek(b))[0];
  const crowd = crowdFor(game, club, nextHome);
  const fair = Math.round(fairPrice(club, crowd.appeal));

  return (
    <div className="grid">
      <BoardWarningBanner />
      <Card title={t("fin.overview")}>
        <Hint>
          <p>{iconize(t("fin.wageHint.what"))}</p>
          <p>{iconize(t("fin.wageHint.over"))}</p>
          <h4>{iconize(t("fin.wageHint.howTitle"))}</h4>
          <ul className="tt-help-list">
            {(["sell", "loan", "expire", "negotiate", "buy"] as const).map((k) => <li key={k}>{iconize(t(`fin.wageHint.${k}`))}</li>)}
          </ul>
        </Hint>
        <dl className="kv">
          <dt>{iconize(t("fin.cash"))}</dt><dd className={club.cash < 0 ? "neg" : ""}>{money(club.cash)}</dd>
          <dt>{iconize(t("fin.transferBudget"))}</dt><dd>{money(club.transferBudget)}</dd>
          <dt>{iconize(t("fin.wageBudget"))}</dt><dd>{money(club.wageBudget)} {iconize(t("common.perWeek"))}</dd>
          <dt>{iconize(t("fin.wageBill"))}</dt><dd className={bill > club.wageBudget ? "neg" : ""}>{money(bill)} {iconize(t("common.perWeek"))}</dd>
        </dl>
      </Card>

      <Card title={t("fin.stadium")}>
        {/* How the price works: in the (i), not in the way. */}
        <Hint>{iconize(t("fin.autoHint"))} {iconize(t("fin.manualHint"))} {iconize(t("fin.crowdHint"))}</Hint>
        <dl className="kv">
          <dt>{iconize(t("fin.capacity"))}</dt><dd>{club.capacity.toLocaleString()}</dd>
          <dt>{iconize(t("fin.priceMode"))}</dt>
          <dd>
            <button className={`switch ${club.ticketAuto ? "on" : ""}`} role="switch" aria-checked={!!club.ticketAuto} onClick={toggleAuto}>
              <span className="switch-track" aria-hidden><span className="switch-knob" /></span>
              {club.ticketAuto ? t("fin.priceAuto") : t("fin.priceManual")}
            </button>
          </dd>
          <dt>{iconize(t("fin.ticketPrice"))}</dt>
          {club.ticketAuto ? (
            <dd className="price-stepper">
              <button className="btn small" aria-label={t("fin.priceDown")} disabled={adjust <= TICKET_ADJUST.min} onClick={() => setAdjust(adjust - TICKET_ADJUST.step)}>▼</button>
              <span className="price-auto">
                <strong>{money(crowd.price)}</strong>
                <small className="muted">{adjust === 0 ? t("fin.priceBest") : `${adjust > 0 ? "+" : ""}${adjust} %`}</small>
              </span>
              <button className="btn small" aria-label={t("fin.priceUp")} disabled={adjust >= TICKET_ADJUST.max} onClick={() => setAdjust(adjust + TICKET_ADJUST.step)}>▲</button>
            </dd>
          ) : (
            <dd className="price-stepper">
              <button className="btn small" aria-label={t("fin.priceDown")} disabled={club.ticketPrice <= TICKET_PRICE.min} onClick={() => setPrice(club.ticketPrice - 1)}>▼</button>
              <NumberInput value={club.ticketPrice} min={TICKET_PRICE.min} max={TICKET_PRICE.max} ariaLabel={t("fin.ticketPrice")} onChange={setPrice} />
              <button className="btn small" aria-label={t("fin.priceUp")} disabled={club.ticketPrice >= TICKET_PRICE.max} onClick={() => setPrice(club.ticketPrice + 1)}>▲</button>
            </dd>
          )}
          {nextHome && <dt>{iconize(t("fin.nextHome"))}</dt>}
          {nextHome && (
            <dd>
              {iconize(t("fin.vsOpponent", {opponent: game.clubs[nextHome.awayId].name}))}
              {crowd.appeal >= 1.3 && <span className="big-match"> <Icon name="star" size={18} /> {iconize(t("fin.bigMatch"))}</span>}
            </dd>
          )}
          <dt>{iconize(t("fin.attendance"))}</dt>
          <dd className={crowd.rate >= 0.995 ? "pos-num" : crowd.rate < 0.6 ? "neg" : ""}>
            {iconize(t("fin.crowd", {fans: crowd.fans, pct: Math.round(crowd.rate * 100)}))}{crowd.rate >= 0.995 ? ` · ${t("match.soldOut")}` : ""}
          </dd>
          <dt>{iconize(t("fin.perHomeGame"))}</dt><dd>{money(crowd.fans * crowd.price)}</dd>
          <dt>{iconize(t("fin.fairPrice"))}</dt><dd>{money(fair)}</dd>
          <dt>{iconize(t("fin.sponsor"))}</dt><dd>{money(club.sponsorWeekly)} {iconize(t("common.perWeek"))}</dd>
          <dt>{iconize(t("fin.operations"))}</dt><dd>{money(-operatingCost(club))} {iconize(t("common.perWeek"))}</dd>
        </dl>
      </Card>

      <Card title={last ? t("fin.lastWeek", {week: last.week}) : t("fin.lastWeekEmpty")}>
        {last ? <Lines lines={last.lines} /> : <Empty>{iconize(t("fin.noReport"))}</Empty>}
      </Card>

      <Card title={t("fin.season", {season: game.season})}>
        <Lines lines={game.finance.season} />
      </Card>

      <Loans />

      {club.installments.length > 0 && (
        <Card title={t("fin.installments")}>
          <ul className="plain-list">
            {club.installments.map((i, n) => (
              <li key={n}>{iconize(t("fin.installmentRow", {club: game.clubs[i.toClubId].name, amount: i.amount, weeks: i.weeksLeft}))}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card title={t("fin.history")} className="span-2">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>{iconize(t("fin.week"))}</th><th>{iconize(t("fin.income"))}</th><th>{iconize(t("fin.expenses"))}</th><th>{iconize(t("fin.net"))}</th></tr>
            </thead>
            <tbody>
              {game.finance.weeks.map((w) => {
                const s = sumLines(w.lines);
                return (
                  <tr key={`${w.season}-${w.week}`}>
                    <td>{w.season}:{w.week}</td>
                    <td className="num pos-num">{money(s.income)}</td>
                    <td className="num neg">{money(s.expenses)}</td>
                    <td className={s.net >= 0 ? "num pos-num strong" : "num neg strong"}>{money(s.net)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/** A bank loan: three to choose from (asked once more before it's taken), or the one being paid back. */
function Loans() {
  const {t, money} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  const club = userClub(game);
  const [asking, setAsking] = useState<number | null>(null);
  const offers = loanOffers(club);
  const loan = club.loan;
  const left = loanLeft(club);
  const offer = asking === null ? undefined : offers[asking];
  const take = () => {
    if (asking === null) return;
    const err = act((g) => takeLoan(g, asking));
    setAsking(null);
    if (err) notify(err, undefined, "error");
  };
  const repay = () => {
    const err = act((g) => repayLoan(g));
    if (err) notify(err, undefined, "error");
  };
  return (
    <Card title={<><Icon name="bank" size={20} /> {iconize(t("loan.title"))}</>}>
      {loan ? (
        <>
          <dl className="kv">
            <dt>{iconize(t("loan.current"))}</dt><dd>{money(loan.amount)}</dd>
            <dt>{iconize(t("loan.weekly"))}</dt><dd className="neg">{money(-loan.weekly)} {iconize(t("common.perWeek"))}</dd>
            <dt>{iconize(t("loan.weeksLeft"))}</dt><dd>{loan.weeksLeft}</dd>
            <dt>{iconize(t("loan.left"))}</dt><dd>{money(left)}</dd>
          </dl>
          <div className="btn-row">
            <button className="btn" disabled={club.cash < left} onClick={repay}>{iconize(t("loan.repay", {left}))}</button>
          </div>
        </>
      ) : (
        <>
          <Hint>{iconize(t("loan.hint"))}</Hint>
          <div className="loan-offers">
            {offers.map((o) => (
              <button key={o.index} className="loan-offer" onClick={() => setAsking(o.index)}>
                <strong>{iconize(t("loan.offer", {amount: o.amount}))}</strong>
                <small className="muted">{iconize(t("loan.terms", {weekly: o.weekly, weeks: o.weeks, total: o.total}))}</small>
              </button>
            ))}
          </div>
        </>
      )}
      {offer && (
        <Modal compact title={<><Icon name="bank" size={20} /> {iconize(t("loan.confirmTitle"))}</>} onClose={() => setAsking(null)}>
          <p>{iconize(t("loan.confirmText", {amount: offer.amount, weekly: offer.weekly, weeks: offer.weeks, total: offer.total}))}</p>
          <div className="btn-row dialog-actions">
            <button className="btn" onClick={() => setAsking(null)}>{iconize(t("common.cancel"))}</button>
            <button className="btn primary" onClick={take}>{iconize(t("loan.take"))}</button>
          </div>
        </Modal>
      )}
    </Card>
  );
}

function Lines({lines}: {lines: FinanceLines}) {
  const {t, money} = useT();
  const s = sumLines(lines);
  const rows = FINANCE_CATEGORIES.filter((c) => lines[c]);
  if (rows.length === 0) return <Empty>{iconize(t("fin.noReport"))}</Empty>;
  return (
    <dl className="kv">
      {rows.map((c) => (
        <div key={c} className="kv-row">
          <dt>{iconize(t(`cat.${c}`))}</dt>
          <dd className={(lines[c] ?? 0) >= 0 ? "pos-num" : "neg"}>{money(lines[c] ?? 0)}</dd>
        </div>
      ))}
      <div className="kv-row total">
        <dt>{iconize(t("fin.net"))}</dt>
        <dd className={s.net >= 0 ? "pos-num" : "neg"}>{money(s.net)}</dd>
      </div>
    </dl>
  );
}
