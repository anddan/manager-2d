// The walk-through before a match: the competition, the two teams sliding in, a "VS" that slams down, how
// they compare, a countdown and the whistle. Tap anywhere to skip. Not shown with the effects turned off.
import {useEffect, useRef, useState} from "react";
import {CUP_STAGES} from "../game/cup";
import {findFixture, isCupFixture} from "../game/helpers";
import {matchClubs} from "../game/kit";
import {leagueCountry, matchConditions} from "../game/conditions";
import {leaguePosition} from "../game/league";
import {overall, teamOvr} from "../game/ratings";
import type {MatchReport, Player} from "../game/types";
import {useT, type TKey} from "../i18n";
import {useGame, useGameState} from "../store";
import {CrestOf, FormArrow} from "./common";
import {effectsOn} from "./effects";
import {Icon, iconize} from "./Icon";
import {PlayerCard} from "./PlayerCard";
import {crowd, whistle} from "./sound";

/** The walk-through before a match can be turned off in the settings (remembered on this device). */
export function introOn(): boolean {
  try {
    return localStorage.getItem("manager2d.matchIntro") !== "off" && effectsOn();
  } catch {
    // No storage: shown in a browser, never where there is no page (the tests).
    return typeof document !== "undefined";
  }
}

/** When each phase starts (ms): 0 banner, 1 teams, 2 VS, 3 comparison, 4 the stars of each team, 5 ready. */
const STEPS = [0, 600, 1500, 2300, 4100, 5600];
/** The last phase: everything shown, nothing moving; the walk-through waits for the kick-off button (it never closes by itself). */
const READY = 5;

