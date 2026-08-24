import type { ReactNode } from "react";

export default function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  getLabel = (option) => option,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  getLabel?: (value: T) => ReactNode;
}) {
  return (
    <div className="inline-flex rounded-full border-3 border-outline bg-surface p-0.5 shadow-soft">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={`focus-pouf rounded-full px-3.5 py-1.5 text-meta font-bold transition ${
            value === option
              ? "bg-ink text-background"
              : "text-ink hover:bg-lilac"
          }`}
        >
          {getLabel(option)}
        </button>
      ))}
    </div>
  );
}
