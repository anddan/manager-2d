import {useState} from "react";
import {Icon, iconize} from "../Icon";
import {fullName, listName, shortName, userClub} from "../../game/helpers";
import {askingPrice, estimatedOverall, respondToBid} from "../../game/transfers";
import {POSITIONS, type Position} from "../../game/types";
import {useT} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Card, Empty, Flag, NumberInput, Ovr, PosBadge, SortTh, StatusIcons, Tabs, sortRows, useSort, Hint} from "../common";

type SearchSort = "pos" | "name" | "age" | "ovr" | "club" | "price" | "contract";

type Tab = "search" | "bids" | "listed" | "scouting";

export function Transfers() {
  const {t} = useT();
  const game = useGameState();
  const [tab, setTab] = useState<Tab>("search");
  const bids = game.incomingBids.length;
  return (
    <Card title={t("nav.transfers")}>
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          {id: "search", label: <><Icon name="search" size={18} /> {iconize(t("tr.search"))}</>},
          {id: "bids", label: <><Icon name="inbox" size={18} /> {iconize(t("tr.bids"))}{bids ? ` (${bids})` : ""}</>},
          {id: "listed", label: <><Icon name="tag" size={18} /> {iconize(t("tr.listed"))}</>},
          {id: "scouting", label: <><Icon name="eye" size={18} /> {iconize(t("tr.scouting"))}</>},
        ]}
      />
      {tab === "search" && <Search />}
      {tab === "bids" && <Bids />}
      {tab === "listed" && <Listed />}
      {tab === "scouting" && <Scouting />}
    </Card>
  );
}

