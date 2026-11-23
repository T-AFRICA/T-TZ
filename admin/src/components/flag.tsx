import type { ReactNode } from "react";
import { CD, CG, KE, RW, TZ, UG } from "country-flag-icons/react/3x2";
import { GlobeIcon } from "@tronic/ui";

/**
 * A country's flag beside its name, drawn as an SVG (country-flag-icons,
 * MIT): Windows shows flag emoji as two letters, so an emoji is not used.
 *
 * The flag comes from the country's confirmed ISO code in the Central
 * Admin's own record, never from its name. A country whose code is not
 * confirmed (Congo: it is not yet known which Congo) or is not in the list
 * below gets a neutral globe, never a guessed flag. Decorative: the name
 * is always written next to it, so screen readers skip the picture.
 */
type Flag = (props: { className?: string; "aria-hidden"?: boolean; focusable?: "false" }) => ReactNode;

/** The countries TRONIC lists, and both Congos for when the owner confirms which one. */
const FLAGS: Record<string, Flag> = { TZ, KE, UG, RW, CD, CG };

export function hasFlag(isoCode: string | null | undefined): boolean {
  return typeof isoCode === "string" && Object.hasOwn(FLAGS, isoCode.toUpperCase());
}

export function CountryFlag({ isoCode, size = "md" }: { isoCode: string | null | undefined; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-3.5 w-[1.3125rem]" : "h-[1.125rem] w-[1.6875rem]";
  const frame = `inline-block shrink-0 overflow-hidden rounded-[3px] ring-1 ring-line ${box}`;
  const Picture = hasFlag(isoCode) ? FLAGS[(isoCode as string).toUpperCase()] : undefined;
  if (!Picture) {
    return (
      <span aria-hidden="true" data-flag="none" className={`${frame} grid place-items-center bg-raised text-muted`}>
        <GlobeIcon size={size === "sm" ? 10 : 12} />
      </span>
    );
  }
  return (
    <span aria-hidden="true" data-flag={(isoCode as string).toUpperCase()} className={frame}>
      <Picture className="block h-full w-full" aria-hidden focusable="false" />
    </span>
  );
}
