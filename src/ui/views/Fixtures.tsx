import {useState} from "react";
import {ROUNDS} from "../../game/constants";
import {currentRound} from "../../game/helpers";
import {useT} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Card} from "../common";

export function Fixtures() {
  const {t} = useT();
  const game = useGameState();
  const watchMatch = useGame((s) => s.watchMatch);
  const [onlyMine, setOnlyMine] = useState(true);
  const now = currentRound(game) ?? 0;
  const rounds = Array.from({length: ROUNDS}, (_, i) => i + 1);

  return (
    <Card
      title={t("nav.fixtures")}
      actions={
        <label className="toggle">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> {t("fx.onlyMine")}
        </label>
      }
    >
      <div className="fixture-list">
        {rounds.map((round) => {
          const fixtures = game.fixtures.filter(
            (f) => f.round === round && (!onlyMine || f.homeId === game.userClubId || f.awayId === game.userClubId)
          );
          return (
            <div key={round} className={round === now ? "round current" : "round"}>
              <h3>{t("ov.round", {round})}</h3>
              {fixtures.map((f) => {
                const mine = f.homeId === game.userClubId || f.awayId === game.userClubId;
                const report = game.reports.find((r) => r.fixtureId === f.id);
                const home = game.clubs[f.homeId];
                const away = game.clubs[f.awayId];
                const ours = f.homeId === game.userClubId ? f.homeGoals : f.awayGoals;
                const theirs = f.homeId === game.userClubId ? f.awayGoals : f.homeGoals;
                const result = f.played && mine ? (ours > theirs ? "W" : ours === theirs ? "D" : "L") : "";
                return (
                  <div key={f.id} className={`fixture ${mine ? "mine" : ""}`}>
                    <span className="fx-team home">{home.name} <span className="crest tiny" style={{background: home.color}} /></span>
                    <span className={`fx-score ${result ? `form-${result}` : ""}`}>{f.played ? `${f.homeGoals} – ${f.awayGoals}` : "–"}</span>
                    <span className="fx-team away"><span className="crest tiny" style={{background: away.color}} /> {away.name}</span>
                    {report && <button className="btn small" onClick={() => watchMatch(f.id)}>▶</button>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
