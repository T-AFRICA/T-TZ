import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "./Header";
import { MobileSearch } from "./MobileSearch";
import { SmartScroll } from "./SmartScroll";

// SearchBox navigates with the app router, which is not mounted in unit tests.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn() }),
}));

/** jsdom has no modal dialogs: open and close the element the way a browser would. */
function stubDialog() {
  const proto = HTMLDialogElement.prototype;
  vi.spyOn(proto, "showModal").mockImplementation(function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  vi.spyOn(proto, "close").mockImplementation(function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });
}

beforeEach(() => {
  if (!("showModal" in HTMLDialogElement.prototype)) {
    Object.assign(HTMLDialogElement.prototype, { showModal() {}, close() {} });
  }
  stubDialog();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete document.documentElement.dataset.navHidden;
});

describe("mobile header row", () => {
  it("has the search button immediately before Notifications and no second search row", () => {
    render(<Header />);
    const header = screen.getByRole("banner");
    const search = screen.getByRole("button", { name: "Search products" });
    const bell = screen.getByRole("link", { name: "Notifications" });
    // Next to each other in the row, search first.
    expect(search.parentElement?.nextElementSibling).toBe(bell);
    // One search field in the page: the desktop one. The phone's is mounted on demand.
    expect(header.querySelectorAll('input[type="search"]')).toHaveLength(1);
    expect(header.querySelector(".md\\:hidden input[type='search']")).toBeNull();
  });
});

describe("phone search panel", () => {
  it("opens the existing search box focused, and closes with a clear action", async () => {
    const user = userEvent.setup();
    render(<MobileSearch />);
    const trigger = screen.getByRole("button", { name: "Search products" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("combobox")).toBeNull();

    await user.click(trigger);
    const field = screen.getByRole("combobox", { name: "Search products" });
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute("placeholder", "Search products, SKU or model…");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Close search" }));
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes when the browser closes the dialog (Escape) and when a category is chosen", async () => {
    const user = userEvent.setup();
    render(<MobileSearch />);
    await user.click(screen.getByRole("button", { name: "Search products" }));
    act(() => {
      screen.getByRole("dialog", { name: "Search products" }).dispatchEvent(new Event("close"));
    });
    expect(screen.queryByRole("combobox")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Search products" }));
    // Popular categories are offered while the field is empty; choosing one leaves the search.
    const category = screen.getAllByRole("link").find((link) => link.getAttribute("href")?.startsWith("/categories/"));
    expect(category).toBeDefined();
    // jsdom cannot follow links; the form's own handler still runs.
    category!.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(category!);
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});

describe("smart scroll", () => {
  let scrollY = 0;
  let mobile = true;

  function scrollTo(y: number) {
    scrollY = y;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
  }
  const hidden = () => document.documentElement.dataset.navHidden === "true";

  beforeEach(() => {
    vi.useFakeTimers();
    scrollY = 0;
    mobile = true;
    Object.defineProperty(window, "scrollY", { configurable: true, get: () => scrollY });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    vi.stubGlobal("matchMedia", () => ({
      get matches() {
        return mobile;
      },
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hides the bars on the way down, shows them on the way up and half a second after a stop", () => {
    render(<SmartScroll />);
    scrollTo(40);
    expect(hidden()).toBe(false); // still near the top
    scrollTo(300);
    expect(hidden()).toBe(true);
    scrollTo(900);
    expect(hidden()).toBe(true);
    scrollTo(860);
    expect(hidden()).toBe(false); // scrolling up

    scrollTo(1400);
    expect(hidden()).toBe(true);
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(hidden()).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(hidden()).toBe(false); // scrolling stopped
  });

  it("ignores tiny movements until they add up", () => {
    render(<SmartScroll />);
    scrollTo(300);
    scrollTo(296); // 4px up: not enough to react
    expect(hidden()).toBe(true);
    scrollTo(292); // 8px up in total
    expect(hidden()).toBe(false);
  });

  it("keeps the bars while a dialog is open, while focus is inside them, and on desktop widths", () => {
    const { container } = render(
      <>
        <SmartScroll />
        <header className="site-header">
          <button type="button">Menu</button>
        </header>
        <dialog />
      </>,
    );
    scrollTo(300);
    expect(hidden()).toBe(true);

    container.querySelector("dialog")!.setAttribute("open", "");
    scrollTo(700);
    expect(hidden()).toBe(false);
    container.querySelector("dialog")!.removeAttribute("open");
    scrollTo(1100);
    expect(hidden()).toBe(true);

    // Keyboard focus moving into the header brings it back and keeps it.
    act(() => {
      screen.getByRole("button", { name: "Menu" }).focus();
    });
    expect(hidden()).toBe(false);
    scrollTo(1500);
    expect(hidden()).toBe(false);
    act(() => {
      (document.activeElement as HTMLElement).blur();
    });

    mobile = false;
    scrollTo(2200);
    expect(hidden()).toBe(false);
  });

  it("leaves the bars visible when it is removed", () => {
    const { unmount } = render(<SmartScroll />);
    scrollTo(500);
    expect(hidden()).toBe(true);
    unmount();
    expect(hidden()).toBe(false);
  });
});