function Search() {
  const {t, money} = useT();
  const game = useGameState();
  const openPlayer = useGame((s) => s.openPlayer);
  const [pos, setPos] = useState<Position | "">("");
  const [maxAge, setMaxAge] = useState(35);
  const [maxPrice, setMaxPrice] = useState(0);
  const [minOvr, setMinOvr] = useState(0);
  const [source, setSource] = useState<"all" | "free" | "listed">("all");
  // Best first to start with; any column sorts the whole search, then the first 80 show.
  const sort = useSort<SearchSort>("ovr", true);

  const found = Object.values(game.players)
    .filter((p) => p.clubId !== game.userClubId && p.loan?.parentClubId !== game.userClubId && !(p.clubId && game.clubs[p.clubId]?.guest) && !game.packChoice?.includes(p.id))
    .filter((p) => (!pos || p.position === pos) && p.age <= maxAge)
    .filter((p) => (source === "free" ? !p.clubId : source === "listed" ? p.transferListed || p.loanListed : true))
    .map((p) => ({p, est: estimatedOverall(game, p), price: askingPrice(game, p)}))
    .filter(({est, price}) => est.high >= minOvr && (!maxPrice || price <= maxPrice));
  const results = sortRows(
    found.sort((a, b) => b.est.high - a.est.high),
    ({p, est, price}): number | string => {
      switch (sort.key) {
        case "pos": return POSITIONS.indexOf(p.position);
        case "name": return listName(p);
        case "age": return p.age;
        case "ovr": return est.high;
        case "club": return p.clubId ? game.clubs[p.clubId].short : "";
        case "price": return p.clubId ? price : 0;
        case "contract": return p.clubId ? p.contract.expiresSeason : 0;
      }
    },
    sort.desc
  ).slice(0, 80);
  const th = (key: SearchSort, label: string, descFirst = true, title?: string) => (
    <SortTh label={label} title={title} active={sort.key === key} desc={sort.desc} onClick={() => sort.onSort(key, descFirst)} />
  );

  return (
    <>
      <div className="filters">
        <label className="field">
          <span>{iconize(t("col.pos"))}</span>
          <select value={pos} onChange={(e) => setPos(e.target.value as Position | "")}>
            <option value="">{iconize(t("common.all"))}</option>
            {POSITIONS.map((p) => <option key={p} value={p}>{iconize(t(`pos.${p}`))}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{iconize(t("tr.maxAge"))}</span>
          <NumberInput max={40} value={maxAge} onChange={setMaxAge} />
        </label>
        <label className="field">
          <span>{iconize(t("tr.minOvr"))}</span>
          <NumberInput max={99} value={minOvr} onChange={setMinOvr} />
        </label>
        <label className="field">
          <span>{iconize(t("tr.maxPrice"))}</span>
          <NumberInput step={100_000} value={maxPrice} onChange={setMaxPrice} placeholder="0 = ∞" />
        </label>
        <label className="field">
          <span>{iconize(t("tr.source"))}</span>
          <select value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
            <option value="all">{iconize(t("common.all"))}</option>
            <option value="free">{iconize(t("tr.freeAgents"))}</option>
            <option value="listed">{iconize(t("tr.onlyListed"))}</option>
          </select>
        </label>
      </div>
      <Hint>{iconize(t("tr.searchHint", {budget: userClub(game).transferBudget}))}</Hint>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {th("pos", t("col.pos"), false)}{th("name", t("col.name"), false)}{th("age", t("col.age"), false)}{th("ovr", t("col.ovr"), true, t("col.ovrHint"))}
              {th("club", t("tbl.club"), false)}{th("price", t("tr.asking"), false)}{th("contract", t("col.contract"), false)}
            </tr>
          </thead>
          <tbody>
            {results.map(({p, price}) => (
              <tr key={p.id} className="clickable" onClick={() => openPlayer(p.id)}>
                <td><PosBadge pos={p.position} /></td>
                <td className="name-cell"><Flag code={p.nationality} /> {listName(p)} <StatusIcons player={p} /></td>
                <td>{p.age}</td>
                <td className="num"><Ovr game={game} player={p} /></td>
                <td>{p.clubId ? game.clubs[p.clubId].short : t("tr.free")}</td>
                <td className="num">{p.clubId ? money(price) : "–"}</td>
                <td className="num">{p.clubId ? p.contract.expiresSeason : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {results.length === 0 && <Empty>{iconize(t("tr.noResults"))}</Empty>}
    </>
  );
}

/** Bids from AI clubs on the user's players. Also used in the inbox. */
export function BidCard({bidId}: {bidId: string}) {
  const {t, tx, money} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const notify = useGame((s) => s.notify);
  const openPlayer = useGame((s) => s.openPlayer);
  const bid = game.incomingBids.find((b) => b.id === bidId);
  const [counter, setCounter] = useState(() => (bid ? Math.round((bid.fee * 1.25) / 10_000) * 10_000 : 0));
  if (!bid) return <p className="muted small">{iconize(t("tr.bidClosed"))}</p>;
  const p = game.players[bid.playerId];
  const club = game.clubs[bid.fromClubId];
  const respond = (action: "accept" | "reject" | "counter") => {
    const key = act((g, rng) => respondToBid(g, rng, bidId, action, counter));
    notify(key, {name: shortName(p), club: club.name}, key === "tr.sold" || key === "tr.loanDone" ? "good" : "info");
  };
  return (
    <div className="bid-card">
      <p>
        <strong>{club.name}</strong> → <button className="link" onClick={() => openPlayer(p.id)}>{fullName(p)}</button>
        {" · "}
        {bid.loan ? t("tr.loanTerms", {pct: Math.round(bid.wageShare * 100)}) : <strong>{money(bid.fee)}</strong>}
        {!bid.loan && <span className="muted"> ({t("col.value")} {money(p.value)})</span>}
      </p>
      <div className="btn-row wrap">
        <button className="btn primary" onClick={() => respond("accept")}>{iconize(t("tr.accept"))}</button>
        <button className="btn" onClick={() => respond("reject")}>{iconize(t("tr.reject"))}</button>
        {!bid.loan && (
          <>
            <span className="small-input"><NumberInput step={10_000} value={counter} onChange={setCounter} ariaLabel={t("tr.counterAmount")} /></span>
            <button className="btn" onClick={() => respond("counter")}>{iconize(t("tr.counter"))}</button>
          </>
        )}
      </div>
      <p className="muted small">{iconize(tx("tr.expires", {weeks: Math.max(0, bid.expiresWeek - game.absWeek)}))}</p>
    </div>
  );
}

function Bids() {
  const {t} = useT();
  const game = useGameState();
  if (game.incomingBids.length === 0) return <Empty>{iconize(t("tr.noBids"))}</Empty>;
  return <div className="stack">{game.incomingBids.map((b) => <BidCard key={b.id} bidId={b.id} />)}</div>;
}

function Listed() {
  const {t, money} = useT();
  const game = useGameState();
  const openPlayer = useGame((s) => s.openPlayer);
  const listed = Object.values(game.players).filter((p) => p.clubId === game.userClubId && (p.transferListed || p.loanListed));
  if (listed.length === 0) return <Empty>{iconize(t("tr.noneListed"))}</Empty>;
  return (
    <ul className="plain-list">
      {listed.map((p) => (
        <li key={p.id}>
          <button className="link" onClick={() => openPlayer(p.id)}>{fullName(p)}</button>{" "}
          <span className="muted">{p.transferListed ? `🏷️ ${money(askingPrice(game, p))}` : ""} {p.loanListed ? <><Icon name="swap" size={16} /> {iconize(t("status.loanListed"))}</> : ""}</span>
        </li>
      ))}
    </ul>
  );
}

function Scouting() {
  const {t} = useT();
  const game = useGameState();
  const openPlayer = useGame((s) => s.openPlayer);
  const scouted = Object.entries(game.scouted)
    .map(([id, week]) => ({p: game.players[id], week}))
    .filter(({p}) => p && p.clubId !== game.userClubId)
    .sort((a, b) => b.week - a.week);
  return (
    <>
      <h3>{iconize(t("tr.inProgress"))}</h3>
      {game.scoutQueue.length === 0 ? <Empty>{iconize(t("tr.noScouting"))}</Empty> : (
        <ul className="plain-list">
          {game.scoutQueue.map((id) => game.players[id] && <li key={id}>🔭 {fullName(game.players[id])}</li>)}
        </ul>
      )}
      <h3>{iconize(t("tr.reports"))}</h3>
      {scouted.length === 0 ? <Empty>{iconize(t("tr.noReports"))}</Empty> : (
        <ul className="plain-list">
          {scouted.map(({p}) => (
            <li key={p.id}>
              <PosBadge pos={p.position} /> <button className="link" onClick={() => openPlayer(p.id)}>{fullName(p)}</button>{" "}
              <span className="muted">{iconize(t("col.ovr"))} <Ovr game={game} player={p} /> · {p.clubId ? game.clubs[p.clubId].short : t("tr.free")}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
