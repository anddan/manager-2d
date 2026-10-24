import {CUP_STAGES} from "../../game/cup";
import {isCupFixture, nextUserFixture, userClub} from "../../game/helpers";
import {leaguePosition, standings} from "../../game/league";
import {clubPlayers, teamOvr, wageBill} from "../../game/ratings";
import {useT} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Card, Empty, Face, PlayerLink} from "../common";

export function Overview() {
  const {t, tx, money} = useT();
  const game = useGameState();
  const setView = useGame((s) => s.setView);
  const watchMatch = useGame((s) => s.watchMatch);
  const club = userClub(game);
  const next = nextUserFixture(game);
  const position = leaguePosition(game, club.id);
  const squad = clubPlayers(game, club.id);
  const injured = squad.filter((p) => p.injuryWeeks > 0 || p.suspension > 0);
  const unhappy = squad.filter((p) => p.happiness < 40).sort((a, b) => a.happiness - b.happiness);
  const lastReport = game.reports[0];
  const table = standings(game);
  const row = table.find((r) => r.club.id === club.id)!;
  const bill = wageBill(game, club.id);

  return (
    <div className="grid">
      <Card title={t("ov.nextMatch")}>
        {next ? (
          <div className="next-match">
            <Team id={next.homeId} />
            <span className="vs">{isCupFixture(next) ? `🏆 ${t("cup.name")} · ${t(CUP_STAGES[next.stage])}` : t("ov.round", {round: next.round})}</span>
            <Team id={next.awayId} />
            <p className="muted">
              {next.homeId === club.id ? t("ov.home") : t("ov.away")} · {t(matchup(teamOvr(game, club.id) - teamOvr(game, next.homeId === club.id ? next.awayId : next.homeId)))}
            </p>
            <button className="btn" onClick={() => setView("tactics")}>📋 {t("nav.tactics")}</button>
          </div>
        ) : (
          <Empty>{t("ov.noMatch")}</Empty>
        )}
      </Card>

      <Card title={t("ov.league")} actions={<button className="btn small" onClick={() => setView("table")}>{t("common.more")}</button>}>
        <div className="big-number">{position}<small>/{table.length}</small></div>
        <p className="muted">{t("ov.record", {w: row.won, d: row.drawn, l: row.lost, pts: row.points})}</p>
        <div className="form-row">{row.form.map((f, i) => <span key={i} className={`form-dot form-${f}`}>{tx(`form.${f}`)}</span>)}</div>
      </Card>

      <Card title={t("ov.lastMatch")}>
        {lastReport ? (
          <div className="last-match">
            <p className="score-line">
              {game.clubs[lastReport.homeId].name} <strong>{lastReport.homeGoals} – {lastReport.awayGoals}</strong> {game.clubs[lastReport.awayId].name}
            </p>
            <button className="btn small" onClick={() => watchMatch(lastReport.fixtureId)}>▶ {t("fx.watch")}</button>
          </div>
        ) : (
          <Empty>{t("ov.noMatchYet")}</Empty>
        )}
      </Card>

      <Card title={t("ov.economy")} actions={<button className="btn small" onClick={() => setView("finance")}>{t("common.more")}</button>}>
        <dl className="kv">
          <dt>{t("fin.cash")}</dt><dd>{money(club.cash)}</dd>
          <dt>{t("fin.transferBudget")}</dt><dd>{money(club.transferBudget)}</dd>
          <dt>{t("fin.wageBill")}</dt><dd className={bill > club.wageBudget ? "neg" : ""}>{money(bill)} / {money(club.wageBudget)}</dd>
        </dl>
      </Card>

      <Card title={t("ov.unavailable")}>
        {injured.length === 0 ? <Empty>{t("ov.allFit")}</Empty> : (
          <ul className="plain-list">
            {injured.map((p) => (
              <li key={p.id}>
                <PlayerLink player={p} />{" "}
                <span className="muted">{p.injuryWeeks > 0 ? t("status.injured", {weeks: p.injuryWeeks}) : t("status.suspended")}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t("ov.mood")}>
        {unhappy.length === 0 ? <Empty>{t("ov.allHappy")}</Empty> : (
          <ul className="plain-list">
            {unhappy.slice(0, 6).map((p) => (
              <li key={p.id}><Face value={p.happiness} /> <PlayerLink player={p} /></li>
            ))}
          </ul>
        )}
        <p className="muted small">{t("ov.squadSize", {n: squad.length})}</p>
      </Card>
    </div>
  );
}

/** How the two teams compare, by team OVR. */
function matchup(diff: number): "ov.even" | "ov.favourite" | "ov.underdog" {
  return Math.abs(diff) <= 2 ? "ov.even" : diff > 0 ? "ov.favourite" : "ov.underdog";
}

function Team({id}: {id: string}) {
  const {t} = useT();
  const game = useGameState();
  const c = game.clubs[id];
  return (
    <div className="team">
      <span className="crest big" style={{background: c.color, color: c.color2}}>{c.short}</span>
      <span>{c.name}</span>
      <span className="team-ovr">{t("tac.teamOvr")} <strong>{teamOvr(game, id)}</strong></span>
    </div>
  );
}
