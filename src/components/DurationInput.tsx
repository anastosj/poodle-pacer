"use client";

import { parseDuration } from "@/lib/pace";

/**
 * Free-text duration entry: "42:30", "1:23:45", or a bare number of minutes.
 * Kept as a string while typing so partial input like "8:" doesn't fight the user.
 */
export default function DurationInput({
  value,
  onChange,
  className = "",
  placeholder = "Time (mm:ss)",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const invalid = value.trim() !== "" && parseDuration(value) === undefined;

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Duration"
      aria-invalid={invalid}
      className={`rounded-lg border px-2 py-1 text-[11px] tabular-nums focus:outline-none focus:ring-2 focus:ring-headband ${
        invalid ? "border-red-400 bg-red-50" : "border-poodle-fur"
      } ${className}`}
    />
  );
}
