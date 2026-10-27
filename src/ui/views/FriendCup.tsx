// The friends' cup page: make a cup (and share its code) or join one; then the members, your
// team sent in, the rounds' results and the table. The cup's creator starts it and plays the
// rounds; everyone sees the same results as they come in.
import {useEffect, useState} from "react";
import {friendFixtures, friendTable, snapshotReady, snapshotTeam} from "../../game/friendCup";
import {userClub} from "../../game/helpers";
import {useT, type TKey} from "../../i18n";
import {useGame, useGameState} from "../../store";
import {Card, Empty, Hint} from "../common";
import {Icon, iconize} from "../Icon";
import {
  createCup,
  deviceId,
  joinCup,
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
      <Card title={<><Icon name="trophy" size={20} /> {iconize(t("friends.create"))}</>}>
        <Hint>{iconize(t("friends.hint"))}</Hint>
        <label className="field">
          <span>{iconize(t("friends.cupName"))}</span>
          <input className="input" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="btn-row">
          <button className="btn primary" disabled={busy} onClick={create}><Icon name="plus" size={16} /> {iconize(t("friends.createButton"))}</button>
        </div>
      </Card>
      <Card title={<><Icon name="handshake" size={20} /> {iconize(t("friends.join"))}</>}>
        <label className="field">
          <span>{iconize(t("friends.code"))}</span>
          <input className="input friends-code-input" value={join} maxLength={6} placeholder="ABC123" onChange={(e) => setJoin(e.target.value.toUpperCase())} />
        </label>
        <div className="btn-row">
          <button className="btn primary" disabled={busy || join.trim().length < 4} onClick={enter}><Icon name="handshake" size={16} /> {iconize(t("friends.joinButton"))}</button>
        </div>
      </Card>
    </div>
  );
}

/** In a cup: who's in it, sending your team, starting and playing the rounds, results and table. */
function CupRoom({code, onLeave}: {code: string; onLeave: () => void}) {
  const {t} = useT();
  const game = useGameState();
  const notify = useGame((s) => s.notify);
  const [cup, setCup] = useState<FriendCupDoc | null | undefined>(undefined);
  const [rounds, setRounds] = useState<FriendRoundDoc[]>([]);
  const [sent, setSent] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  useEffect(
    () =>
      watchCup(code, {
        cup: (c) => { setCup(c); setOffline(false); },
        rounds: setRounds,
        sent: setSent,
        error: () => setOffline(true),
      }),
    [code]
  );
  const run = async (job: () => Promise<unknown>, done?: TKey) => {
    setBusy(true);
    try {
      await job();
      if (done) notify(done, undefined, "good");
    } catch (e) {
      notify(e instanceof Error && e.message.startsWith("friends.") ? (e.message as TKey) : "friends.err.offline", undefined, "error");
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
  const results = rounds.flatMap((r) => r.results);
  const table = friendTable(members, results);
  const name = (id: string) => cup.members[id]?.club.name ?? "?";
  const crest = (id: string) => {
    const c = cup.members[id]?.club;
    return c ? <span className="crest tiny" style={{background: c.color, color: c.color2}}>{c.short}</span> : null;
  };
  const snap = snapshotTeam(game);
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
              {crest(id)} <strong>{name(id)}</strong> <span className="muted small">{cup.members[id].manager}{id === cup.creator ? ` · ${t("friends.host")}` : ""}</span>
              <span className={sent[id] ? "friends-sent" : "friends-sent missing"}>{sent[id] ? <><Icon name="check" size={14} /> {iconize(t("friends.sent"))}</> : iconize(t("friends.notSent"))}</span>
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
          {finished && table[0] && <p className="cup-winner">{iconize(t("friends.winner", {club: name(table[0].id)}))}</p>}
        </Card>
      )}

      {started && (
        <Card title={<><Icon name="calendar" size={20} /> {iconize(t("friends.results"))}</>} className="span-2">
          {rounds.length === 0 && <Empty>{iconize(t("friends.noRounds"))}</Empty>}
          {[...rounds].reverse().map((r) => (
            <section key={r.round} className="friends-round">
              <h4>{iconize(t("friends.round", {round: r.round}))}</h4>
              {r.results.map((m, i) => (
                <details key={i} className="friends-match">
                  <summary>
                    <span className="friends-team">{crest(m.home)} {name(m.home)}</span>
                    <strong className="friends-score">{m.homeGoals} – {m.awayGoals}</strong>
                    <span className="friends-team away">{name(m.away)} {crest(m.away)}</span>
                  </summary>
                  {m.goals.length > 0 ? (
                    <ul className="plain-list small muted friends-goals">
                      {m.goals.map((g, j) => <li key={j}><Icon name="ball" size={14} /> {g.minute}' {g.name} ({name(g.side === "home" ? m.home : m.away)})</li>)}
                    </ul>
                  ) : (
                    <p className="small muted">{iconize(t("friends.noGoals"))}</p>
                  )}
                </details>
              ))}
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

      <div className="btn-row span-2">
        <button className="btn small" onClick={onLeave}><Icon name="close" size={14} /> {iconize(t("friends.leave"))}</button>
      </div>
    </div>
  );
}
