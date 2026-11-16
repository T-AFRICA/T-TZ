/** The result a server action hands back to its form. Plain data: safe to import from client components. */
export interface FormState {
  status: "idle" | "ok" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
}

export const IDLE: FormState = { status: "idle" };
