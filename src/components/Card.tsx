import React, { useRef } from "react";

type Props = {
  children: React.ReactNode;
  padding?: string;
  accent?: "sky" | "rose" | "emerald" | "amber" | "indigo";
  className?: string;
  wrapperClassName?: string;
  tilt?: boolean;
};

const accentMap: Record<NonNullable<Props["accent"]>, string> = {
  sky: "from-sky-400 via-sky-300 to-sky-500",
  rose: "from-rose-400 via-pink-300 to-fuchsia-400",
  emerald: "from-emerald-400 via-teal-300 to-emerald-500",
  amber: "from-amber-400 via-orange-300 to-amber-500",
  indigo: "from-indigo-400 via-violet-300 to-indigo-500",
};

export default function Card({
  children,
  padding = "p-4",
  accent = "indigo",
  className = "",
  wrapperClassName = "",
  tilt = true,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Flat, subtle tilt (no perspective = no “pushed down” illusion)
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tilt || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const rx = (0.5 - y) * 3; // was 6
    const ry = (x - 0.5) * 4; // was 8
    ref.current.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`; // removed perspective()
  };
  const onLeave = () => {
    if (!ref.current) return;
    ref.current.style.transform = "rotateX(0deg) rotateY(0deg)";
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`relative group h-full transition-transform duration-150 will-change-transform ${wrapperClassName}`}
      style={{ transformOrigin: "center" }}
    >
      {/* Glow border */}
      <div
        className={`
          pointer-events-none absolute -inset-px rounded-2xl opacity-60 blur-md
          bg-gradient-to-r ${accentMap[accent]} transition
          group-hover:opacity-90 group-active:opacity-100
        `}
        aria-hidden
      />
      {/* Shadow wrapper */}
      <div
        className="
          relative rounded-2xl p-px h-full
          shadow-[0_10px_30px_rgba(0,0,0,0.20)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.55)]
          bg-gradient-to-b from-black/0 to-black/10 dark:from-white/5 dark:to-white/0
        "
      >
        {/* Inner glass */}
        <div
          className={`
            rounded-2xl h-full
            ring-1 ring-black/10 dark:ring-white/10
            bg-white/70 dark:bg-white/5
            supports-[backdrop-filter:blur(0)]:backdrop-blur-md
            supports-[backdrop-filter:blur(0)]:bg-white/60
            dark:supports-[backdrop-filter:blur(0)]:bg-white/10
            ${padding} ${className}
          `}
          style={{ backfaceVisibility: "hidden" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}