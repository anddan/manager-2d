// Line icons for the menus and buttons: all drawn alike (2 px strokes, round ends) in the
// current text colour, so they are white by default and take the accent when chosen.
import type {ReactNode} from "react";

export type IconName =
  | "home" | "mail" | "users" | "clipboard" | "dumbbell" | "calendar" | "list" | "trophy" | "stadium"
  | "swap" | "pen" | "wallet" | "boot" | "diamond" | "settings" | "play" | "ball" | "shield" | "info" | "close"
  | "warn" | "fire" | "video" | "gift" | "shin" | "glove" | "dice" | "user" | "text" | "palette" | "megaphone" | "skip" | "coffee" | "stop" | "target" | "star" | "sparkle" | "chart" | "chat" | "handshake" | "trend" | "tag" | "shirt" | "undo" | "check" | "bolt" | "bank" | "sound" | "compass" | "download" | "upload" | "cart" | "hammer" | "run" | "bench" | "moon" | "search" | "inbox" | "eye" | "coins" | "medical" | "plane" | "clip" | "lock" | "flag";

const PATHS: Record<IconName, ReactNode> = {
  home: <><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" /><path d="M18 14.8c2 .7 3.2 2.4 3.5 5.2" /></>,
  clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="M9 10h6M9 14h6M9 18h3" /></>,
  dumbbell: <><path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4" /><path d="M12 13v4M8 21h8M9 17h6" /></>,
  stadium: <><ellipse cx="12" cy="9" rx="9" ry="4" /><path d="M3 9v6c0 2.2 4 4 9 4s9-1.8 9-4V9" /><path d="M8 18.6V14M16 18.6V14" /></>,
  swap: <><path d="M4 8h14l-3-3M20 16H6l3 3" /></>,
  pen: <><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13 7 4 4" /></>,
  wallet: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18" /><path d="M16 15h2" /><path d="M6 6l9-3 1 3" /></>,
  boot: <><path d="M4 17V9l5-1 1 3c3 0 7 1 9 3 1 .8 1.5 2 1.5 3H4Z" /><path d="M4 20h17M7 17v3M12 17v3M17 17v3" /></>,
  diamond: <><path d="M6 4h12l3 5-9 11L3 9l3-5Z" /><path d="M3 9h18M9 4l3 16M15 4l-3 16" /></>,
  settings: <><path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2Z" /><circle cx="12" cy="12" r="3" /></>,
  play: <path d="M8 5v14l11-7L8 5Z" fill="currentColor" />,
  ball: <><circle cx="12" cy="12" r="9" /><path d="m12 7 4 3-1.5 4.5h-5L8 10l4-3Z" /><path d="M12 3v4M16 10l4.5-1.5M14.5 14.5l2.5 4M9.5 14.5 7 18.5M8 10 3.5 8.5" /></>,
  shield: <><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z" /><path d="M12 8v8M8 12h8" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><circle cx="12" cy="7.8" r="0.6" fill="currentColor" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  warn: <><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4" /><circle cx="12" cy="17" r="0.6" fill="currentColor" /></>,
  fire: <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 1 1.5 1.5 2 2.5 2C11.5 7.5 11 5.5 12 3Z" />,
  video: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>,
  gift: <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v8h14v-8M12 8v12" /><path d="M12 8c-1.5-3-5-3.5-5-1.5S10 8 12 8Zm0 0c1.5-3 5-3.5 5-1.5S14 8 12 8Z" /></>,
  shin: <><path d="M7 3h10l-1 13c-.2 3-1.8 5-4 5s-3.8-2-4-5L7 3Z" /><path d="M8 8h8M9 13h6" /></>,
  glove: <><path d="M7 21v-4l-2-3V9a1.5 1.5 0 0 1 3 0v3V5a1.5 1.5 0 0 1 3 0v6V4a1.5 1.5 0 0 1 3 0v7V6a1.5 1.5 0 0 1 3 0v8c0 2-1 3-2 4v3H7Z" /></>,
  dice: <><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r="1" fill="currentColor" /><circle cx="15" cy="15" r="1" fill="currentColor" /><circle cx="15" cy="9" r="1" fill="currentColor" /><circle cx="9" cy="15" r="1" fill="currentColor" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6" /></>,
  text: <><path d="M4 7V5h16v2M12 5v14M9 19h6" /></>,
  palette: <><path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2 0-1.5-1.5-1.5-1.5-3S14 14 16 14h2a3 3 0 0 0 3-3c0-4.5-4-8-9-8Z" /><circle cx="7.5" cy="11" r="1" fill="currentColor" /><circle cx="10" cy="7" r="1" fill="currentColor" /><circle cx="15" cy="7.5" r="1" fill="currentColor" /></>,
  megaphone: <><path d="M3 10v4h4l8 5V5L7 10H3Z" /><path d="M18 9a4 4 0 0 1 0 6" /></>,
  skip: <><path d="M5 5v14l10-7L5 5Z" /><path d="M19 5v14" /></>,
  coffee: <><path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z" /><path d="M16 11h2a2 2 0 0 1 0 4h-2M8 3v3M12 3v3" /></>,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></>,
  star: <path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1.1 6.2L12 17.4l-5.6 2.9 1.1-6.2L3 9.7l6.2-.9L12 3Z" />,
  sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="M12 8l1.5 2.5L16 12l-2.5 1.5L12 16l-1.5-2.5L8 12l2.5-1.5L12 8Z" /></>,
  chart: <><path d="M4 20V4M4 20h16" /><path d="M8 16v-4M12 16V8M16 16v-6" /></>,
  chat: <path d="M4 5h16v11H9l-5 4V5Z" />,
  handshake: <><path d="M2 12 6 8l4 2 3-2 3 1 6 3" /><path d="m6 14 3 3 2-1 2 2 2-1 3-3" /></>,
  trend: <><path d="M3 17 9 11l4 4 8-8" /><path d="M15 7h6v6" /></>,
  tag: <><path d="M3 3h8l10 10-8 8L3 11V3Z" /><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" /></>,
  shirt: <path d="m8 3-5 3 2 5 2-1v11h10V10l2 1 2-5-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3Z" />,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></>,
  check: <path d="m4 12 5 5L20 6" />,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  bank: <><path d="M3 9 12 4l9 5H3Z" /><path d="M5 9v9M10 9v9M14 9v9M19 9v9M3 20h18" /></>,
  sound: <><path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></>,
  download: <><path d="M12 4v11M7 10l5 5 5-5" /><path d="M4 19h16" /></>,
  upload: <><path d="M12 15V4M7 9l5-5 5 5" /><path d="M4 19h16" /></>,
  cart: <><path d="M3 4h2l2.5 11h11L21 7H6.5" /><circle cx="9" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /></>,
  hammer: <><path d="m14 6 4 4-9 9-4-4 9-9Z" /><path d="M13 4l3-1 5 5-1 3" /></>,
  run: <><circle cx="15" cy="4.5" r="1.8" /><path d="m6 20 4-5 3 2 1-6 4 3h3M10 11l3-3 3 1" /></>,
  bench: <><path d="M3 10h18M4 10v8M20 10v8M3 14h18" /></>,
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 5 5" /></>,
  inbox: <><path d="M3 13h5l1.5 3h5L16 13h5" /><path d="M5 5h14l2 8v6H3v-6l2-8Z" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  coins: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
  medical: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 8v8M8 12h8" /></>,
  plane: <path d="M21 4 3 11l7 2 2 7 9-16ZM10 13l5-4" />,
  clip: <path d="M8 12V7a4 4 0 0 1 8 0v9a6 6 0 0 1-12 0V9" />,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  flag: <><path d="M5 21V4" /><path d="M5 4h12l-2 4 2 4H5" /></>,
};

