// The guide for new players: the assistant manager points at the next thing to
// do, with the button or area to use highlighted. Some steps move on by
// themselves once it's done (open Tactics, pick the best XI, a match starts…).
import {useEffect, useLayoutEffect, useState, type ReactNode} from "react";
import {TUTORIAL_STEPS, tutorialNext, tutorialSkip, type TutorialStep} from "../game/tutorial";
import {useT, type TKey} from "../i18n";
import {useGame} from "../store";
import {ManagerAvatar, defaultManagerLook} from "./Avatar";
import {ControlIcon} from "./MatchViewer";

interface StepSpec {
  /** What to highlight (and put the bubble next to). */
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
  tactics: {target: '[data-tour="nav-tactics"]'},
  bestXI: {target: '[data-tour="best-xi"]', showWhen: '[data-tour="best-xi"]', onClick: true},
  lineup: {target: ".pitch-board", showWhen: ".pitch-board", next: true},
  formation: {target: '[data-tour="formation"]', showWhen: '[data-tour="formation"]', next: true},
  play: {target: ".continue"},
  match: {target: ".speed-group", showWhen: ".match-controls", next: true},
  orders: {target: '[data-tour="orders"]', showWhen: '[data-tour="orders"]', next: true},
  setpieces: {target: '[data-tour="orders"]', showWhen: '[data-tour="orders"]', next: true},
  talk: {target: ".tt-options", showWhen: ".tt-options"},
  daily: {target: ".daily-tasks", showWhen: ".daily-tasks", next: true},
  // Tapping the manager opens the profile, where the club's name, initials and colours are changed.
  club: {target: ".topbar-manager", next: true, onClick: true},
  // Waits for the profile to be closed again.
  names: {target: '[data-tour="nav-squad"]', showWhen: "body:not(:has(.modal-backdrop))", next: true},
};

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
    if (step === "play" && game.liveMatch) act((g) => tutorialNext(g, "play"));
    // The talk is over once the match has closed.
    if (step === "talk" && !game.liveMatch && !document.querySelector(".tt-options")) {
      if (game.reports.length > 0) act((g) => tutorialNext(g, "talk"));
    }
    // A match finished without its steps being seen (skipped through): on to the talk.
    if ((step === "match" || step === "orders" || step === "setpieces") && !game.liveMatch && game.reports.length > 0) {
      act((g) => { if (g.tutorial) g.tutorial.step = TUTORIAL_STEPS.indexOf("talk"); });
    }
  });

  // Follow the target around (it may move, open later or close).
  useLayoutEffect(() => {
    if (!spec) return;
    let frame = 0;
    const track = () => {
      const shown = !spec.showWhen || !!document.querySelector(spec.showWhen);
      setPresent(shown);
      const el = spec.target ? document.querySelector(spec.target) : null;
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
      const el = document.querySelector(spec.target!);
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
    <div className={`tour-bubble ${rect ? "" : "centred"}`} style={style} role="dialog" aria-live="polite">
      <div className="tour-head">
        <ManagerAvatar look={look} size={36} tie="#16a34a" />
        <strong>{t("tour.coach")}</strong>
        <span className="tour-count">{stepIndex + 1}/{TUTORIAL_STEPS.length}</span>
      </div>
      <p>{withIcons(t(`tour.${step}` as TKey, {name: game.managerName}))}</p>
      <div className="tour-actions">
        <button className="btn small" onClick={() => act((g) => tutorialSkip(g))}>{t("tour.skip")}</button>
        {spec.next && (
          <button className="btn primary small" onClick={() => act((g) => tutorialNext(g, step))}>
            {stepIndex === TUTORIAL_STEPS.length - 1 ? t("tour.done") : t("tour.next")}
          </button>
        )}
      </div>
    </div>
  );
}
