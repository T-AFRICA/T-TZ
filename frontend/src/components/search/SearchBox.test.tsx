import { act, render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductSearchHit, SearchResponse } from "@tronic/types";
import type { SearchClient } from "@tronic/api-client";
import { ToastProvider } from "@tronic/ui";
import { cartStore } from "@/features/cart/store";
import { SearchBox } from "./SearchBox";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

// The quick view confirms Add to Cart with a toast, as the product page does.
function render(ui: React.ReactElement) {
  return rtlRender(<ToastProvider>{ui}</ToastProvider>);
}

const panel: ProductSearchHit = {
  id: "sample-led-panel",
  slug: "sample-led-panel",
  sku: "SAMPLE-LED-PANEL",
  name: "24W LED Panel Light",
  categoryName: "Lighting",
  image: "/products/panel-light.png",
  price: 28_000,
  wasPrice: 35_000,
  currency: "TZS",
  inStock: true,
};
const bulb: ProductSearchHit = {
  ...panel,
  id: "sample-led-bulb",
  slug: "sample-led-bulb",
  sku: "SAMPLE-LED-BULB",
  name: "9W LED Bulb",
  wasPrice: undefined,
  price: 4_500,
  inStock: false,
};

function respond(query: string, results: ProductSearchHit[], total = results.length): SearchResponse {
  return { query, results, total, simulated: true };
}

const sampleClient: SearchClient = {
  search: vi.fn(async (query: string) => respond(query, query.toLowerCase().includes("led") ? [panel, bulb] : [], 9)),
};

const failingClient: SearchClient = {
  async search() {
    throw new Error("network down");
  },
};

beforeEach(() => {
  push.mockClear();
  vi.mocked(sampleClient.search).mockClear();
});

