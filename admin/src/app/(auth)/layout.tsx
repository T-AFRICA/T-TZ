import { BrandMark } from "@tronic/ui";

/** Sign-in, second factor and the no-access notice: one centred card, no console chrome. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main-content" className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <BrandMark />
          <span className="border-l border-line-strong pl-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted">Central Admin</span>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-panel sm:p-8">{children}</div>
        <p className="mt-6 text-center text-xs text-muted">Authorised administrators only. Activity in this console is recorded.</p>
      </div>
    </main>
  );
}
