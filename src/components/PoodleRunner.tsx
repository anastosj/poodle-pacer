/**
 * The poodle, side on and mid-stride, for the route replay.
 *
 * The existing mascot is a front-facing head, which cannot run anywhere. This
 * one is drawn in profile facing right; the replay flips it horizontally when
 * the route heads west. Legs, ears and tail are animated in CSS so the browser
 * keeps them going without a React render per frame.
 */

export const RUNNER_WIDTH = 60;
export const RUNNER_HEIGHT = 44;

export default function PoodleRunner({ running = true }: { running?: boolean }) {
  const stride = running ? "poodle-stride" : "";
  const fur = "#fdfcf9";
  const furEdge = "#cfc7b7";

  return (
    <svg
      viewBox="0 0 60 44"
      width={RUNNER_WIDTH}
      height={RUNNER_HEIGHT}
      overflow="visible"
      aria-hidden="true"
    >
      {/* shadow on the ground, so the poodle sits on the map rather than over it */}
      <ellipse cx="28" cy="41" rx="15" ry="3" fill="#3a3630" opacity="0.18" />

      <g className={running ? "poodle-bob" : ""}>
        {/* back legs */}
        <g className={stride} style={{ animationDelay: "-0.18s" }}>
          <path
            d="M 15 27 L 11 36 L 15 39"
            stroke={fur}
            strokeWidth="4.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 15 27 L 11 36 L 15 39"
            stroke={furEdge}
            strokeWidth="1"
            strokeLinecap="round"
            fill="none"
            opacity="0.6"
          />
        </g>
        {/* front legs */}
        <g className={stride} style={{ animationDelay: "-0.36s" }}>
          <path
            d="M 36 26 L 40 35 L 36 39"
            stroke={fur}
            strokeWidth="4.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 36 26 L 40 35 L 36 39"
            stroke={furEdge}
            strokeWidth="1"
            strokeLinecap="round"
            fill="none"
            opacity="0.6"
          />
        </g>

        {/* tail pouf */}
        <g className={running ? "poodle-tail" : ""} style={{ transformOrigin: "12px 20px" }}>
          <path d="M 14 21 L 7 14" stroke={fur} strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="6" cy="12" r="5" fill={fur} stroke={furEdge} strokeWidth="1.5" />
        </g>

        {/* body */}
        <ellipse cx="24" cy="24" rx="14" ry="9" fill={fur} stroke={furEdge} strokeWidth="1.5" />
        {/* chest pouf, the poodle silhouette in one circle */}
        <circle cx="34" cy="24" r="7.5" fill={fur} stroke={furEdge} strokeWidth="1.5" />

        {/* front legs, near side, one stride out of phase */}
        <g className={stride}>
          <path
            d="M 33 27 L 36 36 L 32 39"
            stroke={fur}
            strokeWidth="4.5"
            strokeLinecap="round"
            fill="none"
          />
        </g>
        {/* back legs, near side */}
        <g className={stride} style={{ animationDelay: "-0.27s" }}>
          <path
            d="M 18 27 L 16 36 L 20 39"
            stroke={fur}
            strokeWidth="4.5"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        {/* neck and head */}
        <path d="M 37 20 L 43 14" stroke={fur} strokeWidth="7" strokeLinecap="round" />
        <ellipse cx="46" cy="12" rx="8" ry="7" fill={fur} stroke={furEdge} strokeWidth="1.5" />
        {/* muzzle */}
        <ellipse cx="54" cy="13" rx="5" ry="3.5" fill="#fff" stroke={furEdge} strokeWidth="1.2" />
        <circle cx="58" cy="12.5" r="1.8" fill="#3a3630" />
        {/* tongue, because this is a happy run */}
        <path
          className={running ? "poodle-tongue" : ""}
          d="M 55 15.5 Q 57 19 53.5 18.5"
          fill="#f19bb4"
          stroke="#e57697"
          strokeWidth="1"
          strokeLinejoin="round"
          style={{ transformOrigin: "55px 15.5px" }}
        />
        {/* top pouf */}
        <circle cx="43" cy="5" r="5" fill={fur} stroke={furEdge} strokeWidth="1.5" />
        <circle cx="49" cy="5.5" r="4" fill={fur} stroke={furEdge} strokeWidth="1.5" />
        {/* headband */}
        <path
          d="M 39 9 Q 46 5 53 10 L 52 13 Q 46 8 39 12 Z"
          fill="#2f6fed"
          stroke="#1d4ed8"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {/* ear, flapping */}
        <g className={running ? "poodle-ear" : ""} style={{ transformOrigin: "43px 12px" }}>
          <ellipse cx="42" cy="16" rx="4.5" ry="6" fill={fur} stroke={furEdge} strokeWidth="1.5" />
        </g>
        {/* eye */}
        <circle cx="50" cy="11" r="1.6" fill="#3a3630" />
        <circle cx="50.5" cy="10.4" r="0.6" fill="#fff" />
      </g>
    </svg>
  );
}
