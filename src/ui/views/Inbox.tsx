import {useState} from "react";
import {Icon, type IconName, iconize} from "../Icon";
import {shortName} from "../../game/helpers";
import {answerTransferRequest} from "../../game/morale";
import {startNegotiation} from "../../game/contracts";
import type {Message, MessageKind} from "../../game/types";
import {useT} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Card, Empty, Tabs} from "../common";
import {BidCard} from "./Transfers";

const KIND_ICONS: Record<MessageKind, IconName> = {news: "list", player: "user", transfer: "swap", finance: "coins", match: "ball"};

export function Inbox() {
  const {t} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const [filter, setFilter] = useState<MessageKind | "all">("all");
  const [open, setOpen] = useState<string | null>(null);
  const messages = game.inbox.filter((m) => filter === "all" || m.kind === filter);

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
        ]}
      />
      {messages.length === 0 ? <Empty>{iconize(t("inbox.empty"))}</Empty> : (
        <ul className="inbox">
          {messages.map((m) => (
            <li key={m.id} className={`${m.read ? "" : "unread"} ${open === m.id ? "open" : ""}`}>
              <button className="inbox-row" onClick={() => toggle(m)} aria-expanded={open === m.id}>
                <span aria-hidden className="inbox-kind"><Icon name={KIND_ICONS[m.kind]} size={20} /></span>
                <span className="inbox-text"><MessageText message={m} /></span>
                <span className="muted small">{iconize(t("inbox.week", {week: m.absWeek}))}</span>
              </button>
              {open === m.id && m.action && !m.resolved && <MessageAction message={m} />}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function MessageText({message}: {message: Message}) {
  const {tx} = useT();
  return <>{iconize(tx(message.key, message.params))}</>;
}

function MessageAction({message: m}: {message: Message}) {
  const {t} = useT();
  const game = useGameState();
  const act = useGame((s) => s.act);
  const openPlayer = useGame((s) => s.openPlayer);
  const watchMatch = useGame((s) => s.watchMatch);
  const setNegotiation = useGame((s) => s.setNegotiation);
  const notify = useGame((s) => s.notify);
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
    case "match":
      return game.reports.some((r) => r.fixtureId === a.fixtureId) ? (
        <div className="inbox-action"><button className="btn" onClick={() => watchMatch(a.fixtureId)}><Icon name="play" size={18} /> {iconize(t("fx.watch"))}</button></div>
      ) : null;
  }
}
