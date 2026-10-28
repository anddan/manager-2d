// A team's line-up as on the tactics page: the eleven on the board (shirts, kit, name plates)
// and the bench below. Used for a friend's team in the friends' cup and for the opponent
// (tap their team strength before or during a match).
import {useState} from "react";
import {clubSlots} from "../game/constants";
import {listName, shortName} from "../game/helpers";
import {repairLineup} from "../game/lineup";
import {effectiveRating, teamOvr} from "../game/ratings";
import type {Club, Player} from "../game/types";
import {useT} from "../i18n";
import {useGame, useGameState} from "../store";
import {Flag, FormArrow, Modal, PosBadge} from "./common";
import {GearPicture} from "./Gear";
import {Icon, iconize} from "./Icon";
import {Jersey} from "./Jersey";
import {boardSpots} from "./views/Tactics";

/** What the sheet needs of a club: its kit, formation, roles and who's picked. */
export type SheetClub = Pick<Club, "name" | "color" | "color2" | "formation" | "mentality" | "lineup" | "bench"> & Partial<Pick<Club, "roles" | "customSlots">>;

export function LineupSheet({club, player, onPick}: {club: SheetClub; player: (id: string) => Player | undefined; onPick: (p: Player) => void}) {
  const {t} = useT();
  const slots = clubSlots(club as Club);
  const spots = boardSpots(slots);
  const bench = club.bench.map(player).filter((p): p is Player => !!p);
  return (
    <>
      <div className="pitch-board friends-board" aria-label={t("friends.lineup")}>
        <div className="pitch-lines" aria-hidden />
        {slots.map((slot, i) => {
          const p = player(club.lineup[i]);
          return (
            <div key={i} className={p ? "slot" : "slot empty"} style={spots[i]} role={p ? "button" : undefined} onClick={p ? () => onPick(p) : undefined}>
              {p && club.roles?.captain === p.id && <span className="armband" title={t("roles.captain")}>C</span>}
              {p?.gear && <span className={p.gear.kind === "gloves" ? "slot-gear gloves" : "slot-gear"} aria-hidden><GearPicture item={p.gear} size={p.gear.kind === "gloves" ? 22 : 24} /></span>}
              {p?.shin && <span className="slot-gear slot-shin" aria-hidden><GearPicture item={p.shin} size={15} /></span>}
              <Jersey color={club.color} trim={club.color2} keeper={slot.pos === "GK"} number={i + 1} />
              <span className="plate">
                <span className="plate-name">{p ? shortName(p) : t(`pos.${slot.pos}`)}</span>
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
      </div>
      <h4><Icon name="bench" size={18} /> {iconize(t("friends.bench"))}</h4>
      {bench.length === 0 ? (
        <p className="muted small">{iconize(t("common.none"))}</p>
      ) : (
        <ul className="pick-list">
          {bench.map((p) => (
            <li key={p.id} className="bench-row friends-clickable" role="button" onClick={() => onPick(p)}>
              <div className="pick friends-bench-row">
                <Jersey color={club.color} trim={club.color2} keeper={p.position === "GK"} size={26} />
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
