// A classic football: white panels, a black pentagon in the middle and five
// more around the edge, stitched seams and a bit of shading. Centred on (0, 0)
// with radius `r`, for use inside another SVG; rotate the parent to spin it.
import {useId} from "react";

function pentagon(cx: number, cy: number, size: number, turn = 0): string {
  return Array.from({length: 5}, (_, k) => {
    const a = ((-90 + turn + k * 72) * Math.PI) / 180;
    return `${(cx + Math.cos(a) * size).toFixed(3)},${(cy + Math.sin(a) * size).toFixed(3)}`;
  }).join(" ");
}

export function Football({r}: {r: number}) {
  const id = useId().replace(/:/g, "");
  const inner = r * 0.36;
  const rays = Array.from({length: 5}, (_, k) => ((-90 + k * 72) * Math.PI) / 180);
  const outer = Array.from({length: 5}, (_, k) => ((-90 + 36 + k * 72) * Math.PI) / 180);
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-shade`} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#eef1f5" />
          <stop offset="1" stopColor="#b8c0cc" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <circle r={r} />
        </clipPath>
      </defs>
      <circle r={r} fill={`url(#${id}-shade)`} />
      <g clipPath={`url(#${id}-clip)`}>
        <g stroke="#9aa3b2" strokeWidth={r * 0.045} fill="none">
          {rays.map((a, k) => (
            <line key={k} x1={Math.cos(a) * inner} y1={Math.sin(a) * inner} x2={Math.cos(a) * r * 0.78} y2={Math.sin(a) * r * 0.78} />
          ))}
        </g>
        <polygon points={pentagon(0, 0, inner)} fill="#111827" />
        {outer.map((a, k) => (
          <polygon key={k} points={pentagon(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98, r * 0.34, 36 + k * 72)} fill="#111827" />
        ))}
        {/* Shade on the far side, light on the near side. */}
        <circle r={r} fill="none" stroke="#000" strokeOpacity={0.12} strokeWidth={r * 0.3} transform={`translate(${r * 0.08} ${r * 0.1})`} />
      </g>
      <ellipse cx={-r * 0.36} cy={-r * 0.42} rx={r * 0.28} ry={r * 0.16} fill="#fff" opacity={0.7} transform={`rotate(-30 ${-r * 0.36} ${-r * 0.42})`} />
      <circle r={r} fill="none" stroke="#111827" strokeWidth={r * 0.07} />
    </g>
  );
}
