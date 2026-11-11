import {useEffect, useState, useRef} from "react";
import {ENERGY_COST_MATCH, SEASON_WEEKS} from "../game/constants";
import {energySpent} from "./effects";
import {Icon, type IconName, iconize} from "./Icon";
import {FlagIcon} from "./Flag";
import {clubSlots, ENERGY_MAX, MIN_PLAYERS} from "../game/constants";
import {fixtureWeek, nextUserFixture, userClub} from "../game/helpers";
import {lineupProblems, pickBestLineup} from "../game/lineup";
import {CrestOf, Modal} from "./common";
import {unseenScouted} from "../game/transfers";
import {recentSpend} from "../game/finance";
import {dailyToCollect, ensureDaily} from "../game/daily";
import {wheelStatus} from "../game/wheel";
import {claimable} from "../game/album";
import {openTiers, thisWeek} from "../game/spending";
import {today} from "./DailyTasks";
import {claimDailyBonus, msToNextEnergy, regenerateEnergy} from "../game/monetization";
import {finishWeek, startWeek} from "../game/week";
import {useT, type TKey} from "../i18n";
import {clubPlayers} from "../game/ratings";
import type {GameState} from "../game/types";
import {useGame, useGameState, type View} from "../store";
import {ManagerAvatar, defaultManagerLook} from "./Avatar";
import {ContractModal} from "./ContractModal";
import {LiveMatchViewer, MatchViewer} from "./MatchViewer";
import {GameOver} from "./GameOver";
import {diamondBurst} from "./effects";
import {ManagerProfile} from "./ManagerProfile";
import {LevelRing} from "./ManagerLevel";
import {TrophyCelebration} from "./TrophyCelebration";
import {BoardWarningPopup} from "./BoardWarning";
import {DailyWheelPopup} from "./LuckyWheel";
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
import {Album} from "./views/Album";
import {National} from "./views/National";
import {Tournament} from "./views/Tournament";
import {tournamentOf} from "../game/national";
import {dueNationalMatch, startNationalMatch} from "../game/national";
import {DecisionsDialog} from "./DecisionsDialog";
import {pendingDecisions, readForceDecisions} from "./decisions";
import {CodeSalesPage, FriendSalesWatcher} from "./FriendSale";
import {useFriendCupBadge} from "./friendCupBadge";
import {Pals} from "./views/Pals";
import {ProfileSync} from "./ProfileSync";
import {DealEffects} from "./DealEffects";
import {CoachTips} from "./CoachTips";
import {PalWatcher, palsTodo, usePals} from "./palStore";

const ICONS: Record<View, IconName> = {
  overview: "home",
  inbox: "mail",
  squad: "users",
  tactics: "clipboard",
  training: "dumbbell",
  fixtures: "calendar",
  table: "list",
  cup: "trophy",
  friends: "users",
  national: "flag",
  tournament: "trophy",
  pals: "user",
  stadium: "stadium",
  transfers: "swap",
  codes: "tag",
  contracts: "pen",
  finance: "wallet",
  storage: "boot",
  album: "trophy",
  // The Shop keeps the old outlined diamond in the menu.
  shop: "diamondLine",
  settings: "settings",
};