export function Icon({name, size = 22}: {name: IconName; size?: number}) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[name]}
    </svg>
  );
}

/** The emoji that stand for something (money, energy, a cup…) and the icon drawn instead. */
const EMOJI_ICONS: Record<string, IconName> = {
  "💎": "diamond", "💠": "diamond", "⚡": "bolt", "💰": "coins", "💸": "coins", "🏆": "trophy", "⚽": "ball", "🎁": "gift",
  "🔍": "search", "🏟️": "stadium", "🏗️": "hammer", "🎬": "video", "🎯": "target", "🔥": "fire", "🧤": "glove", "👟": "boot",
  "⭐": "star", "✅": "check", "❌": "close", "🏦": "bank", "✏️": "pen", "🖊️": "pen", "✍️": "pen", "🎨": "palette", "🔒": "lock",
  "🏁": "flag", "📋": "clipboard", "🔁": "swap", "🔄": "swap", "🏷️": "tag", "🏋️": "dumbbell", "⚠️": "warn", "📭": "inbox",
};
const EMOJI_RE = new RegExp("(" + Object.keys(EMOJI_ICONS).sort((a, b) => b.length - a.length).map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "u");

/** A text with its money, energy, cup… emoji drawn as the white line icons (other emoji, like faces, stay). */
export function iconize(text: string): ReactNode {
  if (!EMOJI_RE.test(text)) return text;
  return text.split(new RegExp(EMOJI_RE.source, "gu")).map((part, i) =>
    i % 2 === 1 ? <Icon key={i} name={EMOJI_ICONS[part]} size={16} /> : part
  );
}
