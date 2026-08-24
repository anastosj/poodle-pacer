import { NextRequest, NextResponse } from "next/server";
import { issueOAuthState } from "@/lib/session";
import { LOGIN_SCOPE, stravaConfigured } from "@/lib/strava";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Kicks off "Sign in with Strava". */
export function GET(request: NextRequest) {
  if (!stravaConfigured()) {
    return NextResponse.redirect(
      new URL("/login?error=not_configured", request.url)
    );
  }

  const authorizeUrl = new URL("https://www.strava.com/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", process.env.STRAVA_CLIENT_ID!);
  authorizeUrl.searchParams.set(
    "redirect_uri",
    new URL("/api/auth/callback", request.url).toString()
  );
  authorizeUrl.searchParams.set("response_type", "code");
  // `force` re-shows the consent screen, needed when someone declined the
  // activity scope and wants to grant it after all.
  authorizeUrl.searchParams.set(
    "approval_prompt",
    request.nextUrl.searchParams.get("force") ? "force" : "auto"
  );
  authorizeUrl.searchParams.set("scope", LOGIN_SCOPE);
  // Random nonce bound to this browser, verified on the way back.
  authorizeUrl.searchParams.set(
    "state",
    issueOAuthState(request.nextUrl.searchParams.get("next") ?? undefined)
  );

  return NextResponse.redirect(authorizeUrl);
}
