export default function PoodleMascot({ size = 96 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="White poodle mascot wearing a blue headband"
    >
      {/* ears */}
      <circle cx="26" cy="58" r="16" fill="#f5f2ec" stroke="#d9d2c4" strokeWidth="2" />
      <circle cx="94" cy="58" r="16" fill="#f5f2ec" stroke="#d9d2c4" strokeWidth="2" />
      <circle cx="24" cy="72" r="13" fill="#f5f2ec" stroke="#d9d2c4" strokeWidth="2" />
      <circle cx="96" cy="72" r="13" fill="#f5f2ec" stroke="#d9d2c4" strokeWidth="2" />
      {/* top pouf */}
      <circle cx="44" cy="30" r="14" fill="#fdfcf9" stroke="#d9d2c4" strokeWidth="2" />
      <circle cx="60" cy="24" r="16" fill="#fdfcf9" stroke="#d9d2c4" strokeWidth="2" />
      <circle cx="76" cy="30" r="14" fill="#fdfcf9" stroke="#d9d2c4" strokeWidth="2" />
      {/* face */}
      <ellipse cx="60" cy="68" rx="30" ry="28" fill="#fdfcf9" stroke="#d9d2c4" strokeWidth="2" />
      {/* blue headband */}
      <path
        d="M 30 46 Q 60 34 90 46 L 88 56 Q 60 45 32 56 Z"
        fill="#2f6fed"
        stroke="#1d4ed8"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* headband knot */}
      <circle cx="90" cy="50" r="5" fill="#2f6fed" stroke="#1d4ed8" strokeWidth="2" />
      <path d="M 93 47 L 103 40 L 99 52 Z" fill="#2f6fed" stroke="#1d4ed8" strokeWidth="2" strokeLinejoin="round" />
      <path d="M 94 53 L 105 56 L 96 61 Z" fill="#2f6fed" stroke="#1d4ed8" strokeWidth="2" strokeLinejoin="round" />
      {/* eyes */}
      <circle cx="49" cy="66" r="3.5" fill="#3a3630" />
      <circle cx="71" cy="66" r="3.5" fill="#3a3630" />
      <circle cx="50.2" cy="64.8" r="1.2" fill="#fff" />
      <circle cx="72.2" cy="64.8" r="1.2" fill="#fff" />
      {/* muzzle */}
      <ellipse cx="60" cy="80" rx="13" ry="10" fill="#fff" stroke="#d9d2c4" strokeWidth="1.5" />
      <ellipse cx="60" cy="76" rx="4.5" ry="3.5" fill="#3a3630" />
      <path d="M 60 80 Q 60 85 55 86" stroke="#3a3630" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M 60 80 Q 60 85 65 86" stroke="#3a3630" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* tongue */}
      <path d="M 57 86 Q 60 92 63 86 Q 60 89 57 86" fill="#f19bb4" stroke="#e57697" strokeWidth="1" />
      {/* cheek blush */}
      <ellipse cx="41" cy="76" rx="4" ry="2.5" fill="#f7ccd6" opacity="0.8" />
      <ellipse cx="79" cy="76" rx="4" ry="2.5" fill="#f7ccd6" opacity="0.8" />
    </svg>
  );
}
