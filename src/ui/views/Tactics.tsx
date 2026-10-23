// Lineup and tactics. Tap a slot on the pitch, then a player to put there.
import {useState} from "react";
import {BENCH_SIZE, FORMATIONS} from "../../game/constants";
import {userClub} from "../../game/helpers";
import {isAvailable, pickBestLineup} from "../../game/lineup";
import {clubPlayers, effectiveRating, familiarity} from "../../game/ratings";
import {FORMATION_IDS, MENTALITIES} from "../../game/types";
import {useT} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Bar, Card, PosBadge, StatusIcons} from "../common";

export function Tactics() {
  const {t} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const openPlayer = useGame((s) => s.openPlayer);
  const club = userClub(game);
  const slots = FORMATIONS[club.formation];
  const [selected, setSelected] = useState<number | null>(null);
  const squad = clubPlayers(game, club.id);

  const assign = (playerId: string) => {
    if (selected === null) return;
    act((g) => {
      const c = g.clubs[g.userClubId];
      const lineup = [...c.lineup];
      while (lineup.length < slots.length) lineup.push("");
      const current = lineup[selected];
      const otherSlot = lineup.indexOf(playerId);
      if (otherSlot >= 0) lineup[otherSlot] = current; // Swap two starters.
      lineup[selected] = playerId;
      let bench = c.bench.filter((id) => id !== playerId);
      if (otherSlot < 0 && current) bench = [current, ...bench].slice(0, BENCH_SIZE);
      c.lineup = lineup;
      c.bench = bench;
    });
    setSelected(null);
  };

  const toggleBench = (playerId: string) =>
    act((g) => {
      const c = g.clubs[g.userClubId];
      if (c.bench.includes(playerId)) c.bench = c.bench.filter((id) => id !== playerId);
      else if (c.bench.length < BENCH_SIZE && !c.lineup.includes(playerId)) c.bench = [...c.bench, playerId];
    });

  const auto = () =>
    act((g) => {
      const c = g.clubs[g.userClubId];
      const best = pickBestLineup(g, c, FORMATIONS[c.formation]);
      c.lineup = best.lineup;
      c.bench = best.bench;
    });

  const pos = selected !== null ? slots[selected].pos : null;
  const candidates = pos
    ? squad.slice().sort((a, b) => effectiveRating(b, pos) - effectiveRating(a, pos))
    : [];

  return (
    <div className="grid tactics">
      <Card
        title={t("nav.tactics")}
        actions={<button className="btn small" onClick={auto}>✨ {t("tac.auto")}</button>}
      >
        <div className="btn-row wrap">
          {FORMATION_IDS.map((f) => (
            <button key={f} className={f === club.formation ? "chip active" : "chip"} onClick={() => act((g) => { g.clubs[g.userClubId].formation = f; })}>{f}</button>
          ))}
        </div>
        <div className="btn-row wrap">
          {MENTALITIES.map((m) => (
            <button key={m} className={m === club.mentality ? "chip active" : "chip"} onClick={() => act((g) => { g.clubs[g.userClubId].mentality = m; })}>
              {t(`tac.${m}`)}
            </button>
          ))}
        </div>
        <p className="muted small">{t(`tac.${club.mentality}Hint`)}</p>

        <div className="pitch-board" role="group" aria-label={t("tac.pitch")}>
          <div className="pitch-lines" aria-hidden />
          {slots.map((slot, i) => {
            const p = game.players[club.lineup[i]];
            const bad = !p || p.clubId !== club.id || !isAvailable(p);
            return (
              <button
                key={i}
                className={`slot ${selected === i ? "selected" : ""} ${bad ? "empty" : ""}`}
                style={{left: `${slot.y}%`, top: `${100 - slot.x - 4}%`}}
                onClick={() => setSelected(selected === i ? null : i)}
              >
                <span className="slot-pos">{t(`pos.${slot.pos}`)}</span>
                <span className="slot-name">{p && !bad ? p.lastName : "—"}</span>
                {p && !bad && <span className="slot-rating">{Math.round(effectiveRating(p, slot.pos))}</span>}
              </button>
            );
          })}
        </div>
      </Card>

      <Card title={selected !== null && pos ? t("tac.pickFor", {pos: t(`pos.${pos}`)}) : t("tac.bench", {n: club.bench.length, max: BENCH_SIZE})}>
        {selected !== null && pos ? (
          <ul className="pick-list">
            {candidates.map((p) => (
              <li key={p.id}>
                <button className="pick" disabled={!isAvailable(p)} onClick={() => assign(p.id)}>
                  <PosBadge pos={p.position} />
                  <span className="pick-name">{p.firstName.charAt(0)}. {p.lastName} <StatusIcons player={p} /></span>
                  <span className="muted small">{club.lineup.includes(p.id) ? t("tac.starting") : club.bench.includes(p.id) ? t("tac.onBench") : ""}</span>
                  <span className={familiarity(p, pos) < 1 ? "num warn" : "num strong"}>{Math.round(effectiveRating(p, pos))}</span>
                  <Bar value={p.fitness} small />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <p className="muted small">{t("tac.benchHint")}</p>
            <ul className="pick-list">
              {squad
                .filter((p) => !club.lineup.includes(p.id))
                .sort((a, b) => Number(club.bench.includes(b.id)) - Number(club.bench.includes(a.id)))
                .map((p) => (
                  <li key={p.id}>
                    <div className="pick">
                      <input type="checkbox" aria-label={t("tac.toBench")} checked={club.bench.includes(p.id)} disabled={!isAvailable(p)} onChange={() => toggleBench(p.id)} />
                      <PosBadge pos={p.position} />
                      <button className="link pick-name" onClick={() => openPlayer(p.id)}>{p.firstName.charAt(0)}. {p.lastName} <StatusIcons player={p} /></button>
                      <span className="num">{Math.round(effectiveRating(p, p.position))}</span>
                      <Bar value={p.fitness} small />
                    </div>
                  </li>
                ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
