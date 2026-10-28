// The friends' cup page: make a cup (and share its code) or join one; then the members, your
// team sent in, the rounds' results and the table. The cup's creator starts it and plays the
// rounds; everyone sees the same results as they come in.
import {useCallback, useEffect, useState} from "react";
import {
  collectFriendPrize,
  friendFixtures,
  friendMatchSeed,
  friendPack,
  friendPackBlocked,
  friendPrize,
  friendTable,
  openFriendPack,
  playFriendMatch,
  snapshotReady,
  snapshotTeam,
  type FriendPrize,
  type TeamSnapshot,
} from "../../game/friendCup";
import type {GameState, MatchReport} from "../../game/types";
import {GameOverride} from "../../store";
import {MatchScreen} from "../MatchViewer";
import {listName, userClub} from "../../game/helpers";
import {useT, type TKey} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Card, Empty, Flag, Hint, Modal} from "../common";
import {PlayerCard} from "../PlayerCard";
import {GearCard} from "../Gear";
import {LineupSheet} from "../LineupSheet";
import {PackReveal} from "../PackReveal";
import {OfferDialog, TradeOffers, useOffers, useSettleTrades} from "./FriendTrades";
import {diamondBurst, moneyBurst} from "../effects";
import type {PlayerPackId} from "../../game/packs";
import type {Player} from "../../game/types";
import {Icon, iconize} from "../Icon";
import {
  claimPack,
  claimPrize,
  createCup,
  deviceId,
  fetchTeam,
  joinCup,
  loadSeen,
  matchKey,
  saveSeen,
  leaveCup,
  myCupCode,
  playNextRound,
  sendTeam,
  setMyCupCode,
  startCup,
  watchCup,
  type CupMember,
  type FriendCupDoc,
  type FriendRoundDoc,
} from "../friendCupApi";

export function FriendCup() {
  const [code, setCode] = useState<string | null>(() => myCupCode());
  const enter = (c: string | null) => {
    setMyCupCode(c);
    setCode(c);
  };
  return code ? <CupRoom code={code} onLeave={() => enter(null)} /> : <CupStart onEnter={enter} />;
}

/** This manager and their club, as a member of a cup. */
function useMe(): () => CupMember {
  const game = useGameState();
  return () => {
    const club = userClub(game);
    return {manager: game.managerName, club: {name: club.name, short: club.short, color: club.color, color2: club.color2}, joinedAt: Date.now()};
  };
}

