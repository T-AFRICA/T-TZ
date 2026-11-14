import Image from "next/image";
import { LogOut } from "lucide-react";
import { Container } from "@tronic/ui";
import { signOutAction } from "@/features/auth/actions";
import type { SessionUser } from "@/features/auth/server";
import { avatarUrl } from "@/features/account/avatar";
import { initials } from "@/features/account/session";
import { AccountNav } from "./AccountNav";

/** The customer's photo when they have one; their initials otherwise (and behind a photo that fails to load). */
function Avatar({ user, size }: { user: SessionUser; size: "md" | "lg" }) {
  const photo = avatarUrl(user.avatarVersion);
  return (
    <span
      aria-hidden="true"
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-[linear-gradient(135deg,#d71920,#9e1118)] font-bold text-white ${
        size === "lg" ? "h-12 w-12 text-base" : "h-11 w-11 text-sm"
      }`}
    >
      {initials(user)}
      {photo ? <Image src={photo} alt="" fill sizes="48px" unoptimized className="object-cover" /> : null}
    </span>
  );
}

/**
 * Customer portal frame (owner brief 2026-11-14). Desktop: a sticky
 * sidebar (who is signed in, the sections, Sign out) beside the content.
 * Phones and tablets: a compact account header, a swipeable row of
 * sections, then the content. A customer portal, not an admin dashboard:
 * light surfaces, generous spacing, the red accent only for the active
 * section and primary actions.
 */
export function AccountShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const name = user.fullName ?? "Your account";
  return (
    <div className="bg-[#f6f6f7] max-md:bg-transparent">
      <Container className="py-4 md:py-8 lg:py-10">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-8">
          <aside className="hidden lg:block">
            <div className="sticky top-[calc(var(--header-height)_+_1.25rem)] rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(17,17,17,0.04)]">
              <div className="flex items-center gap-3 border-b border-[var(--color-light-grey)] px-1 pb-4">
                <Avatar user={user} size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{name}</p>
                  {user.email ? <p className="truncate text-xs text-[var(--text-secondary)]">{user.email}</p> : null}
                </div>
              </div>
              <div className="py-3">
                <AccountNav variant="sidebar" />
              </div>
              <form action={signOutAction} className="border-t border-[var(--color-light-grey)] pt-3">
                <button
                  type="submit"
                  className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[#f6f6f7] hover:text-[var(--color-action-red)]"
                >
                  <LogOut size={18} aria-hidden="true" />
                  Sign out
                </button>
              </form>
            </div>
          </aside>

          <div className="min-w-0">
            <div className="mb-4 space-y-3 lg:hidden">
              <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-[0_1px_2px_rgba(17,17,17,0.05)]">
                <Avatar user={user} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{name}</p>
                  {user.email ? <p className="truncate text-xs text-[var(--text-secondary)]">{user.email}</p> : null}
                </div>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[var(--color-light-grey)] px-3 text-xs font-semibold transition-colors hover:border-[var(--color-action-red)] hover:text-[var(--color-action-red)]"
                  >
                    <LogOut size={14} aria-hidden="true" />
                    Sign out
                  </button>
                </form>
              </div>
              <AccountNav variant="pills" />
            </div>
            {children}
          </div>
        </div>
      </Container>
    </div>
  );
}
