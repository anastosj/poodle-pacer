import { PoodleFaceIcon, RosetteIcon } from "@/components/Icons";
import { RunnerSummary } from "@/lib/group";

function Avatar({ summary }: { summary: RunnerSummary }) {
  if (summary.avatarUrl) {
    return (
      // Strava avatars are remote URLs; next/image would need host allowlisting.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={summary.avatarUrl}
        alt=""
        className="h-11 w-11 shrink-0 rounded-full border-2 border-outline object-cover"
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
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-outline bg-primary text-sm font-bold text-white">
      {initials}
    </span>
  );
}

/**
 * The pack's one ranking number: how much of this week's plan is done. Weekly
 * rather than whole-plan, so a rough week costs a week and not a season, and
 * everyone starts level again on Monday.
 */
function ConsistencyBar({ value, due }: { value: number; due: number }) {
  const pct = Math.round(value * 100);
  const nothingDue = due === 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-meta">
        <span className="font-medium text-ink-soft">
          This week&apos;s consistency
        </span>
        <span className="font-bold tabular-nums text-primary-dark">
          {nothingDue ? "Nothing due yet" : `${pct}%`}
        </span>
      </div>
      <div className="mt-1 h-4 overflow-hidden border-2 border-outline bg-lilac">
        <div
          className="h-full border-r-2 border-outline bg-primary transition-all"
          style={{ width: `${nothingDue ? 0 : Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-title tabular-nums text-ink">
        {value}
      </div>
      <div className="text-meta font-medium text-ink-soft">{label}</div>
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
  // Ranking is weekly, so early in the week everyone sits at zero. A rosette
  // for having run nothing yet is worth less than no rosette at all.
  const place =
    summary.started && summary.weekCompleted > 0 && rank < 3
      ? ((rank + 1) as 1 | 2 | 3)
      : null;

  return (
    <li
      className={`rounded-sm border-3 border-outline bg-surface p-4 shadow-card pouf-lift ${
        isMe ? "bg-highlight" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <Avatar summary={summary} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-extrabold">{summary.name}</span>
            {isMe && (
              <span className="rounded-full border-2 border-outline bg-ink px-2 py-0.5 text-meta font-bold text-background">
                You
              </span>
            )}
            {place && <RosetteIcon place={place} size={17} title={`#${place}`} />}
          </div>
          <div className="truncate text-meta text-ink-soft">
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
            <div className="font-display text-title tabular-nums text-primary-dark">
              {summary.daysToRace}
            </div>
            <div className="text-meta font-medium text-ink-soft">
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
            <ConsistencyBar
              value={summary.weekConsistency}
              due={summary.weekDue}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label="Miles this week" value={`${summary.weekMiles}`} />
            <Stat label="Plan miles" value={`${summary.miles}`} />
            <Stat
              label="Plan workouts"
              value={`${summary.completed}/${summary.scheduled}`}
            />
          </div>
        </>
      ) : (
        <p className="mt-3 rounded-sm border-2 border-outline bg-lilac px-3 py-2 text-meta text-ink-soft">
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
      <p className="mt-6 rounded-sm border-3 border-outline bg-surface p-6 text-center type-body text-ink-soft">
        <PoodleFaceIcon size={60} className="mx-auto mb-3" />
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
        <div className="rounded-sm border-3 border-outline bg-primary p-4 text-center text-white shadow-card">
          <div className="font-display text-title tabular-nums">
            {summaries.length}
          </div>
          <div className="text-meta font-medium text-white/75">
            {summaries.length === 1 ? "runner" : "runners"}
          </div>
        </div>
        <div className="rounded-sm border-3 border-outline bg-surface p-4 text-center shadow-card">
          <div className="font-display text-title tabular-nums text-primary">
            {weekMiles}
          </div>
          <div className="text-meta font-medium text-ink-soft">
            miles this week
          </div>
        </div>
        <div className="rounded-sm border-3 border-outline bg-surface p-4 text-center shadow-card">
          <div className="font-display text-title tabular-nums text-primary">
            {totalMiles}
          </div>
          <div className="text-meta font-medium text-ink-soft">
            total miles
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