/** The menu: four groups of pages (and the round play button in the middle of the bar). */
const NAV_GROUPS: {id: "home" | "team" | "matches" | "club"; icon: IconName; views: View[]}[] = [
  {id: "home", icon: "home", views: ["overview", "inbox", "pals", "storage"]},
  {id: "team", icon: "users", views: ["squad", "tactics", "training"]},
  {id: "matches", icon: "ball", views: ["fixtures", "table", "cup"]},
  {id: "club", icon: "shield", views: ["finance", "transfers", "shop", "settings"]},
];
/** Pages shown as a sub-tab of another (three tabs fit a phone): Contracts under Squad, Arena under Finance. */
const SUB_PAGES: Partial<Record<View, View[]>> = {squad: ["squad", "contracts", "national"], transfers: ["transfers", "codes"], finance: ["finance", "stadium"], storage: ["storage", "album"], cup: ["cup", "friends", "tournament"]};
/** The national team's page is only there once the manager coaches a country (set as the menu is drawn). */
let NATIONAL_ON = false;
/** The tournament's page (the World Cup or the Euros of the year, e.g. "VM 2028") only in a year with one, once the manager coaches a country. */
let TOURNAMENT_LABEL: string | null = null;
const pagesOf = (v: View): View[] => (SUB_PAGES[v] ?? [v]).filter((p) => (p !== "national" || NATIONAL_ON) && (p !== "tournament" || (NATIONAL_ON && TOURNAMENT_LABEL !== null)));
const navLabel = (v: View, t: (k: never) => string) => (v === "tournament" ? TOURNAMENT_LABEL ?? "" : iconize(t(`nav.${v}` as never)));
/** The tab a page sits under (itself, or the page it's a sub-tab of). */
const tabOf = (v: View): View => (Object.entries(SUB_PAGES).find(([, subs]) => subs!.includes(v))?.[0] as View | undefined) ?? v;
/** The group a page is in. */
const groupOf = (v: View) => NAV_GROUPS.find((g) => g.views.includes(tabOf(v)));
/** Every page a group holds, sub-tabs too (for the guide to find a page's group). */
const groupPages = (g: (typeof NAV_GROUPS)[number]) => g.views.flatMap((v) => pagesOf(v));

/** A page's icon in the menus; the national team's page shows the flag of the country the manager coaches (the flag icon until then). */
function NavIcon({view, size}: {view: View; size?: number}) {
  const country = useGameState().national?.country;
  if (view === "national" && country) return <FlagIcon code={country} size={size ? size + 4 : 30} />;
  return <Icon name={ICONS[view]} size={size} />;
}

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
  national: National,
  tournament: Tournament,
  pals: Pals,
  stadium: Stadium,
  transfers: Transfers,
  codes: CodeSalesPage,
  contracts: Contracts,
  finance: Finance,
  shop: Shop,
  storage: Storage,
  album: Album,
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
      <FriendSalesWatcher />
      <ProfileSync />
      <PalWatcher />
      <DealEffects />
      <CoachTips />
      <BoardWarningPopup />
      <DailyWheelPopup />
      <TutorialCoach />
      <ToastView />
    </div>
  );
}

/** Unread mail and daily rewards to collect, shown as a number on a page (and its group). */
/** Our players whose contract ends this season (the ones with the warning triangle on the contracts page): yellow, and red in the last weeks of the season when it is about to happen. */
function expiringContracts(game: GameState): {tone: "red" | "yellow" | null; n: number} {
  const now = clubPlayers(game, game.userClubId).filter((p) => p.contract.expiresSeason <= game.season).length;
  if (now === 0) return {tone: null, n: 0};
  return {tone: game.week > SEASON_WEEKS - 10 ? "red" : "yellow", n: now};
}

function useBadges(): Partial<Record<View, number>> {
  const game = useGameState();
  const friends = useFriendCupBadge();
  const pals = palsTodo(usePals());
  return {
    inbox: game.inbox.filter((m) => !m.read).length,
    // Contracts running out: this season (red) or next (yellow).
    contracts: expiringContracts(game).n,
    // The last weeks spent more than came in: a red circle (see the economy page).
    finance: (recentSpend(game)?.used ?? 0) > 100 ? 1 : 0,
    // The daily tasks to collect, and the wheel when today's free spin is not taken.
    overview: dailyToCollect(game.daily) + (wheelStatus(game, today()).free ? 1 : 0),
    // Kit bought but not put on anyone yet.
    storage: game.gearBag?.length ?? 0,
    // Things in the album to open (each gives diamonds).
    album: claimable(game).length,
    // Levels of the weekly spending package open and not picked from.
    shop: openTiers(game, thisWeek()).length,
    // Bids on our players, and the ones listed for sale and scouted (a blue reminder, like the tabs).
    transfers: game.incomingBids.length
      + Object.values(game.players).filter((p) => p.clubId === game.userClubId && (p.transferListed || p.loanListed)).length
      + unseenScouted(game).length,
    // Players up for sale to a friend with a code, waiting to be bought.
    codes: Object.keys(game.friendSales ?? {}).length,
    // Things to do in the friends' cup: offers to answer, matches to see, prizes, rounds to play.
    friends,
    // Friends: offers to answer and invitations to cups.
    pals,
  };
}

