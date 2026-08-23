"use client";

import { BoneIcon } from "@/components/Icons";

function MiniPoodle({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden>
      {/* tail pouf */}
      <circle cx="8" cy="30" r="6" fill="#fdfcf9" stroke="#d9d2c4" strokeWidth="1.5" />
      {/* body */}
      <ellipse cx="26" cy="36" rx="14" ry="10" fill="#fdfcf9" stroke="#d9d2c4" strokeWidth="1.5" />
      {/* legs mid-stride */}
      <path d="M 18 44 L 13 52" stroke="#d9d2c4" strokeWidth="3" strokeLinecap="round" />
      <path d="M 34 44 L 39 52" stroke="#d9d2c4" strokeWidth="3" strokeLinecap="round" />
      {/* head pouf */}
      <circle cx="44" cy="22" r="10" fill="#fdfcf9" stroke="#d9d2c4" strokeWidth="1.5" />
      <circle cx="40" cy="13" r="5" fill="#fdfcf9" stroke="#d9d2c4" strokeWidth="1.5" />
      {/* headband */}
      <path d="M 36 18 Q 44 13 52 18 L 51 22 Q 44 18 37 22 Z" fill="#2f6fed" stroke="#1d4ed8" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M 51 20 L 58 16 L 55 24 Z" fill="#2f6fed" stroke="#1d4ed8" strokeWidth="1.2" strokeLinejoin="round" />
      {/* eye + nose */}
      <circle cx="46" cy="24" r="1.5" fill="#3a3630" />
      <circle cx="53" cy="27" r="2" fill="#3a3630" />
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
    <div className="mt-4 rounded-pouf bg-poodle-white p-4 ring-1 ring-poodle-fur pouf-shadow">
      <div className="flex items-center justify-between text-xs font-semibold text-foreground/60">
        <span>Road to race day</span>
        <span>{label}</span>
      </div>
      <div className="relative mt-1 h-12">
        {/* track */}
        <div className="absolute bottom-2 left-0 right-0 h-3 rounded-full bg-poodle-cream ring-1 ring-poodle-fur" />
        <div
          className="absolute bottom-2 left-0 h-3 rounded-full bg-headband transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
        {/* bone at the finish */}
        <span className="absolute -right-1 bottom-5 text-xl" role="img" aria-label="bone">
          <BoneIcon size={22} />
        </span>
        {/* running poodle */}
        <div
          className="absolute bottom-3 transition-all duration-700"
          style={{ left: `calc(${pct}% - 20px)` }}
        >
          <MiniPoodle />
        </div>
      </div>
      <p className="text-center text-[11px] text-foreground/50">
        {pct >= 100
          ? "Bone acquired. What a good runner."
          : `${Math.round(pct)}% of the way to the bone`}
      </p>
    </div>
  );
}
