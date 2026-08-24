import type { HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "section" | "article";
  interactive?: boolean;
  tone?: "white" | "lilac" | "periwinkle" | "cyan" | "violet";
}

export default function Card({
  as = "section",
  interactive = false,
  tone = "white",
  className = "",
  ...props
}: CardProps) {
  const Element = as;
  const tones = {
    white: "bg-surface",
    lilac: "bg-lilac",
    periwinkle: "bg-periwinkle",
    cyan: "bg-pale-cyan",
    violet: "bg-primary text-white",
  };
  return (
    <Element
      className={`rounded-sm border-3 border-outline shadow-card ${
        tones[tone]
      } ${interactive ? "pouf-lift" : ""} ${className}`}
      {...props}
    />
  );
}
