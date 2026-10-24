import {useEffect, useState} from "react";
import {ENERGY_MAX} from "../game/constants";
import {fixtureWeek, nextUserFixture, userClub} from "../game/helpers";
import {claimDailyBonus, msToNextEnergy, regenerateEnergy} from "../game/monetization";
import {finishWeek, startWeek} from "../game/week";
import {useT, type TKey} from "../i18n";
import {useGame, useGameState, VIEWS, type View} from "../store";
import {ManagerAvatar, defaultManagerLook} from "./Avatar";
import {ContractModal} from "./ContractModal";
import {LiveMatchViewer, MatchViewer} from "./MatchViewer";
import {NewGame} from "./NewGame";
import {PlayerModal} from "./PlayerModal";
import {Contracts} from "./views/Contracts";
import {Finance} from "./views/Finance";
import {Fixtures} from "./views/Fixtures";
import {Inbox} from "./views/Inbox";
import {Overview} from "./views/Overview";
import {Settings} from "./views/Settings";
import {Shop} from "./views/Shop";
import {Squad} from "./views/Squad";
import {Table} from "./views/Table";
import {Tactics} from "./views/Tactics";
import {Training} from "./views/Training";
import {Transfers} from "./views/Transfers";

const ICONS: Record<View, string> = {
  overview: "🏠",
  inbox: "✉️",
  squad: "👥",
  tactics: "📋",
  training: "🏋️",
  fixtures: "📅",
  table: "🏆",
  transfers: "🔄",
  contracts: "✍️",
  finance: "💰",
  shop: "💎",
  settings: "⚙️",
};

const SCREENS: Record<View, () => React.JSX.Element> = {
  overview: Overview,
  inbox: Inbox,
  squad: Squad,
  tactics: Tactics,
  training: Training,
  fixtures: Fixtures,
  table: Table,
  transfers: Transfers,
  contracts: Contracts,
  finance: Finance,
  shop: Shop,
  settings: Settings,
};

export function App() {
  const game = useGame((s) => s.game);
  const lang = useGame((s) => s.lang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  if (!game) return <NewGame />;
  return <Game />;
}

function Game() {
  const view = useGame((s) => s.view);
  const playerId = useGame((s) => s.playerId);
  const matchId = useGame((s) => s.matchFixtureId);
  const negotiation = useGame((s) => s.negotiation);
  const liveFixture = useGame((s) => s.game?.liveMatch?.fixtureId);
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  const Screen = SCREENS[view];

  // Daily login diamonds, once per calendar day.
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const given = act((g) => claimDailyBonus(g.monetization, today));
    if (given > 0) notify("toast.dailyBonus", {n: given}, "good");
  }, [act, notify]);

  return (
    <div className="app">
      <Nav />
      <div className="main">
        <TopBar />
        <main className="content">
          <Screen />
        </main>
      </div>
      {/* Later dialogs stack on top: a player opened from a match, a contract from a player. */}
      {matchId && <MatchViewer fixtureId={matchId} />}
      {/* Open whenever a live match is under way, also after a reload. */}
      {liveFixture && <LiveMatchViewer key={liveFixture} />}
      {playerId && <PlayerModal key={playerId} playerId={playerId} />}
      {negotiation && <ContractModal />}
      <ToastView />
    </div>
  );
}

function Nav() {
  const {t} = useT();
  const view = useGame((s) => s.view);
  const setView = useGame((s) => s.setView);
  const game = useGameState();
  const unread = game.inbox.filter((m) => !m.read).length;
  return (
    <nav className="nav" aria-label={t("nav.label")}>
      <div className="brand">⚽ <span>Manager 2D</span></div>
      {VIEWS.map((v) => (
        <button key={v} className={v === view ? "nav-item active" : "nav-item"} onClick={() => setView(v)} aria-current={v === view ? "page" : undefined}>
          <span className="nav-icon" aria-hidden>{ICONS[v]}</span>
          <span className="nav-label">{t(`nav.${v}`)}</span>
          {v === "inbox" && unread > 0 && <span className="badge">{unread}</span>}
        </button>
      ))}
    </nav>
  );
}

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function TopBar() {
  const {t, money} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  const setView = useGame((s) => s.setView);
  const now = useNow(1000);
  const club = userClub(game);
  // Show regenerated energy without writing the save every second.
  const m = {...game.monetization};
  regenerateEnergy(m, now);
  const wait = msToNextEnergy(m, now);
  const next = nextUserFixture(game);
  const isMatchWeek = !!next && fixtureWeek(next) === game.week;

  // Match weeks open the live match; finishing it moves the week on.
  const advance = () => {
    const result = act((g, rng) => {
      const started = startWeek(g, rng, Date.now());
      if (started.ok && !started.live) finishWeek(g, rng);
      return started;
    });
    if (!result.ok) {
      notify(result.reason, undefined, "error");
      setView("shop");
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-club">
        <span className="crest" style={{background: club.color, color: club.color2}}>{club.short}</span>
        <div>
          <strong>{club.name}</strong>
          <small>{t("top.seasonWeek", {season: game.season, week: game.week})}</small>
        </div>
      </div>
      <button className="topbar-manager" onClick={() => setView("settings")} title={game.managerName}>
        <ManagerAvatar look={game.managerLook ?? defaultManagerLook(game.managerName)} size={34} tie={club.color} />
        <span>{game.managerName}</span>
      </button>
      <div className="topbar-stats">
        <span className="chip" title={t("fin.cash")}>💰 {money(club.cash)}</span>
        <button className="chip" onClick={() => setView("shop")} title={t("shop.energy")}>
          ⚡ {m.energy}/{ENERGY_MAX}
          {wait > 0 && <small className="timer">{formatWait(wait)}</small>}
        </button>
        <button className="chip" onClick={() => setView("shop")} title={t("shop.diamonds")}>💎 {m.diamonds}</button>
      </div>
      <button className="btn primary continue" onClick={advance}>
        {isMatchWeek ? `${t("top.playMatch")} ⚡${1}` : t("top.nextWeek")} ▶
      </button>
    </header>
  );
}

function formatWait(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function ToastView() {
  const {tx} = useT();
  const toast = useGame((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => useGame.setState({toast: null}), 3500);
    return () => clearTimeout(id);
  }, [toast]);
  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.tone}`} role="status" onClick={() => useGame.setState({toast: null})}>
      {tx(toast.key, toast.params)}
    </div>
  );
}

export type {TKey};
