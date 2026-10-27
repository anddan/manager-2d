import {useEffect, useState, useRef} from "react";
import {ENERGY_COST_MATCH} from "../game/constants";
import {energySpent} from "./effects";
import {Icon, type IconName, iconize} from "./Icon";
import {clubSlots, ENERGY_MAX, MIN_PLAYERS} from "../game/constants";
import {fixtureWeek, nextUserFixture, userClub} from "../game/helpers";
import {lineupProblems, pickBestLineup} from "../game/lineup";
import {Modal} from "./common";
import {dailyToCollect, ensureDaily} from "../game/daily";
import {claimDailyBonus, msToNextEnergy, regenerateEnergy} from "../game/monetization";
import {finishWeek, startWeek} from "../game/week";
import {useT, type TKey} from "../i18n";
import {useGame, useGameState, type View} from "../store";
import {ManagerAvatar, defaultManagerLook} from "./Avatar";
import {ContractModal} from "./ContractModal";
import {LiveMatchViewer, MatchViewer} from "./MatchViewer";
import {GameOver} from "./GameOver";
import {diamondBurst} from "./effects";
import {ManagerProfile} from "./ManagerProfile";
import {TrophyCelebration} from "./TrophyCelebration";
import {BoardWarningPopup} from "./BoardWarning";
import {TutorialCoach} from "./TutorialCoach";
import {useUpdates} from "./updates";
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
import {Cup} from "./views/Cup";
import {FriendCup} from "./views/FriendCup";
import {Stadium} from "./views/Stadium";
import {Tactics} from "./views/Tactics";
import {Training} from "./views/Training";
import {Transfers} from "./views/Transfers";
import {Storage} from "./views/Storage";

const ICONS: Record<View, IconName> = {
  overview: "home",
  inbox: "mail",
  squad: "users",
  tactics: "clipboard",
  training: "dumbbell",
  fixtures: "calendar",
  table: "list",
  cup: "trophy",
  friends: "handshake",
  stadium: "stadium",
  transfers: "swap",
  contracts: "pen",
  finance: "wallet",
  storage: "boot",
  shop: "diamond",
  settings: "settings",
};

/** The menu: four groups of pages (and the round play button in the middle of the bar). */
const NAV_GROUPS: {id: "home" | "team" | "matches" | "club"; icon: IconName; views: View[]}[] = [
  {id: "home", icon: "home", views: ["overview", "inbox", "storage"]},
  {id: "team", icon: "users", views: ["squad", "tactics", "training"]},
  {id: "matches", icon: "ball", views: ["fixtures", "table", "cup"]},
  {id: "club", icon: "shield", views: ["finance", "transfers", "shop", "settings"]},
];
/** Pages shown as a sub-tab of another (three tabs fit a phone): Contracts under Squad, Arena under Finance. */
const SUB_PAGES: Partial<Record<View, View[]>> = {squad: ["squad", "contracts"], finance: ["finance", "stadium"], cup: ["cup", "friends"]};
/** The tab a page sits under (itself, or the page it's a sub-tab of). */
const tabOf = (v: View): View => (Object.entries(SUB_PAGES).find(([, subs]) => subs!.includes(v))?.[0] as View | undefined) ?? v;
/** The group a page is in. */
const groupOf = (v: View) => NAV_GROUPS.find((g) => g.views.includes(tabOf(v)));
/** Every page a group holds, sub-tabs too (for the guide to find a page's group). */
const groupPages = (g: (typeof NAV_GROUPS)[number]) => g.views.flatMap((v) => SUB_PAGES[v] ?? [v]);

const SCREENS: Record<View, () => React.JSX.Element> = {
  overview: Overview,
  inbox: Inbox,
  squad: Squad,
  tactics: Tactics,
  training: Training,
  fixtures: Fixtures,
  table: Table,
  cup: Cup,
  friends: FriendCup,
  stadium: Stadium,
  transfers: Transfers,
  contracts: Contracts,
  finance: Finance,
  shop: Shop,
  storage: Storage,
  settings: Settings,
};

