import {TICKET_ADJUST, TICKET_PRICE, crowdFor, fairPrice, operatingCost, sumLines} from "../../game/finance";
import {BoardWarningBanner} from "../BoardWarning";
import {fixtureWeek, userClub} from "../../game/helpers";
import {wageBill} from "../../game/ratings";
import {FINANCE_CATEGORIES, type FinanceLines} from "../../game/types";
import {useT} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Card, Empty, NumberInput} from "../common";

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
        <dl className="kv">
          <dt>{t("fin.cash")}</dt><dd className={club.cash < 0 ? "neg" : ""}>{money(club.cash)}</dd>
          <dt>{t("fin.transferBudget")}</dt><dd>{money(club.transferBudget)}</dd>
          <dt>{t("fin.wageBudget")}</dt><dd>{money(club.wageBudget)} {t("common.perWeek")}</dd>
          <dt>{t("fin.wageBill")}</dt><dd className={bill > club.wageBudget ? "neg" : ""}>{money(bill)} {t("common.perWeek")}</dd>
        </dl>
      </Card>

      <Card title={t("fin.stadium")}>
        <dl className="kv">
          <dt>{t("fin.capacity")}</dt><dd>{club.capacity.toLocaleString()}</dd>
          <dt>{t("fin.priceMode")}</dt>
          <dd>
            <button className={`switch ${club.ticketAuto ? "on" : ""}`} role="switch" aria-checked={!!club.ticketAuto} onClick={toggleAuto}>
              <span className="switch-track" aria-hidden><span className="switch-knob" /></span>
              {club.ticketAuto ? t("fin.priceAuto") : t("fin.priceManual")}
            </button>
          </dd>
          <dt>{t("fin.ticketPrice")}</dt>
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
          {nextHome && <dt>{t("fin.nextHome")}</dt>}
          {nextHome && (
            <dd>
              {t("fin.vsOpponent", {opponent: game.clubs[nextHome.awayId].name})}
              {crowd.appeal >= 1.3 && <span className="big-match"> ⭐ {t("fin.bigMatch")}</span>}
            </dd>
          )}
          <dt>{t("fin.attendance")}</dt>
          <dd className={crowd.rate >= 0.995 ? "pos" : crowd.rate < 0.6 ? "neg" : ""}>
            {t("fin.crowd", {fans: crowd.fans, pct: Math.round(crowd.rate * 100)})}{crowd.rate >= 0.995 ? ` · ${t("match.soldOut")}` : ""}
          </dd>
          <dt>{t("fin.perHomeGame")}</dt><dd>{money(crowd.fans * crowd.price)}</dd>
          <dt>{t("fin.fairPrice")}</dt><dd>{money(fair)}</dd>
          <dt>{t("fin.sponsor")}</dt><dd>{money(club.sponsorWeekly)} {t("common.perWeek")}</dd>
          <dt>{t("fin.operations")}</dt><dd>{money(-operatingCost(club))} {t("common.perWeek")}</dd>
        </dl>
        <p className="muted small">{club.ticketAuto && <>{t("fin.autoHint")} </>}{t("fin.crowdHint")}</p>
      </Card>

      <Card title={last ? t("fin.lastWeek", {week: last.week}) : t("fin.lastWeekEmpty")}>
        {last ? <Lines lines={last.lines} /> : <Empty>{t("fin.noReport")}</Empty>}
      </Card>

      <Card title={t("fin.season", {season: game.season})}>
        <Lines lines={game.finance.season} />
      </Card>

      {club.installments.length > 0 && (
        <Card title={t("fin.installments")}>
          <ul className="plain-list">
            {club.installments.map((i, n) => (
              <li key={n}>{t("fin.installmentRow", {club: game.clubs[i.toClubId].name, amount: i.amount, weeks: i.weeksLeft})}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card title={t("fin.history")} className="span-2">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>{t("fin.week")}</th><th>{t("fin.income")}</th><th>{t("fin.expenses")}</th><th>{t("fin.net")}</th></tr>
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

function Lines({lines}: {lines: FinanceLines}) {
  const {t, money} = useT();
  const s = sumLines(lines);
  const rows = FINANCE_CATEGORIES.filter((c) => lines[c]);
  if (rows.length === 0) return <Empty>{t("fin.noReport")}</Empty>;
  return (
    <dl className="kv">
      {rows.map((c) => (
        <div key={c} className="kv-row">
          <dt>{t(`cat.${c}`)}</dt>
          <dd className={(lines[c] ?? 0) >= 0 ? "pos-num" : "neg"}>{money(lines[c] ?? 0)}</dd>
        </div>
      ))}
      <div className="kv-row total">
        <dt>{t("fin.net")}</dt>
        <dd className={s.net >= 0 ? "pos-num" : "neg"}>{money(s.net)}</dd>
      </div>
    </dl>
  );
}
