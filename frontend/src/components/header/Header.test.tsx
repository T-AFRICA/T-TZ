import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SUPPORT_PHONE } from "@/config/site";
import { Header } from "./Header";

// SearchBox navigates with the app router, which is not mounted in unit tests.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  document.cookie = "sb-testproject-auth-token=; path=/; max-age=0";
});

describe("Header", () => {
  it("keeps the dedicated Meter link in the main header row (FR-003)", () => {
    render(<Header />);
    // Rendered twice: the desktop header action and the mobile drawer entry.
    const meterLinks = screen.getAllByRole("link", { name: /Meter/ });
    expect(meterLinks.length).toBeGreaterThan(0);
    for (const link of meterLinks) {
      expect(link).toHaveAttribute("href", "/meter");
    }
  });

  it("links Track Order, Login and Wishlist to their placeholder routes", () => {
    render(<Header />);
    const trackLinks = screen.getAllByRole("link", { name: /Track Order/ });
    expect(trackLinks[0]).toHaveAttribute("href", "/track-order");
    const loginLinks = screen.getAllByRole("link", { name: /Login/ });
    expect(loginLinks[0]).toHaveAttribute("href", "/login");
    const wishlistLinks = screen.getAllByRole("link", { name: /Wishlist/ });
    expect(wishlistLinks[0]).toHaveAttribute("href", "/wishlist");
  });

  it("offers a signed-in customer their account instead of Login, in the header and the drawer", () => {
    document.cookie = "sb-testproject-auth-token=session; path=/";
    render(<Header />);
    // hidden: true also finds the link inside the closed drawer.
    const accountLinks = screen.getAllByRole("link", { name: "Account", hidden: true });
    expect(accountLinks.length).toBe(2);
    for (const link of accountLinks) expect(link).toHaveAttribute("href", "/account");
    expect(screen.queryByRole("link", { name: /Login/, hidden: true })).not.toBeInTheDocument();
  });

  it("does not render the top bar: no social links or support phone in the header (owner request 2026-11-09)", () => {
    render(<Header />);
    expect(screen.queryByRole("list", { name: "Social media" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: SUPPORT_PHONE.label })).not.toBeInTheDocument();
  });

  it("keeps the desktop category navbar out of the sticky header so it scrolls away with the page (owner request 2026-11-09)", () => {
    const { container } = render(<Header />);
    expect(container.querySelector("header")).not.toBeNull();
    const desktopNavs = Array.from(container.querySelectorAll('nav[aria-label="Product categories"]')).filter(
      (nav) => !nav.closest("dialog"),
    );
    expect(desktopNavs).toHaveLength(0);
  });
});
