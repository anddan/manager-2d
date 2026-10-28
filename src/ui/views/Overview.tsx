import {CUP_STAGES} from "../../game/cup";
import {Icon, iconize} from "../Icon";
import {ClubCrest, TeamOvr} from "../LineupSheet";
import {BoardWarningBanner} from "../BoardWarning";
import {isCupFixture, nextUserFixture, userClub} from "../../game/helpers";
import {leaguePosition, standings} from "../../game/league";
import {clubPlayers, teamOvr, wageBill} from "../../game/ratings";
import {useT} from "../../i18n";
import {DailyTasks} from "../DailyTasks";
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
      <BoardWarningBanner />
      <DailyTasks />
      <Card title={t("ov.nextMatch")}>
        {next ? (
          <div className="ov-next">
            {/* What it is first, a little bigger: the cup round or the league round. */}
            <div className="ov-next-what">{isCupFixture(next) ? <><Icon name="trophy" size={20} /> {iconize(t("cup.name"))} · {iconize(t(CUP_STAGES[next.stage]))}</> : t("ov.round", {round: next.round})}</div>
            <Team id={next.homeId} />
            <span className="vs">–</span>
            <Team id={next.awayId} />
            <p className="muted">
              {next.homeId === club.id ? t("ov.home") : t("ov.away")} · {iconize(t(matchup(teamOvr(game, club.id) - teamOvr(game, next.homeId === club.id ? next.awayId : next.homeId))))}
            </p>
            <button className="btn" onClick={() => setView("tactics")}><Icon name="clipboard" size={18} /> {iconize(t("nav.tactics"))}</button>
          </div>
        ) : (
          <Empty>{iconize(t("ov.noMatch"))}</Empty>
        )}
      </Card>

      <Card title={t("ov.league")} actions={<button className="btn small" onClick={() => setView("table")}>{iconize(t("common.more"))}</button>}>
        <div className="big-number">{position}<small>/{table.length}</small></div>
        <p className="muted">{iconize(t("ov.record", {w: row.won, d: row.drawn, l: row.lost, pts: row.points}))}</p>
        <div className="form-row">{row.form.map((f, i) => <span key={i} className={`form-dot form-${f}`}>{iconize(tx(`form.${f}`))}</span>)}</div>
      </Card>

      <Card title={t("ov.lastMatch")}>
        {lastReport ? (
          <div className="last-match">
            <p className="score-line">
              {game.clubs[lastReport.homeId].name} <strong>{lastReport.homeGoals} – {lastReport.awayGoals}</strong> {game.clubs[lastReport.awayId].name}
            </p>
            <button className="btn small" onClick={() => watchMatch(lastReport.fixtureId)}><Icon name="play" size={18} /> {iconize(t("fx.watch"))}</button>
          </div>
        ) : (
          <Empty>{iconize(t("ov.noMatchYet"))}</Empty>
        )}
      </Card>

      <Card title={t("ov.economy")} actions={<button className="btn small" onClick={() => setView("finance")}>{iconize(t("common.more"))}</button>}>
        <dl className="kv">
          <dt>{iconize(t("fin.cash"))}</dt><dd>{money(club.cash)}</dd>
          <dt>{iconize(t("fin.transferBudget"))}</dt><dd>{money(club.transferBudget)}</dd>
          <dt>{iconize(t("fin.wageBill"))}</dt><dd className={bill > club.wageBudget ? "neg" : ""}>{money(bill)} / {money(club.wageBudget)}</dd>
        </dl>
      </Card>

      <Card title={t("ov.unavailable")}>
        {injured.length === 0 ? <Empty>{iconize(t("ov.allFit"))}</Empty> : (
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
        {unhappy.length === 0 ? <Empty>{iconize(t("ov.allHappy"))}</Empty> : (
          <ul className="plain-list">
            {unhappy.slice(0, 6).map((p) => (
              <li key={p.id}><Face value={p.happiness} /> <PlayerLink player={p} /></li>
            ))}
          </ul>
        )}
        <p className="muted small">{iconize(t("ov.squadSize", {n: squad.length}))}</p>
      </Card>
    </div>
  );
}

/** How the two teams compare, by team OVR. */
function matchup(diff: number): "ov.even" | "ov.favourite" | "ov.underdog" {
  return Math.abs(diff) <= 2 ? "ov.even" : diff > 0 ? "ov.favourite" : "ov.underdog";
}

function Team({id}: {id: string}) {
  const game = useGameState();
  const c = game.clubs[id];
  return (
    <div className="team">
      <ClubCrest clubId={id} className="crest big" />
      <span>{c.name}</span>
      <TeamOvr clubId={id} />
    </div>
  );
}
