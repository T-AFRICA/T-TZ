import { WhiteMark } from "@/components/brand";

/**
 * Sign-in, second factor and the no-access notice, in the TRONIC sign-in
 * style (owner request 2026-11-19, after the token desk): a red brand panel
 * with the white wordmark and rings radiating from the sun, and the form
 * on a white sheet. Desktop: panel and form side by side. Phones: a short
 * red header, the form on a sheet that overlaps it, and a red band below.
 * No notes (owner request): the wordmark, "Admin" and the form only. The
 * rings and the entrance are decoration and stop under reduced motion.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main-content" className="auth-split">
      <section className="auth-brand">
        <div className="auth-wordmark">
          <WhiteMark className="auth-logo" />
          <span>Admin</span>
        </div>
        <div className="auth-foot">
          <span>Tronic Tanzania · Dar es Salaam</span>
        </div>
        <div className="auth-radiate" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </section>

      <section className="auth-form-wrap">
        <div className="auth-card">{children}</div>
      </section>

      <footer className="auth-band">Tronic Tanzania · Dar es Salaam</footer>
    </main>
  );
}
