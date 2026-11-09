import Link from "next/link";
import { HomeIcon, ShieldCheckIcon, TruckIcon } from "@tronic/ui";
import { POLICY_LINKS } from "@/config/site";

function policyHref(label: string): string {
  return POLICY_LINKS.find((link) => link.label === label)?.href ?? "/help";
}

/**
 * Three service promises directly under the hero (owner request 2026-11-07,
 * after the oraimo reference; moved above the category banners 2026-11-09).
 * Copy makes no price or threshold claim (owner choice 2026-11-07: "Fast
 * Delivery" rather than a free-delivery line) and each item links to the
 * policy page that will carry the real terms.
 */
const BENEFITS = [
  { icon: TruckIcon, label: "Fast Delivery", href: policyHref("Delivery Information") },
  { icon: HomeIcon, label: "Home Delivery", href: policyHref("Delivery Information") },
  { icon: ShieldCheckIcon, label: "Hassle-Free Warranty", href: policyHref("Warranty Policy") },
] as const;

export function BenefitsStrip() {
  return (
    <section aria-label="Why shop with TRONIC">
      {/* Icon beside its label, one line each, at every size. Phones: one row that
          scrolls inside the strip if a narrow screen cannot fit all three (the
          page itself never scrolls sideways; below 360px the icons step out so
          the three labels fit); md+: one quiet row. */}
      <ul className="flex items-center justify-between gap-3 overflow-x-auto whitespace-nowrap rounded-2xl bg-white px-3 py-2.5 shadow-[0_2px_10px_rgba(17,17,17,0.05)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:justify-around md:gap-6 md:overflow-visible md:border md:border-[var(--color-light-grey)] md:px-6 md:py-4 md:shadow-none">
        {BENEFITS.map(({ icon: Icon, label, href }) => (
          <li key={label} className="shrink-0">
            <Link
              href={href}
              className="group flex items-center gap-1.5 text-[10px] font-medium leading-none text-[var(--text-primary)] transition-colors hover:text-[var(--color-action-red)] md:gap-3 md:text-sm"
            >
              <span className="grid shrink-0 place-items-center text-[var(--color-dark-grey)] max-[359px]:hidden transition-colors group-hover:text-[var(--color-action-red)] md:h-10 md:w-10 md:rounded-full md:bg-[var(--surface-card)] [&>svg]:md:h-5 [&>svg]:md:w-5">
                <Icon size={15} />
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
