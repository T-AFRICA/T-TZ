import Link from "next/link";
import { buttonClass } from "@/components/ui";

/**
 * Shown inside the console when a page does not exist or the signed-in
 * administrator may not open it. Both look the same on purpose: a refusal
 * does not confirm that a country, a person or a record exists.
 */
export default function ConsoleNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-ink">Not found</p>
      <h1 className="font-display text-2xl text-ink">There is nothing here for you</h1>
      <p className="text-sm text-muted">The page does not exist, or your account is not allowed to open it.</p>
      <Link href="/" className={buttonClass.primary}>
        Back to the overview
      </Link>
    </div>
  );
}
