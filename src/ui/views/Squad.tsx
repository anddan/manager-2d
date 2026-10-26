import {useState} from "react";
import {fullName, listName, shortName, userClub} from "../../game/helpers";
import {clubPlayers, overall} from "../../game/ratings";
import {takerSkill} from "../../game/setpieces";
import {POSITIONS, TEAM_ROLES, type Player, type TeamRole} from "../../game/types";
import {useT, type TKey} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Avatar} from "../Avatar";
import {Bar, Card, Face, Flag, FormArrow, PosBadge, StatusIcons} from "../common";

type SortKey = "pos" | "name" | "age" | "ovr" | "form" | "fitness" | "happiness" | "value" | "wage";

const COLUMNS: {key: SortKey; label: TKey}[] = [
  {key: "pos", label: "col.pos"},
  {key: "name", label: "col.name"},
  {key: "age", label: "col.age"},
  {key: "ovr", label: "col.ovr"},
  {key: "form", label: "col.form"},
  {key: "fitness", label: "col.fitness"},
  {key: "happiness", label: "col.happiness"},
  {key: "value", label: "col.value"},
  {key: "wage", label: "col.wage"},
];

function sortValue(p: Player, key: SortKey): number | string {
  switch (key) {
    case "pos": return POSITIONS.indexOf(p.position);
    case "name": return shortName(p);
    case "age": return p.age;
    case "ovr": return overall(p);
    case "form": return p.form;
    case "fitness": return p.fitness;
    case "happiness": return p.happiness;
    case "value": return p.value;
    case "wage": return p.contract.wage;
  }
}

