import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <main id="main-content" className="grid min-h-screen place-items-center px-4">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-ink">Not found</p>
        <h1 className="font-display text-2xl text-ink">There is nothing here for you</h1>
        <p className="text-sm text-muted">The page does not exist, or your account is not allowed to open it.</p>
        <Link href="/" className={buttonClass.primary}>
          Back to the console
        </Link>
      </div>
    </main>
  );
}
