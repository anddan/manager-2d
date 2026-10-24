// Renders every screen and dialog against a game in mid-season, in all three
// languages, to catch crashes and missing data before a player does.
import {renderToString} from "react-dom/server";
import {describe, expect, it} from "vitest";
import {startNegotiation} from "../game/contracts";
import {newGame} from "../game/generate";
import {Rng} from "../game/rng";
import {advanceWeek, startWeek} from "../game/week";
import {SetPieceView} from "./SetPieceView";
import {LANGS} from "../i18n";
import {useGame, VIEWS} from "../store";
import {App} from "./App";
import {ContractModal} from "./ContractModal";
import {MatchViewer} from "./MatchViewer";
import {PlayerModal} from "./PlayerModal";

const game = newGame("Smoke", 4, 42);
const rng = new Rng(7);
for (let i = 0; i < 12; i++) advanceWeek(game, rng, Date.now(), {useEnergy: false});
game.rngState = rng.state;

// Server rendering reads zustand's initial state, so set both.
function setStore(partial: Partial<ReturnType<typeof useGame.getState>>) {
  useGame.setState(partial);
  Object.assign(useGame.getInitialState(), partial);
}

describe("UI smoke test", () => {
  for (const lang of LANGS) {
    it(`renders every view in ${lang}`, () => {
      for (const view of VIEWS) {
        setStore({game, lang, view, playerId: null, matchFixtureId: null, negotiation: null});
        const html = renderToString(<App />);
        // The top bar shows the club, so this is the game and not the start screen.
        expect(html).toContain(game.clubs[game.userClubId].name);
        // A raw key in the output means a missing translation.
        expect(html).not.toMatch(/\b(nav|col|pl|tr|fin|ov|tac|train|shop)\.[a-z][A-Za-z]+\b/);
      }
    });
  }

  it("shows a nickname everywhere, and both names on the player's profile", () => {
    const g = structuredClone(game);
    const p = Object.values(g.players).find((x) => x.clubId === g.userClubId)!;
    p.nickname = "Ronaldo";
    setStore({game: g, lang: "sv", view: "squad", playerId: null, matchFixtureId: null, negotiation: null});
    const squad = renderToString(<App />);
    expect(squad).toContain("Ronaldo");
    expect(squad).not.toContain(`${p.firstName.charAt(0)}. ${p.lastName}`);
    expect(renderToString(<PlayerModal playerId={p.id} />)).toContain(`${p.firstName} ${p.lastName} (Ronaldo)`);
    setStore({game});
  });

  it("renders player cards for own, other and free players", () => {
    setStore({game, lang: "sv"});
    const own = Object.values(game.players).find((p) => p.clubId === game.userClubId)!;
    const other = Object.values(game.players).find((p) => p.clubId && p.clubId !== game.userClubId)!;
    const free = Object.values(game.players).find((p) => !p.clubId)!;
    for (const p of [own, other, free]) {
      expect(renderToString(<PlayerModal playerId={p.id} />)).toContain(p.lastName);
    }
  });

  it("renders a live match and both set-piece views", () => {
    const g = structuredClone(game);
    const started = startWeek(g, new Rng(3), Date.now(), {useEnergy: false});
    expect(started.ok && started.live).toBe(true);
    setStore({game: g, lang: "sv", view: "overview", playerId: null, matchFixtureId: null, negotiation: null});
    expect(renderToString(<App />)).toContain("LIVE");

    const taker = Object.values(g.players).find((p) => p.position === "ST")!;
    const keeper = Object.values(g.players).find((p) => p.position === "GK")!;
    const clubs = Object.values(g.clubs);
    const sp = {index: 0, kind: "freekick" as const, minute: 30, side: "home" as const, takerId: taker.id, keeperId: keeper.id, wallSide: 1 as const, spot: {x: 76, y: 60}};
    for (const role of ["shooter", "keeper"] as const) {
      const html = renderToString(
        <SetPieceView sp={sp} role={role} taker={taker} keeper={keeper} shooters={clubs[0]} keepers={clubs[1]} onAnswer={() => {}} onDone={() => {}} />
      );
      expect(html).toContain(taker.lastName);
    }
    setStore({game});
  });

  it("renders the match viewer and a contract negotiation", () => {
    setStore({game, lang: "en"});
    const report = game.reports[0];
    expect(report).toBeDefined();
    expect(renderToString(<MatchViewer fixtureId={report.fixtureId} />)).toContain("viewBox");
    const own = Object.values(game.players).find((p) => p.clubId === game.userClubId && p.happiness >= 40)!;
    const neg = startNegotiation(game, own.id, game.userClubId, "renewal");
    expect("refused" in neg).toBe(false);
    if (!("refused" in neg)) {
      setStore({negotiation: neg});
      expect(renderToString(<ContractModal />)).toContain(own.lastName);
    }
  });
});
