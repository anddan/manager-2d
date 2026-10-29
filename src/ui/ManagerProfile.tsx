// The manager's profile: who they are and what they've won. The manager's name
// can be changed here, the club given a nickname (the way players can: shown
// everywhere, with the real name kept alongside in brackets here) and its colours.
import {Icon, iconize} from "./Icon";
import {useState} from "react";
import {CUP_ROUNDS} from "../game/cup";
import {leaguePosition} from "../game/league";
import {useT} from "../i18n";
import {useGame, useGameState} from "../store";
import {ManagerAvatar, defaultManagerLook} from "./Avatar";
import {Modal} from "./common";
import {awayKit, homeKit} from "../game/kit";
import {COLLARS, SHIRT_PATTERNS, SLEEVES, type Collar, type Kit, type ShirtPattern, type Sleeves} from "../game/types";
import {Jersey} from "./Jersey";
import type {TKey} from "../i18n";

export function ManagerProfile({onClose}: {onClose: () => void}) {
  const {t, tx, money, lang} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const club = game.clubs[game.userClubId];
  const official = club.officialName ?? club.name;
  const [nick, setNick] = useState(club.officialName ? club.name : "");
  const [managerName, setManagerName] = useState(game.managerName);
  // Two kits, home and away, edited one at a time (the toggle picks which).
  const [which, setWhich] = useState<"home" | "away">("home");
  const [kits, setKits] = useState<{home: Kit; away: Kit}>(() => ({home: homeKit(club), away: awayKit(club)}));
  const kit = kits[which];
  const setKit = (patch: Partial<Kit>) => setKits((k) => ({...k, [which]: {...k[which], ...patch}}));
  const color = kit.color;
  const color2 = kit.color2;
  const color3 = kit.color3;
  const collar: Collar = kit.collar ?? "round";
  const sleeves: Sleeves = kit.sleeves ?? "short";
  const pattern: ShirtPattern = kit.pattern ?? "solid";
  const setColor = (c: string) => setKit({color: c});
  const setColor2 = (c: string) => setKit({color2: c});
  const setColor3 = (c: string | undefined) => setKit({color3: c});
  const setCollar = (c: Collar) => setKit({collar: c === "round" ? undefined : c});
  const setSleeves = (c: Sleeves) => setKit({sleeves: c === "short" ? undefined : c});
  const setPattern = (p: ShirtPattern) => setKit({pattern: p === "solid" ? undefined : p});
  // The club's initials on its crest (up to three letters).
  const [short, setShort] = useState(club.short);
  const trophies = [
    ...game.history.filter((h) => h.userPosition === 1).map((h) => ({season: h.season, key: "trophy.leagueShort"})),
    ...game.history.filter((h) => h.cup === CUP_ROUNDS.length).map((h) => ({season: h.season, key: "trophy.cupShort"})),
  ].sort((a, b) => a.season - b.season);
  const cupText = (cup?: number) => (cup === undefined ? "" : cup === CUP_ROUNDS.length ? t("mgr.cupWon") : tx(CUP_ROUNDS[cup]));
  // Saved, and the dialog closes.
  const save = () => {
    act((g) => {
      const c = g.clubs[g.userClubId];
      const who = managerName.trim();
      if (who) g.managerName = who;
      const home = kits.home;
      c.color = home.color;
      c.color2 = home.color2;
      c.color3 = home.color3;
      c.pattern = home.pattern;
      c.collar = home.collar;
      c.sleeves = home.sleeves;
      c.away = {...kits.away};
      const initials = short.trim().toUpperCase();
      if (initials) c.short = initials;
      const name = nick.trim();
      if (name && name !== (c.officialName ?? c.name)) {
        c.officialName = c.officialName ?? c.name;
        c.name = name;
      } else if (c.officialName) {
        c.name = c.officialName;
        delete c.officialName;
      }
    });
    onClose();
  };

  return (
    <Modal title={t("mgr.title")} onClose={onClose}>
      <section className="mgr-section">
      <h3 className="mgr-section-title"><Icon name="user" size={18} /> {iconize(t("mgr.sectionManager"))}</h3>
      <div className="mgr-head">
        <ManagerAvatar look={game.managerLook ?? defaultManagerLook(game.managerName)} size={84} tie={kits.home.color} />
        <div>
          <h3>{managerName.trim() || game.managerName}</h3>
          <p className="muted">{club.officialName ? `${club.name} (${official})` : club.name}</p>
        </div>
      </div>

      <h4><Icon name="pen" size={18} /> {iconize(t("mgr.managerName"))}</h4>
      <input className="input mgr-input" value={managerName} maxLength={30} placeholder={game.managerName} onChange={(e) => setManagerName(e.target.value)} />

      <h4><Icon name="trophy" size={18} /> {iconize(t("mgr.trophies"))}</h4>
      {trophies.length === 0 ? (
        <p className="muted">{iconize(t("mgr.noTrophies"))}</p>
      ) : (
        <ul className="mgr-trophies">
          {trophies.map((tr, i) => <li key={i}><Icon name="trophy" size={18} /> {iconize(tx(tr.key, {season: tr.season}))}</li>)}
        </ul>
      )}

      {/* What's been bought in the shop with real money. */}
      <h4><Icon name="cart" size={18} /> {iconize(t("mgr.bought"))}</h4>
      <dl className="kv mgr-bought">
        <dt>{iconize(t("mgr.boughtDiamonds"))}</dt><dd><Icon name="diamond" size={16} /> {game.purchases?.diamonds ?? 0}</dd>
        <dt>{iconize(t("mgr.boughtMoney"))}</dt><dd><Icon name="coins" size={16} /> {money(game.purchases?.money ?? 0)}</dd>
        <dt>{iconize(t("mgr.boughtCost"))}</dt><dd>{new Intl.NumberFormat(lang, {style: "currency", currency: "EUR"}).format(game.purchases?.eur ?? 0)}</dd>
      </dl>

      <h4><Icon name="list" size={18} /> {iconize(t("mgr.career"))}</h4>
      <ul className="mgr-career">
        <li>
          <strong>{game.season}</strong> {iconize(t("mgr.now", {position: leaguePosition(game, club.id)}))}
        </li>
        {[...game.history].reverse().map((h) => (
          <li key={h.season}>
            <strong>{h.season}</strong> {iconize(t("mgr.position", {position: h.userPosition}))}
            {h.cup !== undefined && <> · {iconize(t("cup.name"))}: {cupText(h.cup)}</>}
          </li>
        ))}
      </ul>

      </section>

      {/* The club: its nickname, initials and colours. */}
      <section className="mgr-section">
      <h3 className="mgr-section-title"><Icon name="stadium" size={18} /> {iconize(t("mgr.sectionClub"))}</h3>
      <h4><Icon name="pen" size={18} /> {iconize(t("mgr.clubNick"))}</h4>
      <p className="muted small">{iconize(t("mgr.clubNickHint", {name: official}))}</p>
      <input className="input mgr-input" value={nick} maxLength={30} placeholder={official} onChange={(e) => setNick(e.target.value)} />

      <h4><Icon name="text" size={18} /> {iconize(t("mgr.initials"))}</h4>
      <input className="input mgr-initials" value={short} maxLength={3} placeholder={club.short} onChange={(e) => setShort(e.target.value.toUpperCase())} aria-label={t("mgr.initials")} />

      <h4><Icon name="palette" size={18} /> {iconize(t("mgr.colors"))}</h4>
      {/* Home or away: the toggle picks which kit the colours and the shirt below are for. */}
      <div className="kit-row">
        <span className="speed-group kit-which" role="group" aria-label={t("mgr.colors")}>
          {(["home", "away"] as const).map((w) => (
            <button key={w} type="button" className={which === w ? "chip active" : "chip"} onClick={() => setWhich(w)}>
              <Jersey color={kits[w].color} trim={kits[w].color2} pattern={kits[w].pattern} trim3={kits[w].color3} collar={kits[w].collar} sleeves={kits[w].sleeves} size={22} /> {t(w === "home" ? "mgr.kitHome" : "mgr.kitAway")}
            </button>
          ))}
        </span>
        {which === "away" && <button type="button" className="btn small" onClick={() => setKits((k) => ({...k, away: awayKit({...club, away: undefined, color: k.home.color, color2: k.home.color2, color3: k.home.color3, collar: k.home.collar, sleeves: k.home.sleeves})}))}>{iconize(t("mgr.kitAwayReset"))}</button>}
      </div>
      {which === "away" && club.away && <p className="muted small">{iconize(t("mgr.kitAwayHint"))}</p>}
      <div className="mgr-colors">
        <span className="crest big" style={{background: color, color: color2}} aria-hidden>{short.trim().toUpperCase() || club.short}</span>
        <div className="mgr-swatch-rows">
          <ColorRow label={t("mgr.color1")} value={color} onPick={setColor} />
          <ColorRow label={t("mgr.color2")} value={color2} onPick={setColor2} />
          <ColorRow label={t("mgr.color3")} value={color3 ?? color2} onPick={setColor3} />
          {color3 && <button type="button" className="btn small" onClick={() => setColor3(undefined)}>{iconize(t("mgr.color3Reset"))}</button>}
        {/* The shirt: plain or patterned, in the two colours above. */}
        <h4><Icon name="shirt" size={18} /> {iconize(t("mgr.shirt"))}</h4>
        <div className="shirt-patterns" role="radiogroup" aria-label={t("mgr.shirt")}>
          {SHIRT_PATTERNS.map((p) => (
            <button key={p} type="button" role="radio" aria-checked={p === pattern} className={p === pattern ? "shirt-pattern on" : "shirt-pattern"} onClick={() => setPattern(p)} title={t(`shirt.${p}` as TKey)}>
              <Jersey color={color} trim={color2} pattern={p} trim3={color3} collar={collar} sleeves={sleeves} size={44} />
              <span>{iconize(t(`shirt.${p}` as TKey))}</span>
            </button>
          ))}
        </div>
        <div className="shirt-patterns" role="radiogroup" aria-label={t("mgr.collar")}>
          {COLLARS.map((o) => (
            <button key={o} type="button" role="radio" aria-checked={o === collar} className={o === collar ? "shirt-pattern on" : "shirt-pattern"} onClick={() => setCollar(o)}>
              <Jersey color={color} trim={color2} pattern={pattern} trim3={color3} size={44} collar={o} sleeves={sleeves} />
              <span>{iconize(t(`collar.${o}` as TKey))}</span>
            </button>
          ))}
        </div>
        <div className="shirt-patterns" role="radiogroup" aria-label={t("mgr.sleeves")}>
          {SLEEVES.map((o) => (
            <button key={o} type="button" role="radio" aria-checked={o === sleeves} className={o === sleeves ? "shirt-pattern on" : "shirt-pattern"} onClick={() => setSleeves(o)}>
              <Jersey color={color} trim={color2} pattern={pattern} trim3={color3} size={44} collar={collar} sleeves={o} />
              <span>{iconize(t(`sleeves.${o}` as TKey))}</span>
            </button>
          ))}
        </div>
        </div>
      </div>
      </section>

      {/* Always in view at the bottom of the dialog, however far it's scrolled. */}
      <div className="btn-row dialog-actions mgr-actions">
        <button className="btn" onClick={onClose}>{iconize(t("common.cancel"))}</button>
        <button className="btn primary" onClick={save}>{iconize(t("mgr.save"))}</button>
      </div>
    </Modal>
  );
}

