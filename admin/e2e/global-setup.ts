import { PORTS } from "./ports";
import { startStack } from "./support/stack";

/**
 * TEST ONLY. Starts the disposable admin database and the account-service
 * stand-in for the run (support/stack.ts) and hands the tests what the
 * synthetic accounts sign in with. Nothing here touches Supabase or any
 * shared system.
 */
export default async function globalSetup() {
  const stack = await startStack(PORTS);
  process.env.E2E_ADMIN_SIGN_IN = stack.secret;
  return stack.stop;
}
