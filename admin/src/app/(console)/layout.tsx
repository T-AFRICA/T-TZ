import { cookies } from "next/headers";
import { Shell, type ShellCountry } from "@/components/shell/Shell";
import { signOutAction } from "@/features/auth/actions";
import { COUNTRY_STATUS_LABEL, initials, roleName } from "@/features/labels";
import { buildNav } from "@/features/nav";
import { notificationAudiences } from "@/features/notifications/audiences";
import { SIDEBAR_COOKIE, THEME_COOKIE, parseTheme } from "@/features/theme";
import { requireAdmin } from "@/server/session";

/**
 * The console frame. It asks for the administrator like every page does;
 * the pages never rely on this layout having run (layouts are not re-run on
 * every navigation).
 */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const jar = await cookies();

  const platform = buildNav(admin.actor, null)[0]?.items ?? [];
  const countries: ShellCountry[] = admin.countries.map((country) => ({
    id: country.id,
    name: country.name,
    note: country.status === "active" ? null : COUNTRY_STATUS_LABEL[country.status],
    items: buildNav(admin.actor, country)[1]?.items ?? [],
    notifications: notificationAudiences(admin.actor, country.id).length > 0,
  }));

  const first = admin.actor.assignments[0];
  const firstCountry = admin.countries.find((country) => country.id === first?.countryId)?.name;
  const more = admin.actor.assignments.length - 1;
  const roleSummary = admin.isMaster
    ? "Master Super Admin"
    : first
      ? `${roleName(first.role)}${firstCountry ? `, ${firstCountry}` : ""}${more > 0 ? ` and ${more} more` : ""}`
      : "";

  return (
    <Shell
      platform={platform}
      countries={countries}
      allCountries={admin.isMaster}
      user={{ name: admin.fullName ?? admin.email.split("@")[0] ?? admin.email, email: admin.email, initials: initials(admin.fullName, admin.email), roleSummary }}
      initialTheme={parseTheme(jar.get(THEME_COOKIE)?.value)}
      initialCollapsed={jar.get(SIDEBAR_COOKIE)?.value === "collapsed"}
      signOutAction={signOutAction}
    >
      {children}
    </Shell>
  );
}
