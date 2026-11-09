import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SUPPORT_PHONE } from "@/config/site";
import { Header } from "./Header";

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
    expect(loginLinks[0]).toHaveAttribute("href", "/account");
    const wishlistLinks = screen.getAllByRole("link", { name: /Wishlist/ });
    expect(wishlistLinks[0]).toHaveAttribute("href", "/wishlist");
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
