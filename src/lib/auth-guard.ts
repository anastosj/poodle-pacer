import "server-only";
import { redirect } from "next/navigation";
import { UserRecord, findUser } from "@/lib/db";
import { currentUserId } from "@/lib/session";

/**
 * The auth boundary for every signed-in page. Verifies the session signature
 * and that the user still exists, or sends them to the login screen.
 */
export async function requireUser(): Promise<UserRecord> {
  const id = currentUserId();
  if (!id) redirect("/login");

  const user = await findUser(id);
  if (!user) redirect("/login");

  return user;
}
