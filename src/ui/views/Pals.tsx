// Friends: your friend code to share, adding a friend by theirs, and your friends with their
// teams as they stand (sent by themselves every week): tap one to see the line-up, the bench,
// the kit and each player.
import {useEffect, useState} from "react";
import type {TeamSnapshot} from "../../game/friendCup";
import type {Player} from "../../game/types";
import {useT, type TKey} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Card, Empty, Flag, Hint, Modal} from "../common";
import {GearCard} from "../Gear";
import {Icon, iconize} from "../Icon";
import {LineupSheet} from "../LineupSheet";
import {PlayerCard} from "../PlayerCard";
import {listName} from "../../game/helpers";
import {deviceId, joinCup, PAL_OFFERS, sendTeam, setMyCupCode} from "../friendCupApi";
import {snapshotTeam} from "../../game/friendCup";
import {palClub, usePals} from "../palStore";
import {OfferDialog, TradeOffers} from "./FriendTrades";
import {addFriend, dismissInvite, inviteFriend, myFriendCode, publishProfile, removeFriend, watchProfile, type PalProfile} from "../palsApi";

const fail = (e: unknown): TKey => (e instanceof Error && /^(pals|friends)\./.test(e.message) ? (e.message as TKey) : "friends.err.offline");

export function Pals() {
  const {t} = useT();
  const game = useGameState();
  const notify = useGame((s) => s.notify);
  const [code, setCode] = useState<string | null>(() => (typeof window === "undefined" ? null : myFriendCode()));
  const [me, setMe] = useState<PalProfile | null>(null);
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  // Opening the page makes the profile (first time) and sends the team as it is now.
  useEffect(() => {
    publishProfile(game).then(setCode, (e) => notify(fail(e), undefined, "error"));
    // Once per visit to the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => (code ? watchProfile(deviceId(), setMe) : undefined), [code]);
  const friends = Object.entries(me?.friends ?? {}).sort((a, b) => b[1] - a[1]).map(([id]) => id);

  const add = async () => {
    setBusy(true);
    try {
      await addFriend(adding);
      notify("pals.added", undefined, "good");
      setAdding("");
    } catch (e) {
      notify(fail(e), undefined, "error");
    } finally {
      setBusy(false);
    }
  };
  const copy = () => code && navigator.clipboard?.writeText(code).then(() => notify("friends.copied", undefined, "good"), () => undefined);

  const {offers, me: mine} = usePals();
  const invites = Object.entries(mine?.invites ?? {});
  const setView = useGame((s) => s.setView);
  // An invitation to a friends' cup: join it (your team goes in), or say no.
  const join = async (cupCode: string) => {
    setBusy(true);
    try {
      const club = game.clubs[game.userClubId];
      await joinCup(cupCode, {manager: game.managerName, club: {name: club.name, short: club.short, color: club.color, color2: club.color2}, joinedAt: Date.now()});
      await sendTeam(cupCode, snapshotTeam(game));
      setMyCupCode(cupCode);
      await dismissInvite(cupCode);
      notify("pals.joined", undefined, "good");
      setView("friends");
    } catch (e) {
      notify(fail(e), undefined, "error");
      // A cup that's gone or has started can't be joined: the invitation goes too.
      if (e instanceof Error && /noCup|started/.test(e.message)) await dismissInvite(cupCode).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid">
      {invites.length > 0 && (
        <Card title={<><Icon name="trophy" size={20} /> {iconize(t("pals.invites"))}</>}>
          <ul className="plain-list friends-offers">
            {invites.map(([cupCode, inv]) => (
              <li key={cupCode} className="friends-offer incoming">
                <span>{iconize(t("pals.inviteText", {club: inv.club, manager: inv.manager, cup: inv.cup}))}</span>
                <div className="btn-row">
                  <button className="btn small" disabled={busy} onClick={() => dismissInvite(cupCode)}><Icon name="close" size={14} /> {iconize(t("friends.decline"))}</button>
                  <button className="btn primary small" disabled={busy} onClick={() => join(cupCode)}><Icon name="check" size={14} /> {iconize(t("pals.join"))}</button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {offers.length > 0 && <TradeOffers path={PAL_OFFERS} offers={offers} clubName={palClub} hint="pals.tradeHint" />}
      <Card title={<><Icon name="user" size={20} /> {iconize(t("pals.code"))}</>}>
        <Hint>{iconize(t("pals.hint"))}</Hint>
        <div className="pals-code-row">
          <button className="pals-code" onClick={copy} disabled={!code} title={t("pals.copy")}>
            {code ?? "······"} <Icon name="clip" size={18} />
          </button>
        </div>
        <p className="muted small">{iconize(t("pals.codeHint"))}</p>
        <h4><Icon name="plus" size={18} /> {iconize(t("pals.add"))}</h4>
        <div className="btn-row">
          <input className="input friends-code-input" value={adding} maxLength={6} placeholder="ABC123" onChange={(e) => setAdding(e.target.value.toUpperCase())} />
          <button className="btn primary" disabled={busy || adding.trim().length < 6 || !code} onClick={add}><Icon name="plus" size={16} /> {iconize(t("pals.addButton"))}</button>
        </div>
      </Card>

      <Card title={<><Icon name="users" size={20} /> {iconize(t("pals.list"))}</>}>
        {friends.length === 0 ? (
          <Empty>{iconize(t("pals.none"))}</Empty>
        ) : (
          <ul className="plain-list pals-list">
            {friends.map((id) => <PalRow key={id} id={id} onOpen={() => setViewing(id)} />)}
          </ul>
        )}
      </Card>
      {viewing && <PalTeam id={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

/** Follows a friend's profile. */
function usePal(id: string): PalProfile | null | undefined {
  const [p, setP] = useState<PalProfile | null | undefined>(undefined);
  useEffect(() => watchProfile(id, setP), [id]);
  return p;
}

/** When a friend last sent their team: today, yesterday, or some days ago. */
function lastSeen(t: ReturnType<typeof useT>["t"], at: number): string {
  const days = Math.floor((Date.now() - at) / 86_400_000);
  return days <= 0 ? t("pals.seenToday") : days === 1 ? t("pals.seenYesterday") : t("pals.seenDays", {n: days});
}

/** A friend in the list: their badge and team strength, club, manager and when they last played. */
function PalRow({id, onOpen}: {id: string; onOpen: () => void}) {
  const {t} = useT();
  const p = usePal(id);
  if (!p) return null;
  return (
    <li>
      <button className="pal-row" onClick={onOpen}>
        <span className="crest" style={{background: p.club.color, color: p.club.color2}}>{p.club.short}</span>
        <span className="pal-row-name">
          <strong>{p.club.name}</strong>
          <span className="muted small">{p.manager} · {lastSeen(t, p.updatedAt)}</span>
        </span>
        <span className="team-ovr">{iconize(t("tac.teamOvr"))} <strong>{p.ovr || "–"}</strong></span>
      </button>
    </li>
  );
}

/** A friend's team as they last sent it: the board, the bench, each player\'s card and kit. */
function PalTeam({id, onClose}: {id: string; onClose: () => void}) {
  const {t} = useT();
  const game = useGameState();
  const notify = useGame((s) => s.notify);
  const p = usePal(id);
  const [card, setCard] = useState<Player | null>(null);
  // The player an offer is being made for.
  const [buying, setBuying] = useState<Player | null>(null);
  const [sure, setSure] = useState(false);
  let team: TeamSnapshot | null = null;
  try {
    team = p ? (JSON.parse(p.team) as TeamSnapshot) : null;
  } catch {
    team = null;
  }
  const players = new Map(team?.players.map((x) => [x.id, x]) ?? []);
  const club = team?.club;
  const remove = async () => {
    try {
      await removeFriend(id);
      notify("pals.removed", undefined, "good");
      onClose();
    } catch (e) {
      notify(fail(e), undefined, "error");
    }
  };
  return (
    <Modal title={p ? <><span className="crest tiny" style={{background: p.club.color}} /> {p.club.name}</> : iconize(t("pals.list"))} onClose={onClose}>
      {p === undefined && <Empty>{iconize(t("friends.loading"))}</Empty>}
      {(p === null || (p && !team)) && <Empty>{iconize(t("friends.noTeam"))}</Empty>}
      {p && club && team && (
        <>
          <p className="muted small sheet-meta">
            {p.manager} · {club.formation} · {iconize(t(`tac.${club.mentality}`))}
            <span className="team-ovr">{iconize(t("tac.teamOvr"))} <strong>{p.ovr}</strong></span>
          </p>
          <LineupSheet club={club} player={(pid) => players.get(pid)} onPick={setCard} />
          <div className="btn-row dialog-actions">
            {sure ? (
              <>
                <span className="muted small">{iconize(t("pals.removeSure", {name: p.club.name}))}</span>
                <button className="btn" onClick={() => setSure(false)}>{iconize(t("common.cancel"))}</button>
                <button className="btn danger" onClick={remove}>{iconize(t("pals.remove"))}</button>
              </>
            ) : (
              <button className="btn small" onClick={() => setSure(true)}><Icon name="close" size={14} /> {iconize(t("pals.remove"))}</button>
            )}
          </div>
        </>
      )}
      {/* A player's card, with the friend's club for the crest and shirt, and their kit. */}
      {card && club && (
        <Modal title={<><Flag code={card.nationality} /> {listName(card)}</>} compact onClose={() => setCard(null)}>
          <div className="friends-card">
            <PlayerCard game={{...game, clubs: {...game.clubs, [card.clubId!]: {...(game.clubs[card.clubId!] ?? Object.values(game.clubs)[0]), ...club, id: card.clubId!}}}} player={card} reveal />
          </div>
          {(card.gear || card.shin) && (
            <div className="gear-cards friends-card-gear">
              {card.gear && <GearCard item={card.gear} small />}
              {card.shin && <GearCard item={card.shin} small />}
            </div>
          )}
          <div className="btn-row dialog-actions">
            <button className="btn primary" onClick={() => setBuying(card)}><Icon name="handshake" size={16} /> {iconize(t("friends.buy"))}</button>
          </div>
        </Modal>
      )}
      {buying && p && <OfferDialog path={PAL_OFFERS} seller={id} sellerName={p.club.name} player={buying} onClose={() => { setBuying(null); setCard(null); }} />}
    </Modal>
  );
}

/** In a friends' cup not yet started (for its host): invite friends straight from the list. */
export function InviteFriends({code, cupName, members}: {code: string; cupName: string; members: string[]}) {
  const {t} = useT();
  const game = useGameState();
  const notify = useGame((s) => s.notify);
  const {me} = usePals();
  const [sent, setSent] = useState<Set<string>>(new Set());
  const friends = Object.keys(me?.friends ?? {}).filter((id) => !members.includes(id));
  if (!myFriendCode() || friends.length === 0) return null;
  const invite = async (id: string) => {
    try {
      await inviteFriend(id, {code, cup: cupName, club: game.clubs[game.userClubId].name, manager: game.managerName, at: Date.now()});
      setSent((s) => new Set(s).add(id));
      notify("pals.invited", undefined, "good");
    } catch (e) {
      notify(fail(e), undefined, "error");
    }
  };
  return (
    <section className="invite-friends">
      <h4><Icon name="users" size={18} /> {iconize(t("pals.inviteTitle"))}</h4>
      <ul className="plain-list pals-list">
        {friends.map((id) => <InviteRow key={id} id={id} sent={sent.has(id)} onInvite={() => invite(id)} />)}
      </ul>
    </section>
  );
}

function InviteRow({id, sent, onInvite}: {id: string; sent: boolean; onInvite: () => void}) {
  const {t} = useT();
  const p = usePal(id);
  if (!p) return null;
  return (
    <li className="invite-row">
      <span className="crest" style={{background: p.club.color, color: p.club.color2}}>{p.club.short}</span>
      <span className="pal-row-name"><strong>{p.club.name}</strong><span className="muted small">{p.manager}</span></span>
      <button className={sent ? "btn small" : "btn primary small"} disabled={sent} onClick={onInvite}>
        {sent ? <><Icon name="check" size={14} /> {iconize(t("pals.invitedShort"))}</> : <><Icon name="plus" size={14} /> {iconize(t("pals.invite"))}</>}
      </button>
    </li>
  );
}
