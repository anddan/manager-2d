import {useEffect, useRef, useState} from "react";
import {Icon, iconize} from "../Icon";
import {TUTORIAL_VERSION} from "../../game/tutorial";
import {parseSave} from "../../game/save";
import {LANGS, useT, type Lang, type TKey} from "../../i18n";
import {COACH_TIPS} from "../CoachTips";
import {useGame, useGameState} from "../../store";
import {Card, Hint} from "../common";
import {isMuted, onMutedChange, setMuted} from "../sound";
import {BUILD_ID, checkForUpdate} from "../updates";

const LANG_NAMES: Record<Lang, string> = {sv: "Svenska", en: "English", es: "Español", it: "Italiano", fr: "Français"};

/** A setting remembered on this device (the match reads the same keys). */
function usePref<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      return (localStorage.getItem(key) as T | null) ?? fallback;
    } catch {
      return fallback;
    }
  });
  const set = (v: T) => {
    setValue(v);
    try {
      localStorage.setItem(key, v);
    } catch {
      // Only for now.
    }
  };
  return [value, set];
}

/** Two or more choices in a pill, the chosen one lit. */
function Choice<T extends string>({value, options, onPick, label, disabled}: {value: T; options: readonly (readonly [T, string])[]; onPick: (v: T) => void; label: string; disabled?: boolean}) {
  return (
    <span className="speed-group" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} disabled={disabled} className={value === v ? "chip active" : "chip"} onClick={() => onPick(v)}>{text}</button>
      ))}
    </span>
  );
}

