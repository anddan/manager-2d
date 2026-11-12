// The manager's level: shown as a ring round the manager's picture (how far to the next level) with the level on a small badge, and as a
// title (see game/manager.ts for what the levels give).
import {useEffect, useRef, useState, type ReactNode} from "react";
import {managerStanding} from "../game/manager";
import {useT, type TKey} from "../i18n";
import {useGameState} from "../store";
import {effectsOn} from "./effects";

/** The manager's picture; on the start page with a ring round it (how far it is to the next level) and the level on a small badge. In the profile it is plain: the title and level are written beside it. */
export function LevelRing({size, children, ring = true}: {size: number; children: ReactNode; ring?: boolean}) {
  const {t} = useT();
  const game = useGameState();
  const st = managerStanding(game);
  const title = `${t(`mgr.level.${st.title}` as TKey, {name: game.managerName})} · ${t("mgr.levelN", {n: st.level})}`;
  // XP gained (for a win, a deal, a contract): the ring pulses and its arc slides to the new length, so the level is seen to move (the amount is not shown).
  const last = useRef(st.xp);
  const [gain, setGain] = useState(false);
  useEffect(() => {
    const before = last.current;
    last.current = st.xp;
    if (!ring || st.xp <= before || !effectsOn()) return;
    setGain(true);
    const id = setTimeout(() => setGain(false), 1300);
    return () => clearTimeout(id);
  }, [st.xp, ring]);
  return (
    <span className={gain ? "lvl-ring pulse" : "lvl-ring"} style={{width: size, height: size}} title={title}>
      {children}
      {ring && (
        <svg className="lvl-arc" viewBox="0 0 100 100" aria-hidden>
          <circle className="lvl-track" cx="50" cy="50" r="47" />
          <circle className="lvl-fill" cx="50" cy="50" r="47" pathLength={100} strokeDasharray={`${Math.max(0, Math.min(1, st.share)) * 100} 100`} />
        </svg>
      )}
      {ring && <span className="lvl-badge" aria-label={t("mgr.levelN", {n: st.level})}>{st.level}</span>}
    </span>
  );
}

/** The title and how far it is to the next level (in the manager's profile, under the club's name). */
export function ManagerTitle() {
  const {t} = useT();
  const game = useGameState();
  const st = managerStanding(game);
  return (
    <div className="mgr-title">
      <p className="mgr-title-name">
        <strong>{t(`mgr.level.${st.title}` as TKey, {name: game.managerName})}</strong> <small>· {t("mgr.levelN", {n: st.level})}</small>
      </p>
      <span className="mgr-xp" aria-hidden><span style={{width: `${Math.round(st.share * 100)}%`}} /></span>
      <small className="muted">{st.to === null ? t("mgr.xpMax", {xp: st.xp}) : t("mgr.xp", {xp: st.xp, to: st.to})}</small>
    </div>
  );
}
