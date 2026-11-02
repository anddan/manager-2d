// The national team: the country's best players (whatever club they play for), picked automatically for
// the formation and mood the manager chooses. A few friendlies a year, and the Euros / World Cup in the
// last weeks of the season in their years.
import {Icon, iconize} from "../Icon";
import {clearNationalLineup, dueNationalMatch, moveNationalSlot, nationalKit, nationalPool, nationalSlots, nextNationalWeek, setNationalFormation, setNationalSlot, shownSquad} from "../../game/national";
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
      <div className="pick">
        <span className="drag-handle"><Jersey color={kit.color} trim={kit.color2} pattern={kit.pattern} keeper={p.position === "GK"} size={26} /></span>
        <PosBadge pos={p.position} />
        <button className="link pick-name" onClick={() => openPlayer(p.id)}><Flag code={p.nationality} size={15} /> {listName(p)} <StatusIcons player={p} /></button>
        {p.gear && <GearPicture item={p.gear} size={18} />}
        {p.shin && <GearPicture item={p.shin} size={14} />}
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
            <span className="pick-name"><Flag code={inSlot.nationality} size={15} /> {listName(inSlot)} <StatusIcons player={inSlot} /></span>
            {inSlot.gear && <GearPicture item={inSlot.gear} size={18} />}
            {inSlot.shin && <GearPicture item={inSlot.shin} size={14} />}
            <span className="muted small"><Icon name="user" size={16} /></span>
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
            <span className="pick-name"><Flag code={p.nationality} size={15} /> {listName(p)} <StatusIcons player={p} /></span>
            {p.gear && <GearPicture item={p.gear} size={18} />}
            {p.shin && <GearPicture item={p.shin} size={14} />}
            <span className="muted small">{taken.has(p.id) ? t("tac.starting") : squad.bench.includes(p.id) ? t("tac.onBench") : ""}</span>
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
      {due && (
        <div className="next-match span-2" role="status">
          <span className="next-match-what">
            {/* Tournament matches: tap to go to the tournament. */}
            {due.what === "friendly" ? <><Icon name="ball" size={18} /> {iconize(t(`national.what.${due.what}` as TKey))}</> : <button type="button" className="link" onClick={() => setView("tournament")}><Icon name="ball" size={18} /> {iconize(t(`national.what.${due.what}` as TKey))}</button>}
          </span>
          <span className="next-match-teams">
            <span className="next-match-opp"><Flag code={job.country} size={18} /> <strong>{t(`nat.${job.country}` as TKey)}</strong></span> <span className="muted">–</span> <span className="next-match-opp"><strong>{t(`nat.${due.opponent}` as TKey)}</strong> <Flag code={due.opponent} size={18} /></span>
          </span>
        </div>
      )}
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
        <p className="muted small">
          {next ? iconize(t(next.what === "friendly" ? "national.next" : "national.nextTournament", {week: next.week, comp: `national.comp.${next.what}`})) : null}
        </p>
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
            {resting.length > 0 && <li className="pick-group rest-head"><Icon name="moon" size={18} /> {iconize(t("tac.restGroup", {n: resting.length}))}</li>}
            {resting.map((p) => row(p, "rest-row"))}
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
