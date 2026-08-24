import type { ReactNode } from "react";

export default function SectionHeader({
  title,
  eyebrow,
  action,
  light = false,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  light?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && (
          <div className={`type-overline ${light ? "text-lilac" : "text-ink"}`}>
            {eyebrow}
          </div>
        )}
        <h2 className={`type-title ${light ? "text-white" : "text-ink"}`}>
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}
