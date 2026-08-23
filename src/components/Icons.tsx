/**
 * Hand-drawn icon set for Poodle Pacer.
 *
 * Everything here shares one visual language: soft rounded forms, a 24x24 grid,
 * the mascot's cream-and-blue palette, and no stock emoji. Icons take a `size`
 * and optional `className` so they can sit inline with text.
 */

const FUR = "#fdfcf9";
const FUR_EDGE = "#d9d2c4";
const BLUE = "#2f6fed";
const BLUE_DEEP = "#1d4ed8";
const INK = "#3a3630";
const BLUSH = "#f7ccd6";
const GOLD = "#e8b04b";
const SILVER = "#c2c8d0";
const BRONZE = "#c98b5e";

export interface IconProps {
  size?: number;
  className?: string;
  title?: string;
}

function Svg({
  size = 20,
  className = "",
  title,
  box = 24,
  children,
}: IconProps & { box?: number; children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${box} ${box}`}
      className={`inline-block shrink-0 align-[-0.15em] ${className}`}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

/**
 * The poodle head every character icon is built on, drawn on a 120 grid.
 * Keeping the ear poufs, crown, and muzzle identical across workouts is what
 * makes each one read as a dog first and an activity second.
 */
function PoodleHead({ crown = true }: { crown?: boolean }) {
  return (
    <>
      {/* ear poufs */}
      <circle cx="27" cy="66" r="15" fill={FUR} stroke={FUR_EDGE} strokeWidth="2" />
      <circle cx="93" cy="66" r="15" fill={FUR} stroke={FUR_EDGE} strokeWidth="2" />
      <circle cx="26" cy="79" r="12" fill={FUR} stroke={FUR_EDGE} strokeWidth="2" />
      <circle cx="94" cy="79" r="12" fill={FUR} stroke={FUR_EDGE} strokeWidth="2" />
      {crown && (
        <>
          <circle cx="45" cy="40" r="13" fill="#fdfcf9" stroke={FUR_EDGE} strokeWidth="2" />
          <circle cx="60" cy="34" r="15" fill="#fdfcf9" stroke={FUR_EDGE} strokeWidth="2" />
          <circle cx="75" cy="40" r="13" fill="#fdfcf9" stroke={FUR_EDGE} strokeWidth="2" />
        </>
      )}
      <ellipse cx="60" cy="76" rx="29" ry="27" fill="#fdfcf9" stroke={FUR_EDGE} strokeWidth="2" />
    </>
  );
}

/**
 * Shared snout, so every poodle has the same face below the eyes. The mouth
 * is the only part that moves, which is what lets the moods stay on-model.
 */
function PoodleMuzzle({
  tongue = false,
  mouth = "neutral",
  blush = true,
}: {
  tongue?: boolean;
  mouth?: "neutral" | "happy" | "sad";
  blush?: boolean;
}) {
  const jowls =
    mouth === "happy"
      ? ["M 60 88 Q 60 95 52 92", "M 60 88 Q 60 95 68 92"]
      : mouth === "sad"
        ? ["M 60 88 Q 59 94 53 98", "M 60 88 Q 61 94 67 98"]
        : ["M 60 88 Q 60 93 55 94", "M 60 88 Q 60 93 65 94"];

  return (
    <>
      <ellipse cx="60" cy="88" rx="12" ry="9" fill="#fff" stroke={FUR_EDGE} strokeWidth="1.5" />
      <ellipse cx="60" cy="85" rx="4.2" ry="3.2" fill={INK} />
      {jowls.map((d) => (
        <path key={d} d={d} stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      ))}
      {tongue && (
        <path
          d="M 56 94 Q 60 102 64 94 Q 60 97 56 94"
          fill="#f19bb4"
          stroke="#e57697"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      )}
      {blush && (
        <>
          <ellipse cx="40" cy="86" rx="4" ry="2.5" fill={BLUSH} opacity="0.8" />
          <ellipse cx="80" cy="86" rx="4" ry="2.5" fill={BLUSH} opacity="0.8" />
        </>
      )}
    </>
  );
}

function EyesOpen() {
  return (
    <>
      <circle cx="49" cy="74" r="3.6" fill={INK} />
      <circle cx="71" cy="74" r="3.6" fill={INK} />
      <circle cx="50.2" cy="72.8" r="1.2" fill="#fff" />
      <circle cx="72.2" cy="72.8" r="1.2" fill="#fff" />
    </>
  );
}

/* ------------------------------- navigation ------------------------------ */

export function HomeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M4 11.2 12 4.5l8 6.7V19a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 19z"
        fill={FUR}
        stroke={FUR_EDGE}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M2.6 12.2 12 4l9.4 8.2"
        fill="none"
        stroke={BLUE}
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M9.6 20.6v-4.4a2.4 2.4 0 0 1 4.8 0v4.4"
        fill={BLUE}
        opacity="0.18"
        stroke={BLUE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** A paw print: the "pack" / group marker. */
export function PawIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <ellipse cx="7.2" cy="8.6" rx="2.2" ry="2.8" fill={BLUE} />
      <ellipse cx="12" cy="6.9" rx="2.3" ry="3" fill={BLUE} />
      <ellipse cx="16.8" cy="8.6" rx="2.2" ry="2.8" fill={BLUE} />
      <path
        d="M12 11.4c3.1 0 5.4 2.2 5.4 4.7 0 2.2-1.9 3.5-4 3.5-.7 0-1 .3-1.4.3s-.7-.3-1.4-.3c-2.1 0-4-1.3-4-3.5 0-2.5 2.3-4.7 5.4-4.7z"
        fill={BLUE}
      />
    </Svg>
  );
}

/** Target for goals: a rosette-ish bullseye rather than a dartboard. */
export function TargetIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.4" fill={FUR} stroke={FUR_EDGE} strokeWidth="1.5" />
      <circle cx="12" cy="12" r="5.4" fill="none" stroke={BLUE} strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.3" fill={BLUE} />
      <path
        d="M12 3.6v2.2M12 18.2v2.2M3.6 12h2.2M18.2 12h2.2"
        stroke={BLUE_DEEP}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Settings: a plain cog. Squared teeth and a hollow hub read as a gear at 15px. */
export function SettingsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      {/* four bars through the centre give eight teeth */}
      <g fill={BLUE}>
        {[0, 45, 90, 135].map((angle) => (
          <rect
            key={angle}
            x="10.15"
            y="1.7"
            width="3.7"
            height="20.6"
            rx="1"
            transform={`rotate(${angle} 12 12)`}
          />
        ))}
      </g>
      <circle cx="12" cy="12" r="7.5" fill={BLUE} />
      <circle cx="12" cy="12" r="6.6" fill={FUR} stroke={FUR_EDGE} strokeWidth="1.2" />
      <circle cx="12" cy="12" r="2.9" fill={FUR} stroke={BLUE_DEEP} strokeWidth="2.4" />
    </Svg>
  );
}

/* --------------------------------- awards -------------------------------- */

export function BoneIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <g
        transform="rotate(-35 12 12)"
        fill={FUR}
        stroke={FUR_EDGE}
        strokeWidth="1.4"
        strokeLinejoin="round"
      >
        <rect x="7" y="10.4" width="10" height="3.2" rx="1.6" />
        <circle cx="6.6" cy="10.3" r="2.5" />
        <circle cx="6.6" cy="13.7" r="2.5" />
        <circle cx="17.4" cy="10.3" r="2.5" />
        <circle cx="17.4" cy="13.7" r="2.5" />
      </g>
    </Svg>
  );
}

/** Rosette award. Tone picks gold, silver, or bronze. */
export function RosetteIcon({
  place = 1,
  ...props
}: IconProps & { place?: 1 | 2 | 3 }) {
  const color = place === 1 ? GOLD : place === 2 ? SILVER : BRONZE;
  return (
    <Svg {...props}>
      <path d="M9 14.5 7.2 21l3.3-1.7L12 22l1.5-2.7 3.3 1.7-1.8-6.5z" fill={BLUE} opacity="0.75" />
      <circle cx="12" cy="9" r="6.4" fill={color} stroke={FUR_EDGE} strokeWidth="1.2" />
      <circle cx="12" cy="9" r="3.6" fill={FUR} opacity="0.55" />
      <circle cx="12" cy="9" r="1.6" fill={color} />
    </Svg>
  );
}

export function MedalIcon(props: IconProps) {
  return <RosetteIcon place={1} {...props} />;
}

/** Finish line: a little checkered pennant. */
export function FinishFlagIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 3.2v18" stroke={INK} strokeWidth="1.9" strokeLinecap="round" />
      <path d="M7.4 4.4h12l-2.6 3.8 2.6 3.8h-12z" fill={BLUE} />
      <g fill={FUR} opacity="0.95">
        <rect x="7.4" y="4.4" width="3" height="2.4" />
        <rect x="13.4" y="4.4" width="3" height="2.4" />
        <rect x="10.4" y="6.8" width="3" height="2.4" />
        <rect x="16.4" y="6.8" width="2.2" height="2.4" />
        <rect x="7.4" y="9.2" width="3" height="2.4" />
        <rect x="13.4" y="9.2" width="3" height="2.4" />
      </g>
    </Svg>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M12 3.4l2.5 5.3 5.7.8-4.1 4.1 1 5.8-5.1-2.8-5.1 2.8 1-5.8L3.8 9.5l5.7-.8z"
        fill={GOLD}
        stroke={FUR_EDGE}
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ConfettiIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <g stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" fill="none">
        <path d="M12 3v2.4M5.6 5.6l1.7 1.7M18.4 5.6l-1.7 1.7" />
      </g>
      <circle cx="6" cy="13" r="1.5" fill={BLUSH} />
      <circle cx="18" cy="12.4" r="1.5" fill={GOLD} />
      <circle cx="9.5" cy="19" r="1.4" fill={BLUE} />
      <circle cx="15.5" cy="18.4" r="1.3" fill={BLUSH} />
      <circle cx="12" cy="10.6" r="2.1" fill={BLUE} opacity="0.75" />
    </Svg>
  );
}

/* -------------------------------- workouts ------------------------------- */

/**
 * Running: a whole poodle at full stride, facing right. Drawn in the show clip
 * (tail pom, hip rosette, ankle poms) because that silhouette says "poodle"
 * faster than any amount of face detail does at this size. The stride itself
 * carries the motion; trailing speed lines just read as stray marks.
 */
export function RunIcon(props: IconProps) {
  return (
    <Svg box={120} {...props}>
      {/* far-side legs sit behind the body in a paler tone, which reads as
          depth instead of the four-legged clutter a flat set produces */}
      <g stroke={FUR_EDGE} strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M64 76 L69 95" />
        <path d="M40 76 L37 95" />
      </g>

      {/* tail, carried high */}
      <path d="M27 58 L15 44" stroke={FUR_EDGE} strokeWidth="5" strokeLinecap="round" fill="none" />
      <circle cx="12" cy="39" r="8.5" fill="#fdfcf9" stroke={FUR_EDGE} strokeWidth="2" />

      {/* body: barrel plus the clipped hindquarter */}
      <ellipse cx="50" cy="66" rx="26" ry="15" fill="#fdfcf9" stroke={FUR_EDGE} strokeWidth="2" />
      <circle cx="32" cy="64" r="14" fill="#fdfcf9" stroke={FUR_EDGE} strokeWidth="2" />

      {/* near legs, mid-stride: one reaching forward, one driving back */}
      <g stroke={INK} strokeWidth="6" strokeLinecap="round" fill="none">
        <path d="M70 74 L88 90" />
        <path d="M34 74 L17 88" />
      </g>
      <g fill="#fdfcf9" stroke={FUR_EDGE} strokeWidth="2">
        <circle cx="91" cy="93" r="6.5" />
        <circle cx="14" cy="91" r="6.5" />
      </g>

      {/* neck, drawn thick so the head never looks detached */}
      <path d="M70 62 L84 48" stroke="#fdfcf9" strokeWidth="15" strokeLinecap="round" fill="none" />
      <path d="M70 62 L84 48" stroke={FUR_EDGE} strokeWidth="15" strokeLinecap="round" fill="none" opacity="0.35" />

      {/* head */}
      <circle cx="88" cy="42" r="14" fill="#fdfcf9" stroke={FUR_EDGE} strokeWidth="2" />
      {/* ear pouf, oversized on purpose: it is the main "this is a dog" cue */}
      <ellipse cx="77" cy="52" rx="9.5" ry="12" fill={FUR} stroke={FUR_EDGE} strokeWidth="2" />
      {/* muzzle, overlapping the head so it reads as one form */}
      <ellipse cx="104" cy="48" rx="11" ry="6.8" fill="#fff" stroke={FUR_EDGE} strokeWidth="1.8" />
      <ellipse cx="113" cy="46" rx="3.4" ry="2.8" fill={INK} />
      <path
        d="M 104 53 q 5 7 9 2 q -4 1 -9 -2"
        fill="#f19bb4"
        stroke="#e57697"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* topknot */}
      <circle cx="86" cy="27" r="8.5" fill="#fdfcf9" stroke={FUR_EDGE} strokeWidth="2" />
      {/* Headband hugging the skull. No trailing ribbon here: paired with the
          pointed muzzle it turned the whole head into a fish. */}
      <path
        d="M 75 38 Q 88 26 101 38 L 99 45 Q 88 34 77 45 Z"
        fill={BLUE}
        stroke={BLUE_DEEP}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* eye sits on the head, clear of the band */}
      <circle cx="94" cy="47" r="3.2" fill={INK} />
      <circle cx="95.1" cy="45.9" r="1.1" fill="#fff" />
    </Svg>
  );
}

/** Run or cross: same poodle in a bike helmet. */
export function BikeIcon(props: IconProps) {
  return (
    <Svg box={120} {...props}>
      <PoodleHead crown={false} />
      {/* helmet shell over the crown, with vents and a visor */}
      <path
        d="M 30 60 A 30 28 0 0 1 90 60 Z"
        fill={BLUE}
        stroke={BLUE_DEEP}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <g stroke={BLUE_DEEP} strokeWidth="2.4" strokeLinecap="round" opacity="0.65">
        <path d="M48 42v12" />
        <path d="M60 38v14" />
        <path d="M72 42v12" />
      </g>
      <path
        d="M 28 60 h 64 l -3 7 h -58 Z"
        fill={BLUE_DEEP}
        stroke={BLUE_DEEP}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* chin strap */}
      <path d="M 34 66 L 46 84" stroke={BLUE_DEEP} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M 86 66 L 74 84" stroke={BLUE_DEEP} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <EyesOpen />
      <PoodleMuzzle />
    </Svg>
  );
}

/** Cross-training: same poodle in goggles, chin in the water. */
export function SwimIcon(props: IconProps) {
  return (
    <Svg box={120} {...props}>
      <PoodleHead />
      {/* Goggles are the bold mass here: one wide strap plus filled lenses. */}
      <path
        d="M 28 68 Q 60 55 92 68"
        fill="none"
        stroke={BLUE_DEEP}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <g stroke={BLUE_DEEP} strokeWidth="3">
        <ellipse cx="47" cy="74" rx="13" ry="10.5" fill="#9ccdf0" />
        <ellipse cx="73" cy="74" rx="13" ry="10.5" fill="#9ccdf0" />
      </g>
      <path d="M 58 74 h 4" stroke={BLUE_DEEP} strokeWidth="4" strokeLinecap="round" />
      <circle cx="47" cy="74" r="3.4" fill={INK} />
      <circle cx="73" cy="74" r="3.4" fill={INK} />
      <circle cx="43" cy="70.5" r="2.6" fill="#fff" opacity="0.9" />
      <circle cx="69" cy="70.5" r="2.6" fill="#fff" opacity="0.9" />
      <ellipse cx="60" cy="92" rx="10" ry="7" fill="#fff" stroke={FUR_EDGE} strokeWidth="1.5" />
      <ellipse cx="60" cy="90" rx="3.8" ry="2.8" fill={INK} />
      {/* A single waterline, low enough that it frames the chin instead of
          competing with the face at small sizes. */}
      <path
        d="M2 110q9 0 9 5.5t9 5.5 9-5.5 9-5.5 9 5.5 9 5.5 9-5.5 9-5.5 9 5.5 9 5.5 9-5.5 9-5.5 9 5.5 9 5.5"
        fill="none"
        stroke={BLUE}
        strokeWidth="6"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/* -------------------------------- feelings ------------------------------- */

/**
 * How a workout felt. Same head and snout as every other poodle here; only the
 * eyes, mouth, and a small tell (tongue or sweat) change between moods.
 */
export function MoodIcon({
  mood,
  ...props
}: IconProps & { mood: "good" | "medium" | "bad" }) {
  return (
    <Svg box={120} {...props}>
      <PoodleHead />

      {mood === "good" && (
        <>
          {/* happy arcs rather than dots, so the whole face lifts */}
          <path d="M 44 76 Q 49 69 54 76" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M 66 76 Q 71 69 76 76" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
          <PoodleMuzzle mouth="happy" tongue />
        </>
      )}

      {mood === "medium" && (
        <>
          <EyesOpen />
          <PoodleMuzzle mouth="neutral" blush={false} />
        </>
      )}

      {mood === "bad" && (
        <>
          {/* squeezed-shut eyes, the universal "that was rough" */}
          <path d="M 44 72 Q 49 79 54 72" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M 66 72 Q 71 79 76 72" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
          <PoodleMuzzle mouth="sad" blush={false} />
          {/* one bead of sweat off the temple */}
          <path
            d="M 92 44 q 4.5 6.5 0 8.5 q -4.5 -2 0 -8.5"
            fill="#8fc7ef"
            stroke="#5aa6d8"
            strokeWidth="1.4"
          />
        </>
      )}
    </Svg>
  );
}

/* ------------------------------ small utility ---------------------------- */

export function ChevronIcon({ up, ...props }: IconProps & { up?: boolean }) {
  return (
    <Svg {...props}>
      <path
        d={up ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M5 12.8l4.4 4.2L19 7.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CheckBadgeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" fill={BLUE} />
      <path
        d="M7.4 12.4l3.2 3.1L16.8 9"
        fill="none"
        stroke={FUR}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M4 20l1-4L16.2 4.8a2 2 0 0 1 2.8 2.8L8 19z"
        fill={FUR}
        stroke={FUR_EDGE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M15.2 5.8l3 3" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 20l1-4 3 3z" fill={BLUE} opacity="0.35" />
    </Svg>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.4" y="13" width="4" height="7.4" rx="1.4" fill={BLUE} opacity="0.35" />
      <rect x="10" y="9" width="4" height="11.4" rx="1.4" fill={BLUE} opacity="0.6" />
      <rect x="16.6" y="4.6" width="4" height="15.8" rx="1.4" fill={BLUE} />
    </Svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.2" y="5.4" width="17.6" height="15" rx="3" fill={FUR} stroke={FUR_EDGE} strokeWidth="1.5" />
      <path d="M3.2 10h17.6" stroke={FUR_EDGE} strokeWidth="1.4" />
      <path d="M7.6 3.4v3.6M16.4 3.4v3.6" stroke={BLUE} strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="8.4" cy="14" r="1.4" fill={BLUE} />
      <circle cx="12" cy="14" r="1.4" fill={BLUE} opacity="0.45" />
      <circle cx="15.6" cy="14" r="1.4" fill={BLUE} opacity="0.45" />
    </Svg>
  );
}

export function BellIcon({ muted, ...props }: IconProps & { muted?: boolean }) {
  return (
    <Svg {...props}>
      <path
        d="M6.2 16.4V11a5.8 5.8 0 0 1 11.6 0v5.4l1.4 2.2H4.8z"
        fill={FUR}
        stroke={FUR_EDGE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10 19.4a2.2 2.2 0 0 0 4 0" fill={BLUE} opacity="0.3" stroke={BLUE} strokeWidth="1.4" />
      <circle cx="12" cy="4.2" r="1.6" fill={BLUE} />
      {muted && (
        <path d="M4.6 4.6l14.8 14.8" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      )}
    </Svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6.4" y="2.6" width="11.2" height="18.8" rx="3" fill={FUR} stroke={FUR_EDGE} strokeWidth="1.5" />
      <rect x="8.4" y="5.6" width="7.2" height="10.4" rx="1.4" fill={BLUE} opacity="0.2" />
      <circle cx="12" cy="18.4" r="1.3" fill={BLUE} />
    </Svg>
  );
}

/** Strava sync marker. */
export function BoltIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M13.6 2.6L5.4 13.6h5l-1.2 7.8 8.4-11.2h-5.2z"
        fill="#fc4c02"
        stroke="#d94002"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M12 2.8c2.6 3.4.6 5 2 6.6 1-.6 1.4-1.8 1.4-1.8 2.6 2.6 3.2 4.8 3.2 6.6a6.6 6.6 0 1 1-13.2 0c0-3.4 2.6-6 4.4-8.4.9-1.2 2.2-3 2.2-3z"
        fill="#f4a24c"
        stroke="#e07f2a"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M12 12.4c1.4 1.8.4 2.8 1 3.6a3.2 3.2 0 1 1-4.2 0c.6-.8 1.8-2.2 3.2-3.6z"
        fill={GOLD}
        opacity="0.9"
      />
    </Svg>
  );
}

/** Small poodle head, for avatars and profile rows. */
export function PoodleFaceIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="4.8" cy="12.4" r="2.9" fill={FUR} stroke={FUR_EDGE} strokeWidth="1.2" />
      <circle cx="19.2" cy="12.4" r="2.9" fill={FUR} stroke={FUR_EDGE} strokeWidth="1.2" />
      <circle cx="8.2" cy="5.4" r="2.7" fill={FUR} stroke={FUR_EDGE} strokeWidth="1.2" />
      <circle cx="15.8" cy="5.4" r="2.7" fill={FUR} stroke={FUR_EDGE} strokeWidth="1.2" />
      <circle cx="12" cy="4.4" r="2.9" fill={FUR} stroke={FUR_EDGE} strokeWidth="1.2" />
      <circle cx="12" cy="13" r="7.4" fill={FUR} stroke={FUR_EDGE} strokeWidth="1.3" />
      <path
        d="M5.2 9.4Q12 6.6 18.8 9.4l-.5 2.3Q12 9.1 5.7 11.7z"
        fill={BLUE}
        stroke={BLUE_DEEP}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <circle cx="9.6" cy="13" r="1.2" fill={INK} />
      <circle cx="14.4" cy="13" r="1.2" fill={INK} />
      <ellipse cx="12" cy="16" rx="2.1" ry="1.5" fill="#fff" stroke={FUR_EDGE} strokeWidth="0.9" />
      <ellipse cx="12" cy="15.4" rx="0.9" ry="0.7" fill={INK} />
      <ellipse cx="7.4" cy="15.4" rx="1.3" ry="0.9" fill={BLUSH} opacity="0.85" />
      <ellipse cx="16.6" cy="15.4" rx="1.3" ry="0.9" fill={BLUSH} opacity="0.85" />
    </Svg>
  );
}
