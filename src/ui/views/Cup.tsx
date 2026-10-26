// The Champions Cup: the four groups (tables and games), and the knockout
// bracket from the quarter-finals to the final. Before the knockout the
// bracket shows who would meet (winner of group A against runner-up of B…).
import {useState} from "react";
import {CUP_FROM_LEAGUE, CUP_GROUP_DAYS, CUP_WEEKS} from "../../game/constants";
import {CUP_STAGES, GROUP_NAMES, groupTable} from "../../game/cup";
import {currentCupStage} from "../../game/helpers";
import type {CupFixture} from "../../game/types";
import {useT} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Card, Empty} from "../common";
import {FlagIcon} from "../Flag";
import {FixtureRow} from "./Fixtures";

/** Who goes into each quarter-final before it's known: [group, place] for home and away. */
const QUARTER_SEEDS: [[number, number], [number, number]][] = [
  [[0, 0], [1, 1]],
  [[1, 0], [0, 1]],
  [[2, 0], [3, 1]],
  [[3, 0], [2, 1]],
];

export function Cup() {
  const {t} = useT();
  const game = useGameState();
  const cup = game.cup;
  if (!cup || !cup.groups) {
    return (
      <Card title={`🏆 ${t("cup.name")}`}>
        <Empty>{t("cup.notIn", {n: CUP_FROM_LEAGUE})}</Empty>
      </Card>
    );
  }
  const knockoutStarted = cup.fixtures.some((f) => f.stage >= CUP_GROUP_DAYS);
  const inIt = cup.clubIds.includes(game.userClubId);
  const groups = <Groups key="groups" />;
  const bracket = <Bracket key="bracket" />;
  return (
    <div className="grid">
      {!inIt && (
        <Card title={`🏆 ${t("cup.name")}`} className="span-2">
          <p className="muted">{t("cup.notIn", {n: CUP_FROM_LEAGUE})}</p>
        </Card>
      )}
      {cup.winnerId && (
        <Card className="span-2">
          <p className="cup-winner">{t("cup.winner", {club: game.clubs[cup.winnerId]?.name ?? "?"})}</p>
        </Card>
      )}
      {/* What's being played now comes first. */}
      {knockoutStarted ? [bracket, groups] : [groups, bracket]}
    </div>
  );
}