export function App() {
  // A phone with the game on its home screen picks up each new deploy.
  useUpdates();
  const game = useGame((s) => s.game);
  const lang = useGame((s) => s.lang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  if (!game) return <NewGame />;
  if (game.gameOver) return <GameOver />;
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

  useDragScroll();

  // Daily login diamonds, once per calendar day.
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const given = act((g) => claimDailyBonus(g.monetization, today));
    // Today's tasks.
    act((g) => ensureDaily(g, today));
    if (given > 0) {
      notify("toast.dailyBonus", {n: given}, "good");
      // Once the page has drawn, so the diamonds have somewhere to fly to.
      setTimeout(() => diamondBurst(null, given), 600);
    }
  }, [act, notify]);

  return (
    <div className="app">
      <div className="main">
        <TopBar />
        <main className="content">
          <GroupTabs />
          <Screen />
        </main>
      </div>
      <Nav />
      {/* Later dialogs stack on top: a player opened from a match, a contract from a player. */}
      {matchId && <MatchViewer fixtureId={matchId} />}
      {/* Open whenever a live match is under way, also after a reload. */}
      {liveFixture && <LiveMatchViewer key={liveFixture} />}
      {playerId && <PlayerModal key={playerId} playerId={playerId} />}
      {negotiation && <ContractModal />}
      <TrophyCelebration />
      <BoardWarningPopup />
      <TutorialCoach />
      <ToastView />
    </div>
  );
}

/** Unread mail and daily rewards to collect, shown as a number on a page (and its group). */
function useBadges(): Partial<Record<View, number>> {
  const game = useGameState();
  return {
    inbox: game.inbox.filter((m) => !m.read).length,
    overview: dailyToCollect(game.daily),
    // Kit bought but not put on anyone yet.
    storage: game.gearBag?.length ?? 0,
  };
}

/** Pages whose number is a reminder rather than something waiting (shown in blue, not red). */
const BLUE_BADGES: View[] = ["storage"];
const badgeClass = (v: View) => (BLUE_BADGES.includes(v) ? "badge blue" : "badge");

/**
 * The bar at the bottom: two groups, the round play button, two groups. Tapping a group
 * pops its pages out in an arc above the bar.
 */
