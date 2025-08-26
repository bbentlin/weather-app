import React from "react";

type Props = {
  colorsA: [string, string, string];
  colorsB: [string, string, string];
  opacityA?: number; // 0..1
  opacityB?: number; // 0..1
  className?: string;
};

export default function Aurora({
  colorsA,
  colorsB,
  opacityA = 0.55,
  opacityB = 0.35,
  className = "",
}: Props) {
  return (
    <div
      aria-hidden
      className={
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden " +
        "[mask-image:radial-gradient(70%_50%_at_50%_40%,black,transparent)] " +
        className
      }
    >
      <div
        className="absolute -top-1/3 left-1/2 -translate-x-1/2 w-[120vmax] h-[120vmax] rounded-full blur-3xl animate-aurora-slow"
        style={{
          opacity: opacityA,
          background: `conic-gradient(from 180deg at 50% 50%, ${colorsA[0]} 0deg, ${colorsA[1]} 120deg, ${colorsA[2]} 240deg, ${colorsA[0]} 360deg)`,
        }}
      />
      <div
        className="absolute top-1/3 -left-1/3 w-[90vmax] h-[90vmax] rounded-full blur-3xl animate-aurora-fast"
        style={{
          opacity: opacityB,
          background: `conic-gradient(from 90deg at 50% 50%, ${colorsB[0]} 0deg, ${colorsB[1]} 140deg, ${colorsB[2]} 260deg, ${colorsB[0]} 360deg)`,
        }}
      />
    </div>
  );
}