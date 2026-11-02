import {useEffect, useState} from "react";
import {Icon, type IconName, iconize} from "../Icon";
import {shortName} from "../../game/helpers";
import {answerTransferRequest} from "../../game/morale";
import {startNegotiation} from "../../game/contracts";
import {acceptNational} from "../../game/national";
import type {Message, MessageKind} from "../../game/types";
import {useT} from "../../i18n";
import type {TKey} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Card, Empty, Flag, Tabs} from "../common";
import {BidCard} from "./Transfers";
import {PlayerCard} from "../PlayerCard";

const KIND_ICONS: Record<MessageKind, IconName> = {news: "list", player: "user", transfer: "swap", finance: "coins", match: "ball"};

export function Inbox() {
  const {t} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const [filter, setFilter] = useState<MessageKind | "all" | "awards" | "national">("all");
  const [open, setOpen] = useState<string | null>(null);
  const messages = game.inbox.filter((m) => filter === "all" || (filter === "awards" ? m.key === "msg.awards" : filter === "national" ? m.key.startsWith("msg.national") : m.kind === filter));
  // The national team has its own group once there is a mail about it.
  const hasNational = game.inbox.some((m) => m.key.startsWith("msg.national"));

  const toggle = (m: Message) => {
    setOpen(open === m.id ? null : m.id);
    if (!m.read) act((g) => { const msg = g.inbox.find((x) => x.id === m.id); if (msg) msg.read = true; });
  };

  return (
    <Card
      title={t("nav.inbox")}
      actions={<button className="btn small mark-all" disabled={game.inbox.every((m) => m.read)} onClick={() => act((g) => g.inbox.forEach((m) => (m.read = true)))}><Icon name="check" size={16} /> {iconize(t("inbox.markAll"))}</button>}
    >
      <Tabs
        value={filter}
        onChange={setFilter}
        options={[
          {id: "all", label: t("common.all")},
          {id: "player", label: <><Icon name={KIND_ICONS.player} size={18} /> {iconize(t("inbox.player"))}</>},
          {id: "transfer", label: <><Icon name={KIND_ICONS.transfer} size={18} /> {iconize(t("inbox.transfer"))}</>},
          {id: "match", label: <><Icon name={KIND_ICONS.match} size={18} /> {iconize(t("inbox.match"))}</>},
          {id: "news", label: <><Icon name={KIND_ICONS.news} size={18} /> {iconize(t("inbox.news"))}</>},
          {id: "finance", label: <><Icon name={KIND_ICONS.finance} size={18} /> {iconize(t("inbox.finance"))}</>},
          ...(hasNational ? [{id: "national" as const, label: <><Icon name="flag" size={18} /> {iconize(t("inbox.national"))}</>}] : []),
          {id: "awards", label: <><Icon name="trophy" size={18} /> {iconize(t("inbox.awards"))}</>},
        ]}
      />
      {messages.length === 0 ? <Empty>{iconize(t("inbox.empty"))}</Empty> : (
        <ul className="inbox">
          {messages.map((m) => (
            <li key={m.id} className={`${m.read ? "" : "unread"} ${open === m.id ? "open" : ""} `}>
              <button className="inbox-row" onClick={() => toggle(m)} aria-expanded={open === m.id}>
                <span aria-hidden className="inbox-kind"><Icon name={KIND_ICONS[m.kind]} size={20} /></span>
                <span className="inbox-text"><MessageText message={m} /></span>
                <span className="muted small">{iconize(t("inbox.week", {week: m.absWeek}))}</span>
              </button>
              {m.key === "msg.awards" && <AwardsList message={m} />}
              {open === m.id && m.action && !m.resolved && <MessageAction message={m} />}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** The season's awards, always shown under the mail; the ones one of ours won are lit up in gold. */
export function AwardsList({message: m}: {message: Message}) {
  const {t} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const openPlayer = useGame((s) => s.openPlayer);
  const p = m.params;
  const rows: {key: string; icon: IconName; name: string; id: string; mine: boolean}[] = [
    {key: "player", icon: "trophy", name: String(p.player), id: String(p.playerId), mine: p.playerMine === 1},
    {key: "keeper", icon: "goal", name: String(p.keeper), id: String(p.keeperId), mine: p.keeperMine === 1},
    {key: "talent", icon: "sprout", name: String(p.talent), id: String(p.talentId), mine: p.talentMine === 1},
    {key: "manager", icon: "star", name: String(p.manager), id: "", mine: p.managerMine === 1},
  ];
  const winners = rows.filter((r) => r.id && game.players[r.id]);
  // Seen is enough: the awards never need an answer.
  useEffect(() => {
    if (!m.resolved) act((g) => { const msg = g.inbox.find((x) => x.id === m.id); if (msg) msg.resolved = true; });
  }, [m.id, m.resolved, act]);
  return (
    <>
    <ul className="awards-list">
      {rows.map((r) => (
        <li key={r.key} className={r.mine ? "award mine" : "award"}>
          <Icon name={r.mine ? "star" : r.icon} size={18} />
          <span className="award-label">{iconize(t(`award.${r.key}` as TKey))}</span>
          {r.id && game.players[r.id] ? <button className="link" onClick={() => openPlayer(r.id)}>{r.name}</button> : <span>{r.name}</span>}
          {r.mine && <strong className="award-yours">{iconize(t("award.yours"))}</strong>}
        </li>
      ))}
    </ul>
    {/* The winners' cards: tap one for the profile. */}
    {winners.length > 0 && (
      <div className="award-cards">
        {winners.map((r) => (
          <button key={r.key} type="button" className="award-card" title={t("tac.profile")} aria-label={`${t("tac.profile")}: ${r.name}`} onClick={() => openPlayer(r.id)}>
            <PlayerCard game={game} player={game.players[r.id]} />
          </button>
        ))}
      </div>
    )}
    </>
  );
}

export function MessageText({message}: {message: Message}) {
  const {t, tx} = useT();
  const text = tx(message.key, message.params);
  // A country's offer: its flag right before its name.
  if (message.action?.type === "nationalOffer") {
    const code = message.action.country;
    const name = t(`nat.${code}` as TKey);
    const at = text.indexOf(name);
    if (at >= 0) return <>{iconize(text.slice(0, at))}<Flag code={code} size={18} /> {name}{iconize(text.slice(at + name.length))}</>;
  }
  return <>{iconize(text)}</>;
}

export function MessageAction({message: m}: {message: Message}) {
  const {t} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const openPlayer = useGame((s) => s.openPlayer);
  const watchMatch = useGame((s) => s.watchMatch);
  const setNegotiation = useGame((s) => s.setNegotiation);
  const notify = useGame((s) => s.notify);
  const setView = useGame((s) => s.setView);
  const a = m.action!;
  const resolve = () => act((g) => { const msg = g.inbox.find((x) => x.id === m.id); if (msg) msg.resolved = true; });

  switch (a.type) {
    case "incomingBid":
      return <div className="inbox-action"><BidCard bidId={a.bidId} /></div>;
    case "transferRequest": {
      const p = game.players[a.playerId];
      if (!p || p.clubId !== game.userClubId) return null;
      return (
        <div className="inbox-action btn-row">
          <button className="btn" onClick={() => { act((g) => answerTransferRequest(g, a.playerId, true)); resolve(); }}>{iconize(t("pl.acceptRequest"))}</button>
          <button className="btn" onClick={() => { act((g) => answerTransferRequest(g, a.playerId, false)); resolve(); }}>{iconize(t("pl.rejectRequest"))}</button>
          <button className="btn" onClick={() => openPlayer(a.playerId)}><Icon name="user" size={18} /> {iconize(t("inbox.openPlayer"))}</button>
        </div>
      );
    }
    case "contract":
      return (
        <div className="inbox-action btn-row">
          <button
            className="btn"
            onClick={() => {
              const neg = startNegotiation(game, a.playerId, game.userClubId, "renewal");
              if ("refused" in neg) notify(neg.refused, {name: (game.players[a.playerId] ? shortName(game.players[a.playerId]) : undefined) ?? ""}, "error");
              else setNegotiation(neg);
            }}
          >
            <Icon name="pen" size={18} /> {iconize(t("pl.discussContract"))}
          </button>
          <button className="btn" onClick={() => openPlayer(a.playerId)}><Icon name="user" size={18} /> {iconize(t("inbox.openPlayer"))}</button>
        </div>
      );
    case "player":
      return game.players[a.playerId] ? (
        <div className="inbox-action"><button className="btn" onClick={() => openPlayer(a.playerId)}><Icon name="user" size={18} /> {iconize(t("inbox.openPlayer"))}</button></div>
      ) : null;
    case "ack":
      return null;
    case "nationalOffer":
      return game.national ? null : (
        <div className="inbox-action btn-row">
          <button className="btn primary" onClick={() => { act((g) => acceptNational(g, a.country)); resolve(); notify("national.accepted", {country: `nat.${a.country}`}, "good"); setView("national"); }}>{iconize(t("national.accept"))}</button>
          <button className="btn" onClick={resolve}>{iconize(t("national.decline"))}</button>
        </div>
      );
    case "match":
      return game.reports.some((r) => r.fixtureId === a.fixtureId) ? (
        <div className="inbox-action"><button className="btn" onClick={() => watchMatch(a.fixtureId)}><Icon name="play" size={18} /> {iconize(t("fx.watch"))}</button></div>
      ) : null;
  }
}
