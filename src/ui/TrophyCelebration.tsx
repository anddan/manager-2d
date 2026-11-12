// A trophy won: the whole team on the podium, the captain lifting it, and
// confetti in the club's colours. Shown once per trophy.
import {Icon, iconize} from "./Icon";
import {useEffect, useMemo, useState} from "react";
import {effectsOn} from "./effects";
import {useT} from "../i18n";
import type {TKey} from "../i18n";
import {useGame, useGameState} from "../store";
import {ManagerAvatar, defaultManagerLook, lookFor} from "./Avatar";
import {Figure} from "./Figure";
import {Confetti} from "./MatchViewer";
import {nationalKit, nationalLineup} from "../game/national";
import {PlayerCard} from "./PlayerCard";
import {fanfare} from "./sound";

/** How long the level ring has to itself before the level-up screen comes (ms). */
const LEVEL_DELAY_MS = 1800;

export function TrophyCelebration() {
  const {t} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const openPlayer = useGame((s) => s.openPlayer);
  const next = game.celebrations?.[0];
  const club = game.clubs[game.userClubId];
  // The eleven, captain in the middle.
  const tournament = next?.kind === "tournament" ? next : undefined;
  const team = useMemo(() => {
    // A tournament: the national eleven (the best picked, the manager's own choice first).
    const ids = tournament && game.national ? nationalLineup(game, game.national).lineup.filter(Boolean) : club.lineup.filter((id) => game.players[id]?.clubId === club.id);
    const captain = club.roles?.captain && ids.includes(club.roles.captain) ? club.roles.captain : ids[0];
    const rest = ids.filter((id) => id !== captain);
    const half = Math.floor(rest.length / 2);
    return [...rest.slice(0, half), captain, ...rest.slice(half)].filter(Boolean).map((id) => game.players[id]);
  }, [club, game.players, tournament]);
  const kit = tournament ? nationalKit(tournament.country) : {color: club.color, color2: club.color2};
  const colors = useMemo(() => [kit.color, kit.color2, "#fde047", "#ffffff"], [kit.color, kit.color2]);
  // A level up: a fanfare when it appears.
  const levelUp = next?.kind === "level" ? next.level : 0;
  const [waited, setWaited] = useState(0);
  const shown = !!levelUp && (!effectsOn() || waited === levelUp);
  useEffect(() => {
    if (!shown) return;
    try { fanfare(false); } catch { /* no sound */ }
  }, [shown, levelUp]);
  // The level ring in the header gets to do its effect first (it pulses and the arc slides): the level-up screen follows a moment later.
  useEffect(() => {
    if (!levelUp || !effectsOn()) return;
    const id = setTimeout(() => setWaited(levelUp), LEVEL_DELAY_MS);
    return () => clearTimeout(id);
  }, [levelUp]);
  if (!next) return null;
  if (next.kind === "level" && effectsOn() && waited !== next.level) return null;
  const done = () => act((g) => { g.celebrations = g.celebrations?.slice(1); });
  // A level up: a burst, the new level, what it gave (at random) and, now and then, a new title.
  if (next.kind === "level") {
    const title = next.title ? t(`mgr.level.${next.title}` as TKey, {name: game.managerName}) : null;
    return (
      <div className="trophy-overlay level-overlay" role="dialog" aria-label={t("level.up")}>
        <Confetti colors={["#38bdf8", "#2563eb", "#fde047", "#ffffff"]} />
        <div className="level-rays" aria-hidden />
        <h1 className="trophy-title">{iconize(t("level.up"))}</h1>
        <div className="level-medal"><b>{next.level}</b></div>
        <p className="trophy-text">{iconize(t("level.now", {level: next.level}))}</p>
        {title && <p className="level-title">{iconize(t("level.newTitle", {title}))}</p>}
        <ul className="level-gifts">
          {next.gifts.slice(-6).map((g, i) => (
            <li key={i} className={`level-gift ${g.kind}`} style={{animationDelay: `${0.25 + i * 0.18}s`}}>
              <Icon name={g.kind === "diamonds" ? "diamond" : g.kind === "money" ? "coins" : "bolt"} size={22} /> {iconize(t(`level.gift.${g.kind}` as TKey, {n: g.n, money: g.n}))}
            </li>
          ))}
        </ul>
        {next.gifts.length > 6 && <p className="muted small">+{next.gifts.length - 6}</p>}
        <button className="btn primary big" onClick={done}>{iconize(t("trophy.continue"))} ▶</button>
      </div>
    );
  }
  // An award for one of ours: the winners, lit up, with confetti.
  if (next.kind === "award") {
    return (
      <div className="trophy-overlay award-overlay" role="dialog" aria-label={t("award.celebrate")}>
        <Confetti colors={colors} />
        <h1 className="trophy-title"><Icon name="star" size={22} /> {iconize(t("award.celebrate"))}</h1>
        <p className="trophy-text">{iconize(t("award.celebrateText", {season: next.season}))}</p>
        <ul className="award-winners">
          {next.awards.map((a) => {
            const p = a.playerId ? game.players[a.playerId] : undefined;
            return (
              <li key={a.key} className={a.mine ? "award-winner mine" : "award-winner"}>
                {p ? <button type="button" className="award-winner-card" title={t("tac.profile")} aria-label={`${t("tac.profile")}: ${a.name}`} onClick={() => { done(); openPlayer(p.id); }}><PlayerCard game={game} player={p} /></button> : <span className="award-winner-manager"><ManagerAvatar look={game.managerLook ?? defaultManagerLook(game.managerName)} size={72} tie={club.color} /></span>}
                <span className="award-winner-text"><small>{iconize(t(`award.${a.key}` as TKey))}</small>{p ? <button type="button" className="link award-name" onClick={() => { done(); openPlayer(p.id); }}><strong>{a.name}</strong></button> : <strong>{a.name}</strong>}{a.team && a.key !== "manager" && <small className="award-team">{a.team}</small>}</span>
              </li>
            );
          })}
        </ul>
        <button className="btn primary big" onClick={done}>{iconize(t("trophy.continue"))} ▶</button>
      </div>
    );
  }
  const place = tournament?.place ?? 1;
  const title = tournament ? t(`trophy.tournament.${place}` as TKey, {comp: `national.comp.${tournament.comp}`, season: tournament.season}) : t(next.kind === "cup" ? "trophy.cup" : "trophy.league", {season: next.season});
  const text = tournament ? t(`trophy.tournamentText.${place}` as TKey, {country: `nat.${tournament.country}`}) : t(next.kind === "cup" ? "trophy.cupText" : "trophy.leagueText", {club: club.name});
  const medal = place === 2 ? {fill: "#e5e7eb", edge: "#94a3b8"} : {fill: "#d97706", edge: "#92400e"};
  const middle = Math.floor(team.length / 2);
  const width = 160;
  const step = Math.min(13, (width - 20) / Math.max(1, team.length - 1));
  const startX = width / 2 - (step * (team.length - 1)) / 2;
  return (
    <div className="trophy-overlay" role="dialog" aria-label={title}>
      <Confetti colors={colors} />
      <h1 className="trophy-title"><Icon name="trophy" size={18} /> {iconize(title)}</h1>
      <svg className="trophy-scene" viewBox={`0 0 ${width} 92`}>
        <rect x={0} y={0} width={width} height={92} fill="#0b1324" />
        <rect x={0} y={62} width={width} height={30} fill="#166534" />
        {/* The podium. */}
        <rect x={10} y={78} width={width - 20} height={10} rx={2} fill="#e2e8f0" />
        <text x={width / 2} y={85.6} className="trophy-podium">{tournament ? tournament.country : club.name}</text>
        {team.map((p, i) => {
          const x = startX + i * step;
          const lifting = i === middle;
          return (
            <g key={p.id} className={lifting ? "trophy-captain" : "trophy-jump"} style={{animationDelay: `${(i % 4) * 0.12}s`}}>
              <g transform={`translate(${x} 78) scale(${lifting && place === 1 ? 1.05 : 0.95})`}>
                <Figure look={lookFor(p)} kit={kit.color} trim={kit.color2} pattern={tournament ? undefined : club.pattern} collar={tournament ? undefined : club.collar} sleeves={tournament ? undefined : club.sleeves} trim3={tournament ? undefined : club.color3} pose={place === 1 ? "up" : "ready"} mood={place === 1 ? 100 : place === 2 ? 62 : 48} />
                {/* Silver and bronze: a medal on a ribbon round every neck. */}
                {tournament && place > 1 && (
                  <g>
                    <path d="M-1.600 -19.500 L0 -14.500 L1.600 -19.500" fill="none" stroke="#2563eb" strokeWidth={0.9} />
                    <circle cx={0} cy={-13.600} r={1.700} fill={medal.fill} stroke={medal.edge} strokeWidth={0.5} />
                  </g>
                )}
              </g>
              {lifting && place === 1 && (
                // The trophy, held up above the captain's head.
                <g transform={`translate(${x} 36)`} className="trophy-cup">
                  {tournament?.comp === "wc" ? (
                    // The World Cup: a golden globe on a twisted stem.
                    <g fill="#fbbf24" stroke="#b45309" strokeWidth={0.6}>
                      <circle cx={0} cy={-6.500} r={4.600} />
                      <path d="M-2.600 -2.600 Q-4.200 3 -2 7.500 L2 7.500 Q4.200 3 2.600 -2.600Z" />
                      <path d="M-4 7.500 H4 V10.500 H-4Z" fill="#15803d" />
                      <path d="M-4.200 -7 Q0 -4.600 4.200 -7 M0 -11 Q-2.400 -6.500 0 -2" fill="none" stroke="#b45309" strokeWidth={0.4} />
                    </g>
                  ) : tournament ? (
                    // The Euros: a big silver cup with handles.
                    <path d="M-5.500 -9 H5.500 V-2.500 Q5.500 4 0 5.500 Q-5.500 4 -5.500 -2.500 Z M-5.500 -7 Q-9.500 -7 -9.500 -2.500 Q-9.500 1.500 -5.500 1.500 M5.500 -7 Q9.500 -7 9.500 -2.500 Q9.500 1.500 5.500 1.500 M-1 5.500 H1 V9 H-1 Z M-4.500 9 H4.500 V11.500 H-4.500Z" fill="#e5e7eb" stroke="#64748b" strokeWidth={0.6} />
                  ) : next.kind === "cup" ? (
                    <path d="M-5 -8 H5 V-2 Q5 4 0 5 Q-5 4 -5 -2 Z M-5 -6 Q-9 -6 -9 -2 Q-9 1 -5 1 M5 -6 Q9 -6 9 -2 Q9 1 5 1 M-1 5 H1 V9 H-1 Z M-4 9 H4 V11 H-4 Z" fill="#fbbf24" stroke="#b45309" strokeWidth={0.6} />
                  ) : (
                    <path d="M-4 -9 H4 L3 -1 Q2 3 0 3 Q-2 3 -3 -1 Z M-1 3 H1 V8 H-1 Z M-3.5 8 H3.5 V11 H-3.5 Z" fill="#e5e7eb" stroke="#94a3b8" strokeWidth={0.6} />
                  )}
                </g>
              )}
            </g>
          );
        })}
      </svg>
      <p className="trophy-text">{iconize(text)}</p>
      <button className="btn primary big" onClick={done}>{iconize(t("trophy.continue"))} ▶</button>
    </div>
  );
}
