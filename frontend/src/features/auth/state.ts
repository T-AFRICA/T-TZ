import type { AuthErrorCode } from "./service";

/**
 * Result of an account form's server action, rendered by the form. It
 * travels in the POST response only (never in a URL) and holds no secret:
 * no password, token or session.
 */
export type AuthFormState =
  | { status: "idle" }
  | { status: "error"; code: AuthErrorCode; fieldErrors?: Record<string, string> }
  | { status: "invalid"; fieldErrors: Record<string, string> }
  | { status: "sent"; text: string };

export const IDLE: AuthFormState = { status: "idle" };
