import PoodleSleeping from "@/components/PoodleSleeping";
import {
  BikeIcon,
  BoltIcon,
  IconProps,
  MedalIcon,
  RunIcon,
  SwimIcon,
} from "@/components/Icons";
import { Workout } from "@/lib/programs";

/**
 * The poodle that stands for a kind of workout. Shared so the calendar cell and
 * the next-workout banner always show the same animal for the same session.
 */
const TYPE_ICON: Record<
  Exclude<Workout["type"], "rest">,
  (p: IconProps) => JSX.Element
> = {
  run: RunIcon,
  "run-or-cross": BikeIcon,
  cross: SwimIcon,
  swim: SwimIcon,
  bike: BikeIcon,
  brick: BoltIcon,
  multi: BoltIcon,
  race: MedalIcon,
};

export default function WorkoutIcon({
  type,
  size = 34,
  className,
  onPrimary = false,
}: {
  type: Workout["type"];
  size?: number;
  className?: string;
  /** Rendering on the blue banner rather than the app's pale ground. */
  onPrimary?: boolean;
}) {
  // The sleeping poodle is curled up, so it reads smaller than the others at
  // the same box size and gets a little more room to compensate.
  if (type === "rest") {
    return (
      <PoodleSleeping size={size + 8} className={className} onPrimary={onPrimary} />
    );
  }
  const Icon = TYPE_ICON[type];
  return <Icon size={size} className={className} />;
}
