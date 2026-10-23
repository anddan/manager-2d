import {useState} from "react";
import {userClub} from "../../game/helpers";
import {clubPlayers, overall} from "../../game/ratings";
import {POSITIONS, type Player} from "../../game/types";
import {useT, type TKey} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Avatar} from "../Avatar";
import {Bar, Card, Face, Flag, PosBadge, StatusIcons} from "../common";

type SortKey = "pos" | "name" | "age" | "ovr" | "pot" | "form" | "fitness" | "happiness" | "value" | "wage";

const COLUMNS: {key: SortKey; label: TKey}[] = [
  {key: "pos", label: "col.pos"},
  {key: "name", label: "col.name"},
  {key: "age", label: "col.age"},
  {key: "ovr", label: "col.ovr"},
  {key: "pot", label: "col.pot"},
  {key: "form", label: "col.form"},
  {key: "fitness", label: "col.fitness"},
  {key: "happiness", label: "col.happiness"},
  {key: "value", label: "col.value"},
  {key: "wage", label: "col.wage"},
];

function sortValue(p: Player, key: SortKey): number | string {
  switch (key) {
    case "pos": return POSITIONS.indexOf(p.position);
    case "name": return p.lastName;
    case "age": return p.age;
    case "ovr": return overall(p);
    case "pot": return p.potential;
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
      setDesc(["ovr", "pot", "form", "fitness", "happiness", "value", "wage"].includes(key));
    }
  };

  return (
    <Card title={`${t("nav.squad")} (${players.length})`}>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key}>
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
                  <Flag code={p.nationality} /> {p.firstName.charAt(0)}. {p.lastName} <StatusIcons player={p} />
                </td>
                <td>{p.age}</td>
                <td className="num strong">{overall(p)}</td>
                <td className="num">{p.potential}</td>
                <td><Bar value={p.form} small /></td>
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
                <button className="link" onClick={() => openPlayer(p.id)}>{p.firstName} {p.lastName}</button>{" "}
                <span className="muted">→ {game.clubs[p.clubId!].name}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
