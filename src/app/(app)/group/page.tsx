import GroupBoard from "@/components/GroupBoard";
import { requireUser } from "@/lib/auth-guard";
import { groupSummaries } from "@/lib/group";

export const dynamic = "force-dynamic";

export default async function Group() {
  const user = await requireUser();
  const summaries = await groupSummaries();

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-2xl font-extrabold tracking-tight">
          👟 The Pack
        </h1>
        <p className="mt-1 text-sm text-foreground/60">
          Everyone training right now, most consistent first.
        </p>
        <GroupBoard summaries={summaries} currentUserId={user.id} />
      </div>
    </main>
  );
}