describe("SearchBox", () => {
  it("shows product hits with SKU, category, TZS prices and stock", async () => {
    const user = userEvent.setup();
    render(<SearchBox client={sampleClient} />);
    await user.type(screen.getByRole("combobox", { name: "Search products" }), "led");
    const option = await screen.findByRole("option", { name: /24W LED Panel Light/ });
    expect(option).toHaveTextContent("SKU SAMPLE-LED-PANEL · Lighting");
    expect(option).toHaveTextContent(/TZS\s?28,000/);
    expect(option).toHaveTextContent(/TZS\s?35,000/);
    expect(option).toHaveTextContent("In stock");
    expect(screen.getByRole("option", { name: /9W LED Bulb/ })).toHaveTextContent("Out of stock");
    expect(screen.getByRole("option", { name: /View all 9 results for “led”/ })).toBeInTheDocument();
    expect(screen.getByText(/Sample catalogue/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /24W LED Panel Light/ })).toHaveAttribute("href", "/products/sample-led-panel");
  });

  it("debounces typing into one request for the final text", async () => {
    const user = userEvent.setup();
    render(<SearchBox client={sampleClient} />);
    await user.type(screen.getByRole("combobox", { name: "Search products" }), "led pa");
    await screen.findByRole("listbox");
    expect(sampleClient.search).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sampleClient.search).mock.calls[0]?.[0]).toBe("led pa");
  });

  it("never lets a slow, stale response replace newer results", async () => {
    const resolvers = new Map<string, (value: SearchResponse) => void>();
    const slowClient: SearchClient = {
      search: (query, options) =>
        new Promise((resolve, reject) => {
          resolvers.set(query, resolve);
          options?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    };
    const user = userEvent.setup();
    render(<SearchBox client={slowClient} />);
    const input = screen.getByRole("combobox", { name: "Search products" });
    await user.type(input, "led");
    await waitFor(() => expect(resolvers.has("led")).toBe(true));
    await user.type(input, " bulb");
    await waitFor(() => expect(resolvers.has("led bulb")).toBe(true));
    await act(async () => {
      resolvers.get("led bulb")?.(respond("led bulb", [bulb]));
      resolvers.get("led")?.(respond("led", [panel]));
    });
    expect(await screen.findByRole("option", { name: /9W LED Bulb/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /24W LED Panel Light/ })).not.toBeInTheDocument();
  });

  it("moves with the arrow keys and opens the highlighted product on Enter", async () => {
    const user = userEvent.setup();
    render(<SearchBox client={sampleClient} />);
    const input = screen.getByRole("combobox", { name: "Search products" });
    await user.type(input, "led");
    await screen.findByRole("listbox");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    const second = screen.getByRole("option", { name: /9W LED Bulb/ });
    expect(second).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", second.id);
    await user.keyboard("{ArrowUp}{Enter}");
    expect(push).toHaveBeenCalledWith("/products/sample-led-panel");
  });

  it("opens the full results page on Enter when nothing is highlighted", async () => {
    const user = userEvent.setup();
    render(<SearchBox client={sampleClient} />);
    await user.type(screen.getByRole("combobox", { name: "Search products" }), "  LED   panel {Enter}");
    expect(push).toHaveBeenCalledWith("/search?q=LED+panel");
  });

  it("closes on Escape and clears results with the clear button", async () => {
    const user = userEvent.setup();
    render(<SearchBox client={sampleClient} />);
    const input = screen.getByRole("combobox", { name: "Search products" });
    await user.type(input, "led");
    await screen.findByRole("listbox");
    await user.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(input).toHaveValue("");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Popular categories" })).toBeInTheDocument();
  });

  it("does not search for empty or whitespace input", async () => {
    const user = userEvent.setup();
    render(<SearchBox client={sampleClient} />);
    await user.type(screen.getByRole("combobox", { name: "Search products" }), "   ");
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(sampleClient.search).not.toHaveBeenCalled();
  });

  it("renders search text as text, never as HTML", async () => {
    const user = userEvent.setup();
    const { container } = render(<SearchBox client={sampleClient} />);
    await user.type(screen.getByRole("combobox", { name: "Search products" }), "<img src=x>");
    await waitFor(() => expect(screen.getByText(/No products match/)).toBeInTheDocument());
    expect(screen.getByText(/No products match/)).toHaveTextContent("<img src=x>");
    expect(container.querySelector("img[src='x']")).toBeNull();
  });

  it("opens the quick view on the first hit, then follows hover and the keyboard", async () => {
    const user = userEvent.setup();
    const specced: ProductSearchHit = {
      ...bulb,
      description: "Warm white bulb for living rooms.",
      specifications: [
        { label: "Model No.", value: "TR-B9" },
        { label: "Wattage", value: "9W" },
      ],
    };
    const client: SearchClient = { search: async (query) => respond(query, [panel, specced]) };
    render(<SearchBox client={client} />);
    await user.type(screen.getByRole("combobox", { name: "Search products" }), "led");
    const quick = await screen.findByRole("complementary", { name: "Quick view" });
    expect(within(quick).getByRole("heading", { name: "24W LED Panel Light" })).toBeInTheDocument();
    expect(quick).toHaveTextContent("Save 20%");
    expect(quick).not.toHaveTextContent("Specifications");
    // No copy yet: the same generic line as the product page.
    expect(quick).toHaveTextContent("Reliable lighting for homes, businesses and industry.");

    // Hover takes over after a short rest (hover intent), not instantly.
    await user.hover(screen.getByRole("link", { name: /9W LED Bulb/ }));
    await waitFor(() => expect(within(quick).getByRole("heading", { name: "9W LED Bulb" })).toBeInTheDocument());
    expect(quick).toHaveTextContent("Model TR-B9");
    expect(quick).toHaveTextContent("Warm white bulb for living rooms.");
    expect(quick).toHaveTextContent("Wattage9W");
    expect(quick).toHaveTextContent("Out of stock, so it cannot be bought right now.");
    expect(within(quick).getByRole("button", { name: /Add to Cart/ })).toBeDisabled();
    expect(within(quick).getByRole("link", { name: /View full product details/ })).toHaveAttribute(
      "href",
      "/products/sample-led-bulb",
    );

    // The "View all" row keeps the last product in the quick view.
    await user.keyboard("{ArrowDown}");
    expect(within(quick).getByRole("heading", { name: "9W LED Bulb" })).toBeInTheDocument();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: /24W LED Panel Light/ })).toHaveAttribute("aria-selected", "true");
    expect(within(quick).getByRole("heading", { name: "24W LED Panel Light" })).toBeInTheDocument();
  });

  it("ignores rows the pointer only sweeps across", async () => {
    const user = userEvent.setup();
    render(<SearchBox client={sampleClient} />);
    await user.type(screen.getByRole("combobox", { name: "Search products" }), "led");
    const quick = await screen.findByRole("complementary", { name: "Quick view" });
    await user.hover(screen.getByRole("link", { name: /9W LED Bulb/ }));
    await user.hover(quick);
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(within(quick).getByRole("heading", { name: "24W LED Panel Light" })).toBeInTheDocument();
  });

  it("starts each new search\x27s quick view at its own first result", async () => {
    const user = userEvent.setup();
    const client: SearchClient = {
      search: async (query) => respond(query, query === "led" ? [panel, bulb] : [bulb, panel]),
    };
    render(<SearchBox client={client} />);
    const input = screen.getByRole("combobox", { name: "Search products" });
    await user.type(input, "led");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    await user.clear(input);
    await user.type(input, "bulb");
    await waitFor(() => expect(screen.getAllByRole("option")[0]).toHaveTextContent("9W LED Bulb"));
    const quick = screen.getByRole("complementary", { name: "Quick view" });
    expect(within(quick).getByRole("heading", { name: "9W LED Bulb" })).toBeInTheDocument();
  });

  it("requires every option before buying, then adds to cart once and says so", async () => {
    const user = userEvent.setup();
    const extension: ProductSearchHit = {
      ...panel,
      id: "sample-extension",
      slug: "sample-extension",
      name: "Extension Socket",
      variants: ["3-way", "4-way"],
      variantLabel: "Type",
      colors: [
        { name: "White", swatch: "#f4f4f2" },
        { name: "Black", swatch: "#1f1f23" },
      ],
    };
    render(<SearchBox client={{ search: async (query) => respond(query, [extension]) }} />);
    await user.type(screen.getByRole("combobox", { name: "Search products" }), "ext");
    const quick = await screen.findByRole("complementary", { name: "Quick view" });
    const add = within(quick).getByRole("button", { name: /Add to Cart/ });
    const buy = within(quick).getByRole("button", { name: "Buy Now" });
    expect(add).toBeDisabled();
    expect(buy).toBeDisabled();
    expect(quick).toHaveTextContent("Choose a colour and a type to continue.");

    await user.click(within(quick).getByRole("button", { name: "Black" }));
    await user.click(within(quick).getByRole("button", { name: "4-way" }));
    expect(add).toBeEnabled();
    expect(quick).toHaveTextContent("SKU SAMPLE-LED-PANEL · Black · 4-way");

    const increase = within(quick).getByRole("button", { name: "Increase quantity" });
    await user.click(increase);
    await user.click(increase);
    await user.click(add);
    expect(await screen.findByText("Added 3 × Extension Socket (Black · 4-way) to your cart")).toBeInTheDocument();
    expect(cartStore.get()).toEqual([{ productId: "sample-extension", color: "Black", variant: "4-way", quantity: 3 }]);
    expect(within(quick).getByRole("button", { name: /Added/ })).toBeDisabled();
    // Still open, nothing navigated.
    expect(screen.getByRole("combobox", { name: "Search products" })).toHaveAttribute("aria-expanded", "true");
    expect(push).not.toHaveBeenCalled();
  });

  it("Buy Now uses the product page\x27s checkout route and closes the panel", async () => {
    const user = userEvent.setup();
    render(<SearchBox client={sampleClient} />);
    const input = screen.getByRole("combobox", { name: "Search products" });
    await user.type(input, "led");
    const quick = await screen.findByRole("complementary", { name: "Quick view" });
    await user.click(within(quick).getByRole("button", { name: "Buy Now" }));
    expect(push).toHaveBeenCalledWith("/cart");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("closes from inside the quick view with Escape and returns focus to the field", async () => {
    const user = userEvent.setup();
    render(<SearchBox client={sampleClient} />);
    const input = screen.getByRole("combobox", { name: "Search products" });
    await user.type(input, "led");
    const quick = await screen.findByRole("complementary", { name: "Quick view" });
    within(quick).getByRole("button", { name: "Increase quantity" }).focus();
    await user.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveFocus();
  });

  it("shows an error state when the request fails", async () => {
    const user = userEvent.setup();
    render(<SearchBox client={failingClient} />);
    await user.type(screen.getByRole("combobox", { name: "Search products" }), "led");
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/);
    });
  });
});