function Nav() {
  const {t} = useT();
  const view = useGame((s) => s.view);
  const setView = useGame((s) => s.setView);
  const badges = useBadges();
  const [open, setOpen] = useState<string | null>(null);
  const group = NAV_GROUPS.find((g) => g.id === open);
  const current = groupOf(view);
  // A group's number: what's waiting (red) first, else the reminders (blue).
  const count = (g: (typeof NAV_GROUPS)[number], blue: boolean) => groupPages(g).filter((v) => BLUE_BADGES.includes(v) === blue).reduce((n, v) => n + (badges[v] ?? 0), 0);
  const groupButton = (g: (typeof NAV_GROUPS)[number]) => (
    <button
      key={g.id}
      className={`nav-item ${g.id === current?.id ? "active" : ""} ${g.id === open ? "open" : ""}`}
      data-nav-views={groupPages(g).join(" ")}
      onClick={() => setOpen(open === g.id ? null : g.id)}
      aria-expanded={g.id === open}
    >
      <Icon name={g.icon} />
      <span className="nav-label">{iconize(t(`nav.group.${g.id}`))}</span>
      {count(g, false) > 0 ? <span className="badge">{count(g, false)}</span> : count(g, true) > 0 && <span className="badge blue">{count(g, true)}</span>}
    </button>
  );
  return (
    <>
      {/* The arc: the group's pages as round buttons, popped out over the bar. */}
      {group && (
        <div className="nav-arc-backdrop" onClick={() => setOpen(null)}>
          <div className="nav-arc" style={{"--n": group.views.length} as React.CSSProperties}>
            {groupPages(group).map((v, i, pages) => {
              // Spread evenly over an arc above the bar, from left to right.
              const n = pages.length;
              const angle = n === 1 ? 90 : 160 - (140 * i) / (n - 1);
              const r = n > 3 ? 128 : 104;
              const x = Math.cos((angle * Math.PI) / 180) * r;
              const y = -Math.sin((angle * Math.PI) / 180) * r;
              return (
                <button
                  key={v}
                  data-tour={`nav-${v}`}
                  className={v === view ? "arc-item active" : "arc-item"}
                  style={{transform: `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`, animationDelay: `${i * 30}ms`}}
                  onClick={(e) => { e.stopPropagation(); setView(v); setOpen(null); window.scrollTo({top: 0}); }}
                >
                  <span className="arc-circle"><Icon name={ICONS[v]} /></span>
                  <span className="arc-label">{iconize(t(`nav.${v}`))}</span>
                  {(badges[v] ?? 0) > 0 && <span className={badgeClass(v)}>{badges[v]}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <nav className="nav" aria-label={t("nav.label")}>
        {groupButton(NAV_GROUPS[0])}
        {groupButton(NAV_GROUPS[1])}
        <PlayButton />
        {groupButton(NAV_GROUPS[2])}
        {groupButton(NAV_GROUPS[3])}
      </nav>
    </>
  );
}

/** The pages of the group being shown, as pill tabs on top of the page. */
function GroupTabs() {
  const {t} = useT();
  const view = useGame((s) => s.view);
  const setView = useGame((s) => s.setView);
  const badges = useBadges();
  const group = groupOf(view);
  const tab = tabOf(view);
  const subs = SUB_PAGES[tab];
  // The chosen tab scrolled into sight (the row may be wider than a phone).
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    row.current?.querySelector(".pill-tab.active")?.scrollIntoView({block: "nearest", inline: "center"});
  }, [view]);
  if (!group) return null;
  return (
    <>
      <div className="group-tabs" role="tablist" ref={row}>
        {/* Settings is reached from the Club menu only, not a tab of its own. */}
        {group.views.filter((v) => v !== "settings").map((v) => (
          <button key={v} role="tab" aria-selected={v === tab} data-tour={`nav-${v}`} className={v === tab ? "pill-tab active" : "pill-tab"} onClick={() => setView(v)}>
            <Icon name={ICONS[v]} size={18} />
            <span>{iconize(t(`nav.${v}`))}</span>
            {(badges[v] ?? 0) > 0 && <span className={badgeClass(v)}>{badges[v]}</span>}
          </button>
        ))}
      </div>
      {/* Sub-tabs: e.g. the squad and their contracts. */}
      {subs && (
        <div className="real-tabs" role="tablist">
          {subs.map((v) => (
            <button key={v} role="tab" aria-selected={v === view} data-tour={`nav-${v}`} className={v === view ? "real-tab active" : "real-tab"} onClick={() => setView(v)}>
              <Icon name={ICONS[v]} size={18} />
              <span>{iconize(t(`nav.${v}`))}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * The round button in the middle of the bar: on to the next week, or (a match week) to
 * the team in Tactics and then kick-off. Asks first if the team has gaps.
 */
function PlayButton() {
  const {t} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  const setView = useGame((s) => s.setView);
  const view = useGame((s) => s.view);
  const club = userClub(game);
  const next = nextUserFixture(game);
  const isMatchWeek = !!next && fixtureWeek(next) === game.week;
  const [gaps, setGaps] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const play = () => {
    const result = act((g, rng) => {
      const started = startWeek(g, rng, Date.now());
      if (started.ok && !started.live) finishWeek(g, rng);
      return started;
    });
    if (!result.ok) {
      notify(result.reason, undefined, "error");
      setView("shop");
      return;
    }
    // Into a match: its energy goes, shown flying off the button.
    if (isMatchWeek) energySpent(button.current, ENERGY_COST_MATCH);
  };
  const advance = () => {
    // Before a match: first a look at the team in Tactics; the next press kicks off.
    if (isMatchWeek && view !== "tactics") {
      setView("tactics");
      window.scrollTo({top: 0});
      return;
    }
    const missing = isMatchWeek ? lineupProblems(game, club).length : 0;
    if (missing > 0) {
      setGaps(missing);
      return;
    }
    play();
  };
  /** Picks the best eleven, then plays. */
  const bestAndPlay = () => {
    act((g) => {
      const c = g.clubs[g.userClubId];
      const best = pickBestLineup(g, c, clubSlots(c));
      c.lineup = best.lineup;
      c.bench = best.bench;
    });
    setGaps(0);
    play();
  };
  // A match week: first to the team in Tactics (blue play); there, ready to kick off (green ball).
  const kickOff = isMatchWeek && view === "tactics";
  const label = kickOff ? t("top.playMatch") : isMatchWeek ? t("top.toTactics") : t("top.nextWeek");
  // Who can play in the line-up as it stands, and whether that's too few to start.
  const fielded = clubSlots(club).length - gaps;
  const tooFew = gaps > 0 && fielded < MIN_PLAYERS;
  return (
    <div className="nav-play">
      {gaps > 0 && (
        <Modal compact title={<><Icon name="warn" size={20} /> {iconize(t("top.gapsTitle"))}</>} onClose={() => setGaps(0)}>
          {/* Gaps are filled before kick-off; fewer than the minimum who can play is said plainly. */}
          <p>{iconize(tooFew ? t("top.tooFew", {n: fielded, min: MIN_PLAYERS}) : t("top.gapsText", {n: gaps, total: clubSlots(club).length}))}</p>
          <div className="btn-row dialog-actions">
            <button className="btn" onClick={() => setGaps(0)}>{iconize(t("top.gapsBack"))}</button>
            <button className="btn primary" onClick={bestAndPlay}>{iconize(t("top.gapsBest"))}</button>
          </div>
        </Modal>
      )}
      <button ref={button} className={kickOff ? "play-circle continue match" : "play-circle continue"} onClick={advance} aria-label={label} title={label}>
        <Icon name={kickOff ? "ball" : "play"} size={28} />
      </button>
      <span className="nav-play-label">{label}</span>
    </div>
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
  const setView = useGame((s) => s.setView);
  const now = useNow(1000);
  const [profile, setProfile] = useState(false);
  const club = userClub(game);
  // Show regenerated energy without writing the save every second.
  const m = {...game.monetization};
  regenerateEnergy(m, now);
  const wait = msToNextEnergy(m, now);
  return (
    <header className="topbar">
      {profile && <ManagerProfile onClose={() => setProfile(false)} />}
      {/* The club (to its tactics) and, right after it, the manager (to their profile). */}
      <div className="topbar-id">
        <button className="topbar-club" onClick={() => setView("tactics")} title={t("nav.tactics")}>
          <span className="crest" style={{background: club.color, color: club.color2}}>{club.short}</span>
          <span className="topbar-club-text">
            <strong>{club.name}</strong>
            <small>{iconize(t("top.seasonWeek", {season: game.season, week: game.week}))}</small>
          </span>
        </button>
        <button className="topbar-manager" onClick={() => setProfile(true)} title={game.managerName}>
          <ManagerAvatar look={game.managerLook ?? defaultManagerLook(game.managerName)} size={34} tie={club.color} />
          <span>{game.managerName}</span>
        </button>
      </div>
      <div className="topbar-stats">
        <button className="chip" onClick={() => setView("finance")} title={t("fin.cash")}><Icon name="coins" size={16} /> {money(club.cash)}</button>
        <button className="chip" onClick={() => setView("shop")} title={t("shop.energy")}>
          <Icon name="bolt" size={16} /> {m.energy}/{ENERGY_MAX}
          {wait > 0 && <small className="timer">{formatWait(wait)}</small>}
        </button>
        <button className="chip" onClick={() => setView("shop")} title={t("shop.diamonds")}><Icon name="diamond" size={16} /> {m.diamonds}</button>
      </div>
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
      {iconize(tx(toast.key, toast.params))}
    </div>
  );
}

export type {TKey};

/**
 * Rows wider than the screen (tabs, filters, choices) can be dragged sideways with the mouse,
 * as with a finger. A drag of a few pixels scrolls, and the click at its end is swallowed.
 */
function useDragScroll() {
  useEffect(() => {
    let drag: {el: HTMLElement; x: number; left: number; moved: boolean} | null = null;
    const scroller = (start: Element | null): HTMLElement | null => {
      for (let el = start as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
        const o = getComputedStyle(el).overflowX;
        if ((o === "auto" || o === "scroll") && el.scrollWidth > el.clientWidth + 2) return el;
      }
      return null;
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      // Tables scroll with their own bar; the pitch's shirts are dragged for real.
      if ((e.target as Element).closest("table, .pitch-board, input, select, textarea")) return;
      const el = scroller(e.target as Element);
      if (el) drag = {el, x: e.clientX, left: el.scrollLeft, moved: false};
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 4) drag.moved = true;
      if (drag.moved) drag.el.scrollLeft = drag.left - dx;
    };
    const up = () => {
      if (drag?.moved) {
        const swallow = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault(); };
        window.addEventListener("click", swallow, {capture: true, once: true});
        setTimeout(() => window.removeEventListener("click", swallow, {capture: true}), 50);
      }
      drag = null;
    };
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);
}
