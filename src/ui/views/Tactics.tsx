// Lineup and tactics. Tap a slot on the pitch, then a player to put there; or
// drag a shirt onto another slot and they swap.
import {useEffect, useRef, useState, type PointerEvent as ReactPointerEvent} from "react";
import {BENCH_SIZE, FORMATIONS, type Slot} from "../../game/constants";
import {listName, shortName, userClub} from "../../game/helpers";
import {isAvailable, pickBestLineup} from "../../game/lineup";
import {clubPlayers, effectiveRating, familiarity, teamOvr} from "../../game/ratings";
import {FORMATION_IDS, MENTALITIES, type FormationId, type Mentality} from "../../game/types";
import {useT} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Bar, Card, Flag, PosBadge, StatusIcons} from "../common";
import {Jersey} from "../Jersey";

/**
 * Where a slot sits on the lineup board. Formations only use depth 5 (keeper)
 * to about 76 (strikers), so that range is stretched over the whole board,
 * keeper at the bottom and strikers at the top, to give every row room for
 * its shirt and name plate. Sideways it keeps clear of the touchlines.
 */
function boardSpots(slots: Slot[]): {left: string; top: string}[] {
  // Work in percent of the board; a shirt with its plate is about 18% wide and 14% tall.
  const W = 18;
  const H = 14;
  const spots = slots.map((s) => ({
    x: 50 + (s.y - 50) * 0.95,
    y: 2 + (1 - Math.max(0, Math.min(1, (s.x - 5) / 71))) * 79,
  }));
  // Nudge overlapping pairs apart: sideways when they're on about the same line, else up and down.
  for (let round = 0; round < 40; round++) {
    let moved = false;
    for (let a = 0; a < spots.length; a++) {
      for (let b = a + 1; b < spots.length; b++) {
        const p = spots[a];
        const q = spots[b];
        const ox = W - Math.abs(p.x - q.x);
        const oy = H - Math.abs(p.y - q.y);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        if (Math.abs(p.y - q.y) < H / 2) {
          const dir = p.x <= q.x ? -1 : 1;
          p.x += (dir * ox) / 2;
          q.x -= (dir * ox) / 2;
        } else {
          const dir = p.y <= q.y ? -1 : 1;
          p.y += (dir * oy) / 2;
          q.y -= (dir * oy) / 2;
        }
      }
    }
    for (const s of spots) {
      s.x = Math.max(W / 2 - 1, Math.min(101 - W / 2, s.x));
      s.y = Math.max(0, Math.min(84, s.y));
    }
    if (!moved) break;
  }
  return spots.map((s) => ({left: `${s.x}%`, top: `${s.y}%`}));
}