describe("SearchBox on touch and narrow screens", () => {
  const originalMatchMedia = window.matchMedia;
  const proto = HTMLDialogElement.prototype;
  const original = { showModal: proto.showModal, close: proto.close };

  beforeEach(() => {
    // A phone: no fine pointer, so no split view.
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    // jsdom has no modal dialogs; enough of one for these tests.
    proto.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    proto.close = function close(this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    proto.showModal = original.showModal;
    proto.close = original.close;
  });

  it("opens the tapped product in a quick view sheet instead of leaving the page", async () => {
    const user = userEvent.setup();
    render(<SearchBox client={sampleClient} />);
    await user.type(screen.getByRole("combobox", { name: "Search products" }), "led");
    await user.click(await screen.findByRole("link", { name: /9W LED Bulb/ }));

    const sheet = screen.getByRole("dialog", { name: "Quick view: 9W LED Bulb" });
    expect(sheet).toHaveAttribute("open");
    expect(within(sheet).getByRole("heading", { name: "9W LED Bulb" })).toBeInTheDocument();
    expect(within(sheet).getByText(/Out of stock, so it cannot be bought/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    await user.click(within(sheet).getByRole("button", { name: "Close quick view" }));
    await waitFor(() => expect(sheet).not.toHaveAttribute("open"));
    // The results are still there behind it.
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("buys from the sheet through the same checkout route", async () => {
    const user = userEvent.setup();
    render(<SearchBox client={sampleClient} />);
    const input = screen.getByRole("combobox", { name: "Search products" });
    await user.type(input, "led");
    await user.click(await screen.findByRole("link", { name: /24W LED Panel Light/ }));
    const sheet = screen.getByRole("dialog", { name: "Quick view: 24W LED Panel Light" });
    await user.click(within(sheet).getByRole("button", { name: "Buy Now" }));
    expect(push).toHaveBeenCalledWith("/cart");
    expect(sheet).not.toHaveAttribute("open");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });
});
