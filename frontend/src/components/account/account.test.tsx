import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CustomerOrderSummary } from "@tronic/database";
import { ACCOUNT_NAV, isActiveNavItem } from "@/features/account/nav";
import { initials, firstName } from "@/features/account/session";
import { buildTracking } from "@/features/account/tracking";
import { AccountNav } from "./AccountNav";
import { OrderCard } from "./OrderCard";
import { OrderTimeline } from "./OrderTimeline";
import { NotConnected } from "./ui";
import { Package } from "lucide-react";

const pathname = vi.hoisted(() => ({ value: "/account" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value, redirect: vi.fn() }));
// The session helper imports the auth server module, which needs a request.
vi.mock("@/features/auth/server", () => ({ currentUser: vi.fn() }));

const order: CustomerOrderSummary = {
  orderNumber: "TZ-261114-ABCD1234",
  status: "dispatched",
  paymentStatus: "pending",
  paymentMethod: "pay_on_delivery",
  deliveryMethod: "home",
  createdAt: "2026-11-14T08:00:00.000Z",
  totalMinor: 7_450_000,
  currency: "TZS",
  itemCount: 5,
  lines: [
    { productSlug: "sample-led-panel", sku: "SAMPLE-LED-PANEL", name: "24W LED Panel Light", quantity: 2 },
    { productSlug: "sample-top-plug", sku: "SAMPLE-TOP-PLUG", name: "13A Top Plug", quantity: 1 },
    { productSlug: "sample-breaker", sku: "SAMPLE-BREAKER", name: "2 Pole Circuit Breaker 63A", quantity: 1 },
    { productSlug: "sample-extension", sku: "SAMPLE-EXTENSION", name: "Extension Socket with USB-C", quantity: 1 },
  ],
};

describe("account navigation", () => {
  it("marks one section as the current page, including nested routes", () => {
    pathname.value = "/account/orders/TZ-261114-ABCD1234/tracking";
    render(<AccountNav variant="sidebar" />);
    const current = screen.getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent)).toEqual(["My Orders"]);
  });

  it("keeps Profile & Security active on the security page, and the dashboard only on its own path", () => {
    const profile = ACCOUNT_NAV.find((item) => item.href === "/account/profile")!;
    const dashboard = ACCOUNT_NAV.find((item) => item.href === "/account")!;
    expect(isActiveNavItem(profile, "/account/security")).toBe(true);
    expect(isActiveNavItem(dashboard, "/account/orders")).toBe(false);
    expect(isActiveNavItem(dashboard, "/account")).toBe(true);
  });

  it("lists every portal section from the brief", () => {
    expect(ACCOUNT_NAV.map((item) => item.label)).toEqual([
      "Dashboard",
      "My Orders",
      "Track Order",
      "Wishlist",
      "Addresses",
      "Payments",
      "Invoices",
      "Notifications",
      "Help & Support",
      "Profile & Security",
    ]);
  });
});

describe("OrderCard", () => {
  it("shows the order's own number, statuses, total and both actions", () => {
    render(<OrderCard order={order} images={new Map()} />);
    const card = screen.getByRole("article");
    expect(within(card).getByRole("heading", { name: order.orderNumber })).toBeInTheDocument();
    expect(card).toHaveTextContent("Dispatched");
    expect(card).toHaveTextContent("Payment pending");
    expect(card).toHaveTextContent(/TZS\s?74,500/);
    expect(card).toHaveTextContent("5 items");
    expect(card).toHaveTextContent("and 1 more");
    expect(within(card).getByRole("link", { name: "Track order" })).toHaveAttribute("href", `/account/orders/${order.orderNumber}/tracking`);
    expect(within(card).getByRole("link", { name: "View details" })).toHaveAttribute("href", `/account/orders/${order.orderNumber}`);
  });
});

describe("OrderTimeline", () => {
  it("marks completed, current and upcoming steps and shows a time only where one is recorded", () => {
    render(<OrderTimeline tracking={buildTracking(order)} />);
    const steps = within(screen.getByRole("list", { name: "Order progress" })).getAllByRole("listitem");
    expect(steps).toHaveLength(7);
    expect(steps.find((step) => step.getAttribute("aria-current") === "step")).toHaveTextContent("Dispatched");
    expect(steps[0]).toHaveTextContent("completed");
    expect(steps[0]).not.toHaveTextContent("Time not recorded");
    expect(steps[1]).toHaveTextContent("Time not recorded");
    expect(steps[6]).toHaveTextContent("not yet reached");
    expect(steps[6]).not.toHaveTextContent("Time not recorded");
  });

  it("shows a cancellation as an alert beside the steps, not as progress", () => {
    render(<OrderTimeline tracking={buildTracking({ ...order, status: "cancelled" })} />);
    expect(screen.getByRole("status")).toHaveTextContent("Order cancelled");
    const steps = within(screen.getByRole("list", { name: "Order progress" })).getAllByRole("listitem");
    expect(steps.some((step) => step.getAttribute("aria-current") === "step")).toBe(false);
  });
});

describe("NotConnected", () => {
  it("says the module is not connected and what it is waiting for", () => {
    render(<NotConnected icon={Package} title="Invoices are not available online yet" body="They will be listed here." waitingFor="the invoicing workflow" />);
    const state = screen.getByRole("status");
    expect(state).toHaveTextContent("Not connected yet");
    expect(state).toHaveTextContent("Waiting for: the invoicing workflow.");
  });
});

describe("session helpers", () => {
  it("builds initials and a first name without inventing either", () => {
    expect(initials({ fullName: "Carol Mushi", email: "c@example.test" })).toBe("CM");
    expect(initials({ fullName: null, email: "asha.mrema@example.test" })).toBe("AM");
    expect(initials({ fullName: null, email: null })).toBe("T");
    expect(firstName({ fullName: "  Carol   Mushi " })).toBe("Carol");
    expect(firstName({ fullName: null })).toBeNull();
  });
});
