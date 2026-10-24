import {useState} from "react";
import {CUP_FROM_LEAGUE, CUP_WEEKS, ROUNDS} from "../../game/constants";
import {CUP_STAGES} from "../../game/cup";
import {currentCupStage, currentRound, isCupFixture} from "../../game/helpers";
import type {Fixture} from "../../game/types";
import {useT} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Card} from "../common";
import {FlagIcon} from "../Flag";

export function Fixtures() {
  const {t} = useT();
  const game = useGameState();
  const [onlyMine, setOnlyMine] = useState(true);
  const now = currentRound(game) ?? 0;
  const rounds = Array.from({length: ROUNDS}, (_, i) => i + 1);
  const mine = (f: Fixture) => f.homeId === game.userClubId || f.awayId === game.userClubId;

  return (
    <>
      <CupCard />
      <Card
        title={t("nav.fixtures")}
        actions={
          <label className="toggle">
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> {t("fx.onlyMine")}
          </label>
        }
      >
        <div className="fixture-list">
          {rounds.map((round) => (
            <div key={round} className={round === now ? "round current" : "round"}>
              <h3>{t("ov.round", {round})}</h3>
              {game.fixtures.filter((f) => f.round === round && (!onlyMine || mine(f))).map((f) => <FixtureRow key={f.id} f={f} />)}
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

/** The Champions Cup: each round so far, and who's through. */
function CupCard() {
  const {t} = useT();
  const game = useGameState();
  const cup = game.cup;
  if (!cup) return null;
  const now = currentCupStage(game);
  const inIt = cup.clubIds.includes(game.userClubId);
  return (
    <Card title={`🏆 ${t("cup.name")}`}>
      {!inIt && <p className="muted">{t("cup.notIn", {n: CUP_FROM_LEAGUE})}</p>}
      {cup.winnerId && <p className="cup-winner">{t("cup.winner", {club: game.clubs[cup.winnerId]?.name ?? "?"})}</p>}
      <div className="fixture-list">
        {CUP_STAGES.map((key, stage) => {
          const ties = cup.fixtures.filter((f) => f.stage === stage);
          if (ties.length === 0) return null;
          return (
            <div key={key} className={stage === now ? "round current" : "round"}>
              <h3>{t(key)} <small className="muted">· {t("cup.week", {week: CUP_WEEKS[stage]})}</small></h3>
              {ties.map((f) => <FixtureRow key={f.id} f={f} />)}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function FixtureRow({f}: {f: Fixture}) {
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
        {cup?.penalties && <small className="fx-pens">{t("fx.penalties", {h: cup.penalties[0], a: cup.penalties[1]})}</small>}
      </span>
      <span className="fx-team away"><span className="crest tiny" style={{background: away.color}} /> {away.name} {flag(away)}</span>
      {report && <button className="btn small" onClick={() => watchMatch(f.id)}>▶</button>}
    </div>
  );
}
