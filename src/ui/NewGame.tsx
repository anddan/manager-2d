import {useState} from "react";
import {LEAGUES, leagueById} from "../game/leagues";
import {PLAYERS_GENDERS, type ManagerLook, type PlayersGender} from "../game/types";
import {LANGS, useT, type Lang} from "../i18n";
import {useGame} from "../store";
import {ManagerAvatar, defaultManagerLook} from "./Avatar";
import {FlagIcon} from "./Flag";
import {ManagerEditor} from "./ManagerEditor";

const LANG_NAMES: Record<Lang, string> = {sv: "Svenska", en: "English", es: "Español"};

// Example faces for the men / women / mixed choice, in a plain kit colour.
const man = (skin: string, hair: string, style: string, beard = "none"): ManagerLook => ({skin, hair, style, beard, glasses: false, suit: "#2563eb"});
const woman = (skin: string, hair: string, style: string): ManagerLook => ({skin, hair, style, beard: "none", glasses: false, suit: "#db2777", lashes: true});
const SAMPLES: Record<PlayersGender, ManagerLook[]> = {
  men: [man("#ebbd9c", "#3b2618", "short", "stubble"), man("#8a5638", "#1c1714", "buzz")],
  women: [woman("#f6d5bd", "#e3c27a", "ponytail"), woman("#b37a52", "#1c1714", "braids")],
  mix: [woman("#d49c74", "#6b4226", "bob"), man("#f6d5bd", "#b8863b", "sidepart")],
};

/** First screen: language, manager name and look, who plays, the league and the club. */
export function NewGame() {
  const {t} = useT();
  const lang = useGame((s) => s.lang);
  const setLang = useGame((s) => s.setLang);
  const start = useGame((s) => s.start);
  const [name, setName] = useState("");
  const [look, setLook] = useState<ManagerLook>(() => defaultManagerLook(String(Math.random())));
  const [club, setClub] = useState(6);
  const [gender, setGender] = useState<PlayersGender>("men");
  const [leagueId, setLeagueId] = useState(LEAGUES[0].id);
  const league = leagueById(leagueId);

  const difficulty = (i: number) => (i < 3 ? "easy" : i < 9 ? "medium" : "hard");

  return (
    <main className="welcome">
      <div className="welcome-card">
        <p className="eyebrow">{league.name}</p>
        <h1>⚽ Forza Manager</h1>
        <p className="muted">{t("new.intro")}</p>

        <select className="lang-select" value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label={t("settings.language")}>
          {LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
        </select>

        <h3>{t("new.yourManager")}</h3>
        <label className="field">
          <span>{t("new.managerName")}</span>
          <input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder={t("new.namePlaceholder")} />
        </label>
        <ManagerEditor look={look} onChange={setLook} />

        <h3>{t("new.players")}</h3>
        <div className="gender-pick" role="radiogroup" aria-label={t("new.players")}>
          {PLAYERS_GENDERS.map((g) => (
            <button key={g} type="button" role="radio" aria-checked={g === gender} className={g === gender ? "gender-option active" : "gender-option"} onClick={() => setGender(g)}>
              <span className="gender-faces">
                {SAMPLES[g].map((s, i) => (
                  <ManagerAvatar key={i} look={s} size={40} tie="transparent" />
                ))}
              </span>
              <strong>{t(`new.gender.${g}`)}</strong>
            </button>
          ))}
        </div>

        <h3>{t("new.pickLeague")}</h3>
        <div className="league-pick" role="radiogroup" aria-label={t("new.pickLeague")}>
          {LEAGUES.map((l) => (
            <button key={l.id} type="button" role="radio" aria-checked={l.id === leagueId} className={l.id === leagueId ? "league-option active" : "league-option"} onClick={() => setLeagueId(l.id)}>
              <FlagIcon code={l.flag} size={26} />
              <strong>{l.name}</strong>
              <span className="league-crests" aria-hidden>
                {l.clubs.slice(0, 4).map((c) => <span key={c.short} className="crest tiny" style={{background: c.color, borderColor: c.color2}} />)}
              </span>
            </button>
          ))}
        </div>

        <fieldset className="club-pick">
          <legend>{t("new.pickClub")}</legend>
          {league.clubs.map((c, i) => (
            <label key={c.name} className={i === club ? "club-option selected" : "club-option"}>
              <input type="radio" name="club" checked={i === club} onChange={() => setClub(i)} />
              <span className="crest" style={{background: c.color, color: c.color2}}>{c.short}</span>
              <span className="club-option-name">{c.name}</span>
              <span className={`difficulty ${difficulty(i)}`}>{t(`new.difficulty.${difficulty(i)}`)}</span>
            </label>
          ))}
        </fieldset>

        <button className="btn primary big" onClick={() => start(name.trim() || t("new.defaultName"), club, look, gender, leagueId)}>
          {t("new.start")} ▶
        </button>
      </div>
    </main>
  );
}
