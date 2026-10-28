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
