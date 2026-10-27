// The guide for new players: the assistant manager points at the next thing to
// do, with the button or area to use highlighted. Some steps move on by
// themselves once it's done (open Tactics, pick the best XI, a match starts…).
import {iconize} from "./Icon";
import {useEffect, useLayoutEffect, useState, type ReactNode} from "react";
import {TUTORIAL_STEPS, tutorialNext, tutorialSkip, type TutorialStep} from "../game/tutorial";
import {ENERGY_COST_FORZA} from "../game/constants";
import {FORZA} from "../game/match";
import {fixtureWeek, nextUserFixture} from "../game/helpers";
import type {GameState} from "../game/types";
import {useT, type TKey} from "../i18n";
import {useGame} from "../store";
import {ManagerAvatar, defaultManagerLook} from "./Avatar";
import {ControlIcon} from "./MatchViewer";

interface StepSpec {
  /** What to highlight (and put the bubble next to). "nav:<page>": that page in the menu (see findTarget). */
  target?: string;
  /** Only shown while this is on the page (the step waits otherwise). */
  showWhen?: string;
  /** A "Next" button; otherwise the step moves on by itself. */
  next?: boolean;
  /** Moves on when the target is clicked. */
  onClick?: boolean;
}

const STEPS: Record<TutorialStep, StepSpec> = {
  welcome: {next: true},
  tactics: {target: "nav:tactics"},
  bestXI: {target: '[data-tour="best-xi"]', showWhen: '[data-tour="best-xi"]', onClick: true},
  lineup: {target: ".pitch-board", showWhen: ".pitch-board", next: true},
  formation: {target: '[data-tour="formation"]', showWhen: '[data-tour="formation"]', next: true},
  // Waits for any dialog (the kit room's player picker) to be closed.
  play: {target: ".continue", showWhen: "body:not(:has(.modal-backdrop))"},
  match: {target: ".speed-group", showWhen: ".match-controls", next: true},
  orders: {target: '[data-tour="orders"]', showWhen: '[data-tour="orders"]', next: true},
  setpieces: {target: '[data-tour="orders"]', showWhen: '[data-tour="orders"]', next: true},
  forza: {target: '[data-tour="orders"]', showWhen: '[data-tour="orders"]', next: true},
  talk: {target: ".match-dialog:has(.tt-options)", showWhen: ".tt-options"},
  // After the match: back to the overview in the menu, where the last step is.
  toOverview: {target: "nav:overview", showWhen: "body:not(:has(.modal-backdrop))"},
  daily: {target: ".daily-tasks", showWhen: ".daily-tasks", next: true},
  // Tapping the manager opens the profile, where the club's name, initials and colours are changed.
  club: {target: ".topbar-manager", next: true, onClick: true},
  // Waits for the profile to be closed again.
  names: {target: "nav:squad", showWhen: "body:not(:has(.modal-backdrop))", next: true},
  // The present: to the Shop, pick up free boots, to the kit room, give them to a player.
  kit: {target: "nav:shop"},
  kitBuy: {target: ".gear-offer.free .ppack-btn", showWhen: ".gear-offer.free"},
  kitBag: {target: "nav:storage"},
  kitGive: {target: ".storage-actions .btn.primary", showWhen: ".storage-actions .btn.primary", onClick: true},
  // In the picker: the best player for them, at the top (the rest greyed out).
  kitPick: {target: ".give-picker .pick-row:first-child .pick", showWhen: ".give-picker", onClick: true},
};

/**
 * What a step points at. A page in the menu ("nav:tactics") is its button in the popped-out
 * arc or in the tabs on top of the page when one shows, else the group in the bar holding it.
 */
function findTarget(target: string): Element | null {
  if (!target.startsWith("nav:")) return document.querySelector(target);
  const page = target.slice(4);
  const shown = [...document.querySelectorAll(`[data-tour="nav-${page}"]`)].find((e) => e.getBoundingClientRect().width > 0);
  return shown ?? document.querySelector(`[data-nav-views~="${page}"]`);
}

