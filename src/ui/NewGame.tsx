import {useState} from "react";
import {difficultyAt} from "../game/helpers";
import {Icon, iconize, type IconName} from "./Icon";
import {LEAGUES, leagueById} from "../game/leagues";
import {PLAYERS_GENDERS, type ManagerLook, type PlayersGender} from "../game/types";
import {useT} from "../i18n";
import {useGame} from "../store";
import {ManagerAvatar, defaultManagerLook} from "./Avatar";
import {FlagIcon} from "./Flag";
import {ManagerEditor} from "./ManagerEditor";

/** The men / women / mixed choice, as an icon each. */
const GENDER_ICONS: Record<PlayersGender, IconName> = {men: "male", women: "female", mix: "mixed"};

/** First screen: manager name and look, who plays, the league and the club. */
export function NewGame() {
  const {t} = useT();
  const start = useGame((s) => s.start);
  const [name, setName] = useState("");
  const [look, setLook] = useState<ManagerLook>(() => defaultManagerLook(String(Math.random())));
  const [club, setClub] = useState(6);
  const [gender, setGender] = useState<PlayersGender>("men");
  const [leagueId, setLeagueId] = useState(LEAGUES[0].id);
  const [editLook, setEditLook] = useState(false);
  const [leaguesOpen, setLeaguesOpen] = useState(false);
  const league = leagueById(leagueId);

  const difficulty = difficultyAt;

  return (
    <main className="welcome">
      <div className="welcome-card">
        <h1>⚽ Forza Manager</h1>
        <p className="muted">{iconize(t("new.intro"))}</p>

        <h3>{iconize(t("new.yourManager"))}</h3>
        {/* The name, with the face beside it; the look editor only when asked for. */}
        <div className="new-manager">
          {!editLook && <ManagerAvatar look={look} size={64} />}
          <label className="field">
            <span>{iconize(t("new.managerName"))}</span>
            <input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder={t("new.namePlaceholder")} />
          </label>
        </div>
        {editLook ? (
          <ManagerEditor look={look} onChange={setLook} />
        ) : (
          <button type="button" className="btn small" onClick={() => setEditLook(true)}><Icon name="palette" size={16} /> {iconize(t("new.editLook"))}</button>
        )}

        <h3>{iconize(t("new.players"))}</h3>
        <div className="gender-pick" role="radiogroup" aria-label={t("new.players")}>
          {PLAYERS_GENDERS.map((g) => (
            <button key={g} type="button" role="radio" aria-checked={g === gender} className={g === gender ? "gender-option active" : "gender-option"} onClick={() => setGender(g)}>
              <Icon name={GENDER_ICONS[g]} size={30} />
              <strong>{iconize(t(`new.gender.${g}`))}</strong>
            </button>
          ))}
        </div>

        <h3>{iconize(t("new.pickLeague"))}</h3>
        {/* The league chosen; tap to fold out the others. */}
        <button type="button" className={leaguesOpen ? "league-option league-current open" : "league-option league-current"} aria-expanded={leaguesOpen} onClick={() => setLeaguesOpen(!leaguesOpen)}>
          <FlagIcon code={league.flag} size={26} />
          <strong>{league.name}</strong>
          <Icon name="chevron" size={20} />
        </button>
        {leaguesOpen && (
          <div className="league-pick" role="radiogroup" aria-label={t("new.pickLeague")}>
            {LEAGUES.map((l) => (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={l.id === leagueId}
                className={l.id === leagueId ? "league-option active" : "league-option"}
                onClick={() => {
                  setLeagueId(l.id);
                  setLeaguesOpen(false);
                }}
              >
                <FlagIcon code={l.flag} size={26} />
                <strong>{l.name}</strong>
              </button>
            ))}
          </div>
        )}

        <fieldset className="club-pick">
          <legend>{iconize(t("new.pickClub"))}</legend>
          {league.clubs.map((c, i) => (
            <label key={c.name} className={i === club ? "club-option selected" : "club-option"}>
              <input type="radio" name="club" checked={i === club} onChange={() => setClub(i)} />
              <span className="crest" style={{background: c.color, color: c.color2}}>{c.short}</span>
              <span className="club-option-name">{c.name}</span>
              <span className={`difficulty ${difficulty(i)}`}>{iconize(t(`new.difficulty.${difficulty(i)}`))}</span>
            </label>
          ))}
        </fieldset>

        <button className="btn primary big" onClick={() => start(name.trim() || t("new.defaultName"), club, look, gender, leagueId)}>
          {iconize(t("new.start"))} ▶
        </button>
      </div>
    </main>
  );
}
