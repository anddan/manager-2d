// The national team: the country's best players (whatever club they play for), picked automatically for
// the formation and mood the manager chooses. A few friendlies a year, and the Euros / World Cup in the
// last weeks of the season in their years.
import {iconize} from "../Icon";
import {nationalKit, nationalSquad, nextNationalWeek, tournamentOf} from "../../game/national";
import {FORMATION_IDS, MENTALITIES, type FormationId, type Mentality} from "../../game/types";
import type {TKey} from "../../i18n";
import {useT} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Card, Empty, Flag, Hint} from "../common";
import {LineupSheet} from "../LineupSheet";
import {fullName} from "../../game/helpers";

export function National() {
  const {t} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const openPlayer = useGame((s) => s.openPlayer);
  const job = game.national;
  if (!job) return <Card title={t("nav.national")}><Empty>{iconize(t("national.none"))}</Empty></Card>;
  const kit = nationalKit(job.country);
  const squad = nationalSquad(game, job.country, job.formation);
  const next = nextNationalWeek(game);
  const tournament = tournamentOf(game.season);
  const sheet = {name: t(`nat.${job.country}` as TKey), color: kit.color, color2: kit.color2, formation: job.formation, mentality: job.mentality, lineup: squad.lineup, bench: squad.bench};
  return (
    <div className="grid">
      <Card
        title={<><Flag code={job.country} size={22} /> {iconize(t("national.title", {country: `nat.${job.country}`}))}</>}
        actions={<button className="btn small" onClick={() => act((g) => { g.national = undefined; })}>{iconize(t("national.leave"))}</button>}
      >
        <Hint>{iconize(t("national.hint"))}</Hint>
        <div className="tac-pickers">
          <label className="field">
            <span>{iconize(t("tac.formation"))}</span>
            <select value={job.formation} onChange={(e) => act((g) => { g.national!.formation = e.target.value as FormationId; })}>
              {FORMATION_IDS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <label className="field">
            <span>{iconize(t("tac.mentality"))}</span>
            <select value={job.mentality} onChange={(e) => act((g) => { g.national!.mentality = e.target.value as Mentality; })}>
              {MENTALITIES.map((m) => <option key={m} value={m}>{t(`tac.${m}` as TKey)}</option>)}
            </select>
          </label>
        </div>
        <p className="muted small">
          {next ? iconize(t(next.what === "friendly" ? "national.next" : "national.nextTournament", {week: next.week, comp: `national.comp.${next.what}`})) : iconize(t("national.noMore"))}
          {tournament && !next?.what.match(/wc|ec/) ? " " + iconize(t("national.tournamentYear", {comp: `national.comp.${tournament}`})) : ""}
        </p>
        <LineupSheet club={sheet} player={(id) => game.players[id]} onPick={(p) => openPlayer(p.id)} />
      </Card>
      <Card title={iconize(t("national.results"))}>
        {job.results.length === 0 ? (
          <Empty>{iconize(t("national.noResults"))}</Empty>
        ) : (
          <ul className="plain-list national-results">
            {job.results.map((r, i) => (
              <li key={i}>
                <span className="muted small">{r.season} · {iconize(t(`national.what.${r.what}` as TKey))}</span>
                <strong><Flag code={job.country} size={16} /> {r.goals[0]}–{r.goals[1]}{r.pens ? ` (${r.pens[0]}–${r.pens[1]})` : ""} <Flag code={r.opponent} size={16} /></strong>
                {r.scorers.length > 0 && <span className="muted small">{r.scorers.map((id) => (game.players[id] ? fullName(game.players[id]) : "")).filter(Boolean).join(", ")}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
