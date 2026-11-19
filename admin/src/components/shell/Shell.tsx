"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BikeIcon,
  BoxesIcon,
  ChartIcon,
  ChevronDownIcon,
  ClipboardListIcon,
  ContactIcon,
  DashboardIcon,
  FileTextIcon,
  GlobeIcon,
  GridIcon,
  LogOutIcon,
  MegaphoneIcon,
  MenuIcon,
  MoonIcon,
  PackageIcon,
  PanelLeftIcon,
  SettingsIcon,
  ShieldAlertIcon,
  ShoppingBagIcon,
  SunIcon,
  TagsIcon,
  TruckIcon,
  UserCogIcon,
  UsersIcon,
  XIcon,
  type IconProps,
} from "@tronic/ui";
import { WhiteMark } from "@/components/brand";
import { countryIdFromPath, isCurrentNavItem, type NavIcon, type NavItem, type NavSection } from "@/features/nav";
import { SIDEBAR_COOKIE, THEME_COOKIE, THEME_LABEL, nextTheme, type Theme } from "@/features/theme";


const ICONS: Record<NavIcon, (props: IconProps) => ReactNode> = {
  overview: GridIcon,
  countries: GlobeIcon,
  administrators: UserCogIcon,
  audit: ClipboardListIcon,
  security: ShieldAlertIcon,
  dashboard: DashboardIcon,
  products: PackageIcon,
  categories: TagsIcon,
  inventory: BoxesIcon,
  orders: ShoppingBagIcon,
  customers: ContactIcon,
  content: FileTextIcon,
  promotions: MegaphoneIcon,
  reports: ChartIcon,
  staff: UsersIcon,
  settings: SettingsIcon,
  deliveries: TruckIcon,
  riders: BikeIcon,
};

export interface ShellCountry {
  id: string;
  name: string;
  /** Short status text shown beside the name in the switcher, when not active. */
  note: string | null;
  items: NavItem[];
}

