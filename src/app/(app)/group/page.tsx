import RaceView from "@/components/RaceView";
import RaceSetup from "@/components/RaceSetup";
import { notFound } from "next/navigation";
import { PawIcon } from "@/components/Icons";
import { requireUser } from "@/lib/auth-guard";
import { getRaceMember, listRacesForUser } from "@/lib/db";
import { raceLeaderboard } from "@/lib/group";

export const dynamic = "force-dynamic";

export default async function Group({
  searchParams,
}: {
  searchParams: { race?: string };
}) {
  const user = await requireUser();
  const races = await listRacesForUser(user.id);
  const selected = searchParams.race
    ? races.find((race) => race.id === searchParams.race)
    : races[0];
  if (searchParams.race && !selected) notFound();
  const membership = selected
    ? await getRaceMember(selected.id, user.id)
    : null;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <PawIcon size={26} />
          The Pack
        </h1>
        <p className="mt-1 text-sm text-foreground/60">
          Train solo or share progress with a pack you choose.
        </p>
        {!selected ? (
          <div className="mt-6 rounded-pouf bg-poodle-white p-6 ring-1 ring-poodle-fur pouf-shadow">
            <p className="text-sm text-foreground/70">
              Solo training works fine on its own. Start a pack or join one with
              an invite code whenever you&apos;re ready.
            </p>
            <RaceSetup />
          </div>
        ) : !membership ? (
          notFound()
        ) : (
          <RaceView
            race={selected}
            races={races}
            summaries={(await raceLeaderboard(selected.id, user.id)) ?? []}
            membership={membership}
            currentUserId={user.id}
          />
        )}
      </div>
    </main>
  );
}
