import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BottomNav } from "./BottomNav";

const pathname = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

function tabs() {
  return within(screen.getByRole("navigation", { name: "Primary" })).getAllByRole("link");
}
function currentTab() {
  const current = tabs().filter((link) => link.getAttribute("aria-current") === "page");
  expect(current.length).toBeLessThanOrEqual(1);
  return current[0]?.textContent ?? null;
}

afterEach(() => {
  pathname.value = "/";
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; max-age=0; path=/`;
  }
});

describe("phone bottom tab bar", () => {
  it("has Home, Products, Wishlist, Cart and Profile, each a link to its page", () => {
    render(<BottomNav />);
    expect(tabs().map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Home", "/"],
      ["Products", "/products"],
      ["Wishlist", "/wishlist"],
      ["Cart", "/cart"],
      ["Profile", "/login"],
    ]);
    // The Categories tab pointed at a spot on the homepage; it is gone.
    expect(screen.queryByRole("link", { name: "Categories" })).toBeNull();
    expect(document.querySelector('a[href*="#"]')).toBeNull();
  });

  it("marks one tab as the current page", () => {
    const { rerender } = render(<BottomNav />);
    expect(currentTab()).toBe("Home");
    for (const [path, tab] of [
      ["/products", "Products"],
      ["/products/sample-led-panel", "Products"],
      ["/categories/lighting/indoor-lighting", "Products"],
      ["/wishlist", "Wishlist"],
      ["/cart", "Cart"],
      ["/login", "Profile"],
      ["/checkout", null],
      ["/search", null],
    ] as const) {
      pathname.value = path;
      rerender(<BottomNav />);
      expect(currentTab(), path).toBe(tab);
    }
  });

  it("opens the account for a signed-in customer and stays current inside it", () => {
    document.cookie = "tronic-signed-in=1; path=/";
    pathname.value = "/account/orders";
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/account");
    expect(currentTab()).toBe("Profile");
  });

  it("is a rounded bar that floats: the strip around it lets taps through", () => {
    render(<BottomNav />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav).toHaveClass("bottom-nav", "pointer-events-none", "md:hidden");
    const bar = within(nav).getByRole("list");
    expect(bar).toHaveClass("pointer-events-auto", "rounded-full");
  });
});