/** Not in a cup: make one, or join one with a code from a friend. */
function CupStart({onEnter}: {onEnter: (code: string) => void}) {
  const {t} = useT();
  const game = useGameState();
  const notify = useGame((s) => s.notify);
  const me = useMe();
  const [name, setName] = useState(() => t("friends.defaultName", {name: game.managerName}));
  const [join, setJoin] = useState("");
  const [busy, setBusy] = useState(false);
  const fail = (e: unknown) => notify(e instanceof Error && e.message.startsWith("friends.") ? (e.message as TKey) : "friends.err.offline", undefined, "error");
  const create = async () => {
    setBusy(true);
    try {
      const code = await createCup(name.trim() || t("friends.defaultName", {name: game.managerName}), me());
      await sendTeam(code, snapshotTeam(game));
      onEnter(code);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const enter = async () => {
    const code = join.trim().toUpperCase();
    if (code.length < 4) return;
    setBusy(true);
    try {
      await joinCup(code, me());
      await sendTeam(code, snapshotTeam(game));
      onEnter(code);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid">
      <Card title={<><Icon name="users" size={20} /> {iconize(t("friends.create"))}</>}>
        <Hint>{iconize(t("friends.hint"))}</Hint>
        <label className="field">
          <span>{iconize(t("friends.cupName"))}</span>
          <input className="input" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="btn-row">
          <button className="btn primary" disabled={busy} onClick={create}><Icon name="plus" size={16} /> {iconize(t("friends.createButton"))}</button>
        </div>
      </Card>
      <Card title={<><Icon name="users" size={20} /> {iconize(t("friends.join"))}</>}>
        <label className="field">
          <span>{iconize(t("friends.code"))}</span>
          <input className="input friends-code-input" value={join} maxLength={6} placeholder="ABC123" onChange={(e) => setJoin(e.target.value.toUpperCase())} />
        </label>
        <div className="btn-row">
          <button className="btn primary" disabled={busy || join.trim().length < 4} onClick={enter}><Icon name="users" size={16} /> {iconize(t("friends.joinButton"))}</button>
        </div>
      </Card>
    </div>
  );
}

/** In a cup: who's in it, sending your team, starting and playing the rounds, results and table. */
function CupRoom({code, onLeave}: {code: string; onLeave: () => void}) {
  const {t, money} = useT();
  const game = useGameState();
  const notify = useGame((s) => s.notify);
  const [cup, setCup] = useState<FriendCupDoc | null | undefined>(undefined);
  // Trades: offers made and answered come in here; the ones this device made are settled as they're answered.
  const offers = useOffers(code);
  useSettleTrades(offers, useCallback((id: string) => cup?.members[id]?.club.name ?? "?", [cup]));
  const [rounds, setRounds] = useState<FriendRoundDoc[]>([]);
  const [sent, setSent] = useState<Record<string, number>>({});
  // Each sent team's strength.
  const [ovrs, setOvrs] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const act = useGame((s) => s.act);
  const setView = useGame((s) => s.setView);
  // The player from this cup's pack, being revealed.
  const [opened, setOpened] = useState<{playerId: string; pack: PlayerPackId} | null>(null);
  // The member whose team is being looked at.
  const [viewing, setViewing] = useState<string | null>(null);
  // Matches seen (watched or shown) on this device: their scores show, and they count in the table.
  const [seen, setSeen] = useState<Set<string>>(() => loadSeen());
  const see = (key: string) => setSeen((s) => saveSeen(new Set(s).add(key)));
  // A match being watched: played again here from the round's teams and seed.
  const [watching, setWatching] = useState<{state: GameState; report: MatchReport; key: string} | null>(null);
  const watch = (r: FriendRoundDoc, i: number) => {
    if (!r.teams || r.seed === undefined) return;
    const teams = JSON.parse(r.teams) as Record<string, TeamSnapshot>;
    const m = r.results[i];
    if (!teams[m.home] || !teams[m.away]) return;
    const played = playFriendMatch(teams[m.home], teams[m.away], friendMatchSeed(r.seed, i), true);
    setWatching({state: played.state, report: played.report, key: matchKey(code, r.round, i)});
  };
  useEffect(
    () =>
      watchCup(code, {
        cup: (c) => { setCup(c); setOffline(false); },
        rounds: setRounds,
        sent: (at, o) => {
          setSent(at);
          setOvrs(o);
        },
        error: () => setOffline(true),
      }),
    [code]
  );
  const run = async (job: () => Promise<unknown>, done?: TKey): Promise<boolean> => {
    setBusy(true);
    try {
      await job();
      if (done) notify(done, undefined, "good");
      return true;
    } catch (e) {
      notify(e instanceof Error && e.message.startsWith("friends.") ? (e.message as TKey) : "friends.err.offline", undefined, "error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (cup === undefined) return <Card><Empty>{iconize(t(offline ? "friends.err.offline" : "friends.loading"))}</Empty></Card>;
  if (cup === null) {
    return (
      <Card title={iconize(t("friends.title"))}>
        <Empty>{iconize(t("friends.err.noCup"))}</Empty>
        <button className="btn" onClick={onLeave}>{iconize(t("friends.leave"))}</button>
      </Card>
    );
  }
  const me = deviceId();
  const creator = cup.creator === me;
  const members = (cup.order ?? Object.keys(cup.members).sort((a, b) => cup.members[a].joinedAt - cup.members[b].joinedAt)).filter((id) => cup.members[id]);
  const fixtures = cup.order ? friendFixtures(cup.order) : [];
  const started = !!cup.order;
  const finished = started && cup.round >= fixtures.length;
  // Only what's been seen counts, so the table gives nothing away.
  const results = rounds.flatMap((r) => r.results.filter((_, i) => seen.has(matchKey(code, r.round, i))));
  const unseen = rounds.reduce((n, r) => n + r.results.filter((_, i) => !seen.has(matchKey(code, r.round, i))).length, 0);
  const table = friendTable(members, results);
  const name = (id: string) => cup.members[id]?.club.name ?? "?";
  const crest = (id: string) => {
    const c = cup.members[id]?.club;
    return c ? <span className="crest tiny" style={{background: c.color}} /> : null;
  };
  const snap = snapshotTeam(game);
  const teams = cup.order?.length ?? 0;
  const collect = (kind: FriendPrize, button: HTMLElement) =>
    run(async () => {
      if (!(await claimPrize(code, kind))) throw new Error("friends.prizeTaken");
      act((g) => collectFriendPrize(g, kind, teams));
      // The prize flies from the button to its count in the top bar.
      const amount = friendPrize(kind, teams);
      if (kind === "diamonds") diamondBurst(button, amount);
      else moneyBurst(button, money(amount));
    }, "friends.prizeGot");
  const pack = friendPack(teams);
  const openMyPack = () => {
    if (!pack) return;
    const blocked = friendPackBlocked(game, pack);
    if (blocked) return notify(blocked as TKey, undefined, "error");
    void run(async () => {
      if (!(await claimPack(code))) throw new Error("friends.packTaken");
      const res = act((g, rng) => openFriendPack(g, rng, pack));
      if ("playerId" in res && pack !== "diamond") setOpened({playerId: res.playerId, pack});
      else if ("playerIds" in res) {
        notify("friends.pickInShop", undefined, "good");
        setView("shop");
      }
    });
  };
  const share = () => {
    navigator.clipboard?.writeText(code).then(() => notify("friends.copied", undefined, "good"), () => undefined);
  };

  return (
    <div className="grid">
      <Card title={<><Icon name="trophy" size={20} /> {cup.name}</>} actions={<button className="btn small" onClick={share}><Icon name="clip" size={16} /> {code}</button>}>
        <Hint>{iconize(t("friends.hint"))}</Hint>
        <p className="muted small">{iconize(t(finished ? "friends.done" : started ? "friends.roundOf" : "friends.waiting", {round: Math.min(cup.round + 1, fixtures.length), rounds: fixtures.length, code}))}</p>
        <ul className="plain-list friends-members">
          {members.map((id) => (
            <li key={id}>
              {/* The club's badge with the team's strength: tap it for the team as sent. */}
              <button className="friends-team-btn" disabled={!sent[id]} title={t("friends.viewTeam")} onClick={() => setViewing(id)}>
                <span className="crest" style={{background: cup.members[id].club.color, color: cup.members[id].club.color2}}>{cup.members[id].club.short}</span>
                <span className="team-ovr">{iconize(t("tac.teamOvr"))} <strong>{sent[id] ? ovrs[id] || "–" : "–"}</strong></span>
              </button>
              <span className="friends-member-name">
                <strong>{name(id)}</strong>
                <span className="muted small">{cup.members[id].manager}{id === cup.creator ? ` · ${t("friends.host")}` : ""}</span>
              </span>
              {cup.left?.includes(id) ? (
                <span className="friends-sent missing">{iconize(t("friends.hasLeft"))}</span>
              ) : (
                <span className={sent[id] ? "friends-sent" : "friends-sent missing"}>{sent[id] ? <><Icon name="check" size={14} /> {iconize(t("friends.sent"))}</> : iconize(t("friends.notSent"))}</span>
              )}
            </li>
          ))}
        </ul>
        <div className="btn-row">
          {!finished && (
            <button className="btn" disabled={busy || !snapshotReady(snap)} onClick={() => run(() => sendTeam(code, snapshotTeam(game)), "friends.teamSent")}>
              <Icon name="upload" size={16} /> {iconize(t("friends.send"))}
            </button>
          )}
          {creator && !started && (
            <button className="btn primary" disabled={busy || members.length < 2} onClick={() => run(() => startCup(cup), "friends.started")}>
              <Icon name="play" size={16} /> {iconize(t("friends.start"))}
            </button>
          )}
          {creator && started && !finished && (
            <button className="btn primary" disabled={busy} onClick={() => run(() => playNextRound(cup), "friends.played")}>
              <Icon name="ball" size={16} /> {iconize(t("friends.playRound", {round: cup.round + 1}))}
            </button>
          )}
        </div>
        {!creator && started && !finished && <p className="muted small">{iconize(t("friends.hostPlays", {host: cup.members[cup.creator]?.manager ?? "?"}))}</p>}
      </Card>

      {members.length > 1 && <TradeOffers code={code} cup={cup} offers={offers} />}

      {started && (
        <Card title={<><Icon name="list" size={20} /> {iconize(t("friends.table"))}</>}>
          <table className="table compact">
            <thead>
              <tr>
                <th>#</th><th>{iconize(t("col.name"))}</th>
                <th className="num">{iconize(t("cup.colP"))}</th><th className="num">{iconize(t("cup.colW"))}</th><th className="num">{iconize(t("cup.colD"))}</th><th className="num">{iconize(t("cup.colL"))}</th>
                <th className="num">{iconize(t("cup.colGD"))}</th><th className="num">{iconize(t("cup.colPts"))}</th>
              </tr>
            </thead>
            <tbody>
              {table.map((r, i) => (
                <tr key={r.id} className={r.id === me ? "me" : ""}>
                  <td>{i + 1}</td>
                  <td className="cup-club">{crest(r.id)} {name(r.id)}</td>
                  <td className="num">{r.played}</td><td className="num">{r.won}</td><td className="num">{r.drawn}</td><td className="num">{r.lost}</td>
                  <td className="num">{r.goalsFor - r.goalsAgainst > 0 ? `+${r.goalsFor - r.goalsAgainst}` : r.goalsFor - r.goalsAgainst}</td>
                  <td className="num strong">{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {unseen > 0 && <p className="muted small">{iconize(t("friends.unseen", {n: unseen}))}</p>}
          {finished && unseen === 0 && table[0] && <p className="cup-winner">{iconize(t("friends.winner", {club: name(table[0].id)}))}</p>}
          {/* The winner chooses their prize: diamonds or money, more the more teams were in it. */}
          {finished && unseen === 0 && table[0]?.id === me && (
            cup.prizeClaimed ? (
              <p className="muted small">{iconize(t("friends.prizeTaken"))}</p>
            ) : (
              <div className="friends-prize">
                <p>{iconize(t("friends.prizeText", {n: teams}))}</p>
                <div className="btn-row">
                  <button className="btn primary" disabled={busy} onClick={(e) => collect("diamonds", e.currentTarget)}>
                    {iconize(t("friends.takeDiamonds", {n: friendPrize("diamonds", teams)}))}
                  </button>
                  <button className="btn primary" disabled={busy} onClick={(e) => collect("money", e.currentTarget)}>
                    {iconize(t("friends.takeMoney", {x: friendPrize("money", teams)}))}
                  </button>
                </div>
              </div>
            )
          )}
          {/* Everyone's pack once the cup is over: better the more teams were in it. */}
          {finished && pack && cup.members[me] && (
            cup.packsTaken?.[me] ? (
              <p className="muted small">{iconize(t("friends.packTaken"))}</p>
            ) : (
              <div className="friends-prize">
                <p>{iconize(t("friends.packText", {pack: t(`pack.${pack}`), n: teams}))}</p>
                <div className="btn-row">
                  <button className="btn primary" disabled={busy} onClick={openMyPack}>
                    <Icon name="gift" size={16} /> {iconize(t("friends.openPack", {pack: t(`pack.${pack}`)}))}
                  </button>
                </div>
              </div>
            )
          )}
        </Card>
      )}

      {started && (
        <Card title={<><Icon name="calendar" size={20} /> {iconize(t("friends.results"))}</>} className="span-2">
          {rounds.length === 0 && <Empty>{iconize(t("friends.noRounds"))}</Empty>}
          {[...rounds].reverse().map((r) => (
            <section key={r.round} className="friends-round">
              <h4>{iconize(t("friends.round", {round: r.round}))}</h4>
              {r.results.map((m, i) => {
                const key = matchKey(code, r.round, i);
                const shown = seen.has(key);
                const canWatch = !!r.teams && r.seed !== undefined && m.goals !== undefined;
                return (
                <div key={i} className="friends-match">
                  <div className="friends-match-row">
                    <span className="friends-team home"><span className="friends-name">{name(m.home)}</span> {crest(m.home)}</span>
                    <strong className="friends-score">{shown ? `${m.homeGoals} – ${m.awayGoals}` : "? – ?"}</strong>
                    <span className="friends-team away">{crest(m.away)} <span className="friends-name">{name(m.away)}</span></span>
                  </div>
                  {!shown && (
                    <div className="btn-row friends-match-actions">
                      {canWatch && <button className="btn primary small" onClick={() => watch(r, i)}><Icon name="play" size={14} /> {iconize(t("friends.watch"))}</button>}
                      <button className="btn small" onClick={() => see(key)}><Icon name="eye" size={14} /> {iconize(t("friends.show"))}</button>
                    </div>
                  )}
                  {shown && canWatch && (
                    <div className="btn-row friends-match-actions">
                      <button className="btn small" onClick={() => watch(r, i)}><Icon name="play" size={14} /> {iconize(t("friends.watchAgain"))}</button>
                    </div>
                  )}
                  {shown && (m.goals.length > 0 ? (
                    <ul className="plain-list small muted friends-goals">
                      {m.goals.map((g, j) => <li key={j}><Icon name="ball" size={14} /> {g.minute}' {g.name} ({name(g.side === "home" ? m.home : m.away)})</li>)}
                    </ul>
                  ) : (
                    <p className="small muted">{iconize(t("friends.noGoals"))}</p>
                  ))}
                </div>
                );
              })}
              {/* Who sits out an odd round. */}
              {fixtures[r.round - 1] && members.filter((id) => !fixtures[r.round - 1].flat().includes(id)).map((id) => (
                <p key={id} className="small muted">{iconize(t("friends.bye", {club: name(id)}))}</p>
              ))}
            </section>
          ))}
          {!finished && fixtures[cup.round] && (
            <section className="friends-round next">
              <h4>{iconize(t("friends.next", {round: cup.round + 1}))}</h4>
              {fixtures[cup.round].map(([h, a], i) => (
                <p key={i} className="friends-next">{crest(h)} {name(h)} <span className="muted">–</span> {name(a)} {crest(a)}</p>
              ))}
            </section>
          )}
        </Card>
      )}

      {/* The match being watched, in the usual match screen, lent its own ground. */}
      {watching && (
        <GameOverride.Provider value={watching.state}>
          <MatchScreen report={watching.report} onClose={() => { see(watching.key); setWatching(null); }} />
        </GameOverride.Provider>
      )}

      <div className="btn-row span-2">
        <button className="btn small" onClick={() => setLeaving(true)}><Icon name="close" size={14} /> {iconize(t("friends.leave"))}</button>
      </div>
      {opened && <PackReveal playerId={opened.playerId} pack={opened.pack} onClose={() => setOpened(null)} />}
      {viewing && <TeamView code={code} member={viewing} sentAt={sent[viewing]} onClose={() => setViewing(null)} />}
      {leaving && (
        <Modal title={iconize(t("friends.leave"))} compact onClose={() => setLeaving(false)}>
          <p>{iconize(t(members.every((id) => id === me || cup.left?.includes(id)) ? "friends.leaveLast" : "friends.leaveSure"))}</p>
          <div className="btn-row">
            <button className="btn" onClick={() => setLeaving(false)}>{iconize(t("common.cancel"))}</button>
            <button className="btn danger" disabled={busy} onClick={() => run(() => leaveCup(code)).then((ok) => { setLeaving(false); if (ok) onLeave(); })}>
              <Icon name="close" size={16} /> {iconize(t("friends.leave"))}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** A member's team as they last sent it: the starting eleven on a small pitch, and the bench. */
function TeamView({code, member, sentAt, onClose}: {code: string; member: string; sentAt?: number; onClose: () => void}) {
  const {t} = useT();
  const [team, setTeam] = useState<TeamSnapshot | null | undefined>(undefined);
  const game = useGameState();
  // The player whose card is open.
  const [card, setCard] = useState<Player | null>(null);
  // The player an offer is being made for.
  const [buying, setBuying] = useState<Player | null>(null);
  useEffect(() => {
    let live = true;
    fetchTeam(code, member).then((x) => live && setTeam(x), () => live && setTeam(null));
    return () => {
      live = false;
    };
  }, [code, member, sentAt]);
  const club = team?.club;
  const players = new Map(team?.players.map((p) => [p.id, p]) ?? []);
  return (
    <Modal title={club ? <><span className="crest tiny" style={{background: club.color}} /> {club.name}</> : iconize(t("friends.lineup"))} onClose={onClose}>
      {team === undefined && <Empty>{iconize(t("friends.loading"))}</Empty>}
      {team === null && <Empty>{iconize(t("friends.noTeam"))}</Empty>}
      {club && team && (
        <>
          <p className="muted small">{team.manager} · {club.formation} · {iconize(t(`tac.${club.mentality}`))}</p>
          {/* The same board as on the tactics page: shirts, gear and name plates. */}
          <LineupSheet club={club} player={(id) => players.get(id)} onPick={setCard} />
        </>
      )}
      {/* A player's card: lent a ground with this friend's club in it, for the crest and shirt. */}
      {card && club && (
        <Modal title={<><Flag code={card.nationality} /> {listName(card)}</>} compact onClose={() => setCard(null)}>
          <div className="friends-card">
            <PlayerCard game={{...game, clubs: {...game.clubs, [card.clubId!]: {...(game.clubs[card.clubId!] ?? Object.values(game.clubs)[0]), ...club, id: card.clubId!}}}} player={card} reveal />
          </div>
          {/* The kit they wear (it comes along if they're bought). */}
          {(card.gear || card.shin) && (
            <div className="gear-cards friends-card-gear">
              {card.gear && <GearCard item={card.gear} small />}
              {card.shin && <GearCard item={card.shin} small />}
            </div>
          )}
          {/* A friend's player: make an offer. */}
          {member !== deviceId() && (
            <div className="btn-row dialog-actions">
              <button className="btn primary" onClick={() => setBuying(card)}><Icon name="handshake" size={16} /> {iconize(t("friends.buy"))}</button>
            </div>
          )}
        </Modal>
      )}
      {buying && <OfferDialog code={code} seller={member} player={buying} onClose={() => { setBuying(null); setCard(null); }} />}
    </Modal>
  );
}