function Groups() {
  const {t} = useT();
  const game = useGameState();
  const cup = game.cup!;
  const now = currentCupStage(game);
  // Just our group to start with (if we are in it); the box shows all four.
  const ours = cup.groups.findIndex((ids) => ids.includes(game.userClubId));
  const [onlyOurs, setOnlyOurs] = useState(true);
  return (
    <Card
      title={`🏆 ${t("cup.groups")}`}
      className="span-2"
      actions={
        ours >= 0 ? (
          <label className="toggle">
            <input type="checkbox" checked={onlyOurs} onChange={(e) => setOnlyOurs(e.target.checked)} /> {t("cup.onlyOurs")}
          </label>
        ) : undefined
      }
    >
      <p className="muted small">{t("cup.groupHint")}</p>
      <div className="cup-groups">
        {cup.groups.map((ids, g) => {
          if (onlyOurs && ours >= 0 && g !== ours) return null;
          const rows = groupTable(game, g);
          const mine = ids.includes(game.userClubId);
          const games = cup.fixtures.filter((f) => f.group === g).sort((a, b) => a.stage - b.stage);
          return (
            <section key={g} className={`cup-group ${mine ? "mine" : ""}`}>
              <h3>{t("cup.groupName", {group: GROUP_NAMES[g]})}</h3>
              <table className="table compact">
                <thead>
                  <tr>
                    <th>#</th><th>{t("col.name")}</th>
                    <th className="num">{t("cup.colP")}</th><th className="num">{t("cup.colW")}</th><th className="num">{t("cup.colD")}</th><th className="num">{t("cup.colL")}</th>
                    <th className="num">{t("cup.colGD")}</th><th className="num">{t("cup.colPts")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const club = game.clubs[r.clubId];
                    if (!club) return null;
                    const gd = r.goalsFor - r.goalsAgainst;
                    return (
                      <tr key={r.clubId} className={`${r.clubId === game.userClubId ? "me" : ""} ${i < 2 ? "through" : ""}`}>
                        <td>{i + 1}</td>
                        <td className="cup-club">
                          {club.country ? <FlagIcon code={club.country} size={13} /> : null} <span className="crest tiny" style={{background: club.color}} /> {club.name}
                        </td>
                        <td className="num">{r.played}</td><td className="num">{r.won}</td><td className="num">{r.drawn}</td><td className="num">{r.lost}</td>
                        <td className="num">{gd > 0 ? `+${gd}` : gd}</td><td className="num strong">{r.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="cup-group-games">
                {[0, 1, 2].map((day) => (
                  <div key={day} className={day === now ? "round current" : "round"}>
                    <h4>{t(CUP_STAGES[day])} <small className="muted">· {t("cup.week", {week: CUP_WEEKS[day]})}</small></h4>
                    {games.filter((f) => f.stage === day).map((f) => <FixtureRow key={f.id} f={f} />)}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </Card>
  );
}

/** The knockout as a tree: quarters, semis, final; placeholders until it's known who's in them. */
function Bracket() {
  const {t} = useT();
  const game = useGameState();
  const cup = game.cup!;
  const rounds = [0, 1, 2].map((r) => {
    const stage = CUP_GROUP_DAYS + r;
    const ties = cup.fixtures.filter((f) => f.stage === stage).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
    const count = 4 >> r;
    return {stage, slots: Array.from({length: count}, (_, i) => ties.find((f) => (f.slot ?? -1) === i) ?? ties[i])};
  });
  // Before a tie exists, who it will be between.
  const placeholder = (stage: number, slot: number): [string, string] => {
    if (stage === CUP_GROUP_DAYS) {
      const [[hg, hp], [ag, ap]] = QUARTER_SEEDS[slot];
      const label = (g: number, p: number) => t(p === 0 ? "cup.groupWinner" : "cup.groupRunnerUp", {group: GROUP_NAMES[g]});
      return [label(hg, hp), label(ag, ap)];
    }
    const prev = CUP_STAGES[stage - 1];
    return [t("cup.winnerOf", {stage: prev, n: slot * 2 + 1}), t("cup.winnerOf", {stage: prev, n: slot * 2 + 2})];
  };
  return (
    <Card title={`🏆 ${t("cup.bracket")}`} className="span-2">
      <div className="bracket">
        {rounds.map(({stage, slots}) => (
          <div key={stage} className="bracket-round">
            <h4>{t(CUP_STAGES[stage])} <small className="muted">· {t("cup.week", {week: CUP_WEEKS[stage]})}</small></h4>
            <div className="bracket-ties">
              {slots.map((f, i) => (f ? <Tie key={f.id} f={f} /> : <TieTbd key={i} labels={placeholder(stage, i)} />))}
            </div>
          </div>
        ))}
        <div className="bracket-round bracket-champion">
          <h4>🏆</h4>
          <div className="bracket-ties">
            <div className={`bracket-tie champion ${cup.winnerId ? "" : "tbd"}`}>
              {cup.winnerId && game.clubs[cup.winnerId] ? <TeamLine id={cup.winnerId} winner /> : <span className="muted">{t("cup.tbd")}</span>}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function TeamLine({id, goals, pens, winner}: {id: string; goals?: number; pens?: number; winner?: boolean}) {
  const game = useGameState();
  const club = game.clubs[id];
  if (!club) return null;
  return (
    <div className={`bracket-team ${winner ? "won" : ""} ${id === game.userClubId ? "me" : ""}`}>
      <span className="crest tiny" style={{background: club.color}} />
      <span className="bracket-name">{club.name}</span>
      {goals !== undefined && <span className="bracket-score">{goals}{pens !== undefined && <small> ({pens})</small>}</span>}
    </div>
  );
}

function Tie({f}: {f: CupFixture}) {
  const game = useGameState();
  const watchMatch = useGame((s) => s.watchMatch);
  const report = game.reports.find((r) => r.fixtureId === f.id);
  const mine = f.homeId === game.userClubId || f.awayId === game.userClubId;
  return (
    <button className={`bracket-tie ${mine ? "mine" : ""}`} onClick={report ? () => watchMatch(f.id) : undefined} disabled={!report}>
      <TeamLine id={f.homeId} goals={f.played ? f.homeGoals : undefined} pens={f.penalties?.[0]} winner={f.winnerId === f.homeId} />
      <TeamLine id={f.awayId} goals={f.played ? f.awayGoals : undefined} pens={f.penalties?.[1]} winner={f.winnerId === f.awayId} />
    </button>
  );
}

function TieTbd({labels}: {labels: [string, string]}) {
  return (
    <div className="bracket-tie tbd">
      <div className="bracket-team muted">{labels[0]}</div>
      <div className="bracket-team muted">{labels[1]}</div>
    </div>
  );
}
