import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { authConfigured, safeNextPath, supabaseServer } from "@/features/auth/server";

const TYPES: readonly EmailOtpType[] = ["signup", "recovery", "email", "email_change", "invite", "magiclink"];

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
