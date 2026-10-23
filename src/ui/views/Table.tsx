import {standings} from "../../game/league";
import {useT} from "../../i18n";
import {useGameState} from "../../store";
import {Card} from "../common";

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
                <th>#</th><th>{t("tbl.club")}</th>
                <th title={t("tbl.playedLong")}>{t("tbl.played")}</th>
                <th title={t("tbl.wonLong")}>{t("tbl.won")}</th>
                <th title={t("tbl.drawnLong")}>{t("tbl.drawn")}</th>
                <th title={t("tbl.lostLong")}>{t("tbl.lost")}</th>
                <th>{t("tbl.goals")}</th>
                <th title={t("tbl.gdLong")}>{t("tbl.gd")}</th>
                <th>{t("tbl.points")}</th>
                <th>{t("tbl.form")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.club.id} className={r.club.id === game.userClubId ? "me" : ""}>
                  <td>{i + 1}</td>
                  <td className="name-cell"><span className="crest tiny" style={{background: r.club.color}} /> {r.club.name}</td>
                  <td>{r.played}</td>
                  <td>{r.won}</td>
                  <td>{r.drawn}</td>
                  <td>{r.lost}</td>
                  <td>{r.goalsFor}:{r.goalsAgainst}</td>
                  <td>{r.goalsFor - r.goalsAgainst > 0 ? "+" : ""}{r.goalsFor - r.goalsAgainst}</td>
                  <td className="strong">{r.points}</td>
                  <td className="form-row">{r.form.map((f, j) => <span key={j} className={`form-dot form-${f}`}>{tx(`form.${f}`)}</span>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {game.history.length > 0 && (
        <Card title={t("tbl.history")}>
          <ul className="plain-list">
            {game.history.slice().reverse().map((h) => (
              <li key={h.season}>{t("tbl.historyRow", {season: h.season, champion: game.clubs[h.championId]?.name ?? "?", position: h.userPosition})}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