/** The pause / play / fast-forward symbols in a text, drawn as the match's own buttons. */
const ICONS: Record<string, "pause" | "play" | "forward"> = {"⏸": "pause", "▶": "play", "⏩": "forward"};
function withIcons(text: string): ReactNode {
  return text.split(/(⏸|▶|⏩)/u).map((part, i) => (ICONS[part] ? <span key={i} className="tour-icon"><ControlIcon kind={ICONS[part]} /></span> : part));
}

export function TutorialCoach() {
  const {t} = useT();
  const game = useGame((s) => s.game);
  const view = useGame((s) => s.view);
  const act = useGame((s) => s.act);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [present, setPresent] = useState(false);
  const stepIndex = game?.tutorial?.step ?? TUTORIAL_STEPS.length;
  const step = TUTORIAL_STEPS[stepIndex] as TutorialStep | undefined;
  const spec = step ? STEPS[step] : undefined;

  // Steps that move on by themselves.
  useEffect(() => {
    if (!game || !step) return;
    if (step === "tactics" && view === "tactics") act((g) => tutorialNext(g, "tactics"));
    // The present: done in the Shop, then in the kit room.
    if (step === "kit" && view === "shop") act((g) => tutorialNext(g, "kit"));
    if (step === "kitBag" && view === "storage") act((g) => tutorialNext(g, "kitBag"));
    if (step === "toOverview" && view === "overview") act((g) => tutorialNext(g, "toOverview"));
    if (step === "play" && game.liveMatch) act((g) => tutorialNext(g, "play"));
    // The talk is over once the match has closed.
    if (step === "talk" && !game.liveMatch && !document.querySelector(".tt-options")) {
      if (game.reports.length > 0) act((g) => tutorialNext(g, "talk"));
    }
    // A match finished without its steps being seen (skipped through): on to the talk.
    if ((step === "match" || step === "orders" || step === "setpieces" || step === "forza") && !game.liveMatch && game.reports.length > 0) {
      act((g) => { if (g.tutorial) g.tutorial.step = TUTORIAL_STEPS.indexOf("talk"); });
    }
  });

  // The picker closed without a pick: back to the button that opens it. Checked a moment later,
  // since the step moves on as the button is tapped, a little before the picker has opened.
  useEffect(() => {
    if (step !== "kitPick") return;
    const id = setInterval(() => {
      if (!document.querySelector(".give-picker") && document.querySelector(".storage-actions")) {
        act((g) => { if (g.tutorial && TUTORIAL_STEPS[g.tutorial.step] === "kitPick") g.tutorial.step = TUTORIAL_STEPS.indexOf("kitGive"); });
      }
    }, 700);
    return () => clearInterval(id);
  }, [step, act]);

  // Follow the target around (it may move, open later or close).
  useLayoutEffect(() => {
    if (!spec) return;
    let frame = 0;
    const track = () => {
      const shown = !spec.showWhen || !!document.querySelector(spec.showWhen);
      setPresent(shown);
      const el = spec.target ? findTarget(spec.target) : null;
      document.querySelectorAll(".tour-target").forEach((e) => e !== el && e.classList.remove("tour-target"));
      if (el && shown) {
        el.classList.add("tour-target");
        const r = el.getBoundingClientRect();
        setRect((prev) => (prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height ? prev : r));
      } else setRect(null);
      frame = requestAnimationFrame(track);
    };
    frame = requestAnimationFrame(track);
    return () => {
      cancelAnimationFrame(frame);
      document.querySelectorAll(".tour-target").forEach((e) => e.classList.remove("tour-target"));
    };
  }, [spec]);

  // Bring each step's target into view once it's there (it may be far down, on a phone above all).
  useEffect(() => {
    if (!spec?.target) return;
    let tries = 0;
    const id = setInterval(() => {
      const el = findTarget(spec.target!);
      if (el || ++tries > 20) {
        clearInterval(id);
        // Not on a maximised match: it fills the screen already, and scrolling the box behind it moves it.
        if (el && !el.closest(".pitch-wrap.maxed")) el.scrollIntoView({behavior: "smooth", block: "center"});
      }
    }, 150);
    return () => clearInterval(id);
  }, [spec, present]);

  // Steps that move on when their button is clicked.
  useEffect(() => {
    if (!step || !spec?.onClick || !spec.target) return;
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest(spec.target!)) act((g) => tutorialNext(g, step));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [step, spec, act]);

  if (!game || !step || !spec || !present) return null;
  const look = game.managerLook ?? defaultManagerLook(game.managerName);
  // Below the target if there's room, else above; in the middle of the screen without one.
  // Kept inside the screen however tall the target or wherever it sits.
  const below = rect ? rect.bottom + 200 < window.innerHeight : false;
  const style = rect
    ? {
        left: Math.max(12, Math.min(window.innerWidth - 332, rect.left + rect.width / 2 - 160)),
        top: below ? Math.max(12, rect.bottom + 12) : undefined,
        bottom: below ? undefined : Math.max(12, Math.min(window.innerHeight - 200, window.innerHeight - rect.top + 12)),
      }
    : undefined;

  return (
    <>
      <Shade rect={rect} />
    <div className={`tour-bubble ${rect ? "" : "centred"}`} style={style} role="dialog" aria-live="polite">
      <div className="tour-head">
        <ManagerAvatar look={look} size={36} tie="#16a34a" />
        <strong>{iconize(t("tour.coach"))}</strong>
        <span className="tour-count">{stepIndex + 1}/{TUTORIAL_STEPS.length}</span>
      </div>
      <p>{withIcons(t(stepText(game, step, view), {name: game.managerName, pct: Math.round((FORZA.boost - 1) * 100), minutes: FORZA.minutes, energy: ENERGY_COST_FORZA, ...weekParams(game)}))}</p>
      <div className="tour-actions">
        <button className="btn small" onClick={() => act((g) => tutorialSkip(g))}>{iconize(t("tour.skip"))}</button>
        {spec.next && (
          <button className="btn primary small" onClick={() => act((g) => tutorialNext(g, step))}>
            {stepIndex === TUTORIAL_STEPS.length - 1 ? t("tour.done") : t("tour.next")}
          </button>
        )}
      </div>
    </div>
    </>
  );
}

