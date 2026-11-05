// The national team: the country's best players (whatever club they play for), picked automatically for
// the formation and mood the manager chooses. A few friendlies a year, and the Euros / World Cup in the
// last weeks of the season in their years.
import {Icon, iconize} from "../Icon";
import {clearNationalLineup, countryTeam, dueNationalMatch, moveNationalSlot, nationalKit, nationalPool, nationalSlots, nextNationalWeek, setNationalFormation, setNationalSlot, shownSquad} from "../../game/national";
import {BENCH_SIZE} from "../../game/constants";
import {Jersey} from "../Jersey";
import {useNarrow} from "./Tactics";
import {effectiveRating} from "../../game/ratings";
import {useState} from "react";
import {FORMATION_IDS, MENTALITIES, type Mentality, type Player} from "../../game/types";
import type {TKey} from "../../i18n";
import {useT} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Bar, Card, Empty, Flag, FormArrow, Hint, Modal, PosBadge, StatusIcons} from "../common";
import {Avatar} from "../Avatar";
import {GearPicture} from "../Gear";
import {isAvailable} from "../../game/lineup";
import {familiarity} from "../../game/ratings";
import {LineupSheet} from "../LineupSheet";
import {fullName, listName} from "../../game/helpers";
import {CountrySheet} from "../CountrySheet";
import {matchConditions} from "../../game/conditions";
import {Swap} from "../Swap";

