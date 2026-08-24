"use client";

import { BoneIcon, RunIcon } from "@/components/Icons";

export default function PoodleProgressBar({
  fraction,
  label,
}: {
  fraction: number; // 0..1
  label: string;
}) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <div className="mt-4 rounded-sm border-3 border-outline bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between text-meta font-bold uppercase text-ink-soft">
        <span>Road to race day</span>
        <span>{label}</span>
      </div>
      <div className="relative mt-1 h-20">
        <svg
          className="absolute inset-x-0 bottom-1 h-16 w-full overflow-visible"
          viewBox="0 0 800 100"
          preserveAspectRatio="none"
          role="img"
          aria-label="Bone-shaped training progress track"
        >
          <defs>
            <clipPath id="bone-progress-clip">
              <path d="M58 25H742c2-10 10-17 21-17 12 0 21 9 21 21 12 0 20 9 20 21s-8 21-20 21c0 12-9 21-21 21-11 0-19-7-21-17H58c-2 10-10 17-21 17-12 0-21-9-21-21-12 0-20-9-20-21s8-21 20-21c0-12 9-21 21-21 11 0 19 7 21 17Z" />
            </clipPath>
            <pattern id="bone-progress-stripes" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(-25)">
              <rect width="18" height="18" fill="#2f6fed" />
              <rect width="7" height="18" fill="#a88bff" />
            </pattern>
          </defs>
          <path
            d="M58 25H742c2-10 10-17 21-17 12 0 21 9 21 21 12 0 20 9 20 21s-8 21-20 21c0 12-9 21-21 21-11 0-19-7-21-17H58c-2 10-10 17-21 17-12 0-21-9-21-21-12 0-20-9-20-21s8-21 20-21c0-12 9-21 21-21 11 0 19 7 21 17Z"
            fill="#e0d6ff"
          />
          <rect
            x="0"
            y="0"
            width={`${pct}%`}
            height="100"
            fill="url(#bone-progress-stripes)"
            clipPath="url(#bone-progress-clip)"
          />
          <path
            d="M58 25H742c2-10 10-17 21-17 12 0 21 9 21 21 12 0 20 9 20 21s-8 21-20 21c0 12-9 21-21 21-11 0-19-7-21-17H58c-2 10-10 17-21 17-12 0-21-9-21-21-12 0-20-9-20-21s8-21 20-21c0-12 9-21 21-21 11 0 19 7 21 17Z"
            fill="none"
            stroke="#0f1330"
            strokeWidth="6"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* bone at the finish */}
        <span className="absolute -top-1 right-2" role="img" aria-label="bone">
          <BoneIcon size={22} />
        </span>
        {/* running poodle */}
        <div
          className="absolute bottom-2 transition-all duration-700"
          style={{
            left: `clamp(0px, calc(${pct}% - 29px), calc(100% - 58px))`,
          }}
        >
          <RunIcon size={58} />
        </div>
      </div>
      <p className="text-center text-meta text-ink-soft">
        {pct >= 100
          ? "Bone acquired. What a good runner."
          : `${Math.round(pct)}% of the way to the bone`}
      </p>
    </div>
  );
}
