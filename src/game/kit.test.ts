// Home and away kits: the hosts wear theirs, the visitors their away kit, and a clash is avoided.
import {describe, expect, it} from "vitest";
import {newGame} from "./generate";
import {awayKit, colorDistance, homeKit, matchClubs} from "./kit";

describe("kits", () => {
  const g = newGame("Kit", 3, 9);
  const [a, b] = Object.values(g.clubs);

  it("turns the home colours round when a club has no away kit", () => {
    const club = {...a, color: "#2563eb", color2: "#ffffff", away: undefined};
    expect(awayKit(club)).toMatchObject({color: "#ffffff", color2: "#2563eb"});
    expect(homeKit(club)).toMatchObject({color: "#2563eb", color2: "#ffffff"});
  });

  it("uses the manager's own away kit", () => {
    const club = {...a, away: {color: "#facc15", color2: "#111827"}};
    expect(awayKit(club).color).toBe("#facc15");
  });

  it("changes the visitors' shirt when it clashes with the hosts'", () => {
    const home = {...a, color: "#ffffff", color2: "#2563eb"};
    // The visitors' away kit (their colours turned round) would be white too.
    const away = {...b, color: "#2563eb", color2: "#ffffff", away: undefined};
    const [h, v] = matchClubs(home, away);
    expect(h.color).toBe("#ffffff");
    expect(colorDistance(h.color, v.color)).toBeGreaterThan(70);
  });

  it("leaves a shirt that doesn't clash alone", () => {
    const home = {...a, color: "#dc2626", color2: "#ffffff"};
    const away = {...b, color: "#111827", color2: "#ffffff", away: {color: "#16a34a", color2: "#ffffff"}};
    const [, v] = matchClubs(home, away);
    expect(v.color).toBe("#16a34a");
  });
});