export function Tactics() {
  const {t} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const openPlayer = useGame((s) => s.openPlayer);
  const club = userClub(game);
  const slots = FORMATIONS[club.formation];
  const spots = boardSpots(slots);
  const [selected, setSelected] = useState<number | null>(null);
  const squad = clubPlayers(game, club.id);

  const assign = (playerId: string, slot = selected) => {
    if (slot === null) return;
    act((g) => {
      const c = g.clubs[g.userClubId];
      const lineup = [...c.lineup];
      while (lineup.length < slots.length) lineup.push("");
      const current = lineup[slot];
      const otherSlot = lineup.indexOf(playerId);
      if (otherSlot >= 0) lineup[otherSlot] = current; // Swap two starters.
      lineup[slot] = playerId;
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

  const drag = useDrag((playerId, fromSlot, toSlot) => {
    if (toSlot !== fromSlot) assign(playerId, toSlot);
  });

  const pos = selected !== null ? slots[selected].pos : null;
  const candidates = pos
    ? squad.slice().sort((a, b) => effectiveRating(b, pos) - effectiveRating(a, pos))
    : [];

  return (
    <div className="grid tactics">
      <Card
        title={<>{t("nav.tactics")} <span className="team-ovr" title={t("tac.teamOvrHint")}>{t("tac.teamOvr")} <strong>{teamOvr(game, club.id)}</strong></span></>}
        actions={<button className="btn small" onClick={auto}>{t("tac.auto")}</button>}
      >
        <div className="tac-pickers">
          <label className="field">
            <span>{t("tac.formation")}</span>
            <select value={club.formation} onChange={(e) => act((g) => { g.clubs[g.userClubId].formation = e.target.value as FormationId; })}>
              {FORMATION_IDS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <label className="field">
            <span>{t("tac.mentality")}</span>
            <select value={club.mentality} onChange={(e) => act((g) => { g.clubs[g.userClubId].mentality = e.target.value as Mentality; })}>
              {MENTALITIES.map((m) => <option key={m} value={m}>{t(`tac.${m}`)}</option>)}
            </select>
          </label>
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
                data-slot={i}
                className={`slot ${selected === i ? "selected" : ""} ${bad ? "empty" : ""} ${drag.over === i ? "drop" : ""}`}
                style={spots[i]}
                onPointerDown={p && !bad ? (e) => drag.start(e, p.id, i, shortName(p)) : undefined}
                onClick={() => !drag.justDropped() && setSelected(selected === i ? null : i)}
              >
                {p && !bad && club.roles?.captain === p.id && <span className="armband" title={t("roles.captain")}>C</span>}
                {bad ? (
                  <span className="slot-empty">+</span>
                ) : (
                  <Jersey color={club.color} trim={club.color2} keeper={slot.pos === "GK"} number={i + 1} />
                )}
                <span className="plate">
                  <span className="plate-name">{p && !bad ? shortName(p) : t(`pos.${slot.pos}`)}</span>
                  <span className="plate-info">
                    {p && !bad && <Flag code={p.nationality} size={13} />}
                    <span>{t(`pos.${slot.pos}`)}</span>
                    {p && !bad && <strong>{Math.round(effectiveRating(p, slot.pos))}</strong>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="muted small">{t("tac.dragHint")}</p>
      </Card>
      {drag.ghost && <div className="drag-ghost" style={{left: drag.ghost.x, top: drag.ghost.y}}>{drag.ghost.label}</div>}

      <Card title={selected !== null && pos ? t("tac.pickFor", {pos: t(`pos.${pos}`)}) : t("tac.bench", {n: club.bench.length, max: BENCH_SIZE})}>
        {selected !== null && pos ? (
          <ul className="pick-list">
            {candidates.map((p) => (
              <li key={p.id}>
                <button className="pick" disabled={!isAvailable(p)} onClick={() => assign(p.id)}>
                  <PosBadge pos={p.position} />
                  <span className="pick-name"><Flag code={p.nationality} size={15} /> {listName(p)} <StatusIcons player={p} /></span>
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
                      <button className="link pick-name" onClick={() => openPlayer(p.id)}><Flag code={p.nationality} size={15} /> {listName(p)} <StatusIcons player={p} /></button>
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

/**
 * Dragging players with the mouse or a finger (pointer events, so touch works
 * too). A press only becomes a drag once it has moved a few pixels, so taps
 * still select. `onDrop` gets the player, the slot they came from and the slot
 * they were dropped on.
 */
function useDrag(onDrop: (playerId: string, fromSlot: number, toSlot: number) => void) {
  const [ghost, setGhost] = useState<{x: number; y: number; label: string} | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const press = useRef<{playerId: string; fromSlot: number; label: string; x: number; y: number; dragging: boolean} | null>(null);
  const dropped = useRef(0);
  const dropRef = useRef(onDrop);
  dropRef.current = onDrop;

  useEffect(() => {
    const targetAt = (x: number, y: number): number | null => {
      const slot = document.elementFromPoint(x, y)?.closest("[data-slot]")?.getAttribute("data-slot");
      return slot != null ? Number(slot) : null;
    };
    const move = (e: PointerEvent) => {
      const p = press.current;
      if (!p) return;
      if (!p.dragging && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6) return;
      p.dragging = true;
      setGhost({x: e.clientX, y: e.clientY, label: p.label});
      setOver(targetAt(e.clientX, e.clientY));
    };
    const up = (e: PointerEvent) => {
      const p = press.current;
      press.current = null;
      if (!p?.dragging) return;
      dropped.current = performance.now();
      setGhost(null);
      setOver(null);
      const to = targetAt(e.clientX, e.clientY);
      if (to !== null) dropRef.current(p.playerId, p.fromSlot, to);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  return {
    ghost,
    over,
    start: (e: ReactPointerEvent, playerId: string, fromSlot: number, label: string) => {
      if (e.button !== 0) return;
      press.current = {playerId, fromSlot, label, x: e.clientX, y: e.clientY, dragging: false};
    },
    /** True right after a drop, so the click that follows it doesn't also select. */
    justDropped: () => performance.now() - dropped.current < 300,
  };
}
