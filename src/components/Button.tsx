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
    "inline-flex items-center justify-center rounded-xl font-semibold transition " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 dark:focus-visible:ring-sky-300/40 " +
    "disabled:opacity-60 disabled:cursor-not-allowed select-none";
  const sizes: Record<Size, string> = {
    md: "px-5 py-3 text-base",
    sm: "px-3.5 py-2 text-sm",
  };
  const variants: Record<Variant, string> = {
    filled:
      "shadow-md bg-gray-900 text-white hover:bg-gray-800 " +
      "dark:bg-white dark:text-gray-900 dark:hover:bg-blue-50",
    outline:
      "bg-white text-gray-900 border border-black/15 hover:bg-black/5 " +
      "dark:bg-transparent dark:border-white/30 dark:text-white dark:hover:bg-white/10",
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