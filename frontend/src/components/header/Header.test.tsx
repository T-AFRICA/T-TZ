import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});
