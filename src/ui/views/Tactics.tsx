// Lineup and tactics. Tap a slot on the pitch, then a player to put there; or
// drag a shirt onto another slot and they swap, or a player from the list (by
// their handle) onto a slot to bring them in.
import {Icon, iconize} from "../Icon";
import {useEffect, useRef, useState, type PointerEvent as ReactPointerEvent} from "react";
import {BENCH_SIZE, clubSlots, roleAt, type Slot} from "../../game/constants";
import {CUP_STAGES} from "../../game/cup";
import {fixtureWeek, isCupFixture, listName, nextUserFixture, shortName, userClub} from "../../game/helpers";
import {isAvailable, pickBestLineup} from "../../game/lineup";
import {clubPlayers, effectiveRating, familiarity, teamOvr} from "../../game/ratings";
import {FORMATION_IDS, MENTALITIES, type FormationId, type Mentality, type Player} from "../../game/types";
import {useT} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Bar, Card, Flag, FormArrow, Modal, PosBadge, StatusIcons, Hint} from "../common";
import {Avatar} from "../Avatar";
import {Jersey} from "../Jersey";
import {GearPicture} from "../Gear";

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
  const notify = useGame((s) => s.notify);
  const club = userClub(game);
  const slots = clubSlots(club);
  const custom = !!club.customSlots;
  const spots = boardSpots(slots);
  const [selected, setSelected] = useState<number | null>(null);
  // The picker shows only who could come in (not already starting, not injured or banned) unless told
  // otherwise; starters are moved about by dragging their shirts on the pitch.
  const [onlyFit, setOnlyFit] = useState(true);
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

  // Everyone out: the starting eleven and the bench.
  const clearAll = () => {
    act((g) => {
      const c = g.clubs[g.userClubId];
      c.lineup = c.lineup.map(() => "");
      c.bench = [];
    });
    setSelected(null);
  };

  const auto = () =>
    act((g) => {
      const c = g.clubs[g.userClubId];
      const best = pickBestLineup(g, c, clubSlots(c));
      c.lineup = best.lineup;
      c.bench = best.bench;
    });

  // Custom formation: a shirt dropped on open grass moves that position there (the keeper stays in goal).
  const moveSlot = (i: number, left: number, top: number) =>
    act((g) => {
      const c = g.clubs[g.userClubId];
      if (!c.customSlots || i === 0) return;
      const x = Math.round(Math.max(10, Math.min(80, 5 + (1 - (top - 8) / 79) * 71)));
      const y = Math.round(Math.max(5, Math.min(95, 50 + (left - 50) / 0.95)));
      c.customSlots[i] = {pos: roleAt(x, y), x, y};
    });

  const drag = useDrag((playerId, fromSlot, to) => {
    if (typeof to === "object" && "point" in to) {
      if (fromSlot !== null) moveSlot(fromSlot, to.point.left, to.point.top);
      return;
    }
    if (typeof to === "number") {
      // (An empty spot being moved has no player to put anywhere.)
      if (to !== fromSlot && playerId) assign(playerId, to);
      return;
    }
    // Dropped on a group in the list: onto the bench, or off it to rest (list players only).
    if (fromSlot !== null || !("zone" in to)) return;
    const onBench = club.bench.includes(playerId);
    if ((to.zone === "bench") === onBench) return;
    if (to.zone === "bench" && club.bench.length >= BENCH_SIZE) {
      // Full: dropped on a substitute, the two swap; on the heading, nothing to make room.
      if (to.playerId && club.bench.includes(to.playerId)) {
        act((g) => {
          const c = g.clubs[g.userClubId];
          c.bench = c.bench.map((id) => (id === to.playerId ? playerId : id));
        });
      } else notify("tac.benchFull", {max: BENCH_SIZE}, "error");
      return;
    }
    toggleBench(playerId);
  });
  // The list beside the pitch: on the bench first, then those resting.
  const row = (p: Player, onBench: boolean) => (
    <li key={p.id} className={!isAvailable(p) ? "out-row" : onBench ? "bench-row" : "rest-row"} data-zone={isAvailable(p) ? (onBench ? "bench" : "rest") : undefined} data-player={p.id}>
      <div className="pick">
        <span className="drag-handle" title={t("tac.dragIn")} onPointerDown={isAvailable(p) ? (e) => drag.start(e, p.id, null, shortName(p)) : undefined}>
          <Jersey color={club.color} trim={club.color2} keeper={p.position === "GK"} size={26} />
        </span>
        <input type="checkbox" className="bench-check" aria-label={t("tac.toBench")} checked={onBench} disabled={!isAvailable(p)} onChange={() => toggleBench(p.id)} />
        <PosBadge pos={p.position} />
        <button className="link pick-name" onClick={() => openPlayer(p.id)}><Flag code={p.nationality} size={15} /> {listName(p)} <StatusIcons player={p} /></button>
        <FormArrow form={p.form} />
        <span className="num">{Math.round(effectiveRating(p, p.position))}</span>
        <Bar value={p.fitness} small />
      </div>
    </li>
  );
  const notPlaying = squad.filter((p) => !club.lineup.includes(p.id));
  const benched = notPlaying.filter((p) => isAvailable(p) && club.bench.includes(p.id));
  const resting = notPlaying.filter((p) => isAvailable(p) && !club.bench.includes(p.id));
  // Injured or suspended: can't play, listed last (also those still picked in the eleven, so they're easy to find).
  const out = squad.filter((p) => !isAvailable(p));

  const pos = selected !== null ? slots[selected].pos : null;
  // Phones and narrow windows: the list is far below the pitch, so the picker opens as a dialog.
  const narrow = useNarrow();
  const candidates = pos
    ? squad.slice().sort((a, b) => effectiveRating(b, pos) - effectiveRating(a, pos))
    : [];
  // Whoever is in the chosen spot now (it can be emptied).
  const inSlot = selected !== null ? game.players[club.lineup[selected] ?? ""] : undefined;
  const clearSlot = () => {
    if (selected === null) return;
    act((g) => {
      const c = g.clubs[g.userClubId];
      const lineup = [...c.lineup];
      lineup[selected] = "";
      c.lineup = lineup;
    });
    setSelected(null);
  };
  // A player's profile (their attributes), closing the picker first.
  const profile = (id: string) => {
    setSelected(null);
    openPlayer(id);
  };
  const candidateList = pos ? (
    <ul className="pick-list">
      <li className="pick-filter">
        <label className="toggle">
          <input type="checkbox" checked={onlyFit} onChange={(e) => setOnlyFit(e.target.checked)} /> {iconize(t("tac.onlyFit"))}
        </label>
      </li>
      {inSlot && (
        <li className="pick-row">
          {/* The player in the spot, like the rows below (to compare), with ✖ to take them out. */}
          <button className="pick pick-clear" onClick={clearSlot} title={t("tac.clearSlot", {name: listName(inSlot)})} aria-label={t("tac.clearSlot", {name: listName(inSlot)})}>
            <PosBadge pos={inSlot.position} />
            <span className="pick-name"><Flag code={inSlot.nationality} size={15} /> {listName(inSlot)} <StatusIcons player={inSlot} /></span>
            {/* In the status column, like the other rows: what tapping it does. */}
            <span className="pick-clear-x small"><Icon name="close" size={18} /> {iconize(t("tac.clearShort"))}</span>
            <FormArrow form={inSlot.form} />
            <span className={familiarity(inSlot, pos) < 1 ? "num warn" : "num strong"}>{Math.round(effectiveRating(inSlot, pos))}</span>
            <Bar value={inSlot.fitness} small />
          </button>
          <button className="pick-avatar" title={t("tac.profile")} aria-label={`${t("tac.profile")}: ${listName(inSlot)}`} onClick={() => profile(inSlot.id)}>
            <Avatar player={inSlot} shirt={club.color} trim={club.color2} size={34} />
          </button>
        </li>
      )}
      {candidates.filter((p) => p.id !== inSlot?.id && (!onlyFit || (isAvailable(p) && !club.lineup.includes(p.id)))).map((p) => (
        <li key={p.id} className="pick-row">
          <button className="pick" disabled={!isAvailable(p)} onClick={() => assign(p.id)}>
            <PosBadge pos={p.position} />
            <span className="pick-name"><Flag code={p.nationality} size={15} /> {listName(p)} <StatusIcons player={p} /></span>
            <span className="muted small">{club.lineup.includes(p.id) ? t("tac.starting") : club.bench.includes(p.id) ? t("tac.onBench") : ""}</span>
            <FormArrow form={p.form} />
            <span className={familiarity(p, pos) < 1 ? "num warn" : "num strong"}>{Math.round(effectiveRating(p, pos))}</span>
            <Bar value={p.fitness} small />
          </button>
          <button className="pick-avatar" title={t("tac.profile")} aria-label={`${t("tac.profile")}: ${listName(p)}`} onClick={() => profile(p.id)}>
            <Avatar player={p} shirt={club.color} trim={club.color2} size={34} />
          </button>
        </li>
      ))}
    </ul>
  ) : null;

  return (
    <div className="grid tactics">
      <NextMatch />
      <Card
        title={<>{iconize(t("nav.tactics"))} <span className="team-ovr" title={t("tac.teamOvrHint")}>{iconize(t("tac.teamOvr"))} <strong>{teamOvr(game, club.id)}</strong></span></>}
        actions={
          <>
            <button className="btn small" onClick={clearAll} disabled={!club.lineup.some(Boolean) && club.bench.length === 0}>{iconize(t("tac.clearAll"))}</button>
            <button className="btn small" data-tour="best-xi" onClick={auto}>{iconize(t("tac.auto"))}</button>
          </>
        }
      >
        <div className="tac-pickers">
          <label className="field" data-tour="formation">
            <span>{iconize(t("tac.formation"))}</span>
            <select
              value={custom ? "custom" : club.formation}
              onChange={(e) =>
                act((g) => {
                  const c = g.clubs[g.userClubId];
                  // Custom starts from the positions in use now; a standard formation drops them.
                  if (e.target.value === "custom") c.customSlots = clubSlots(c).map((sl) => ({...sl}));
                  else {
                    delete c.customSlots;
                    c.formation = e.target.value as FormationId;
                  }
                })
              }
            >
              {FORMATION_IDS.map((f) => <option key={f} value={f}>{f}</option>)}
              <option value="custom">{iconize(t("tac.custom"))}</option>
            </select>
          </label>
          <label className="field">
            <span>{iconize(t("tac.mentality"))}</span>
            <select value={club.mentality} onChange={(e) => act((g) => { g.clubs[g.userClubId].mentality = e.target.value as Mentality; })}>
              {MENTALITIES.map((m) => <option key={m} value={m}>{iconize(t(`tac.${m}`))}</option>)}
            </select>
          </label>
        </div>
        <p className="muted small">{iconize(t(`tac.${club.mentality}Hint`))}</p>

        <div className={`pitch-board ${custom ? "custom" : ""}`} data-free={custom ? "" : undefined} role="group" aria-label={t("tac.pitch")}>
          <div className="pitch-lines" aria-hidden />
          {slots.map((slot, i) => {
            const p = game.players[club.lineup[i]];
            const bad = !p || p.clubId !== club.id || !isAvailable(p);
            // Still picked, but injured or banned: shown greyed out with why, not as an empty spot.
            const out = !!p && p.clubId === club.id && !isAvailable(p);
            return (
              <button
                key={i}
                data-slot={i}
                className={`slot ${selected === i ? "selected" : ""} ${bad && !out ? "empty" : ""} ${out ? "out" : ""} ${drag.over === i ? "drop" : ""}`}
                style={spots[i]}
                onPointerDown={p && !bad ? (e) => drag.start(e, p.id, i, shortName(p)) : custom && i > 0 ? (e) => drag.start(e, "", i, t(`pos.${slot.pos}`)) : undefined}
                onClick={() => !drag.justDropped() && setSelected(selected === i ? null : i)}
              >
                {p && !bad && club.roles?.captain === p.id && <span className="armband" title={t("roles.captain")}>C</span>}
                {out ? (
                  <>
                    <Jersey color={club.color} trim={club.color2} keeper={slot.pos === "GK"} number={i + 1} />
                    <span className="slot-out" title={p.injuryWeeks > 0 ? t("tac.injured") : t("tac.suspended")}>{p.injuryWeeks > 0 ? "🩹" : "🟥"}</span>
                  </>
                ) : bad ? (
                  <span className="slot-empty">+</span>
                ) : (
                  <>
                    {/* Boots or gloves, in front of the shirt at its lower right. */}
                    {p?.gear && <span className={p.gear.kind === "gloves" ? "slot-gear gloves" : "slot-gear"} aria-hidden><GearPicture item={p.gear} size={p.gear.kind === "gloves" ? 22 : 24} /></span>}
                    {/* Shin guards on the other side. */}
                    {p?.shin && <span className="slot-gear slot-shin" aria-hidden><GearPicture item={p.shin} size={15} /></span>}
                    <Jersey color={club.color} trim={club.color2} keeper={slot.pos === "GK"} number={i + 1} />
                  </>
                )}
                <span className="plate">
                  <span className="plate-name">{p && (!bad || out) ? shortName(p) : t(`pos.${slot.pos}`)}</span>
                  <span className="plate-info">
                    {p && !bad && <Flag code={p.nationality} size={13} />}
                    <span>{iconize(t(`pos.${slot.pos}`))}</span>
                    {p && !bad && <strong>{Math.round(effectiveRating(p, slot.pos))}</strong>}
                    {p && !bad && <FormArrow form={p.form} size={12} />}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="muted small">{iconize(t(custom ? "tac.customHint" : "tac.dragHint"))}</p>
      </Card>
      {drag.ghost && <div className="drag-ghost" style={{left: drag.ghost.x, top: drag.ghost.y}}>{drag.ghost.label}</div>}

      {/* Phones: the picker over the pitch, so nobody has to scroll down to it. */}
      {selected !== null && pos && narrow && (
        <Modal title={t("tac.pickFor", {pos: t(`pos.${pos}`)})} onClose={() => setSelected(null)}>
          {candidateList}
        </Modal>
      )}
      <Card title={selected !== null && pos && !narrow ? t("tac.pickFor", {pos: t(`pos.${pos}`)}) : t("tac.bench", {n: club.bench.length, max: BENCH_SIZE})}>
        {selected !== null && pos && !narrow ? (
          candidateList
        ) : (
          <>
            <Hint>{iconize(t("tac.benchHint"))}</Hint>
            <ul className="pick-list">
              <li className={`pick-group bench-head ${typeof drag.over === "object" && drag.over !== null && "zone" in drag.over && drag.over.zone === "bench" ? "drop" : ""}`} data-zone="bench"><Icon name="bench" size={18} /> {iconize(t("tac.benchGroup", {n: benched.length, max: BENCH_SIZE}))}</li>
              {benched.map((p) => row(p, true))}
              <li className={`pick-group rest-head ${typeof drag.over === "object" && drag.over !== null && "zone" in drag.over && drag.over.zone === "rest" ? "drop" : ""}`} data-zone="rest"><Icon name="moon" size={18} /> {iconize(t("tac.restGroup", {n: resting.length}))}</li>
              {resting.map((p) => row(p, false))}
              {out.length > 0 && <li className="pick-group out-head"><Icon name="medical" size={18} /> {iconize(t("tac.outGroup", {n: out.length}))}</li>}
              {out.map((p) => row(p, club.bench.includes(p.id)))}
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
/** Where a player can be dropped: a slot on the pitch, or a group in the list. */
type DropTarget = number | {zone: "bench" | "rest"; playerId?: string} | {point: {left: number; top: number}};

function useDrag(onDrop: (playerId: string, fromSlot: number | null, to: DropTarget) => void) {
  const [ghost, setGhost] = useState<{x: number; y: number; label: string} | null>(null);
  const [over, setOver] = useState<DropTarget | null>(null);
  const press = useRef<{playerId: string; fromSlot: number | null; label: string; x: number; y: number; dragging: boolean} | null>(null);
  const dropped = useRef(0);
  const dropRef = useRef(onDrop);
  dropRef.current = onDrop;

  useEffect(() => {
    const targetAt = (x: number, y: number): DropTarget | null => {
      const el = document.elementFromPoint(x, y);
      const slot = el?.closest("[data-slot]")?.getAttribute("data-slot");
      if (slot != null) return Number(slot);
      const z = el?.closest("[data-zone]");
      const zone = z?.getAttribute("data-zone");
      if (zone === "bench" || zone === "rest") return {zone, playerId: z?.getAttribute("data-player") ?? undefined};
      // Open grass on a free-form board: where on it, in percent.
      const board = el?.closest("[data-free]");
      if (board) {
        const r = board.getBoundingClientRect();
        return {point: {left: ((x - r.left) / r.width) * 100, top: ((y - r.top) / r.height) * 100}};
      }
      return null;
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
    start: (e: ReactPointerEvent, playerId: string, fromSlot: number | null, label: string) => {
      if (e.button !== 0) return;
      press.current = {playerId, fromSlot, label, x: e.clientX, y: e.clientY, dragging: false};
    },
    /** True right after a drop, so the click that follows it doesn't also select. */
    justDropped: () => performance.now() - dropped.current < 300,
  };
}

/** True on phones and narrow windows (where the list sits below the pitch). */
function useNarrow(): boolean {
  const query = "(max-width: 899px)";
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const m = window.matchMedia?.(query);
    if (!m) return;
    const on = () => setNarrow(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return narrow;
}

/** This week's match, on top: who against whom, home or away, and in what. */
function NextMatch() {
  const {t} = useT();
  const game = useGameState();
  const next = nextUserFixture(game);
  if (!next || fixtureWeek(next) !== game.week) return null;
  const home = game.clubs[next.homeId];
  const away = game.clubs[next.awayId];
  if (!home || !away) return null;
  const crest = (c: typeof home) => <span className="crest" style={{background: c.color, color: c.color2}}>{c.short}</span>;
  return (
    <div className="next-match span-2" role="status">
      <span className="next-match-what">
        {isCupFixture(next) ? <><Icon name="trophy" size={18} /> {iconize(t("cup.name"))} · {iconize(t(CUP_STAGES[next.stage]))}</> : <><Icon name="ball" size={18} /> {iconize(t("ov.round", {round: next.round}))}</>}
        {/* Home or away, on the same line. */}
        <span className="next-match-where"> · {next.homeId === game.userClubId ? t("tac.home") : t("tac.away")}</span>
      </span>
      <span className="next-match-teams">
        {crest(home)} <strong>{home.name}</strong> <span className="muted">–</span> <strong>{away.name}</strong> {crest(away)}
      </span>
    </div>
  );
}
