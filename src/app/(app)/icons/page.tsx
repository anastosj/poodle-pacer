import PoodleSleeping from "@/components/PoodleSleeping";
import {
  BellIcon,
  BikeIcon,
  BoltIcon,
  BoneIcon,
  CalendarIcon,
  ChartIcon,
  CheckBadgeIcon,
  CheckIcon,
  ChevronIcon,
  ConfettiIcon,
  FinishFlagIcon,
  FlameIcon,
  HomeIcon,
  MedalIcon,
  MoodIcon,
  PawIcon,
  PencilIcon,
  PhoneIcon,
  PoodleFaceIcon,
  RosetteIcon,
  RunIcon,
  SettingsIcon,
  StarIcon,
  SwimIcon,
  TargetIcon,
} from "@/components/Icons";

/**
 * A contact sheet of every icon, for judging the artwork on its own rather
 * than at the size it happens to appear in a calendar cell. Each icon is shown
 * large enough to see the linework and small enough to check it still reads.
 */

const CHARACTERS = [
  { name: "Rest", node: <PoodleSleeping size={120} /> },
  { name: "Run", node: <RunIcon size={120} /> },
  { name: "Bike", node: <BikeIcon size={120} /> },
  { name: "Swim", node: <SwimIcon size={120} /> },
  { name: "Poodle face", node: <PoodleFaceIcon size={120} /> },
  { name: "Mood: good", node: <MoodIcon mood="good" size={120} /> },
  { name: "Mood: okay", node: <MoodIcon mood="medium" size={120} /> },
  { name: "Mood: rough", node: <MoodIcon mood="bad" size={120} /> },
  { name: "Paw", node: <PawIcon size={120} /> },
];

const OBJECTS = [
  { name: "Bone", node: <BoneIcon size={120} /> },
  { name: "Rosette", node: <RosetteIcon size={120} /> },
  { name: "Medal", node: <MedalIcon size={120} /> },
  { name: "Finish flag", node: <FinishFlagIcon size={120} /> },
  { name: "Star", node: <StarIcon size={120} /> },
  { name: "Confetti", node: <ConfettiIcon size={120} /> },
  { name: "Flame", node: <FlameIcon size={120} /> },
  { name: "Target", node: <TargetIcon size={120} /> },
];

const UI = [
  { name: "Home", node: <HomeIcon size={120} /> },
  { name: "Settings", node: <SettingsIcon size={120} /> },
  { name: "Chart", node: <ChartIcon size={120} /> },
  { name: "Calendar", node: <CalendarIcon size={120} /> },
  { name: "Bell", node: <BellIcon size={120} /> },
  { name: "Phone", node: <PhoneIcon size={120} /> },
  { name: "Bolt", node: <BoltIcon size={120} /> },
  { name: "Check", node: <CheckIcon size={120} /> },
  { name: "Check badge", node: <CheckBadgeIcon size={120} /> },
  { name: "Pencil", node: <PencilIcon size={120} /> },
  { name: "Chevron", node: <ChevronIcon size={120} /> },
];

/** The same icon at the sizes it actually ships at, to catch detail that muddies. */
const SIZES = [56, 40, 28, 20, 14];

function Sheet({
  title,
  items,
}: {
  title: string;
  items: { name: string; node: React.ReactNode }[];
}) {
  return (
    <section className="mt-8">
      <h2 className="text-meta font-bold uppercase tracking-wide text-ink-soft">
        {title}
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.name}
            className="flex flex-col items-center gap-2 rounded-sm border-2 border-outline bg-surface p-4"
          >
            <div className="flex h-[120px] items-center justify-center">
              {item.node}
            </div>
            <span className="text-meta font-bold text-ink-soft">
              {item.name}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function IconsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="type-display">Icon sheet</h1>
      <p className="mt-1 text-body text-ink-soft">
        Every piece of artwork on the app background, for checking linework and
        that each one still reads once it shrinks.
      </p>

      <section className="mt-8">
        <h2 className="text-meta font-bold uppercase tracking-wide text-ink-soft">
          Shipping sizes
        </h2>
        <div className="mt-3 space-y-2">
          {[
            { name: "Rest", render: (s: number) => <PoodleSleeping size={s} /> },
            { name: "Run", render: (s: number) => <RunIcon size={s} /> },
            { name: "Bike", render: (s: number) => <BikeIcon size={s} /> },
            { name: "Swim", render: (s: number) => <SwimIcon size={s} /> },
            { name: "Bone", render: (s: number) => <BoneIcon size={s} /> },
          ].map((row) => (
            <div
              key={row.name}
              className="flex items-center gap-5 rounded-sm border-2 border-outline bg-surface px-4 py-3"
            >
              <span className="w-16 shrink-0 text-meta font-bold text-ink-soft">
                {row.name}
              </span>
              {SIZES.map((s) => (
                <div
                  key={s}
                  className="flex h-14 w-14 shrink-0 items-center justify-center"
                >
                  {row.render(s)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <Sheet title="Characters" items={CHARACTERS} />
      <Sheet title="Rewards and objects" items={OBJECTS} />
      <Sheet title="Interface" items={UI} />
    </div>
  );
}
