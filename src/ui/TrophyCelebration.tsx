// A trophy won: the whole team on the podium, the captain lifting it, and
// confetti in the club's colours. Shown once per trophy.
import {Icon, iconize} from "./Icon";
import {useMemo} from "react";
import {useT} from "../i18n";
import {useGame, useGameState} from "../store";
import {lookFor} from "./Avatar";
import {Figure} from "./Figure";
import {Confetti} from "./MatchViewer";

export function TrophyCelebration() {
  const {t} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const next = game.celebrations?.[0];
  const club = game.clubs[game.userClubId];
  // The eleven, captain in the middle.
  const team = useMemo(() => {
    const ids = club.lineup.filter((id) => game.players[id]?.clubId === club.id);
    const captain = club.roles?.captain && ids.includes(club.roles.captain) ? club.roles.captain : ids[0];
    const rest = ids.filter((id) => id !== captain);
    const half = Math.floor(rest.length / 2);
    return [...rest.slice(0, half), captain, ...rest.slice(half)].filter(Boolean).map((id) => game.players[id]);
  }, [club, game.players]);
  const colors = useMemo(() => [club.color, club.color2, "#fde047", "#ffffff"], [club.color, club.color2]);
  if (!next) return null;
  const done = () => act((g) => { g.celebrations = g.celebrations?.slice(1); });
  const middle = Math.floor(team.length / 2);
  const width = 160;
  const step = Math.min(13, (width - 20) / Math.max(1, team.length - 1));
  const startX = width / 2 - (step * (team.length - 1)) / 2;
  return (
    <div className="trophy-overlay" role="dialog" aria-label={t(next.kind === "cup" ? "trophy.cup" : "trophy.league", {season: next.season})}>
      <Confetti colors={colors} />
      <h1 className="trophy-title"><Icon name="trophy" size={18} /> {iconize(t(next.kind === "cup" ? "trophy.cup" : "trophy.league", {season: next.season}))}</h1>
      <svg className="trophy-scene" viewBox={`0 0 ${width} 92`}>
        <rect x={0} y={0} width={width} height={92} fill="#0b1324" />
        <rect x={0} y={62} width={width} height={30} fill="#166534" />
        {/* The podium. */}
        <rect x={10} y={78} width={width - 20} height={10} rx={2} fill="#e2e8f0" />
        <text x={width / 2} y={85.6} className="trophy-podium">{club.name}</text>
        {team.map((p, i) => {
          const x = startX + i * step;
          const lifting = i === middle;
          return (
            <g key={p.id} className={lifting ? "trophy-captain" : "trophy-jump"} style={{animationDelay: `${(i % 4) * 0.12}s`}}>
              <g transform={`translate(${x} 78) scale(${lifting ? 1.05 : 0.95})`}>
                <Figure look={lookFor(p)} kit={club.color} trim={club.color2} pose="up" mood={100} />
              </g>
              {lifting && (
                // The trophy, held up above the captain's head.
                <g transform={`translate(${x} 36)`} className="trophy-cup">
                  {next.kind === "cup" ? (
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
      <p className="trophy-text">{iconize(t(next.kind === "cup" ? "trophy.cupText" : "trophy.leagueText", {club: club.name}))}</p>
      <button className="btn primary big" onClick={done}>{iconize(t("trophy.continue"))} ▶</button>
    </div>
  );
}
