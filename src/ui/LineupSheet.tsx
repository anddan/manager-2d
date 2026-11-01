// A team's line-up as on the tactics page: the eleven on the board (shirts, kit, name plates)
// and the bench below. Used for a friend's team in the friends' cup and for the opponent
// (tap their team strength before or during a match).
import {useEffect, useLayoutEffect, useRef, useState} from "react";
import {clubSlots} from "../game/constants";
import {listName, shortName} from "../game/helpers";
import {repairLineup} from "../game/lineup";
import {effectiveRating, pickCaptain, teamOvr} from "../game/ratings";
import type {Club, Player} from "../game/types";
import {useT} from "../i18n";
import {useGame, useGameState} from "../store";
import {Flag, FormArrow, Modal, PosBadge} from "./common";
import {GearPicture} from "./Gear";
import {Icon, iconize} from "./Icon";
import {Jersey} from "./Jersey";
import {boardSpots} from "./views/Tactics";

/** What the sheet needs of a club: its kit, formation, roles and who's picked. */
export type SheetClub = Pick<Club, "name" | "color" | "color2" | "color3" | "pattern" | "collar" | "sleeves" | "formation" | "mentality" | "lineup" | "bench"> & Partial<Pick<Club, "roles" | "customSlots">>;

export function LineupSheet({club, player, onPick, onSlot, actions, onMove, hideBench}: {
  club: SheetClub;
  player: (id: string) => Player | undefined;
  onPick: (p: Player) => void;
  /** Makes every place tappable (also the empty ones), e.g. to pick who plays there. */
  onSlot?: (index: number) => void;
  /** A tapped shirt: the place, with what its red ✕ and its profile button do. */
  actions?: {index: number; onClear: () => void; onProfile: () => void; onClose: () => void} | null;
  /** A free-form formation: a shirt dragged to a spot on the pitch (percent from the left and the top). */
  onMove?: (index: number, left: number, top: number) => void;
  hideBench?: boolean;
}) {
  const {t} = useT();
  const slots = clubSlots(club as Club);
  const spots = boardSpots(slots);
  const captainId = pickCaptain(club.roles?.captain, club.lineup.filter(Boolean), Object.fromEntries(club.lineup.flatMap((id) => { const p = player(id); return p ? [[id, p]] : []; })));
  const bench = club.bench.map(player).filter((p): p is Player => !!p);
  const board = useRef<HTMLDivElement>(null);
  // Where the tapped shirt's name plate is (measured), so the bar lies under all of it.
  const [bar, setBar] = useState<{drop: number; height: number} | null>(null);
  useLayoutEffect(() => {
    setBar(null);
    if (!actions) return;
    const info = board.current?.querySelector<HTMLElement>(`[data-slot="${actions.index}"] .plate`);
    if (info) setBar({drop: info.offsetTop, height: info.offsetHeight});
  }, [actions?.index]); // eslint-disable-line react-hooks/exhaustive-deps
  // Tapping anywhere else puts the bar away.
  useEffect(() => {
    if (!actions) return;
    const close = actions.onClose;
    const index = actions.index;
    const away = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (el?.closest(".pop-actions") || el?.closest(`[data-slot="${index}"]`)) return;
      close();
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [actions?.index]); // eslint-disable-line react-hooks/exhaustive-deps
  // A shirt pressed and dragged on a free-form board.
  const press = useRef<{i: number; x: number; y: number; moved: boolean} | null>(null);
  const dropped = useRef(0);
  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = press.current;
      if (p && !p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) p.moved = true;
    };
    const up = (e: PointerEvent) => {
      const p = press.current;
      press.current = null;
      if (!p?.moved || !board.current) return;
      dropped.current = performance.now();
      const r = board.current.getBoundingClientRect();
      moveRef.current?.(p.i, ((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);
  const boardHeight = board.current?.clientHeight ?? 0;
  return (
    <>
      <div ref={board} className={onMove ? "pitch-board friends-board custom" : "pitch-board friends-board"} data-free={onMove ? "" : undefined} aria-label={t("friends.lineup")}>
        <div className="pitch-lines" aria-hidden />
        {slots.map((slot, i) => {
          const p = player(club.lineup[i]);
          const tap = () => performance.now() - dropped.current > 300 && (onSlot ? onSlot(i) : p && onPick(p));
          return (
            <div
              key={i}
              data-slot={i}
              className={p ? "slot" : "slot empty"}
              style={spots[i]}
              role={p || onSlot ? "button" : undefined}
              onPointerDown={onMove && i > 0 ? (e) => { if (e.button === 0) press.current = {i, x: e.clientX, y: e.clientY, moved: false}; } : undefined}
              onClick={onSlot || p ? tap : undefined}
            >
              {p?.gear && <span className={p.gear.kind === "gloves" ? "slot-gear gloves" : "slot-gear"} aria-hidden><GearPicture item={p.gear} size={p.gear.kind === "gloves" ? 22 : 24} /></span>}
              {p?.shin && <span className="slot-gear slot-shin" aria-hidden><GearPicture item={p.shin} size={15} /></span>}
              <Jersey color={club.color} trim={club.color2} pattern={club.pattern} trim3={club.color3} collar={club.collar} sleeves={club.sleeves} keeper={slot.pos === "GK"} number={p?.shirt ?? i + 1} captain={!!p && p.id === captainId} />
              <span className="plate">
                <span className="plate-name">{p ? shortName(p) : t(`pos.${slot.pos}`)}{!!p && p.id === captainId && <small className="cap-c">c</small>}</span>
                <span className="plate-info">
                  {p && <Flag code={p.nationality} size={13} />}
                  <span>{iconize(t(`pos.${slot.pos}`))}</span>
                  {p && <strong>{Math.round(effectiveRating(p, slot.pos))}</strong>}
                  {p && <FormArrow form={p.form} size={12} />}
                </span>
              </span>
            </div>
          );
        })}
        {/* Tapped a shirt: take them out (red ✕) or open their profile, just under their name plate. */}
        {actions && bar && player(club.lineup[actions.index]) && (
          <div className="pop-actions" style={{left: spots[actions.index].left, top: Math.min((parseFloat(String(spots[actions.index].top)) / 100) * boardHeight + bar.drop + bar.height + 4, boardHeight - 44)}} role="toolbar">
            <button className="pop-action out" aria-label={t("tac.clearShort")} title={t("tac.clearShort")} onClick={actions.onClear}>
              <Icon name="close" size={14} />
            </button>
            <button className="pop-action" aria-label={t("tac.profile")} title={t("tac.profile")} onClick={actions.onProfile}>
              <Icon name="user" size={14} />
            </button>
          </div>
        )}
      </div>
      {!hideBench && (
        <>
          <h4><Icon name="bench" size={18} /> {iconize(t("friends.bench"))}</h4>
          {bench.length === 0 ? (
            <p className="muted small">{iconize(t("common.none"))}</p>
          ) : (
            <ul className="pick-list">
              {bench.map((p) => (
                <li key={p.id} className="bench-row friends-clickable" role="button" onClick={() => onPick(p)}>
                  <div className="pick friends-bench-row">
                    <Jersey color={club.color} trim={club.color2} pattern={club.pattern} trim3={club.color3} collar={club.collar} sleeves={club.sleeves} keeper={p.position === "GK"} size={26} />
                    <PosBadge pos={p.position} />
                    <span className="pick-name"><Flag code={p.nationality} size={15} /> {listName(p)}</span>
                    {p.gear && <GearPicture item={p.gear} size={20} />}
                    {p.shin && <GearPicture item={p.shin} size={16} />}
                    <FormArrow form={p.form} />
                    <span className="num">{Math.round(effectiveRating(p, p.position))}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

/** A club in the game: its tactics and players (tap one for their whole profile: attributes, bids…). */
export function ClubSheet({clubId, onClose}: {clubId: string; onClose: () => void}) {
  const {t} = useT();
  const game = useGameState();
  const openPlayer = useGame((s) => s.openPlayer);
  const real = game.clubs[clubId];
  if (!real) return null;
  // Who they'll actually field: anyone injured, banned or gone replaced as before a match (on a copy).
  const club = structuredClone(real);
  repairLineup(game, club);
  return (
    <Modal title={<><span className="crest tiny" style={{background: club.color}} /> {club.name}</>} onClose={onClose}>
      <p className="muted small sheet-meta">
        {club.formation} · {iconize(t(`tac.${club.mentality}`))}
        <span className="team-ovr">{iconize(t("tac.teamOvr"))} <strong>{teamOvr({...game, clubs: {...game.clubs, [club.id]: club}}, club.id)}</strong></span>
      </p>
      <LineupSheet club={club} player={(id) => game.players[id]} onPick={(p) => openPlayer(p.id)} />
    </Modal>
  );
}

/** A club's team strength; for another club it's a button showing their tactics and players. */
export function TeamOvr({clubId}: {clubId: string}) {
  const {t} = useT();
  const game = useGameState();
  const [open, setOpen] = useState(false);
  const label = <>{iconize(t("tac.teamOvr"))} <strong>{teamOvr(game, clubId)}</strong></>;
  if (clubId === game.userClubId) return <span className="team-ovr" title={t("tac.teamOvrHint")}>{label}</span>;
  return (
    <>
      <button type="button" className="team-ovr team-ovr-btn" title={t("tac.seeTeam")} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && <ClubSheet clubId={clubId} onClose={() => setOpen(false)} />}
    </>
  );
}

/** A club's badge; another club's is a button showing their tactics and players. */
export function ClubCrest({clubId, className = "crest"}: {clubId: string; className?: string}) {
  const {t} = useT();
  const game = useGameState();
  const [open, setOpen] = useState(false);
  const c = game.clubs[clubId];
  if (!c) return null;
  const style = {background: c.color, color: c.color2};
  if (clubId === game.userClubId) return <span className={className} style={style}>{c.short}</span>;
  return (
    <>
      <button type="button" className={`${className} crest-btn`} style={style} title={t("tac.seeTeam")} onClick={() => setOpen(true)}>
        {c.short}
      </button>
      {open && <ClubSheet clubId={clubId} onClose={() => setOpen(false)} />}
    </>
  );
}