/** Pages whose number is a reminder rather than something waiting (shown in blue, not red). */
const BLUE_BADGES: View[] = ["storage", "codes", "transfers", "album", "shop"];
/** How soon the first contract runs out: this season (red), next season (yellow), or no hurry (set as the menu is drawn). */
let CONTRACT_TONE: "red" | "yellow" | null = null;
type BadgeTone = "red" | "warn" | "blue";
/** A page's colour: red is to be done, yellow a contract running out next season, blue a reminder. */
const toneOf = (v: View): BadgeTone => (v === "contracts" && CONTRACT_TONE === "yellow" ? "warn" : BLUE_BADGES.includes(v) ? "blue" : "red");
const TONE_CLASS: Record<BadgeTone, string> = {red: "badge", warn: "badge warn", blue: "badge blue"};
const badgeClass = (v: View) => TONE_CLASS[toneOf(v)];
/** A menu's number: the worst colour among its pages (red, then yellow, then blue), with how many of that colour. */
function worstBadge(pages: View[], badges: Partial<Record<View, number>>): {tone: BadgeTone; n: number} | null {
  for (const tone of ["red", "warn", "blue"] as const) {
    const n = pages.filter((p) => toneOf(p) === tone).reduce((k, p) => k + (badges[p] ?? 0), 0);
    if (n > 0) return {tone, n};
  }
  return null;
}

/**
 * The bar at the bottom: two groups, the round play button, two groups. Tapping a group
 * pops its pages out in an arc above the bar.
 */
