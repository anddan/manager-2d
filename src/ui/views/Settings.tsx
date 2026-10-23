import {useRef} from "react";
import {parseSave} from "../../game/save";
import {LANGS, useT, type Lang} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Card} from "../common";

const LANG_NAMES: Record<Lang, string> = {sv: "Svenska", en: "English", es: "Español"};

export function Settings() {
  const {t} = useT();
  const game = useGameState();
  const lang = useGame((s) => s.lang);
  const setLang = useGame((s) => s.setLang);
  const replace = useGame((s) => s.replace);
  const quit = useGame((s) => s.quit);
  const notify = useGame((s) => s.notify);
  const fileRef = useRef<HTMLInputElement>(null);

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
      <Card title={t("settings.language")}>
        <div className="btn-row">
          {LANGS.map((l) => (
            <button key={l} className={l === lang ? "chip active" : "chip"} onClick={() => setLang(l)}>{LANG_NAMES[l]}</button>
          ))}
        </div>
      </Card>
      <Card title={t("settings.save")}>
        <p className="muted">{t("settings.saveHint")}</p>
        <div className="btn-row wrap">
          <button className="btn" onClick={exportSave}>⬇️ {t("settings.export")}</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>⬆️ {t("settings.import")}</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importSave(e.target.files[0])} />
        </div>
      </Card>
      <Card title={t("settings.newGame")}>
        <p className="muted">{t("settings.newGameHint")}</p>
        <button className="btn danger" onClick={() => window.confirm(t("settings.confirmNew")) && quit()}>{t("settings.newGame")}</button>
      </Card>
    </div>
  );
}
