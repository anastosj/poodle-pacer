import { PoodleFaceIcon, RosetteIcon } from "@/components/Icons";
import { RunnerSummary } from "@/lib/group";
import { formatPacePerMile } from "@/lib/pace";

function Avatar({ summary }: { summary: RunnerSummary }) {
  if (summary.avatarUrl) {
    return (
      // Strava avatars are remote URLs; next/image would need host allowlisting.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={summary.avatarUrl}
        alt=""
        className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-poodle-fur"
      />
    );
  }
  const initials = summary.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  if (!initials) return <PoodleFaceIcon size={44} className="shrink-0" />;
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-headband text-sm font-bold text-white">
      {initials}
    </span>
  );
}

/** Consistency bar: the headline number, since plans differ in length. */
function ConsistencyBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="font-medium text-foreground/55">Consistency</span>
        <span className="font-bold tabular-nums text-headband-dark">{pct}%</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-poodle-cream ring-1 ring-poodle-fur">
        <div
          className="h-full rounded-full bg-headband transition-all"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm font-extrabold tabular-nums text-foreground/85">
        {value}
      </div>
      <div className="text-[10px] font-medium text-foreground/50">{label}</div>
    </div>
  );
}

function RunnerCard({
  summary,
  rank,
  isMe,
}: {
  summary: RunnerSummary;
  rank: number;
  isMe: boolean;
}) {
  const place = summary.started && rank < 3 ? ((rank + 1) as 1 | 2 | 3) : null;

  return (
    <li
      className={`rounded-pouf bg-poodle-white p-4 ring-1 pouf-shadow pouf-lift ${
        isMe ? "ring-2 ring-headband" : "ring-poodle-fur"
      }`}
    >
      <div className="flex items-center gap-3">
        <Avatar summary={summary} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-extrabold">{summary.name}</span>
            {isMe && (
              <span className="rounded-full bg-headband px-2 py-0.5 text-[9px] font-bold text-white">
                You
              </span>
            )}
            {place && <RosetteIcon place={place} size={17} title={`#${place}`} />}
          </div>
          <div className="truncate text-xs text-foreground/55">
            {summary.followingAlong ? (
              "Following along · stats private"
            ) : summary.started ? (
              <>
                {summary.raceName}
                {summary.currentWeek
                  ? ` · Week ${summary.currentWeek} of ${summary.totalWeeks}`
                  : " · starts soon"}
              </>
            ) : (
              "Hasn't set a race date yet"
            )}
          </div>
        </div>
        {summary.daysToRace !== null && (
          <div className="shrink-0 text-right">
            <div className="text-lg font-extrabold tabular-nums text-headband-dark">
              {summary.daysToRace}
            </div>
            <div className="text-[10px] font-medium text-foreground/50">
              days to race
            </div>
          </div>
        )}
      </div>

      {summary.followingAlong ? (
        <p className="mt-3 rounded-xl bg-poodle-cream px-3 py-2 text-xs text-foreground/60">
          Following along with the pack without sharing training stats.
        </p>
      ) : summary.started ? (
        <>
          <div className="mt-3">
            <ConsistencyBar value={summary.consistency} />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            <Stat
              label="This week"
              value={`${summary.weekMiles} mi`}
            />
            <Stat label="Total miles" value={`${summary.miles}`} />
            <Stat
              label="Workouts"
              value={`${summary.completed}/${summary.scheduled}`}
            />
            <Stat
              label="Avg pace"
              value={formatPacePerMile(summary.avgPace)}
            />
          </div>
        </>
      ) : (
        <p className="mt-3 rounded-xl bg-poodle-cream px-3 py-2 text-xs text-foreground/60">
          Once {summary.name.split(" ")[0]} picks a race date, their progress
          shows up here.
        </p>
      )}
    </li>
  );
}

export default function GroupBoard({
  summaries,
  currentUserId,
}: {
  summaries: RunnerSummary[];
  currentUserId: string;
}) {
  if (summaries.length === 0) {
    return (
      <p className="mt-6 rounded-pouf bg-poodle-white p-6 text-center text-sm text-foreground/60 ring-1 ring-poodle-fur">
        No runners yet. Share the link and get the family signed up.
      </p>
    );
  }

  const started = summaries.filter((s) => s.started);
  const totalMiles =
    Math.round(started.reduce((sum, s) => sum + s.miles, 0) * 10) / 10;
  const weekMiles =
    Math.round(started.reduce((sum, s) => sum + s.weekMiles, 0) * 10) / 10;

  return (
    <>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-pouf bg-headband p-4 text-center text-white pouf-shadow">
          <div className="text-xl font-extrabold tabular-nums">
            {summaries.length}
          </div>
          <div className="text-[11px] font-medium text-white/75">
            {summaries.length === 1 ? "runner" : "runners"}
          </div>
        </div>
        <div className="rounded-pouf bg-poodle-white p-4 text-center ring-1 ring-poodle-fur pouf-shadow">
          <div className="text-xl font-extrabold tabular-nums text-headband-dark">
            {weekMiles}
          </div>
          <div className="text-[11px] font-medium text-foreground/55">
            miles this week
          </div>
        </div>
        <div className="rounded-pouf bg-poodle-white p-4 text-center ring-1 ring-poodle-fur pouf-shadow">
          <div className="text-xl font-extrabold tabular-nums text-headband-dark">
            {totalMiles}
          </div>
          <div className="text-[11px] font-medium text-foreground/55">
            miles together
          </div>
        </div>
      </div>

      <ul className="mt-4 space-y-3">
        {summaries.map((s, i) => (
          <RunnerCard
            key={s.userId}
            summary={s}
            rank={i}
            isMe={s.userId === currentUserId}
          />
        ))}
      </ul>
    </>
  );
}
