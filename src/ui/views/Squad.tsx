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
  const [sort, setSort] = useState<SortKey>("pos");
  const [desc, setDesc] = useState(false);
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
  return (
    <Card title={`🎽 ${t("roles.title")}`}>
      <p className="muted small">{t("roles.hint")}</p>
      <div className="roles-grid">
        {TEAM_ROLES.map((role) => {
          const options = squad
            .filter((p) => role === "captain" || p.position !== "GK")
            .sort((a, b) => roleSkill(b, role) - roleSkill(a, role));
          // A player who has left the club no longer holds the role.
          const current = squad.some((p) => p.id === club.roles?.[role]) ? club.roles![role]! : "";
          const chosen = current ? game.players[current] : undefined;
          return (
            <label key={role} className="role-pick">
              <span className="role-label">{ROLE_ICONS[role]} {t(`roles.${role}`)}</span>
              <span className="role-select">
                {chosen && <Avatar player={chosen} shirt={club.color} trim={club.color2} size={30} />}
                <select
                  value={current}
                  onChange={(e) => act((g) => {
                    const c = g.clubs[g.userClubId];
                    c.roles = {...c.roles, [role]: e.target.value || undefined};
                  })}
                >
                  <option value="">{t("roles.auto")}</option>
                  {options.map((p) => (
                    <option key={p.id} value={p.id}>
                      {listName(p)} · {t(`pos.${p.position}`)} · {roleSkill(p, role)}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          );
        })}
      </div>
    </Card>
  );
}
