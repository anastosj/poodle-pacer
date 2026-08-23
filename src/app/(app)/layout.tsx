import { AppProvider } from "@/components/AppContext";
import BottomNav from "@/components/BottomNav";
import NavBar from "@/components/NavBar";
import { requireUser } from "@/lib/auth-guard";

// Reads the session cookie, so these routes can't be prerendered.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Single auth gate for /, /goals, and /settings.
  const user = await requireUser();

  return (
    <AppProvider
      user={{
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
      }}
    >
      <NavBar />
      <div className="pb-20 sm:pb-0">{children}</div>
      <BottomNav />
    </AppProvider>
  );
}