export function Squad() {
  const {t, money} = useT();
  const game = useGameState();
  const openPlayer = useGame((s) => s.openPlayer);
  const club = userClub(game);
  const [sort, setSort] = useState<SortKey>("ovr");
  const [desc, setDesc] = useState(true);
  const players = clubPlayers(game, userClub(game).id).sort((a, b) => {
    const va = sortValue(a, sort);
    const vb = sortValue(b, sort);
    const cmp = typeof va === "string" ? va.localeCompare(String(vb)) : va - Number(vb);
    return (desc ? -cmp : cmp) || overall(b) - overall(a);
  });
  // Players out on loan still belong to the club.
  const loanedOut = Object.values(game.players).filter((p) => p.loan?.parentClubId === game.userClubId);

  const onSort = (key: SortKey) => {
    if (key === sort) setDesc(!desc);
    else {
      setSort(key);
      setDesc(["ovr", "form", "fitness", "happiness", "value", "wage"].includes(key));
    }
  };

  return (
    <div className="stack">
    <TeamRolesCard />
    <Card title={`${t("nav.squad")} (${players.length})`}>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} title={c.key === "ovr" ? t("col.ovrHint") : undefined}>
                  <button className="th-btn" onClick={() => onSort(c.key)}>
                    {t(c.label)}{sort === c.key ? (desc ? " ▼" : " ▲") : ""}
                  </button>
                </th>
              ))}
              <th>{t("col.contract")}</th>
              <th>{t("col.role")}</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id} className="clickable" onClick={() => openPlayer(p.id)}>
                <td><PosBadge pos={p.position} /></td>
                <td className="name-cell">
                  <Avatar player={p} shirt={club.color} trim={club.color2} size={28} mood={p.happiness} />
                  <Flag code={p.nationality} /> {listName(p)} <StatusIcons player={p} />
                </td>
                <td>{p.age}</td>
                <td className="num strong">{overall(p)}</td>
                <td><FormArrow form={p.form} /></td>
                <td><Bar value={p.fitness} small /></td>
                <td><Face value={p.happiness} /></td>
                <td className="num">{money(p.value)}</td>
                <td className="num">{money(p.contract.wage)}</td>
                <td className="num">{p.contract.expiresSeason}</td>
                <td>{t(`role.${p.contract.role}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loanedOut.length > 0 && (
        <>
          <h3>{t("squad.loanedOut")}</h3>
          <ul className="plain-list">
            {loanedOut.map((p) => (
              <li key={p.id}>
                <button className="link" onClick={() => openPlayer(p.id)}>{fullName(p)}</button>{" "}
                <span className="muted">→ {game.clubs[p.clubId!].name}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
    </div>
  );
}

const ROLES_OPEN_KEY = "manager2d.rolesOpen";

const ROLE_ICONS: Record<TeamRole, string> = {captain: "©️", penalties: "🎯", freekicks: "🌀", corners: "🚩"};

/** How good a player is at a role, for sorting and showing next to the name. */
function roleSkill(p: Player, role: TeamRole): number {
  if (role === "captain") return Math.round((overall(p) + Math.min(p.age, 34) + p.professionalism / 2) / 2);
  return Math.round(takerSkill(p, role === "penalties" ? "penalty" : role === "freekicks" ? "freekick" : "corner"));
}

/** Captain and set-piece takers. "Automatic" lets the best one on the pitch take it. */
function TeamRolesCard() {
  const {t} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const club = userClub(game);
  const squad = clubPlayers(game, club.id);
  // One role's list open at a time, under its tile.
  const [open, setOpen] = useState<TeamRole | null>(null);
  const [all, setAll] = useState(false);
  const choose = (role: TeamRole, id: string | undefined) => {
    act((g) => {
      const c = g.clubs[g.userClubId];
      c.roles = {...c.roles, [role]: id};
    });
    setOpen(null);
  };
  // Folded by default (remembered on this device): just who does what.
  const [shown, setShown] = useState(() => {
    try {
      return localStorage.getItem(ROLES_OPEN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setShown((v) => {
      try {
        localStorage.setItem(ROLES_OPEN_KEY, v ? "0" : "1");
      } catch {
        // Only for now.
      }
      return !v;
    });
  // Who has each role: the manager's pick, or the best of the starting eleven.
  const holderOf = (role: TeamRole) => {
    const picked = club.roles?.[role];
    if (picked && squad.some((p) => p.id === picked)) return game.players[picked];
    return squad
      .filter((p) => (role === "captain" || p.position !== "GK") && club.lineup.includes(p.id))
      .sort((a, b) => roleSkill(b, role) - roleSkill(a, role))[0];
  };
  return (
    <Card
      className="roles-card"
      title={
        <button className="card-toggle" aria-expanded={shown} onClick={toggle}>
          🎽 {t("roles.title")} <span className="card-toggle-arrow" aria-hidden>{shown ? "▲" : "▼"}</span>
        </button>
      }
    >
      {!shown && (
        <button className="roles-summary" onClick={toggle}>
          {TEAM_ROLES.map((role) => {
            const h = holderOf(role);
            return (
              <span key={role} className="roles-summary-item" title={t(`roles.${role}`)}>
                <span aria-hidden>{ROLE_ICONS[role]}</span> {h ? listName(h) : "–"}
              </span>
            );
          })}
        </button>
      )}
      {shown && (
      <>
      <p className="muted small">{t("roles.hint")}</p>
      <div className="roles-grid">
        {TEAM_ROLES.map((role) => {
          const options = squad
            .filter((p) => role === "captain" || p.position !== "GK")
            .sort((a, b) => roleSkill(b, role) - roleSkill(a, role));
          // A player who has left the club no longer holds the role.
          const current = squad.some((p) => p.id === club.roles?.[role]) ? club.roles![role]! : "";
          const chosen = current ? game.players[current] : undefined;
          // Automatic: the best of the starting eleven for it.
          const auto = options.find((p) => club.lineup.includes(p.id));
          const holder = chosen ?? auto;
          const isOpen = open === role;
          const shown = all ? options : options.slice(0, 6);
          return (
            <div key={role} className={`role-tile ${isOpen ? "open" : ""}`}>
              <div className="role-head">
                <span className="role-icon" aria-hidden>{ROLE_ICONS[role]}</span>
                <span className="role-label">{t(`roles.${role}`)}</span>
                <button className="btn small" aria-expanded={isOpen} onClick={() => { setOpen(isOpen ? null : role); setAll(false); }}>
                  {isOpen ? t("roles.close") : t("roles.change")} {isOpen ? "▲" : "▼"}
                </button>
              </div>
              <div className="role-holder">
                {holder && <Avatar player={holder} shirt={club.color} trim={club.color2} size={34} />}
                <div className="role-who">
                  <strong>{holder ? listName(holder) : "–"}</strong>
                  <span className="muted small">{chosen ? t("roles.picked") : t("roles.autoShort")}</span>
                </div>
                {holder && (
                  <span className="role-skill">
                    <span className="num">{roleSkill(holder, role)}</span>
                    <Bar value={roleSkill(holder, role)} small />
                  </span>
                )}
              </div>
              {isOpen && (
                <ul className="role-options">
                  {shown.map((p) => (
                    <li key={p.id}>
                      <button className={`role-option ${current === p.id ? "active" : ""}`} onClick={() => choose(role, p.id)}>
                        <PosBadge pos={p.position} />
                        <span className="role-option-name">{listName(p)}{club.lineup.includes(p.id) ? "" : <span className="muted small"> · {t("roles.notStarting")}</span>}</span>
                        <span className="num">{roleSkill(p, role)}</span>
                        <Bar value={roleSkill(p, role)} small />
                      </button>
                    </li>
                  ))}
                  {!all && options.length > shown.length && (
                    <li>
                      <button className="link small" onClick={() => setAll(true)}>{t("roles.showAll", {n: options.length})}</button>
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      </>
      )}
    </Card>
  );
}
