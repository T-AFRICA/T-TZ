import { NextResponse } from "next/server";
import { createAccountService } from "@/features/account/service";
import { currentUser } from "@/features/auth/server";

/**
 * GET /api/account/notifications/unread — how many of the signed-in
 * customer's notifications are unread, for the bell in the header.
 *
 * The answer is a number about the caller's own account and nothing else:
 * the customer comes from the verified session, there is no parameter to
 * ask about another account, and a signed-out caller gets 0 (not an error,
 * so the response does not say whether a session exists beyond what the
 * caller already knows). Never cached.
 */
export const dynamic = "force-dynamic";

const answer = (unread: number) => NextResponse.json({ unread }, { headers: { "Cache-Control": "private, no-store" } });

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return answer(0);
    return answer(await createAccountService(user).countUnreadNotifications());
  } catch (error) {
    // The badge is a convenience: a database that is down shows no badge. Logged without the customer.
    console.error("account: unread notification count failed", (error as { code?: unknown } | null)?.code ?? "unknown");
    return answer(0);
  }
}
