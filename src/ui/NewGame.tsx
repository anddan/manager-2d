import {useState} from "react";
import {CLUB_TEMPLATES, LEAGUE_NAME} from "../game/names";
import {LANGS, useT, type Lang} from "../i18n";
import {useGame} from "../store";

const LANG_NAMES: Record<Lang, string> = {sv: "Svenska", en: "English", es: "Español"};

/** First screen: language, manager name and club. */
export function NewGame() {
  const {t} = useT();
  const lang = useGame((s) => s.lang);
  const setLang = useGame((s) => s.setLang);
  const start = useGame((s) => s.start);
  const [name, setName] = useState("");
  const [club, setClub] = useState(6);

  const difficulty = (i: number) => (i < 3 ? "easy" : i < 9 ? "medium" : "hard");

  return (
    <main className="welcome">
      <div className="welcome-card">
        <p className="eyebrow">{LEAGUE_NAME}</p>
        <h1>⚽ Manager 2D</h1>
        <p className="muted">{t("new.intro")}</p>

        <div className="lang-switch" role="group" aria-label={t("settings.language")}>
          {LANGS.map((l) => (
            <button key={l} className={l === lang ? "chip active" : "chip"} onClick={() => setLang(l)}>{LANG_NAMES[l]}</button>
          ))}
        </div>

        <label className="field">
          <span>{t("new.managerName")}</span>
          <input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder={t("new.namePlaceholder")} />
        </label>

        <fieldset className="club-pick">
          <legend>{t("new.pickClub")}</legend>
          {CLUB_TEMPLATES.map((c, i) => (
            <label key={c.name} className={i === club ? "club-option selected" : "club-option"}>
              <input type="radio" name="club" checked={i === club} onChange={() => setClub(i)} />
              <span className="crest" style={{background: c.color, color: c.color2}}>{c.short}</span>
              <span className="club-option-name">{c.name}</span>
              <span className={`difficulty ${difficulty(i)}`}>{t(`new.difficulty.${difficulty(i)}`)}</span>
            </label>
          ))}
        </fieldset>

        <button className="btn primary big" onClick={() => start(name.trim() || t("new.defaultName"), club)}>
          {t("new.start")} ▶
        </button>
      </div>
    </main>
  );
}