/**
 * The rest of the screen, greyed out and not to be tapped: four panels round the target
 * (a gap a little bigger than it), or the whole screen when the step points at nothing.
 */
function Shade({rect}: {rect: DOMRect | null}) {
  if (!rect) return <div className="tour-shade" style={{inset: 0}} />;
  const pad = 6;
  const top = Math.max(0, rect.top - pad);
  const bottom = rect.bottom + pad;
  const left = Math.max(0, rect.left - pad);
  const right = rect.right + pad;
  return (
    <>
      <div className="tour-shade" style={{left: 0, right: 0, top: 0, height: top}} />
      <div className="tour-shade" style={{left: 0, right: 0, top: bottom, bottom: 0}} />
      <div className="tour-shade" style={{left: 0, width: left, top, height: bottom - top}} />
      <div className="tour-shade" style={{left: right, right: 0, top, height: bottom - top}} />
    </>
  );
}

/**
 * The words for a step. "play" follows each press of the button: a pre-season week on to
 * the next, then the match week (a look at Tactics first, then the kick-off).
 */
function stepText(game: GameState, step: TutorialStep, view: string): TKey {
  if (step !== "play") return `tour.${step}` as TKey;
  const next = nextUserFixture(game);
  if (!next || fixtureWeek(next) > game.week) return "tour.playWeek";
  return view === "tactics" ? "tour.playKickOff" : "tour.playMatchWeek";
}

/** This week, the next, and the weeks left to the first match. */
function weekParams(game: GameState): {week: number; nextWeek: number; left: number} {
  const next = nextUserFixture(game);
  return {week: game.week, nextWeek: game.week + 1, left: next ? Math.max(0, fixtureWeek(next) - game.week) : 0};
}
