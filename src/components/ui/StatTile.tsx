import type { ReactNode } from "react";
import Card from "./Card";

export default function StatTile({
  value,
  label,
  tone = "default",
  className = "",
}: {
  value: ReactNode;
  label: string;
  tone?: "default" | "violet" | "lilac" | "periwinkle" | "cyan";
  className?: string;
}) {
  return (
    <Card
      as="div"
      interactive
      tone={tone === "default" ? "white" : tone}
      className={`flex min-h-[6.25rem] flex-col justify-center p-3 sm:p-4 ${className}`}
    >
      <div className="font-display text-title leading-none">{value}</div>
      <div className="mt-2 text-meta font-bold uppercase">{label}</div>
    </Card>
  );
}
