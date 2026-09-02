import { AppProvider } from "@/components/AppContext";
import BottomNav from "@/components/BottomNav";
import NavBar from "@/components/NavBar";
import { requireUser } from "@/lib/auth-guard";
import { listRacesForUser } from "@/lib/db";

// Reads the session cookie, so these routes can't be prerendered.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Single auth gate for /, /goals, and /settings.
  const user = await requireUser();
  const races = await listRacesForUser(user.id);

  return (
    <AppProvider
      user={{
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
      }}
      raceCount={races.length}
    >
      <NavBar />
      {/* Clears the fixed tab bar and the home indicator below it, so the
          last card on a page is never trapped underneath either. */}
      <div className="pb-bottom-nav">{children}</div>
      <BottomNav />
    </AppProvider>
  );
}
