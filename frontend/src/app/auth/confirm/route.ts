import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { authConfigured, safeNextPath, supabaseServer } from "@/features/auth/server";

/**
 * Only the links this site asks Supabase to send: sign-up confirmation
 * ("signup", or "email" in newer templates) and password reset. A link of
 * any other kind (magic link, invitation, email change) is refused: nothing
 * here sends one, and each would sign whoever opens it into the account of
 * whoever made the link.
 */
const TYPES: readonly EmailOtpType[] = ["signup", "email", "recovery"];

/**
 * Target of the links in Supabase Auth emails (sign-up confirmation and
 * password reset). Exchanges the one-time token for a session cookie, then
 * goes to a same-site page only. The token is Supabase's, from the email,
 * not something the customer typed.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(url.searchParams.get("next"));
  const fail = new URL("/login", url.origin);

  if (!authConfigured() || !tokenHash || !type || !TYPES.includes(type)) {
    return NextResponse.redirect(fail, 303);
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  return NextResponse.redirect(error ? (type === "recovery" ? new URL("/forgot-password", url.origin) : fail) : new URL(next, url.origin), 303);
}
