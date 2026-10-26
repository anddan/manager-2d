// The manager's profile: who they are and what they've won. The look is set
// once, at the start; the club can be given a nickname here, the way players
// can (shown everywhere, with the real name kept alongside in brackets here).
import {useState} from "react";
import {CUP_ROUNDS} from "../game/cup";
import {leaguePosition} from "../game/league";
import {useT} from "../i18n";
import {useGame, useGameState} from "../store";
import {ManagerAvatar, defaultManagerLook} from "./Avatar";
import {Modal} from "./common";

export function ManagerProfile({onClose}: {onClose: () => void}) {
  const {t, tx} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const club = game.clubs[game.userClubId];
  const official = club.officialName ?? club.name;
  const [nick, setNick] = useState(club.officialName ? club.name : "");
  const trophies = [
    ...game.history.filter((h) => h.userPosition === 1).map((h) => ({season: h.season, key: "trophy.leagueShort"})),
    ...game.history.filter((h) => h.cup === CUP_ROUNDS.length).map((h) => ({season: h.season, key: "trophy.cupShort"})),
  ].sort((a, b) => a.season - b.season);
  const cupText = (cup?: number) => (cup === undefined ? "" : cup === CUP_ROUNDS.length ? t("mgr.cupWon") : tx(CUP_ROUNDS[cup]));
  // Saved, and the dialog closes.
  const save = () => {
    act((g) => {
      const c = g.clubs[g.userClubId];
      const name = nick.trim();
      if (name && name !== (c.officialName ?? c.name)) {
        c.officialName = c.officialName ?? c.name;
        c.name = name;
      } else if (c.officialName) {
        c.name = c.officialName;
        delete c.officialName;
      }
    });
    onClose();
  };

  return (
    <Modal title={t("mgr.title")} onClose={onClose}>
      <div className="mgr-head">
        <ManagerAvatar look={game.managerLook ?? defaultManagerLook(game.managerName)} size={84} tie={club.color} />
        <div>
          <h3>{game.managerName}</h3>
          <p className="muted">{club.officialName ? `${club.name} (${official})` : club.name}</p>
        </div>
      </div>

      <h4>🏆 {t("mgr.trophies")}</h4>
      {trophies.length === 0 ? (
        <p className="muted">{t("mgr.noTrophies")}</p>
      ) : (
        <ul className="mgr-trophies">
          {trophies.map((tr, i) => <li key={i}>🏆 {tx(tr.key, {season: tr.season})}</li>)}
        </ul>
      )}

      <h4>📜 {t("mgr.career")}</h4>
      <ul className="mgr-career">
        <li>
          <strong>{game.season}</strong> {t("mgr.now", {position: leaguePosition(game, club.id)})}
        </li>
        {[...game.history].reverse().map((h) => (
          <li key={h.season}>
            <strong>{h.season}</strong> {t("mgr.position", {position: h.userPosition})}
            {h.cup !== undefined && <> · {t("cup.name")}: {cupText(h.cup)}</>}
          </li>
        ))}
      </ul>

      <h4>✏️ {t("mgr.clubNick")}</h4>
      <p className="muted small">{t("mgr.clubNickHint", {name: official})}</p>
      <div className="btn-row">
        <input className="input" value={nick} maxLength={30} placeholder={official} onChange={(e) => setNick(e.target.value)} />
        <button className="btn primary" onClick={save}>{t("mgr.save")}</button>
      </div>
    </Modal>
  );
}
