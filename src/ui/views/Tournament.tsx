// The World Cup or the Euros of this season for the manager's country: the eight groups with their tables, and the
// knockout (the last sixteen, quarter-finals, semi-finals, the final) as it is played. Sits next to the Cup.
import {useState} from "react";
import {Icon, iconize} from "../Icon";
import {TOURNAMENT_WEEKS, tournamentHost, tournamentOf} from "../../game/national";
import type {TKey} from "../../i18n";
import {useT} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Card, Empty, Flag} from "../common";
import {CountrySheet} from "../CountrySheet";

const ROUNDS = ["national.round.r16", "national.round.qf", "national.round.sf", "national.round.final"] as const;

export function Tournament() {
  const {t} = useT();
  const game = useGameState();
  const job = game.national;
  const openPlayer = useGame((s) => s.openPlayer);
  // This year's, or else the last one played (so the winner and the tables can be looked at after it is over, also when out of it).
  const tr = job?.tournament;
  const comp = tr?.comp ?? tournamentOf(game.season, job?.country);
  if (!job || !comp) return <Card title={t("nav.cup")}><Empty>{iconize(t("national.none"))}</Empty></Card>;
  const year = tr?.season ?? game.season;
  const comingUp = tournamentOf(game.season, job?.country) !== null && year !== game.season;
  const [tree, setTree] = useState(false);
  // A country tapped: its team and rating.
  const [sheet, setSheet] = useState<string | null>(null);
  // Only the manager's own group (off to begin with), like the cup.
  const [onlyMine, setOnlyMine] = useState(true);
  type Pair = {a: string; b: string; ga: number; gb: number; w: string};
  const played = tr?.rounds ?? [];
  // 32 countries: four knockout rounds (the last sixteen first); 16 countries (a continental tournament): three.
  const nRounds = tr && tr.groups.length === 4 ? 3 : 4;
  const off = 4 - nRounds;
  const rounds: {done: boolean; known: boolean; pairs: Pair[]}[] = Array.from({length: nRounds}, (_, i) => i).map((i) => {
    if (played[i]) return {done: true, known: true, pairs: played[i]};
    const coming = i === played.length && tr && !tr.champion && tr.bracket.length > 1;
    const pairs: Pair[] = coming ? tr.bracket.reduce<Pair[]>((acc, c, k) => (k % 2 === 0 ? [...acc, {a: c, b: tr.bracket[k + 1], ga: 0, gb: 0, w: ""}] : acc), []) : Array.from({length: (nRounds === 4 ? 8 : 4) >> i}, () => ({a: "", b: "", ga: 0, gb: 0, w: ""}));
    return {done: false, known: !!coming, pairs};
  });
  const name = (c: string) => t(`nat.${c}` as TKey);
  const row = (c: string) => <button type="button" className={c === job.country ? "link strong" : "link"} title={t("tac.seeTeam")} onClick={() => setSheet(c)}><Flag code={c} size={15} /> {name(c)}</button>;
  return (
    <div className="grid">
      <Card title={<><Icon name="trophy" size={20} /> {iconize(t(`national.comp.${comp}` as TKey))} {year}</>}>
        <p className="muted tight"><Flag code={tournamentHost(year)} size={16} /> {iconize(t("national.host", {country: `nat.${tournamentHost(year)}`}))}</p>
        {comingUp && <p className="muted small tight">{iconize(t("national.drawAt", {week: TOURNAMENT_WEEKS[0]}))}</p>}
        {!tr ? (
          <p className="muted">{iconize(t("national.drawAt", {week: TOURNAMENT_WEEKS[0]}))}</p>
        ) : (
          <>
            {tr.champion && <p className="strong"><Icon name="trophy" size={18} /> {iconize(t("national.champion", {country: `nat.${tr.champion}`}))}</p>}
            {/* The two in the final, once they are known (also when we are out of it). */}
            {!tr.champion && tr.bracket.length === 2 && <p className="strong"><Icon name="trophy" size={18} /> {iconize(t("national.round.final"))}: {row(tr.bracket[0])} <span className="muted">–</span> {row(tr.bracket[1])}</p>}
            {!tr.champion && <p className="muted small tight">{iconize(t("national.stillIn", {n: tr.bracket.length > 0 ? tr.bracket.length : tr.groups.length * 4}))}</p>}
          </>
        )}
      </Card>
      {tr?.awards && tr.stats && (
        <Card title={<><Icon name="star" size={20} /> {iconize(t("national.awards"))}</>}>
          <ul className="plain-list award-list">
            {(["scorer", "assists", "player", "keeper"] as const).map((k) => {
              const id = tr.awards?.[k];
              const s = id ? tr.stats?.[id] : undefined;
              if (!s) return null;
              return (
                <li key={k} className={s.country === job.country ? "mine" : undefined}>
                  <span className="muted">{iconize(t(`national.award.${k}` as TKey))}</span>
                  <span className="strong"><Flag code={s.country} size={15} /> {id && game.players[id] ? <button type="button" className="link" onClick={() => openPlayer(id)}>{s.name}</button> : s.name}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      {tr && (tr.rounds?.length || tr.bracket.length > 0) ? (
        <Card
          title={iconize(t("national.knockout"))}
          actions={
            <label className="toggle">
              <input type="checkbox" className="bench-check" checked={tree} onChange={(e) => setTree(e.target.checked)} /> {iconize(t("national.tree"))}
            </label>
          }
        >
          {tree ? (
            // The bracket from both sides in to the final in the middle: the last sixteen at the edges, then the quarter-finals,
            // the semi-finals, and the final in the centre (flags and country codes, so all seven columns fit a phone).
            <div className="ko-tree sym">
              {(nRounds === 4
                ? ([[0, 0, 4], [1, 0, 2], [2, 0, 1], [3, 0, 1], [2, 1, 2], [1, 2, 4], [0, 4, 8]] as const)
                : ([[0, 0, 2], [1, 0, 1], [2, 0, 1], [1, 1, 2], [0, 2, 4]] as const)
              ).map(([r, from, to], col) => (
                <div key={col} className={r === nRounds - 1 ? "ko-col final" : "ko-col"}>
                  <h4 title={t(ROUNDS[r + off] as TKey)}>{iconize(t(ROUNDS[r + off] as TKey))}</h4>
                  <div className="ko-col-matches">
                    {rounds[r].pairs.slice(from, to).map((p, k) => (
                      <div key={k} className={`ko-match ${p.a === job.country || p.b === job.country ? "mine" : ""}`}>
                        {[p.a, p.b].map((c, side) => (
                          <div key={side} className={rounds[r].done && c && p.w === c ? "ko-team won" : "ko-team"} title={c ? name(c) : undefined}>
                            {c ? <button type="button" className="link ko-code" onClick={() => setSheet(c)}><Flag code={c} size={13} /> {c}</button> : <span className="muted">–</span>}
                            <b>{rounds[r].done ? (side === 0 ? p.ga : p.gb) : ""}</b>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            rounds.filter((r) => r.done || r.known).map((round, i) => (
              <div key={i} className="ko-round">
                <h4>{iconize(t(ROUNDS[rounds.indexOf(round) + off] as TKey))}</h4>
                <ul className="plain-list ko-list">
                  {round.pairs.map((p) => (
                    <li key={p.a + p.b} className={p.a === job.country || p.b === job.country ? "mine" : undefined}>
                      <span className={round.done && p.w === p.a ? "strong" : undefined}>{row(p.a)}</span>
                      <b className="ko-score">{round.done ? `${p.ga}–${p.gb}` : "–"}</b>
                      <span className={round.done && p.w === p.b ? "strong" : undefined}>{row(p.b)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </Card>
      ) : null}
      {tr && (
        <Card
          title={iconize(t("national.groups"))}
          actions={
            <label className="toggle">
              <input type="checkbox" className="bench-check" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> {iconize(t("national.onlyMyGroup"))}
            </label>
          }
        >
          <div className="ko-groups">
            {[...tr.groups].filter((g) => !onlyMine || g.includes(job.country)).sort((x, y) => Number(y.includes(job.country)) - Number(x.includes(job.country))).map((g) => (
              <table key={g.join()} className={`table national-table ${g.includes(job.country) ? "mine-group" : ""}`}>
                <thead><tr><th>{t("national.group", {n: String.fromCharCode(65 + tr.groups.indexOf(g))})}</th><th>{t("national.pl")}</th><th>+/-</th><th>{t("national.pts")}</th></tr></thead>
                <tbody>
                  {[...g].sort((x, y) => tr.table[y].pts - tr.table[x].pts || tr.table[y].gf - tr.table[y].ga - (tr.table[x].gf - tr.table[x].ga) || tr.table[y].gf - tr.table[x].gf).map((c) => (
                    <tr key={c} className={c === job.country ? "mine" : undefined}>
                      <td>{row(c)}</td>
                      <td className="num">{tr.table[c].pl}</td>
                      <td className="num">{tr.table[c].gf - tr.table[c].ga}</td>
                      <td className="num strong">{tr.table[c].pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        </Card>
      )}
      {tr?.stats && Object.keys(tr.stats).length > 0 && (
        <>
          {([["goals", "national.scorers"], ["assists", "national.assistLeague"]] as const).map(([field, title]) => {
            const other = field === "goals" ? "assists" : "goals";
            const list = Object.entries(tr.stats!).map(([id, s]) => ({...s, id})).filter((s) => s[field] > 0).sort((x, y) => y[field] - x[field] || y[other] - x[other] || x.name.localeCompare(y.name)).slice(0, 10);
            return (
              <Card key={field} title={<><Icon name={field === "goals" ? "ball" : "boot"} size={20} /> {iconize(t(title as TKey))}</>}>
                <table className="table national-table">
                  <tbody>
                    {list.map((s, i) => (
                      <tr key={s.name + s.country} className={s.country === job.country ? "mine" : undefined}>
                        <td className="num">{i + 1}</td>
                        <td><Flag code={s.country} size={15} /> {game.players[s.id] ? <button type="button" className="link" onClick={() => openPlayer(s.id)}>{s.name}</button> : s.name}</td>
                        <td className="num strong">{s[field]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            );
          })}
        </>
      )}
      {sheet && <CountrySheet code={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}