export function National() {
  const {t} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const openPlayer = useGame((s) => s.openPlayer);
  const setView = useGame((s) => s.setView);
  const job = game.national;
  // The place being picked for, and whether leaving is being confirmed (before the early return: hooks keep their order).
  const [slotPick, setSlotPick] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);
  // A shirt tapped on the pitch: its ✕ and profile buttons.
  const [actions, setActions] = useState<number | null>(null);
  const narrow = useNarrow();
  // The picker shows only who is not starting already, unless told otherwise (like on the tactics page).
  const [onlyFit, setOnlyFit] = useState(true);
  // The ones not picked are many: shown only when asked for.
  const [showResting, setShowResting] = useState(false);
  // A country looked at (tap the opponent on the next-match card).
  const [country, setCountry] = useState<string | null>(null);
  // The next-match card folded to the least (remembered on this device, the same as on the tactics page).
  const [small, setSmall] = useState(() => {
    try {
      return localStorage.getItem("manager2d.matchCardSmall") === "1";
    } catch {
      return false;
    }
  });
  const toggleSmall = () =>
    setSmall((v) => {
      try {
        localStorage.setItem("manager2d.matchCardSmall", v ? "0" : "1");
      } catch {
        // Only for now.
      }
      return !v;
    });
  if (!job) return <Card title={t("nav.national")}><Empty>{iconize(t("national.none"))}</Empty></Card>;
  const kit = nationalKit(job.country);
  // The eleven shown: the ones picked (empty places stay empty until the match, when the best fill them), else the best.
  const squad = shownSquad(game, job);
  const slots = nationalSlots(job);
  const custom = !!job.customSlots;
  const next = nextNationalWeek(game);
  const due = dueNationalMatch(game);
  // The eleven's average rating in their places, as on the tactics page.
  const rated = squad.lineup.map((id, i) => (game.players[id] ? effectiveRating(game.players[id], slots[i].pos) : 0)).filter((v) => v > 0);
  const ovr = rated.length ? Math.round(rated.reduce((a, v) => a + v, 0) / rated.length) : 0;
  const pickPos = slotPick !== null ? slots[slotPick]?.pos : undefined;
  const taken = new Set(squad.lineup.filter(Boolean));
  const pool = nationalPool(game, job.country).sort((x, y) => effectiveRating(y, pickPos ?? x.position) - effectiveRating(x, pickPos ?? y.position));
  const resting = pool.filter((p) => !taken.has(p.id) && !squad.bench.includes(p.id));
  const set = (id: string) => { if (slotPick === null) return; act((g) => setNationalSlot(g, slotPick, id)); setSlotPick(null); };
  const profile = (id: string, slot?: number) => { setSlotPick(null); openPlayer(id, slot, slot !== undefined); };
  // A player in the lists beside the pitch: tap the name for the profile.
  const row = (p: Player, cls: string) => (
    <li key={p.id} className={cls}>
      <div className="pick pick-fixed">
        <span className="drag-handle"><Jersey color={kit.color} trim={kit.color2} pattern={kit.pattern} keeper={p.position === "GK"} size={26} /></span>
        <PosBadge pos={p.position} />
        <button className="link pick-name" onClick={() => openPlayer(p.id)}><Flag code={p.nationality} size={15} /> {listName(p)} <StatusIcons player={p} /></button>
        <span className="pick-gear">{p.gear && <GearPicture item={p.gear} size={18} />}{p.shin && <GearPicture item={p.shin} size={14} />}</span>
        <FormArrow form={p.form} />
        <span className="num">{Math.round(effectiveRating(p, p.position))}</span>
        <Bar value={p.fitness} small />
      </div>
    </li>
  );
  // Who plays in the place: whoever is there now first (✕ takes them out), then the country's best for it.
  const here = slotPick !== null ? squad.lineup[slotPick] : "";
  const inSlot = here ? game.players[here] : undefined;
  const candidateList = pickPos ? (
    <ul className="pick-list">
      <li className="pick-filter">
        <label className="toggle">
          <input type="checkbox" checked={onlyFit} onChange={(e) => setOnlyFit(e.target.checked)} /> {iconize(t("tac.onlyFit"))}
        </label>
      </li>
      {inSlot && (
        <li className="pick-row pick-current">
          <button className="pick" onClick={() => profile(inSlot.id, slotPick ?? undefined)} title={t("tac.profile")} aria-label={`${t("tac.profile")}: ${listName(inSlot)}`}>
            <PosBadge pos={inSlot.position} />
            <span className="pick-name"><Flag code={inSlot.nationality} size={15} /> {listName(inSlot)} <StatusIcons player={inSlot} /> <Icon name="user" size={14} /></span>
            <span className="pick-gear">{inSlot.gear && <GearPicture item={inSlot.gear} size={18} />}{inSlot.shin && <GearPicture item={inSlot.shin} size={14} />}</span>
            <FormArrow form={inSlot.form} />
            <span className={familiarity(inSlot, pickPos) < 1 ? "num warn" : "num strong"}>{Math.round(effectiveRating(inSlot, pickPos))}</span>
            <Bar value={inSlot.fitness} small />
          </button>
          <button className="pick-out" onClick={() => set("")} title={t("tac.clearSlot", {name: listName(inSlot)})} aria-label={t("tac.clearSlot", {name: listName(inSlot)})}>
            <Icon name="close" size={18} />
            <span>{iconize(t("tac.clearShort"))}</span>
          </button>
        </li>
      )}
      {pool.filter((p) => p.id !== here && (!onlyFit || !taken.has(p.id))).map((p) => (
        <li key={p.id} className="pick-row">
          <button className="pick" disabled={!isAvailable(p)} onClick={() => set(p.id)}>
            <PosBadge pos={p.position} />
            <span className="pick-name"><Flag code={p.nationality} size={15} /> {listName(p)} <StatusIcons player={p} /> <span className="muted small">{taken.has(p.id) ? t("tac.starting") : squad.bench.includes(p.id) ? t("tac.onBench") : ""}</span></span>
            <span className="pick-gear">{p.gear && <GearPicture item={p.gear} size={18} />}{p.shin && <GearPicture item={p.shin} size={14} />}</span>
            <FormArrow form={p.form} />
            <span className={familiarity(p, pickPos) < 1 ? "num warn" : "num strong"}>{Math.round(effectiveRating(p, pickPos))}</span>
            <Bar value={p.fitness} small />
          </button>
          <button className="pick-avatar" title={t("tac.profile")} aria-label={`${t("tac.profile")}: ${listName(p)}`} onClick={() => profile(p.id)}>
            <Avatar player={p} shirt={kit.color} trim={kit.color2} size={30} />
          </button>
        </li>
      ))}
    </ul>
  ) : null;
  const sheet = {name: t(`nat.${job.country}` as TKey), color: kit.color, color2: kit.color2, pattern: kit.pattern, formation: job.formation, mentality: job.mentality, lineup: squad.lineup, bench: squad.bench, customSlots: job.customSlots};
  return (
    <div className="grid">
      {/* The match to play this week, on top like on the tactics page: it is started with the play button in the middle of the bar. */}
      {(() => {
        // A tournament under way for us, the next match not known yet (the knockout draws itself as it goes).
        const under = job.tournament && job.tournament.season === game.season && job.tournament.alive ? job.tournament : undefined;
        // Played this week: the card stays with the result on it.
        const last = job.results[job.results.length - 1];
        const played = !due && last && last.season === game.season && last.week === game.week ? last : undefined;
        const what: string | undefined = due ? due.what : played ? played.what : next ? next.what : under?.comp;
        // "wc.g" is the World Cup's group stage; "friendly" is a friendly.
        const comp = what?.split(".")[0];
        const shown = due ?? played;
        const stageKey = shown && comp !== "friendly" ? shown.what.split(".")[1] : undefined;
        const year = job.tournament && job.tournament.season === game.season ? job.tournament.season : game.season;
        const title = comp === "wc" || comp === "ec" ? `${t(`national.comp.${comp}` as TKey)} ${year}` : comp === "friendly" ? t("national.comp.friendly") : t("national.title");
        const weeks = next ? next.week - game.week : 0;
        const stage = stageKey ? t(`national.stage.${stageKey}` as TKey) : under ? t(under.bracket.length > 0 ? "national.knockout" : "national.groupStage") : undefined;
        const mine = nationalKit(job.country);
        const oppCode = due?.opponent ?? played?.opponent;
        const theirs = oppCode ? nationalKit(oppCode) : undefined;
        const flagSide = (code: string | undefined, cls: "home" | "away", you?: boolean) => {
          const inner = (
            <>
              <span className="mp-crest">
                <span className="crest big crest-flag">{code ? <Flag code={code} size={36} /> : "?"}</span>
                {you && <span className="mp-star"><Icon name="star" size={11} /></span>}
              </span>
              <span className="mp-text">
                <strong className="mp-name">{code ? t(`nat.${code}` as TKey) : t("national.opponentTbd")}</strong>
                {!small && code && <span className="mp-meta"><span>{iconize(t("tac.teamOvr"))} <b>{you ? ovr : countryTeam(game, code).ovr}</b></span></span>}
              </span>
            </>
          );
          // The opponent: tap for their eleven.
          return you || !code ? <div className={`mp-team ${cls}${you ? " mine" : ""}`}>{inner}</div> : <button type="button" className={`mp-team ${cls}`} title={t("tac.seeTeam")} onClick={(e) => { e.stopPropagation(); setCountry(code); }}>{inner}</button>;
        };
        // The weather and the time (only for show), as on the tactics page.
        const cond = due || played || next || under ? matchConditions(`nat:${game.season}:${what ?? "x"}`, !played && next ? next.week : game.week, job.country) : undefined;
        return (
          <>
          {/* The whole card goes to the tournament (the opponent and the fold button have their own taps). */}
          <div className={`next-match match-poster span-2${small ? " small" : ""}${comp === "wc" || comp === "ec" ? " go" : ""}`} role="status" style={{["--h" as string]: mine.color, ["--a" as string]: theirs?.color ?? "#64748b"}} onClick={comp === "wc" || comp === "ec" ? () => setView("tournament") : undefined}>
            {!small && (
              <div className="mp-top">
                {/* The kind of match (the competition and its round) and "next match" take turns. */}
                <Swap
                  a={comp === "wc" || comp === "ec" ? (
                    <button type="button" className="mp-what" onClick={() => setView("tournament")}><Icon name="trophy" size={16} /> {stage ? `${title} · ${stage}` : title}</button>
                  ) : (
                    <span className="mp-what"><Icon name="ball" size={16} /> {stage ? `${title} · ${stage}` : title}</span>
                  )}
                  b={<span className="mp-what static"><Icon name="clock" size={16} /> {t(played ? "national.fullTime" : "ov.nextMatch")}</span>}
                />
                {/* The weather and the time take turns with how long it is to the match. */}
                {cond && (
                  <Swap
                    a={
                      <>
                        <span className="mp-chip" title={t(`weather.${cond.weather}` as TKey)}><Icon name={cond.weather} size={14} /> {cond.temp}°</span>
                        <span className="mp-chip" title={t("intro.time")}><Icon name="clock" size={14} /> {cond.time}</span>
                      </>
                    }
                    b={<span className="mp-chip"><Icon name="clock" size={14} /> {played ? t("national.fullTime") : !due && next ? t(weeks === 1 ? "national.nextWeek" : "national.inWeeks", {n: weeks}) : t("ov.nextMatch")}</span>}
                  />
                )}
              </div>
            )}
            <div className="mp-teams">
              {due || played || next || under ? (
                <>
                  {flagSide(job.country, "home", true)}
                  {played ? (
                    <div className="mp-vs score">
                      <span>{played.goals[0]}–{played.goals[1]}{played.pens && <small> ({played.pens[0]}–{played.pens[1]})</small>}</span>
                    </div>
                  ) : (
                    <div className="mp-vs"><span>VS</span></div>
                  )}
                  {flagSide(oppCode, "away")}
                </>
              ) : (
                <p className="mp-none muted">{iconize(t("national.noneSoon"))}</p>
              )}
            </div>
            <button type="button" className="mp-fold" aria-expanded={!small} aria-label={t(small ? "tbl.showMore" : "tbl.showLess")} onClick={(e) => { e.stopPropagation(); toggleSmall(); }}>{small ? "▼" : "▲"}</button>
          </div>
          {country && <CountrySheet code={country} onClose={() => setCountry(null)} />}
          </>
        );
      })()}
      <Card
        title={<><Flag code={job.country} size={22} /> {t(`nat.${job.country}` as TKey)} <span className="team-ovr" title={t("tac.teamOvrHint")}>{iconize(t("tac.teamOvr"))} <strong>{ovr}</strong></span></>}
        actions={
          <>
            <button className="btn small" onClick={() => act((g) => clearNationalLineup(g))} disabled={!!job.lineup && job.lineup.every((id) => !id)}>{iconize(t("tac.clearAll"))}</button>
            <button className="btn small" onClick={() => act((g) => { g.national!.lineup = undefined; })}>{iconize(t("tac.auto"))}</button>
          </>
        }
      >
        <Hint>{iconize(t("national.hint"))}</Hint>
        <div className="tac-pickers">
          <label className="field">
            <span>{iconize(t("tac.formation"))}</span>
            <select value={custom ? "custom" : job.formation} onChange={(e) => act((g) => setNationalFormation(g, e.target.value))}>
              {FORMATION_IDS.map((f) => <option key={f} value={f}>{f}</option>)}
              <option value="custom">{iconize(t("tac.custom"))}</option>
            </select>
          </label>
          <label className="field">
            <span>{iconize(t("tac.mentality"))}</span>
            <select value={job.mentality} onChange={(e) => act((g) => { g.national!.mentality = e.target.value as Mentality; })}>
              {MENTALITIES.map((m) => <option key={m} value={m}>{t(`tac.${m}` as TKey)}</option>)}
            </select>
          </label>
        </div>
        <LineupSheet
          club={sheet}
          hideBench
          player={(id) => game.players[id]}
          onPick={(p) => openPlayer(p.id)}
          onMove={custom ? (i, left, top) => act((g) => moveNationalSlot(g, i, left, top)) : undefined}
          // A shirt with someone in it shows ✕ and the profile; an empty place, the picker.
          onSlot={(i) => (squad.lineup[i] && game.players[squad.lineup[i]] ? (setSlotPick(null), setActions(actions === i ? null : i)) : (setActions(null), setSlotPick(slotPick === i ? null : i)))}
          actions={actions !== null && squad.lineup[actions] ? {index: actions, onClose: () => setActions(null), onClear: () => { const i = actions; setActions(null); act((g) => setNationalSlot(g, i, "")); }, onProfile: () => { const i = actions; setActions(null); openPlayer(squad.lineup[i], i, true); }} : null}
        />
        {/* Who plays in a place: the country's players, the best for it first. */}
        {leaving && (
          <Modal compact title={<><Icon name="close" size={18} /> {t("national.leave")}</>} onClose={() => setLeaving(false)}>
            <p>{iconize(t("national.leaveConfirm"))}</p>
            <div className="btn-row dialog-actions">
              <button className="btn" onClick={() => setLeaving(false)}>{t("common.cancel")}</button>
              <button className="btn primary" onClick={() => act((g) => { g.national = undefined; })}>{t("national.leaveShort")}</button>
            </div>
          </Modal>
        )}
      </Card>
      {slotPick !== null && pickPos && narrow && (
        <Modal title={iconize(t("tac.pickFor", {pos: t(`pos.${pickPos}` as TKey)}))} onClose={() => setSlotPick(null)}>
          {candidateList}
        </Modal>
      )}
      <Card title={slotPick !== null && pickPos && !narrow ? iconize(t("tac.pickFor", {pos: t(`pos.${pickPos}` as TKey)})) : iconize(t("tac.bench", {n: squad.bench.length, max: BENCH_SIZE}))}>
        {slotPick !== null && pickPos && !narrow ? (
          candidateList
        ) : (
          <ul className="pick-list">
            {squad.bench.length > 0 && <li className="pick-group bench-head"><Icon name="bench" size={18} /> {iconize(t("tac.benchGroup", {n: squad.bench.length, max: BENCH_SIZE}))}</li>}
            {squad.bench.map((id) => game.players[id]).filter(Boolean).map((p) => row(p, "bench-row"))}
            {resting.length > 0 && (
              <li className="pick-group rest-head rest-fold">
                <span><Icon name="moon" size={18} /> {iconize(t("tac.restGroup", {n: resting.length}))}</span>
                <button type="button" className="btn small" aria-expanded={showResting} aria-label={t(showResting ? "tbl.showLess" : "tbl.showMore")} onClick={() => setShowResting(!showResting)}>{showResting ? "▲" : "▼"}</button>
              </li>
            )}
            {showResting && resting.map((p) => row(p, "rest-row"))}
          </ul>
        )}
      </Card>
      <Card title={iconize(t("national.results"))}>
        {job.results.length === 0 ? (
          <Empty>{iconize(t("national.noResults"))}</Empty>
        ) : (
          <ul className="plain-list national-results">
            {job.results.map((r, i) => (
              <li key={i}>
                <span className="muted small">{r.season} · {iconize(t(`national.what.${r.what}` as TKey))}</span>
                <strong><Flag code={job.country} size={16} /> {r.goals[0]}–{r.goals[1]}{r.pens ? ` (${r.pens[0]}–${r.pens[1]})` : ""} <Flag code={r.opponent} size={16} /></strong>
                {r.scorers.length > 0 && <span className="muted small">{r.scorers.map((id) => (game.players[id] ? fullName(game.players[id]) : "")).filter(Boolean).join(", ")}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="btn-row national-leave">
        <button type="button" className="btn danger" onClick={() => setLeaving(true)}><Icon name="close" size={16} /> {t("national.leave")}</button>
      </div>
    </div>
  );
}
