import type { HTMLAttributes } from "react";

type PillTone = "dark" | "violet" | "cyan" | "lilac";

export default function Pill({
  tone = "dark",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: PillTone }) {
  const tones = {
    dark: "bg-ink text-background",
    violet: "bg-primary text-white",
    cyan: "bg-highlight text-ink",
    lilac: "bg-lilac text-ink",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border-2 border-outline px-2 py-0.5 text-meta font-bold uppercase ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
