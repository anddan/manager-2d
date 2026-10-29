// Home and away kits. The home team plays in its home kit, the visitors in their away kit (the home
// colours turned round unless the manager made one); if the two shirts are too alike, the visitors
// change to something else.
import type {Club, Kit} from "./types";

export function homeKit(club: Club): Kit {
  return {color: club.color, color2: club.color2, color3: club.color3, pattern: club.pattern, collar: club.collar, sleeves: club.sleeves};
}

/** The away kit: the manager's own, or the home colours turned round (a plain shirt, the same collar and sleeves). */
export function awayKit(club: Club): Kit {
  return club.away ?? {color: club.color2, color2: club.color, color3: club.color3, collar: club.collar, sleeves: club.sleeves};
}

export const kitFor = (club: Club, away: boolean): Kit => (away ? awayKit(club) : homeKit(club));

/** The club with a kit put on (a copy: the club itself is left as it is). */
export function withKit(club: Club, kit: Kit): Club {
  return {...club, color: kit.color, color2: kit.color2, color3: kit.color3, pattern: kit.pattern, collar: kit.collar, sleeves: kit.sleeves};
}

function rgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [128, 128, 128];
  const h = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** How far apart two colours look (0 identical .. about 440). */
export function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  // Redder differences weigh a little more, as the eye sees them.
  return Math.sqrt(2 * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + 3 * (b1 - b2) ** 2) / 3;
}

const CLASH = 70;

/** The two clubs as they look in this match: home kit for the hosts, away kit for the visitors, changed if they clash. */
export function matchClubs(home: Club, away: Club): [Club, Club] {
  const h = homeKit(home);
  let a = awayKit(away);
  if (colorDistance(h.color, a.color) < CLASH) {
    const own = homeKit(away);
    if (colorDistance(h.color, own.color) >= CLASH) a = own;
    else a = {...a, color: colorDistance(h.color, "#f8fafc") >= CLASH ? "#f8fafc" : "#111827", color2: colorDistance(h.color, "#f8fafc") >= CLASH ? "#111827" : "#f8fafc"};
  }
  return [withKit(home, h), withKit(away, a)];
}
