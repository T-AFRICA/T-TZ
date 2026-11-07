import Link from "next/link";
import { HomeIcon, ShieldCheckIcon, TruckIcon } from "@tronic/ui";
import { POLICY_LINKS } from "@/config/site";

function policyHref(label: string): string {
  return POLICY_LINKS.find((link) => link.label === label)?.href ?? "/help";
}

/**
 * Three service promises under the category rail (owner request 2026-11-07,
 * after the oraimo reference). Copy makes no price or threshold claim (owner
 * choice 2026-11-07: "Fast Delivery" rather than a free-delivery line) and
 * each item links to the policy page that will carry the real terms.
 */
const BENEFITS = [
  { icon: TruckIcon, label: "Fast Delivery", href: policyHref("Delivery Information") },
  { icon: HomeIcon, label: "Home Delivery", href: policyHref("Delivery Information") },
  { icon: ShieldCheckIcon, label: "Hassle-Free Warranty", href: policyHref("Warranty Policy") },
] as const;

export function BenefitsStrip() {
  return (
    <section aria-label="Why shop with TRONIC" className="mt-3 md:mt-8">
      {/* Icon beside its label at every size: three tight columns on phones, one
          quiet row from md. */}
      <ul className="grid grid-cols-3 gap-1.5 rounded-2xl bg-white px-2.5 py-3 shadow-[0_2px_10px_rgba(17,17,17,0.05)] md:flex md:justify-around md:gap-6 md:border md:border-[var(--color-light-grey)] md:px-6 md:py-4 md:shadow-none">
        {BENEFITS.map(({ icon: Icon, label, href }) => (
          <li key={label} className="min-w-0">
            <Link
              href={href}
              className="group flex items-center gap-1.5 text-left text-[11px] font-medium leading-tight text-[var(--text-primary)] transition-colors hover:text-[var(--color-action-red)] md:gap-3 md:text-sm"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--surface-card)] text-[var(--color-dark-grey)] transition-colors group-hover:text-[var(--color-action-red)] md:h-10 md:w-10 [&>svg]:md:h-5 [&>svg]:md:w-5">
                <Icon size={16} />
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
