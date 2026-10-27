import {listName} from "../../game/helpers";
import {iconize} from "../Icon";
import {standings} from "../../game/league";
import type {GameState, Player} from "../../game/types";
import {useT, type TKey} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Card} from "../common";

/** The season's leaders in the league's clubs, best first (ties: fewer games). */
function leaders(game: GameState, value: (p: Player) => number): Player[] {
  return Object.values(game.players)
    .filter((p) => p.clubId && game.clubs[p.clubId] && !game.clubs[p.clubId].guest && value(p) > 0)
    .sort((a, b) => value(b) - value(a) || a.stats.apps - b.stats.apps)
    .slice(0, 10);
}

/** A top-ten list: rank, player (opens their profile), club, and the number. */
function Leaders({title, players, value, show}: {title: TKey; players: Player[]; value: (p: Player) => number; show?: (p: Player) => string}) {
  const {t} = useT();
  const game = useGameState();
  const openPlayer = useGame((s) => s.openPlayer);
  return (
    <Card title={t(title)}>
      {players.length === 0 ? (
        <p className="muted">{iconize(t("tbl.noneYet"))}</p>
      ) : (
        <table className="table leaders">
          <tbody>
            {players.map((p, i) => {
              const club = game.clubs[p.clubId!];
              return (
                <tr key={p.id} className={p.clubId === game.userClubId ? "me" : ""}>
                  <td className="num">{i + 1}</td>
                  <td className="name-cell">
                    <span className="crest tiny" style={{background: club.color}} title={club.name} />
                    <button className="link" onClick={() => openPlayer(p.id)}>{listName(p)}</button>
                  </td>
                  <td className="muted small">{club.short}</td>
                  <td className="num strong">{show ? show(p) : value(p)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}

export function Table() {
  const {t, tx} = useT();
  const game = useGameState();
  const rows = standings(game);

  return (
    <div className="grid">
      <Card title={`${game.leagueName} ${game.season}`} className="span-2">
        <div className="table-wrap">
          <table className="table league">
            <thead>
              <tr>
                <th>#</th><th>{iconize(t("tbl.club"))}</th>
                <th title={t("tbl.playedLong")}>{iconize(t("tbl.played"))}</th>
                <th title={t("tbl.wonLong")}>{iconize(t("tbl.won"))}</th>
                <th title={t("tbl.drawnLong")}>{iconize(t("tbl.drawn"))}</th>
                <th title={t("tbl.lostLong")}>{iconize(t("tbl.lost"))}</th>
                <th>{iconize(t("tbl.goals"))}</th>
                <th title={t("tbl.gdLong")}>{iconize(t("tbl.gd"))}</th>
                <th>{iconize(t("tbl.points"))}</th>
                <th>{iconize(t("tbl.form"))}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.club.id} className={r.club.id === game.userClubId ? "me" : ""}>
                  <td className="num">{i + 1}</td>
                  <td className="name-cell"><span className="crest tiny" style={{background: r.club.color}} /> {r.club.name}</td>
                  <td className="num">{r.played}</td>
                  <td className="num">{r.won}</td>
                  <td className="num">{r.drawn}</td>
                  <td className="num">{r.lost}</td>
                  <td className="num">{r.goalsFor}:{r.goalsAgainst}</td>
                  <td className="num">{r.goalsFor - r.goalsAgainst > 0 ? "+" : ""}{r.goalsFor - r.goalsAgainst}</td>
                  <td className="num strong">{r.points}</td>
                  <td><div className="form-row">{r.form.map((f, j) => <span key={j} className={`form-dot form-${f}`}>{iconize(tx(`form.${f}`))}</span>)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Leaders title="tbl.scorers" players={leaders(game, (p) => p.stats.goals)} value={(p) => p.stats.goals} />
      <Leaders title="tbl.assists" players={leaders(game, (p) => p.stats.assists)} value={(p) => p.stats.assists} />
      {/* A red counts as three yellows when ranking. */}
      <Leaders
        title="tbl.cards"
        players={leaders(game, (p) => p.stats.yellow + p.stats.red * 3)}
        value={(p) => p.stats.yellow + p.stats.red * 3}
        show={(p) => `🟨 ${p.stats.yellow}${p.stats.red ? `  🟥 ${p.stats.red}` : ""}`}
      />
      {game.history.length > 0 && (
        <Card title={t("tbl.history")}>
          <ul className="plain-list">
            {game.history.slice().reverse().map((h) => (
              <li key={h.season}>{iconize(t("tbl.historyRow", {season: h.season, champion: game.clubs[h.championId]?.name ?? "?", position: h.userPosition}))}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
