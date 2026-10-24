// A match shirt in the club's colours, like the ones on a fantasy-league
// lineup. Keepers wear green.
export function Jersey({color, trim, number, size = 44, keeper}: {color: string; trim: string; number?: number; size?: number; keeper?: boolean}) {
  const body = keeper ? "#16a34a" : color;
  const edge = keeper ? "#facc15" : trim;
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className="jersey" aria-hidden>
      <path
        d="M13 3 L8 5 L1 11 L5 18 L9 15.5 L9 37 Q20 39 31 37 L31 15.5 L35 18 L39 11 L32 5 L27 3 Q20 8 13 3Z"
        fill={body}
        stroke="rgb(0 0 0 / 0.35)"
        strokeWidth={0.8}
        strokeLinejoin="round"
      />
      <path d="M13 3 Q20 8 27 3" fill="none" stroke={edge} strokeWidth={2} strokeLinecap="round" />
      <path d="M1.8 12 L5.4 17.2 M38.2 12 L34.6 17.2" stroke={edge} strokeWidth={1.4} />
      <path d="M9 15.5 L9 37 Q11 37.4 13 37.6 L13 12 Z" fill="#000" opacity={0.12} />
      {number !== undefined && (
        <text x={20} y={27.5} textAnchor="middle" fontSize={12} fontWeight={900} fill={edge} stroke="rgb(0 0 0 / 0.25)" strokeWidth={0.3}>
          {number}
        </text>
      )}
    </svg>
  );
}
