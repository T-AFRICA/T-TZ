import { passwordChecks, passwordStrength } from "@/features/auth/rules";

const LEVEL = {
  empty: { label: "", bars: 0, color: "" },
  weak: { label: "Weak", bars: 1, color: "bg-[var(--color-action-red)]" },
  fair: { label: "Good", bars: 2, color: "bg-[#d97706]" },
  strong: { label: "Strong", bars: 3, color: "bg-[var(--color-success)]" },
} as const;

/**
 * Password requirements checklist plus a three-step strength meter. The
 * checklist states the actual policy (features/auth/rules.ts); the meter is
 * guidance on top of it.
 */
export function PasswordStrength({ id, password }: { id: string; password: string }) {
  const level = LEVEL[passwordStrength(password)];
  return (
    <div id={id} className="-mt-1.5 rounded-lg bg-[var(--surface-card)] px-3 py-2">
      <div className="flex items-center gap-2">
        <div aria-hidden="true" className="flex flex-1 gap-1">
          {[1, 2, 3].map((bar) => (
            <span
              key={bar}
              className={`h-1 flex-1 rounded-full transition-colors duration-200 ${bar <= level.bars ? level.color : "bg-[var(--color-light-grey)]"}`}
            />
          ))}
        </div>
        <span className="min-w-12 text-right text-[11px] font-semibold text-[var(--text-secondary)]" aria-live="polite">
          {level.label ? `Strength: ${level.label}` : ""}
        </span>
      </div>
      <ul className="mt-1.5 grid grid-cols-3 gap-1 text-[11px] sm:text-xs">
        {passwordChecks(password).map((check) => (
          <li key={check.id} className={`flex items-center gap-1.5 ${check.met ? "text-[var(--color-success)]" : "text-[var(--text-secondary)]"}`}>
            <span aria-hidden="true" className="inline-grid h-3.5 w-3.5 place-items-center rounded-full border border-current text-[9px] leading-none">
              {check.met ? "✓" : ""}
            </span>
            {check.label}
            <span className="sr-only">{check.met ? "(met)" : "(not yet)"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