export function MatchIntro({report, onDone}: {report: MatchReport; onDone: () => void}) {
  const {t} = useT();
  const game = useGameState();
  const openPlayer = useGame((s) => s.openPlayer);
  const [phase, setPhase] = useState(0);
  const done = useRef(false);
  const timers = useRef<number[]>([]);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };
  useEffect(() => {
    // No effects, no walk-through.
    if (!effectsOn()) {
      finish();
      return;
    }
    timers.current = STEPS.map((ms, i) => window.setTimeout(() => setPhase(i), ms));
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      if (phase === 2) crowd("ooh");
      if (phase === 4) crowd("ooh");
    } catch {
      // The sound must never stop the picture.
    }
  }, [phase]);

  // Skipping winds it on to the end: everything shown, and the button becomes the kick-off.
  const skip = () => {
    timers.current.forEach(clearTimeout);
    setPhase(READY);
  };
  const kickOff = () => {
    try {
      whistle("short");
    } catch {
      // No sound.
    }
    finish();
  };
  const [home, away] = matchClubs(game.clubs[report.homeId], game.clubs[report.awayId]);
  if (!home || !away) return null;
  const fixture = findFixture(game, report.fixtureId);
  // What it is: a national match, the cup (and its round), or the league round.
  const national = game.nationalMatch;
  const what = national
    ? t(`national.what.${national.what}` as TKey)
    : fixture && isCupFixture(fixture)
      ? `${t("cup.name")} · ${t(CUP_STAGES[fixture.stage])}`
      : fixture
        ? t("ov.round", {round: fixture.round})
        : "";
  const league = !!fixture && !national && !isCupFixture(fixture);
  const weather = fixture ? matchConditions(fixture.id, game.week, leagueCountry(game.leagueId)) : undefined;
  const ovr = [teamOvr(game, home.id), teamOvr(game, away.id)];
  const rows: {key: string; label: string; h: string; a: string; bar?: [number, number]}[] = [
    {key: "ovr", label: t("intro.strength"), h: String(ovr[0]), a: String(ovr[1]), bar: [ovr[0], ovr[1]]},
    ...(league ? [{key: "pos", label: t("intro.position"), h: `${leaguePosition(game, home.id)}`, a: `${leaguePosition(game, away.id)}`}] : []),
    {key: "form", label: t("intro.formation"), h: home.formation, a: away.formation},
  ];
  const mine = (id: string) => id === game.userClubId;
  // The ones to watch: the highest rated of the eleven, and the one in the best form (another one, if it is the same).
  const stars = (ids: string[]): {p: Player; why: "ovr" | "form"}[] => {
    const xi = ids.map((id) => game.players[id]).filter((p): p is Player => !!p);
    const byOvr = [...xi].sort((a, b) => overall(b) - overall(a));
    const best = byOvr[0];
    const hot = [...xi].filter((p) => p !== best).sort((a, b) => b.form - a.form || overall(b) - overall(a))[0];
    return [best && {p: best, why: "ovr" as const}, hot && {p: hot, why: "form" as const}].filter(Boolean) as {p: Player; why: "ovr" | "form"}[];
  };
  const starCards = (club: typeof home, side: "home" | "away") =>
    stars(report.lineups[side]).map(({p, why}, i) => (
      <button type="button" key={p.id} className={`intro-card ${side}`} title={t("tac.profile")} aria-label={`${t("tac.profile")}: ${p.firstName} ${p.lastName}`} onClick={() => openPlayer(p.id)} style={{animationDelay: `${(side === "home" ? 0 : 150) + i * 300}ms`}}>
        {/* The same card as when a player comes out of a pack. */}
        <div className="intro-card-scale"><PlayerCard game={game} player={p} reveal stage={6} forClubId={club.id} /></div>
        <span className="intro-card-why">{why === "ovr" ? <><Icon name="star" size={13} /> {t("intro.best")}</> : <><FormArrow form={p.form} size={13} /> {t("intro.hot")}</>}</span>
      </button>
    ));
  const side = (club: typeof home, cls: "home" | "away") => (
    <div className={`intro-team ${cls} ${phase >= 1 ? "in" : ""}`}>
      {/* "Your team" above, and the same room kept above the other, so both stand level. */}
      <span className={mine(club.id) ? "intro-you" : "intro-you ghost"} aria-hidden={!mine(club.id)}>{iconize(t("intro.you"))}</span>
      <CrestOf club={club} className="crest big intro-crest" />
      <strong>{club.name}</strong>
    </div>
  );
  return (
    <div className={phase >= 2 ? "intro vs" : "intro"} role="dialog" aria-label={what}>
      <div className="intro-bg" style={{["--h" as string]: home.color, ["--a" as string]: away.color}} />
      <div className="intro-streaks" aria-hidden />
      <div className="intro-stage">
        <div className="intro-banner">
          <Icon name={fixture && isCupFixture(fixture) ? "trophy" : "ball"} size={20} /> {what}
          <small>
            {iconize(t("intro.crowd", {n: home.capacity}))}
            {weather && <> · <Icon name={weather.weather} size={14} /> {weather.temp}° · <Icon name="clock" size={14} /> {weather.time}</>}
          </small>
        </div>
        <div className="intro-teams">
          {side(home, "home")}
          <div className="intro-vs"><span>VS</span></div>
          {side(away, "away")}
        </div>
        {/* One place for the comparison and then the stars: it keeps its height, so nothing above it moves. */}
        <div className="intro-slot">
          {phase === 3 && (
            <div className="intro-stats">
              {rows.map((r, i) => (
                <div key={r.key} className="intro-row" style={{animationDelay: `${i * 160}ms`}}>
                  <span className="intro-val h">{r.h}</span>
                  <span className="intro-label">{r.label}</span>
                  <span className="intro-val a">{r.a}</span>
                  {r.bar && (
                    <span className="intro-bars" aria-hidden>
                      <span className="h"><span style={{width: `${(r.bar[0] / (r.bar[0] + r.bar[1])) * 100}%`}} /></span>
                      <span className="a"><span style={{width: `${(r.bar[1] / (r.bar[0] + r.bar[1])) * 100}%`}} /></span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        {phase >= 4 && (
          <div className="intro-players">
            <div className="intro-players-title">{iconize(t("intro.stars"))}</div>
            <div className="intro-players-cols">
              <div className="intro-players-col">{starCards(home, "home")}</div>
              <div className="intro-players-col">{starCards(away, "away")}</div>
            </div>
          </div>
        )}
        </div>
      </div>
      <button type="button" className="intro-never" onClick={() => { try { localStorage.setItem("manager2d.matchIntro", "off"); } catch { /* only this time */ } finish(); }}>{iconize(t("intro.never"))}</button>
      {phase >= READY ? (
        <button type="button" className="intro-skip intro-start" onClick={kickOff}>{iconize(t("intro.kickoff"))}</button>
      ) : (
        <button type="button" className="intro-skip" onClick={skip}>{iconize(t("intro.skip"))}</button>
      )}
    </div>
  );
}
