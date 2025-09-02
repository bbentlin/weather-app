import React from "react";

type Variant = "filled" | "outline" | "ghost";
type Size = "md" | "sm";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  className?: string;
};

export default function Button({
  variant = "filled",
  size = "md",
  className = "",
  ...props
}: Props) {
  const base =
    "inline-flex items-center justify-center rounded-2xl font-semibold transition " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 dark:focus-visible:ring-sky-300/40 " +
    "disabled:opacity-60 disabled:cursor-not-allowed select-none " +
    "transition-transform active:scale-[.98]"; // ADD press feedback

  const sizes: Record<Size, string> = {
    md: "px-5 py-3 text-base",
    sm: "px-3.5 py-2 text-sm",
  };

  const variants: Record<Variant, string> = {
    filled:
      "shadow-md bg-gradient-to-b from-gray-900 to-gray-800 text-white hover:from-gray-800 hover:to-gray-800 " +
      "dark:from-white dark:to-white/95 dark:text-gray-900",
    outline:
      "backdrop-blur bg-white/70 dark:bg-white/10 border border-black/10 dark:border-white/20 " +
      "text-gray-900 dark:text-white hover:bg-white/90 dark:hover:bg-white/15",
    ghost:
      "bg-transparent text-gray-800 hover:bg-black/5 " +
      "dark:text-white/80 dark:hover:bg-white/10",
  };

  return (
    <button
      className={[base, sizes[size], variants[variant], className].join(" ")}
      {...props}
    />
  );
}