// The manager's profile: who they are and what they've won. The manager's name
// can be changed here, the club given a nickname (the way players can: shown
// everywhere, with the real name kept alongside in brackets here) and its colours.
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
  const [managerName, setManagerName] = useState(game.managerName);
  const [color, setColor] = useState(club.color);
  const [color2, setColor2] = useState(club.color2);
  // The club's initials on its crest (up to three letters).
  const [short, setShort] = useState(club.short);
  const trophies = [
    ...game.history.filter((h) => h.userPosition === 1).map((h) => ({season: h.season, key: "trophy.leagueShort"})),
    ...game.history.filter((h) => h.cup === CUP_ROUNDS.length).map((h) => ({season: h.season, key: "trophy.cupShort"})),
  ].sort((a, b) => a.season - b.season);
  const cupText = (cup?: number) => (cup === undefined ? "" : cup === CUP_ROUNDS.length ? t("mgr.cupWon") : tx(CUP_ROUNDS[cup]));
  // Saved, and the dialog closes.
  const save = () => {
    act((g) => {
      const c = g.clubs[g.userClubId];
      const who = managerName.trim();
      if (who) g.managerName = who;
      c.color = color;
      c.color2 = color2;
      const initials = short.trim().toUpperCase();
      if (initials) c.short = initials;
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
      <section className="mgr-section">
      <h3 className="mgr-section-title">👔 {t("mgr.sectionManager")}</h3>
      <div className="mgr-head">
        <ManagerAvatar look={game.managerLook ?? defaultManagerLook(game.managerName)} size={84} tie={color} />
        <div>
          <h3>{managerName.trim() || game.managerName}</h3>
          <p className="muted">{club.officialName ? `${club.name} (${official})` : club.name}</p>
        </div>
      </div>

      <h4>✏️ {t("mgr.managerName")}</h4>
      <input className="input mgr-input" value={managerName} maxLength={30} placeholder={game.managerName} onChange={(e) => setManagerName(e.target.value)} />

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

      </section>

      {/* The club: its nickname, initials and colours. */}
      <section className="mgr-section">
      <h3 className="mgr-section-title">🏟️ {t("mgr.sectionClub")}</h3>
      <h4>✏️ {t("mgr.clubNick")}</h4>
      <p className="muted small">{t("mgr.clubNickHint", {name: official})}</p>
      <input className="input mgr-input" value={nick} maxLength={30} placeholder={official} onChange={(e) => setNick(e.target.value)} />

      <h4>🔤 {t("mgr.initials")}</h4>
      <input className="input mgr-initials" value={short} maxLength={3} placeholder={club.short} onChange={(e) => setShort(e.target.value.toUpperCase())} aria-label={t("mgr.initials")} />

      <h4>🎨 {t("mgr.colors")}</h4>
      <div className="mgr-colors">
        <span className="crest big" style={{background: color, color: color2}} aria-hidden>{short.trim().toUpperCase() || club.short}</span>
        <div className="mgr-swatch-rows">
          <ColorRow label={t("mgr.color1")} value={color} onPick={setColor} />
          <ColorRow label={t("mgr.color2")} value={color2} onPick={setColor2} />
        </div>
      </div>
      </section>

      {/* Always in view at the bottom of the dialog, however far it's scrolled. */}
      <div className="btn-row mgr-actions">
        <button className="btn" onClick={onClose}>{t("common.cancel")}</button>
        <button className="btn primary" onClick={save}>{t("mgr.save")}</button>
      </div>
    </Modal>
  );
}

/** Kit colours to tap, plus the browser's own picker for any other. */
const SWATCHES = ["#dc2626", "#ea580c", "#f59e0b", "#facc15", "#16a34a", "#0f766e", "#0891b2", "#2563eb", "#1d4ed8", "#7c3aed", "#db2777", "#7a263a", "#111827", "#6b7280", "#ffffff", "#87ceeb"];

function ColorRow({label, value, onPick}: {label: string; value: string; onPick: (c: string) => void}) {
  const {t} = useT();
  return (
    <div className="mgr-swatch-row">
      <span className="small muted mgr-swatch-label">{label}</span>
      <div className="mgr-swatches" role="radiogroup" aria-label={label}>
        {SWATCHES.map((c) => (
          <button key={c} className={`mgr-swatch ${value.toLowerCase() === c ? "on" : ""}`} style={{background: c}} role="radio" aria-checked={value.toLowerCase() === c} aria-label={c} onClick={() => onPick(c)} />
        ))}
        <label className="mgr-swatch mgr-swatch-own" title={t("mgr.ownColor")}>
          <input type="color" value={value} aria-label={t("mgr.ownColor")} onChange={(e) => onPick(e.target.value)} />
          <span aria-hidden>+</span>
        </label>
      </div>
    </div>
  );
}