function Nav() {
  const {t} = useT();
  const natGame = useGameState();
  NATIONAL_ON = !!natGame.national;
  CONTRACT_TONE = expiringContracts(natGame).tone;
  // The year's tournament, or the last one played (to look at after it is over).
  const lastTournament = natGame.national?.tournament;
  TOURNAMENT_LABEL = lastTournament ? `${t(`national.comp.${lastTournament.comp}` as never)} ${lastTournament.season}` : tournamentOf(natGame.season, natGame.national?.country) ? `${t(`national.comp.${tournamentOf(natGame.season, natGame.national?.country)}` as never)} ${natGame.season}` : null;
  const view = useGame((s) => s.view);
  const setView = useGame((s) => s.setView);
  const badges = useBadges();
  const [open, setOpen] = useState<string | null>(null);
  const group = NAV_GROUPS.find((g) => g.id === open);
  const current = groupOf(view);
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
      {(() => {
        const w = worstBadge(groupPages(g), badges);
        return w && <span className={TONE_CLASS[w.tone]}>{w.n}</span>;
      })()}
    </button>
  );
  return (
    <>
      {/* The arc: the group's pages as round buttons, popped out over the bar. */}
      {group && (
        <div className="nav-arc-backdrop" onClick={() => setOpen(null)}>
          <div className="nav-arc" style={{"--n": group.views.length} as React.CSSProperties}>
            {/* Settings has its own button by the Club tabs, not a place in the menu. */}
            {groupPages(group).filter((v) => v !== "settings").map((v, i, pages) => {
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
                  <span className="arc-circle"><NavIcon view={v} size={undefined} /></span>
                  <span className="arc-label">{navLabel(v, t)}</span>
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
  NATIONAL_ON = !!useGameState().national;
  const view = useGame((s) => s.view);
  const setView = useGame((s) => s.setView);
  const badges = useBadges();
  const group = groupOf(view);
  const tab = tabOf(view);
  const subs = SUB_PAGES[tab] ? pagesOf(tab) : undefined;
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
            <span>{navLabel(v, t)}</span>
            {/* The tab counts its sub-pages too (red: to do, blue: reminders). */}
            {(() => {
              const w = worstBadge(pagesOf(v), badges);
              return w && <span className={TONE_CLASS[w.tone]}>{w.n}</span>;
            })()}
          </button>
        ))}
        {group.views.includes("settings") && (
          <button role="tab" aria-selected={view === "settings"} data-tour="nav-settings" className={view === "settings" ? "pill-tab icon-only active" : "pill-tab icon-only"} title={t("nav.settings")} aria-label={t("nav.settings")} onClick={() => setView("settings")}>
            <Icon name={ICONS.settings} size={18} />
          </button>
        )}
      </div>
      {/* Sub-tabs: e.g. the squad and their contracts. */}
      {subs && (
        <div className="real-tabs" role="tablist">
          {subs.map((v) => (
            <button key={v} role="tab" aria-selected={v === view} data-tour={`nav-${v}`} className={v === view ? "real-tab active" : "real-tab"} onClick={() => setView(v)}>
              <NavIcon view={v} size={18} />
              <span>{navLabel(v, t)}</span>
              {(badges[v] ?? 0) > 0 && <span className={badgeClass(v)}>{badges[v]}</span>}
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
  // Questions in the mail that must be answered first (a setting).
  const [decisions, setDecisions] = useState(false);
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
  // The national team's match this week (played first, like any other: its tactics, then the kick-off).
  const nationalDue = dueNationalMatch(game);
  const advance = () => {
    if (readForceDecisions() && pendingDecisions(game).length > 0) {
      setDecisions(true);
      return;
    }
    if (nationalDue) {
      if (view !== "national") {
        setView("national");
        window.scrollTo({top: 0});
        return;
      }
      act((g, rng) => startNationalMatch(g, rng));
      return;
    }
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
  const kickOff = nationalDue ? view === "national" : isMatchWeek && view === "tactics";
  const label = nationalDue ? t(view === "national" ? "top.playNational" : "top.toNational") : kickOff ? t("top.playMatch") : isMatchWeek ? t("top.toTactics") : t("top.nextWeek");
  // Who can play in the line-up as it stands, and whether that's too few to start.
  const fielded = clubSlots(club).length - gaps;
  const tooFew = gaps > 0 && fielded < MIN_PLAYERS;
  return (
    <div className="nav-play">
      {decisions && <DecisionsDialog onClose={() => setDecisions(false)} />}
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
        {/* Kick-off: the club's FZ badge (the app icon); otherwise the play arrow. */}
        {kickOff ? <img className="play-logo" src="/icon-192.png" alt="" /> : <Icon name="play" size={28} />}
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
    <header className="topbar" style={{"--club": club.color} as React.CSSProperties}>
      {profile && <ManagerProfile onClose={() => setProfile(false)} />}
      {/* The club (to its tactics) and, right after it, the manager (to their profile). */}
      <div className="topbar-id">
        <button className="topbar-club" onClick={() => setView("tactics")} title={t("nav.tactics")}>
          <CrestOf club={club} />
          <span className="topbar-club-text">
            <strong>{club.name}</strong>
            <small className="topbar-when">{iconize(t("top.seasonWeek", {season: game.season, week: game.week}))}</small>
          </span>
        </button>
        <button className="topbar-manager" onClick={() => setProfile(true)} title={game.managerName}>
          <LevelRing size={66}><ManagerAvatar look={game.managerLook ?? defaultManagerLook(game.managerName)} size={66} tie={club.color} /></LevelRing>
          <span>{game.managerName}</span>
        </button>
      </div>
      <div className="topbar-stats">
        {/* Money, energy and diamonds. */}
        <button className={club.cash < 0 ? "chip hud-cash neg" : "chip hud-cash"} onClick={() => setView("finance")} title={t("fin.cash")}>
          <span className="chip-ico cash"><Icon name="coins" size={16} /></span>
          <span className="chip-val">{money(club.cash)}</span>
        </button>
        <button className="chip hud-energy" onClick={() => setView("shop")} title={t("shop.energy")}>
          <span className="chip-ico energy"><Icon name="bolt" size={16} /></span>
          <span className="chip-val">{m.energy}/{ENERGY_MAX}</span>
          {wait > 0 && <small className="timer">{formatWait(wait)}</small>}
        </button>
        <button className="chip hud-diamonds" onClick={() => setView("shop")} title={t("shop.diamonds")}>
          <span className="chip-ico gem"><Icon name="diamond" size={16} /></span>
          <span className="chip-val">{m.diamonds}</span>
        </button>
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
