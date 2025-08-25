import React from "react";

type CardProps = {
  children: React.ReactNode;
  className?: string;         
  wrapperClassName?: string;  
  padding?: string;           
};

export default function Card({
  children,
  className = "",
  wrapperClassName = "",
  padding = "p-4",
}: CardProps) {
  return (
    <div
      className={
        "rounded-2xl p-px h-full " +
        "shadow-[0_10px_30px_rgba(0,0,0,0.20)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.55)] " +
        "bg-gradient-to-b from-black/0 to-black/10 dark:from-white/5 dark:to-white/0 " +
        wrapperClassName
      }
    >
      <div
        className={
          "rounded-2xl backdrop-blur-md ring-1 ring-black/10 dark:ring-white/10 " +
          "bg-white/70 dark:bg-white/5 h-full " + // ensure inner fills the wrapper
          padding +
          " " +
          className
        }
      >
        {children}
      </div>
    </div>
  );
}