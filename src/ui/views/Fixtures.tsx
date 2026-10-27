import {useState} from "react";
import type {ReactNode} from "react";
import {Icon, iconize} from "../Icon";
import {CUP_WEEKS, SEASON_WEEKS} from "../../game/constants";
import {CUP_STAGES, cupAlive} from "../../game/cup";
import {cupFixturesInStage, isCupFixture, roundInWeek} from "../../game/helpers";
import type {Fixture} from "../../game/types";
import {useT} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Card} from "../common";
import {FlagIcon} from "../Flag";

/** One week in the calendar: a league round or a Champions Cup round. */
interface Matchday {
  week: number;
  title: ReactNode;
  fixtures: Fixture[];
  /** A cup round not drawn yet, that the user is still in. */
  toBeDrawn?: boolean;
}

/**
 * The season as a calendar, league rounds and cup weeks together. What's
 * coming is on top, the next match first; below it what's been played,
 * newest first.
 */
export function Fixtures() {
  const {t} = useT();
  const game = useGameState();
  const [onlyMine, setOnlyMine] = useState(true);
  const mine = (f: Fixture) => f.homeId === game.userClubId || f.awayId === game.userClubId;
  const inCup = cupAlive(game).includes(game.userClubId);

  const days: Matchday[] = [];
  for (let week = 1; week <= SEASON_WEEKS; week++) {
    const round = roundInWeek(week);
    const stage = CUP_WEEKS.indexOf(week);
    if (round !== null) {
      days.push({week, title: t("ov.round", {round}), fixtures: game.fixtures.filter((f) => f.round === round && (!onlyMine || mine(f)))});
    } else if (stage >= 0) {
      const all = cupFixturesInStage(game, stage);
      days.push({
        week,
        title: <><Icon name="trophy" size={18} /> {iconize(t("cup.name"))} · {iconize(t(CUP_STAGES[stage]))}</>,
        fixtures: all.filter((f) => !onlyMine || mine(f)),
        toBeDrawn: all.length === 0 && inCup,
      });
    }
  }
  const shown = days.filter((d) => d.fixtures.length > 0 || d.toBeDrawn);
  const upcoming = shown.filter((d) => d.week >= game.week);
  const played = shown.filter((d) => d.week < game.week).reverse();
  const next = upcoming.find((d) => d.fixtures.some(mine) || d.toBeDrawn);

  const day = (d: Matchday) => (
    <div key={d.week} className={d === next ? "round current" : "round"}>
      <h3>
        {d.title} <small className="muted">· {iconize(t("cup.week", {week: d.week}))}</small>
        {d === next && <span className="next-tag">{d.week === game.week ? t("fx.thisWeek") : t("fx.next")}</span>}
      </h3>
      {d.toBeDrawn && d.fixtures.length === 0 && <p className="muted small">{iconize(t("fx.toBeDrawn"))}</p>}
      {d.fixtures.map((f) => <FixtureRow key={f.id} f={f} />)}
    </div>
  );

  return (
    <>
      <Card
        title={t("nav.fixtures")}
        actions={
          <label className="toggle">
            <input type="checkbox" className="bench-check" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> {iconize(t("fx.onlyMine"))}
          </label>
        }
      >
        <div className="fixture-list">
          {upcoming.length === 0 && <p className="muted">{iconize(t("fx.seasonDone"))}</p>}
          {upcoming.map(day)}
          {played.length > 0 && <h4 className="fx-divider">{iconize(t("fx.played"))}</h4>}
          {played.map(day)}
        </div>
      </Card>
    </>
  );
}

export function FixtureRow({f}: {f: Fixture}) {
  const {t} = useT();
  const game = useGameState();
  const watchMatch = useGame((s) => s.watchMatch);
  const mine = f.homeId === game.userClubId || f.awayId === game.userClubId;
  const report = game.reports.find((r) => r.fixtureId === f.id);
  const home = game.clubs[f.homeId];
  const away = game.clubs[f.awayId];
  if (!home || !away) return null;
  const cup = isCupFixture(f) ? f : undefined;
  // Level after the match: the shoot-out decides it.
  const won = cup?.winnerId ? cup.winnerId === game.userClubId : (f.homeId === game.userClubId ? f.homeGoals : f.awayGoals) > (f.homeId === game.userClubId ? f.awayGoals : f.homeGoals);
  const level = f.homeGoals === f.awayGoals && !cup?.winnerId;
  const result = f.played && mine ? (won ? "W" : level ? "D" : "L") : "";
  const flag = (c: typeof home) => (c.country ? <FlagIcon code={c.country} size={14} /> : null);
  return (
    <div className={`fixture ${mine ? "mine" : ""}`}>
      <span className="fx-team home">{flag(home)} {home.name} <span className="crest tiny" style={{background: home.color}} /></span>
      <span className={`fx-score ${result ? `form-${result}` : ""}`}>
        {f.played ? `${f.homeGoals} – ${f.awayGoals}` : "–"}
        {cup?.penalties && <small className="fx-pens">{iconize(t("fx.penalties", {h: cup.penalties[0], a: cup.penalties[1]}))}</small>}
      </span>
      <span className="fx-team away"><span className="crest tiny" style={{background: away.color}} /> {away.name} {flag(away)}</span>
      {report && <button className="btn small" onClick={() => watchMatch(f.id)}>▶</button>}
    </div>
  );
}
