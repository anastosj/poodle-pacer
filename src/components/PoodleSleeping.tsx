/** Rest-day mascot: the poodle curled up asleep, headband slipped over one eye. */
export default function PoodleSleeping({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label="Sleeping poodle, rest day"
    >
      {/* ears */}
      <circle cx="27" cy="66" r="15" fill="#f5f2ec" stroke="#d9d2c4" strokeWidth="2" />
      <circle cx="93" cy="66" r="15" fill="#f5f2ec" stroke="#d9d2c4" strokeWidth="2" />
      <circle cx="26" cy="79" r="12" fill="#f5f2ec" stroke="#d9d2c4" strokeWidth="2" />
      <circle cx="94" cy="79" r="12" fill="#f5f2ec" stroke="#d9d2c4" strokeWidth="2" />
      {/* top pouf */}
      <circle cx="45" cy="40" r="13" fill="#fdfcf9" stroke="#d9d2c4" strokeWidth="2" />
      <circle cx="60" cy="34" r="15" fill="#fdfcf9" stroke="#d9d2c4" strokeWidth="2" />
      <circle cx="75" cy="40" r="13" fill="#fdfcf9" stroke="#d9d2c4" strokeWidth="2" />
      {/* face */}
      <ellipse cx="60" cy="76" rx="29" ry="27" fill="#fdfcf9" stroke="#d9d2c4" strokeWidth="2" />
      {/* headband, slipped low like a sleep mask */}
      <path
        d="M 31 58 Q 60 47 89 58 L 87 68 Q 60 57 33 68 Z"
        fill="#2f6fed"
        stroke="#1d4ed8"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* closed eyes */}
      <path
        d="M 44 76 Q 49 81 54 76"
        stroke="#3a3630"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 66 76 Q 71 81 76 76"
        stroke="#3a3630"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* muzzle */}
      <ellipse cx="60" cy="88" rx="12" ry="9" fill="#fff" stroke="#d9d2c4" strokeWidth="1.5" />
      <ellipse cx="60" cy="85" rx="4" ry="3" fill="#3a3630" />
      <path
        d="M 60 88 Q 60 93 56 94"
        stroke="#3a3630"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      {/* cheek blush */}
      <ellipse cx="40" cy="86" rx="4" ry="2.5" fill="#f7ccd6" opacity="0.75" />
      <ellipse cx="80" cy="86" rx="4" ry="2.5" fill="#f7ccd6" opacity="0.75" />
      {/* zzz */}
      <text x="94" y="34" fontSize="20" fontWeight="700" fill="#2f6fed" opacity="0.85">
        z
      </text>
      <text x="104" y="20" fontSize="14" fontWeight="700" fill="#2f6fed" opacity="0.6">
        z
      </text>
    </svg>
  );
}
