// Game over: the board has sacked the manager. They walk away down the
// tunnel, seen from behind, carrying their things in a box.
import {iconize} from "./Icon";
import {useT} from "../i18n";
import {useGame, useGameState} from "../store";
import {defaultManagerLook} from "./Avatar";

export function GameOver() {
  const {t, money} = useT();
  const game = useGameState();
  const quit = useGame((s) => s.quit);
  const look = game.managerLook ?? defaultManagerLook(game.managerName);
  const club = game.clubs[game.userClubId];
  const seasons = game.season - (game.history[0]?.season ?? game.season) + 1;
  return (
    <div className="game-over">
      <svg className="game-over-scene" viewBox="0 0 200 140" role="img" aria-label={t("go.title")}>
        {/* The stand and the tunnel mouth, lit from inside. */}
        <rect width={200} height={140} fill="#0b1324" />
        {Array.from({length: 60}, (_, i) => (
          <circle key={i} cx={(i * 37) % 200} cy={8 + ((i * 13) % 40)} r={1.4} fill={["#1e293b", "#334155", "#475569"][i % 3]} />
        ))}
        <rect y={52} width={200} height={88} fill="#14532d" />
        <path d="M60 140 L72 70 Q100 52 128 70 L140 140 Z" fill="#020617" />
        <path d="M76 140 L82 78 Q100 66 118 78 L124 140 Z" fill="url(#tunnel-light)" />
        <defs>
          <radialGradient id="tunnel-light" cx="0.5" cy="0.35" r="0.7">
            <stop offset="0" stopColor="#fef3c7" stopOpacity="0.55" />
            <stop offset="1" stopColor="#020617" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* The manager from behind, walking away (slowly getting smaller). */}
        <g className="go-walker">
          <g transform="translate(100 118)">
            {/* Legs, one step at a time. */}
            <rect className="go-leg left" x={-6} y={-4} width={5} height={20} rx={2} fill="#111827" />
            <rect className="go-leg right" x={1} y={-4} width={5} height={20} rx={2} fill="#111827" />
            {/* Jacket and arms holding a box of belongings. */}
            <path d="M-12 -34 Q0 -40 12 -34 L13 -2 L-13 -2 Z" fill={look.suit} />
            <rect x={-19} y={-22} width={11} height={9} rx={1} fill="#b45309" />
            <rect x={-19} y={-22} width={11} height={2.2} fill="#92400e" />
            <rect x={-12.5} y={-24} width={3.5} height={10} rx={1.6} fill={look.suit} />
            <rect x={9} y={-33} width={3.5} height={18} rx={1.6} fill={look.suit} />
            <circle cx={10.8} cy={-14} r={2} fill={look.skin} />
            {/* Neck and the back of the head. */}
            <rect x={-2.5} y={-40} width={5} height={5} fill={look.skin} />
            <circle cx={0} cy={-46} r={8} fill={look.skin} />
            <path d="M-8 -46 Q-8 -55 0 -55 Q8 -55 8 -46 Q8 -42 6 -40 L-6 -40 Q-8 -42 -8 -46 Z" fill={look.hair} />
            <ellipse cx={-8} cy={-45} rx={1.4} ry={2.4} fill={look.skin} />
            <ellipse cx={8} cy={-45} rx={1.4} ry={2.4} fill={look.skin} />
          </g>
        </g>
        <text x={100} y={30} className="go-text">GAME OVER</text>
      </svg>
      <div className="game-over-body">
        <h1>{iconize(t("go.title"))}</h1>
        <p>{iconize(t("go.reason", {name: game.managerName, club: club.name, cash: money(club.cash)}))}</p>
        <p className="muted">{iconize(t("go.summary", {seasons, season: game.gameOver?.season ?? game.season, week: game.gameOver?.week ?? game.week}))}</p>
        <button className="btn primary big" onClick={quit}>{iconize(t("go.newGame"))} ▶</button>
      </div>
    </div>
  );
}