/** Kit colours to tap, plus the browser's own picker for any other. */
const SWATCHES = ["#dc2626", "#ea580c", "#f59e0b", "#facc15", "#16a34a", "#0f766e", "#0891b2", "#2563eb", "#1d4ed8", "#7c3aed", "#db2777", "#7a263a", "#111827", "#6b7280", "#ffffff", "#87ceeb"];

function ColorRow({label, value, onPick}: {label: string; value: string; onPick: (c: string) => void}) {
  const {t} = useT();
  return (
    <div className="mgr-swatch-row">
      <span className="small muted mgr-swatch-label">{label}</span>
      <div className="mgr-swatches" role="radiogroup" aria-label={label}>
        {SWATCHES.map((c) => (
          <button key={c} className={`mgr-swatch ${value.toLowerCase() === c ? "on" : ""}`} style={{background: c}} role="radio" aria-checked={value.toLowerCase() === c} aria-label={c} onClick={() => onPick(c)} />
        ))}
        <label className="mgr-swatch mgr-swatch-own" title={t("mgr.ownColor")}>
          <input type="color" value={value} aria-label={t("mgr.ownColor")} onChange={(e) => onPick(e.target.value)} />
          <span aria-hidden>+</span>
        </label>
      </div>
    </div>
  );
}
