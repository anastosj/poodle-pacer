import Link from "next/link";
import { redirect } from "next/navigation";
import { findRaceByInviteCode, getRaceMember } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { fromISO } from "@/lib/dates";
import { programs } from "@/lib/programs";
import JoinConfirm from "@/components/JoinConfirm";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  params,
}: {
  params: { code: string };
}) {
  const race = await findRaceByInviteCode(params.code);
  if (!race) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <p className="rounded-pouf bg-poodle-white p-6 text-center ring-1 ring-poodle-fur">
          Invite not found.
        </p>
      </main>
    );
  }
  const userId = currentUserId();
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent(`/join/${params.code}`)}`);
  }
  const member = await getRaceMember(race.id, userId);

  // Only offer the pack's plan when it is a program we still ship and the
  // owner actually set dates; otherwise the invite is just an invite.
  const program = programs.find((p) => p.id === race.programId);
  const packPlan =
    program && race.startDate
      ? {
          programName: `${program.author}'s ${program.name}`,
          startLabel: fromISO(race.startDate).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          }),
        }
      : null;

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="rounded-pouf bg-poodle-white p-6 text-center ring-1 ring-poodle-fur pouf-shadow">
        <h1 className="text-xl font-extrabold">Join {race.name}?</h1>
        <p className="mt-2 text-sm text-foreground/60">
          {member
            ? "You are already a member of this race."
            : "You can share your stats later, or follow along privately."}
        </p>
        {member ? (
          <Link
            href="/group"
            className="mt-5 inline-block rounded-full bg-headband px-5 py-2 text-sm font-bold text-white"
          >
            Open the pack
          </Link>
        ) : (
          <JoinConfirm code={params.code} packPlan={packPlan} />
        )}
      </div>
    </main>
  );
}
