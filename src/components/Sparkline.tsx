import React from "react";

type Props = {
  data: number[];
  height?: number;
  stroke?: string;
  strokeWidth?: number;
  gradientId?: string;
};

export default function Sparkline({
  data,
  height = 40,
  stroke = "currentColor",
  strokeWidth = 2,
  gradientId = "sparkGrad",
}: Props) {
  if (!data?.length) return null;
  const w = Math.max(data.length - 1, 1);
  const h = Math.max(height, 10);
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;

  const pts = data.map((v, i) => {
    const x = (i / w) * 100;
    const y = 100 - ((v - min) / span) * 100;
    return `${x}, ${y}`;
  });

  const area = `0,100 ${pts.join(" ")} 100,100`;

  return (
    <svg viewBox="0 0 100 100" width="100%" height={h} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={area} fill={`url(#${gradientId})`} stroke="none" />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}