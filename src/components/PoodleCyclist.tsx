/**
 * The poodle on a bike, for replaying a ride.
 *
 * Drawn to the same 60x44 box as PoodleRunner, with the wheels meeting the
 * ground on the same baseline, so the replay can swap sprites without moving
 * anything. Facing right; the replay flips it when the route heads west.
 * Helmet instead of the running headband, because we are responsible poodles.
 */

export const CYCLIST_WIDTH = 60;
export const CYCLIST_HEIGHT = 44;

/** Ground contact, matching PoodleRunner's paws so the anchor is shared. */
export const CYCLIST_ANCHOR_X = 28;
export const CYCLIST_ANCHOR_Y = 40;

const FUR = "#fdfcf9";
const FUR_EDGE = "#cfc7b7";
const FRAME = "#2f6fed";
const FRAME_DARK = "#1d4ed8";
const METAL = "#3a3630";

/** Eight spokes, drawn once and reused by both wheels. */
function Spokes() {
  return (
    <>
      {[0, 45, 90, 135].map((angle) => (
        <line
          key={angle}
          x1={-6.4}
          y1={0}
          x2={6.4}
          y2={0}
          stroke={METAL}
          strokeWidth="0.7"
          opacity="0.5"
          transform={`rotate(${angle})`}
        />
      ))}
    </>
  );
}

function Wheel({ cx, spinning }: { cx: number; spinning: boolean }) {
  return (
    <g transform={`translate(${cx}, 32)`}>
      <circle r="8" fill="none" stroke={METAL} strokeWidth="2" />
      <g
        className={spinning ? "poodle-wheel" : ""}
        style={{ transformOrigin: "0px 0px" }}
      >
        <Spokes />
      </g>
      <circle r="1.4" fill={METAL} />
    </g>
  );
}

export default function PoodleCyclist({
  riding = true,
}: {
  riding?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 60 44"
      width={CYCLIST_WIDTH}
      height={CYCLIST_HEIGHT}
      overflow="visible"
      aria-hidden="true"
    >
      {/* shadow, so the bike sits on the map rather than over it */}
      <ellipse cx="28" cy="41" rx="17" ry="2.6" fill="#3a3630" opacity="0.18" />

      <Wheel cx={14} spinning={riding} />
      <Wheel cx={42} spinning={riding} />

      {/* frame: down tube, seat tube, chain stay */}
      <path
        d="M 14 32 L 26 32 L 33 20 M 26 32 L 34 20 M 33 20 L 42 32"
        stroke={FRAME}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* handlebars and seat post */}
      <path
        d="M 42 32 L 44 19 L 40 17"
        stroke={FRAME_DARK}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 26 32 L 23 22"
        stroke={FRAME_DARK}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* saddle */}
      <ellipse cx="22" cy="21" rx="4.5" ry="1.8" fill={METAL} />

      {/* crank, turning with the wheels */}
      <g transform="translate(26, 32)">
        <g
          className={riding ? "poodle-crank" : ""}
          style={{ transformOrigin: "0px 0px" }}
        >
          <line
            x1="0"
            y1="-4.5"
            x2="0"
            y2="4.5"
            stroke={METAL}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="0" cy="-4.5" r="1.6" fill={FRAME_DARK} />
          <circle cx="0" cy="4.5" r="1.6" fill={FRAME_DARK} />
        </g>
        <circle r="2.6" fill="none" stroke={METAL} strokeWidth="1.4" />
      </g>

      {/* tail pouf, streaming behind */}
      <g
        className={riding ? "poodle-tail" : ""}
        style={{ transformOrigin: "16px 16px" }}
      >
        <path d="M 18 17 L 11 12" stroke={FUR} strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="10" cy="11" r="4.5" fill={FUR} stroke={FUR_EDGE} strokeWidth="1.5" />
      </g>

      {/* back legs, reaching the pedals and turning with them */}
      <g transform="translate(26, 32)">
        <g
          className={riding ? "poodle-crank" : ""}
          style={{ transformOrigin: "0px 0px" }}
        >
          {/* Counter-rotated so the paw stays flat while the crank goes round. */}
          <g transform="translate(0, -4.5)">
            <path
              d="M -4 -10 L 0 0"
              stroke={FUR}
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
          </g>
          <g transform="translate(0, 4.5)">
            <path
              d="M -4 -10 L 0 0"
              stroke={FUR}
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
              opacity="0.85"
            />
          </g>
        </g>
      </g>

      {/* body, leaning forward into the ride */}
      <ellipse
        cx="27"
        cy="18"
        rx="10"
        ry="6.5"
        fill={FUR}
        stroke={FUR_EDGE}
        strokeWidth="1.5"
        transform="rotate(-12 27 18)"
      />
      {/* chest pouf */}
      <circle cx="35" cy="15" r="6" fill={FUR} stroke={FUR_EDGE} strokeWidth="1.5" />

      {/* front paw down to the bars */}
      <path
        d="M 36 16 L 41 18"
        stroke={FUR}
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />

      {/* neck and head */}
      <path d="M 37 12 L 42 8" stroke={FUR} strokeWidth="6.5" strokeLinecap="round" />
      <ellipse cx="45" cy="7" rx="7.5" ry="6.5" fill={FUR} stroke={FUR_EDGE} strokeWidth="1.5" />
      {/* muzzle */}
      <ellipse cx="52.5" cy="8" rx="4.8" ry="3.2" fill="#fff" stroke={FUR_EDGE} strokeWidth="1.2" />
      <circle cx="56.4" cy="7.6" r="1.7" fill="#3a3630" />
      {/* tongue, because downhill is the best part */}
      <path
        className={riding ? "poodle-tongue" : ""}
        d="M 53.5 10.4 Q 55.5 13.8 52 13.3"
        fill="#f19bb4"
        stroke="#e57697"
        strokeWidth="1"
        strokeLinejoin="round"
        style={{ transformOrigin: "53.5px 10.4px" }}
      />

      {/* helmet: shell, brim, and strap */}
      <path
        d="M 37.5 5 Q 45 -4 52 4 L 52 5.5 Q 45 1 38 7 Z"
        fill={FRAME}
        stroke={FRAME_DARK}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M 40 2.5 Q 45 -1.5 49.5 2"
        stroke="#fff"
        strokeWidth="1.1"
        opacity="0.55"
        fill="none"
        strokeLinecap="round"
      />
      {/* vents */}
      <path d="M 42 1.5 L 43.5 4" stroke={FRAME_DARK} strokeWidth="0.9" strokeLinecap="round" />
      <path d="M 46 0.8 L 47 3.6" stroke={FRAME_DARK} strokeWidth="0.9" strokeLinecap="round" />
      {/* chin strap */}
      <path
        d="M 40 7 L 42.5 12"
        stroke={FRAME_DARK}
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />

      {/* ear, flapping under the helmet */}
      <g
        className={riding ? "poodle-ear" : ""}
        style={{ transformOrigin: "41px 8px" }}
      >
        <ellipse cx="40.5" cy="11" rx="4" ry="5.5" fill={FUR} stroke={FUR_EDGE} strokeWidth="1.5" />
      </g>
      {/* eye */}
      <circle cx="48.5" cy="6.5" r="1.5" fill="#3a3630" />
      <circle cx="49" cy="5.9" r="0.55" fill="#fff" />
    </svg>
  );
}
