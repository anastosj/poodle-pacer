"use client";

import { BoneIcon } from "@/components/Icons";

function MiniPoodle({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden>
      {/* tail pouf */}
      <circle cx="8" cy="30" r="6" fill="#ffffff" stroke="#0f1330" strokeWidth="1.5" />
      {/* body */}
      <ellipse cx="26" cy="36" rx="14" ry="10" fill="#ffffff" stroke="#0f1330" strokeWidth="1.5" />
      {/* legs mid-stride */}
      <path d="M 18 44 L 13 52" stroke="#0f1330" strokeWidth="3" strokeLinecap="round" />
      <path d="M 34 44 L 39 52" stroke="#0f1330" strokeWidth="3" strokeLinecap="round" />
      {/* head pouf */}
      <circle cx="44" cy="22" r="10" fill="#ffffff" stroke="#0f1330" strokeWidth="1.5" />
      <circle cx="40" cy="13" r="5" fill="#ffffff" stroke="#0f1330" strokeWidth="1.5" />
      {/* headband */}
      <path d="M 36 18 Q 44 13 52 18 L 51 22 Q 44 18 37 22 Z" fill="#2f6fed" stroke="#0f1330" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M 51 20 L 58 16 L 55 24 Z" fill="#2f6fed" stroke="#0f1330" strokeWidth="1.2" strokeLinejoin="round" />
      {/* eye + nose */}
      <circle cx="46" cy="24" r="1.5" fill="#0f1330" />
      <circle cx="53" cy="27" r="2" fill="#0f1330" />
    </svg>
  );
}

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
          <MiniPoodle size={58} />
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