export function Settings() {
  const {t} = useT();
  const game = useGameState();
  const lang = useGame((s) => s.lang);
  const setLang = useGame((s) => s.setLang);
  const replace = useGame((s) => s.replace);
  const quit = useGame((s) => s.quit);
  const notify = useGame((s) => s.notify);
  const act = useGame((s) => s.act);
  const setView = useGame((s) => s.setView);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [soundOff, setSoundOff] = useState(isMuted());
  // How a match is played: the way to watch it, how fast, who takes set pieces and changes, the view, buzz and effects.
  const [textOnly, setTextOnly] = usePref<"0" | "1">("manager2d.textOnly", "0");
  const [speed, setSpeed] = usePref<string>("manager2d.matchSpeed", "1");
  const [setPieces, setSetPieces] = usePref<"auto" | "self">("manager2d.manualSetPieces", "auto");
  const [subs, setSubs] = usePref<"auto" | "self">("manager2d.manualSubs", "auto");
  const [zoom, setZoom] = usePref<"1" | "0">("manager2d.zoomedIn", "1");
  const [haptics, setHaptics] = usePref<"on" | "off">("manager2d.haptics", "on");
  const [effects, setEffects] = usePref<"on" | "off">("manager2d.effects", "on");
  // The running version: when it was built, in local time.
  const [checking, setChecking] = useState(false);
  const builtAt = (() => {
    const d = new Date(BUILD_ID);
    return Number.isNaN(d.getTime()) ? BUILD_ID : new Intl.DateTimeFormat(lang, {dateStyle: "medium", timeStyle: "short"}).format(d);
  })();
  useEffect(() => onMutedChange(setSoundOff), []);

  const exportSave = () => {
    const blob = new Blob([JSON.stringify(game)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `manager2d-${game.season}-v${game.week}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importSave = async (file: File) => {
    const state = parseSave(await file.text());
    if (!state) return notify("settings.badSave", undefined, "error");
    replace(state);
    notify("settings.loaded", undefined, "good");
  };

  return (
    <div className="grid">
      <Card title={<><Icon name="info" size={20} /> {iconize(t("version.title"))}</>}>
        <dl className="kv">
          <dt>{iconize(t("version.built"))}</dt>
          <dd><strong>{builtAt}</strong></dd>
        </dl>
        <div className="btn-row">
          <button
            className="btn"
            disabled={checking}
            onClick={async () => {
              setChecking(true);
              const found = await checkForUpdate();
              setChecking(false);
              if (found === "latest") notify("version.latest", undefined, "good");
              if (found === "match") notify("version.afterMatch");
            }}
          >
            <Icon name="swap" size={18} /> {checking ? t("version.checking") : t("version.check")}
          </button>
        </div>
        <Hint>{iconize(t("version.hint"))}</Hint>
      </Card>
      <Card title={<><Icon name="sound" size={20} /> {iconize(t("sound.title"))}</>}>
        <label className="toggle">
          <input type="checkbox" className="bench-check" checked={!soundOff} onChange={(e) => setMuted(!e.target.checked)} /> {iconize(t("sound.label"))}
        </label>
        <Hint>{iconize(t("sound.hint"))}</Hint>
      </Card>
      <Card title={<><Icon name="ball" size={20} /> {iconize(t("settings.match"))}</>}>
        <dl className="kv setting-rows">
          <dt><Icon name="video" size={18} /> {iconize(t("settings.view"))}</dt>
          <dd><Choice label={t("settings.view")} value={textOnly} onPick={(v) => { setTextOnly(v); if (v === "1") setSetPieces("auto"); }} options={[["0", t("match.viewPitch")], ["1", t("match.viewText")]]} /></dd>
          <dt><Icon name="skip" size={18} /> {iconize(t("match.speed"))}</dt>
          <dd><Choice label={t("match.speed")} value={speed} onPick={setSpeed} options={[["1", "1×"], ["2", "2×"], ["3", "3×"], ["4", "4×"], ["5", "5×"]]} /></dd>
          <dt><Icon name="target" size={18} /> {iconize(t("match.setPieces"))}</dt>
          <dd><Choice label={t("match.setPieces")} value={textOnly === "1" ? "auto" : setPieces} disabled={textOnly === "1"} onPick={setSetPieces} options={[["self", t("match.self")], ["auto", t("match.auto")]]} /></dd>
          <dt><Icon name="swap" size={18} /> {iconize(t("match.subsWho"))}</dt>
          <dd><Choice label={t("match.subsWho")} value={subs} onPick={setSubs} options={[["self", t("match.self")], ["auto", t("match.auto")]]} /></dd>
          <dt><Icon name="eye" size={18} /> {iconize(t("settings.pitchView"))}</dt>
          <dd><Choice label={t("settings.pitchView")} value={zoom} onPick={setZoom} options={[["1", t("settings.zoomNear")], ["0", t("settings.zoomFar")]]} /></dd>
          <dt><Icon name="bolt" size={18} /> {iconize(t("settings.haptics"))}</dt>
          <dd><Choice label={t("settings.haptics")} value={haptics} onPick={setHaptics} options={[["on", t("settings.on")], ["off", t("settings.off")]]} /></dd>
          <dt><Icon name="coins" size={18} /> {iconize(t("settings.effects"))}</dt>
          <dd><Choice label={t("settings.effects")} value={effects} onPick={setEffects} options={[["on", t("settings.on")], ["off", t("settings.off")]]} /></dd>
        </dl>
        <Hint>{iconize(t("settings.matchHint"))}</Hint>
      </Card>
      <Card title={t("settings.language")}>
        <select className="lang-select" value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label={t("settings.language")}>
          {LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
        </select>
      </Card>
      <Card title={<><Icon name="compass" size={20} /> {iconize(t("settings.tour"))}</>}>
        <button className="btn" onClick={() => { act((g) => { g.tutorial = {step: 0, firstMatch: true, v: TUTORIAL_VERSION}; }); setView("overview"); }}>{iconize(t("settings.tour"))}</button>
      </Card>
      <Card title={<><Icon name="chat" size={20} /> {iconize(t("tips.title"))}</>}>
        <button className="btn" aria-expanded={tipsOpen} onClick={() => setTipsOpen((o) => !o)}>{tipsOpen ? iconize(t("tips.hide")) : iconize(t("tips.more"))} <Icon name="chevron" size={16} /></button>
        {tipsOpen && <ol className="tips-list">
          {Array.from({length: COACH_TIPS}, (_, i) => <li key={i}>{iconize(t(`tips.${i}` as TKey))}</li>)}
        </ol>}
      </Card>
      <Card title={t("settings.save")}>
        <Hint>{iconize(t("settings.saveHint"))}</Hint>
        <div className="btn-row wrap">
          <button className="btn" onClick={exportSave}><Icon name="download" size={18} /> {iconize(t("settings.export"))}</button>
          <button className="btn" onClick={() => fileRef.current?.click()}><Icon name="upload" size={18} /> {iconize(t("settings.import"))}</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importSave(e.target.files[0])} />
        </div>
      </Card>
      <Card title={t("settings.newGame")}>
        <p className="muted">{iconize(t("settings.newGameHint"))}</p>
        <button className="btn danger" onClick={() => window.confirm(t("settings.confirmNew")) && quit()}>{iconize(t("settings.newGame"))}</button>
      </Card>
    </div>
  );
}