export interface ShellProps {
  platform: NavItem[];
  countries: ShellCountry[];
  /** True for a Master Super Admin: the switcher offers "All countries". */
  allCountries: boolean;
  user: { name: string; email: string; initials: string; roleSummary: string };
  initialTheme: Theme;
  initialCollapsed: boolean;
  signOutAction: () => Promise<void>;
  children: ReactNode;
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

/** A small menu that closes on Escape, on a click outside and after a choice. */
function Dropdown({ label, button, children, align = "right" }: { label: string; button: ReactNode; children: (close: () => void) => ReactNode; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-raised"
      >
        {button}
      </button>
      {open ? (
        <div
          className={`absolute top-[calc(100%+0.375rem)] z-40 min-w-56 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-1.5 shadow-panel ${align === "right" ? "right-0" : "left-0"}`}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

function NavList({ sections, pathname, collapsed, onNavigate }: { sections: NavSection[]; pathname: string | null; collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Console" className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      {sections.map((section) => (
        <div key={section.title}>
          <p className={`px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted ${collapsed ? "sr-only" : ""}`}>{section.title}</p>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const current = isCurrentNavItem(item.href, pathname);
              const Icon = ICONS[item.icon];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    onClick={onNavigate}
                    className={`group relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-[background-color,color,transform] duration-200 ease-out before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-white before:transition-transform before:duration-200 before:ease-out ${
                      current
                        ? "bg-sidebar-active text-white before:scale-y-100"
                        : "text-sidebar-muted before:scale-y-0 hover:bg-sidebar-hover hover:text-sidebar-ink hover:before:scale-y-50 motion-safe:hover:translate-x-1"
                    } ${collapsed ? "justify-center px-0" : ""}`}
                  >
                    <Icon size={18} className="shrink-0 transition-transform duration-200 ease-out motion-safe:group-hover:scale-110" />
                    <span className={collapsed ? "sr-only" : "truncate"}>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Shell({ platform, countries, allCountries, user, initialTheme, initialCollapsed, signOutAction, children }: ShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);

  // The country in the address, or the only country of a one-country administrator.
  const pathCountry = countryIdFromPath(pathname);
  const current = countries.find((country) => country.id === pathCountry) ?? (!allCountries && countries.length === 1 ? countries[0] : undefined);
  const sections: NavSection[] = [{ title: "Platform", items: platform }, ...(current ? [{ title: current.name, items: current.items }] : [])];

  useEffect(() => {
    const element = drawer.current;
    if (!element) return;
    if (drawerOpen && !element.open) element.showModal();
    if (!drawerOpen && element.open) element.close();
  }, [drawerOpen]);

  // Following a link closes the drawer.
  useEffect(() => setDrawerOpen(false), [pathname]);

  function toggleCollapsed() {
    setCollapsed((value) => {
      setCookie(SIDEBAR_COOKIE, value ? "open" : "collapsed");
      return !value;
    });
  }

  function cycleTheme() {
    const next = nextTheme(theme);
    setTheme(next);
    if (next === "system") {
      document.cookie = `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`;
      delete document.documentElement.dataset.theme;
    } else {
      setCookie(THEME_COOKIE, next);
      document.documentElement.dataset.theme = next;
    }
  }

  const brand = (
    <Link href="/" className="flex min-h-16 items-center gap-3 border-b border-sidebar-line px-5" aria-label="TRONIC Central Admin, overview">
      <span className={collapsed ? "sr-only" : "flex items-center gap-3"}>
        <WhiteMark className="h-7 w-auto" />
        <span className="text-[11px] font-semibold uppercase leading-tight tracking-[0.16em] text-sidebar-muted">
          Admin
        </span>
      </span>
      {collapsed ? <span aria-hidden="true" className="mx-auto grid h-9 w-9 place-items-center rounded-lg bg-white text-sm font-black text-[#d71920]">T</span> : null}
    </Link>
  );

  return (
    <div className="flex min-h-screen">
      <aside
        data-collapsed={collapsed}
        className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-sidebar text-sidebar-ink transition-[width] duration-200 [--focus-ring:2px_solid_#ffffff] lg:flex ${collapsed ? "w-[4.5rem]" : "w-64"}`}
      >
        {brand}
        <NavList sections={sections} pathname={pathname} collapsed={collapsed} />
      </aside>

      <dialog
        ref={drawer}
        aria-label="Console navigation"
        onClose={() => setDrawerOpen(false)}
        onClick={(event) => {
          if (event.target === drawer.current) setDrawerOpen(false);
        }}
        className="m-0 h-dvh max-h-none w-[min(19rem,88vw)] max-w-none bg-sidebar p-0 text-sidebar-ink [--focus-ring:2px_solid_#ffffff] backdrop:bg-black/60 lg:hidden"
      >
        <div className="flex h-full flex-col">
          <div className="flex min-h-16 items-center justify-between border-b border-sidebar-line px-5">
            <span className="flex items-center gap-3">
              <WhiteMark className="h-7 w-auto" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sidebar-muted">Admin</span>
            </span>
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setDrawerOpen(false)}
              className="grid h-10 w-10 place-items-center rounded-lg text-sidebar-muted hover:bg-sidebar-hover hover:text-white"
            >
              <XIcon size={18} />
            </button>
          </div>
          <NavList sections={sections} pathname={pathname} collapsed={false} onNavigate={() => setDrawerOpen(false)} />
        </div>
      </dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-16 items-center gap-2 border-b border-line bg-surface/95 px-3 backdrop-blur sm:gap-3 sm:px-6">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setDrawerOpen(true)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-ink hover:bg-raised lg:hidden"
          >
            <MenuIcon size={20} />
          </button>
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            onClick={toggleCollapsed}
            className="hidden h-10 w-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink lg:grid"
          >
            <PanelLeftIcon size={18} />
          </button>

          {countries.length > 1 || allCountries ? (
            <Dropdown
              label={`Country: ${current?.name ?? "All countries"}. Change country`}
              align="left"
              button={
                <>
                  <GlobeIcon size={16} className="text-muted" />
                  <span className="max-w-[9rem] truncate sm:max-w-none">{current?.name ?? "All countries"}</span>
                  <ChevronDownIcon size={14} className="text-muted" />
                </>
              }
            >
              {(close) => (
                <ul aria-label="Countries" className="flex flex-col">
                  {allCountries ? (
                    <li>
                      <Link href="/" onClick={close} aria-current={!current ? "true" : undefined} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-raised">
                        All countries
                      </Link>
                    </li>
                  ) : null}
                  {countries.map((country) => (
                    <li key={country.id}>
                      <Link
                        href={`/c/${country.id}`}
                        onClick={close}
                        aria-current={current?.id === country.id ? "true" : undefined}
                        className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:bg-raised ${current?.id === country.id ? "font-semibold text-accent-ink" : "font-medium text-ink"}`}
                      >
                        <span>{country.name}</span>
                        {country.note ? <span className="text-xs font-normal text-muted">{country.note}</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Dropdown>
          ) : current ? (
            <span className="flex min-h-10 items-center gap-2 rounded-lg border border-line bg-raised px-3 text-sm font-medium text-ink">
              <GlobeIcon size={16} className="text-muted" />
              {current.name}
            </span>
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={cycleTheme}
              aria-label={`${THEME_LABEL[theme]}. Change theme`}
              title={THEME_LABEL[theme]}
              className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink"
            >
              {theme === "dark" ? <MoonIcon size={18} /> : theme === "light" ? <SunIcon size={18} /> : <SettingsIcon size={18} />}
            </button>
            <Dropdown
              label={`Account menu for ${user.name}`}
              button={
                <>
                  <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full bg-accent text-xs font-bold text-white">
                    {user.initials}
                  </span>
                  <span className="hidden max-w-[10rem] truncate sm:inline">{user.name}</span>
                  <ChevronDownIcon size={14} className="text-muted" />
                </>
              }
            >
              {() => (
                <div className="w-64 max-w-full">
                  <div className="border-b border-line px-3 py-2.5">
                    <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                    <p className="mt-1.5 text-xs font-medium text-accent-ink">{user.roleSummary}</p>
                  </div>
                  <form action={signOutAction} className="pt-1.5">
                    <button type="submit" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-ink hover:bg-raised">
                      <LogOutIcon size={16} className="text-muted" />
                      Sign out
                    </button>
                  </form>
                </div>
              )}
            </Dropdown>
          </div>
        </header>

        <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
