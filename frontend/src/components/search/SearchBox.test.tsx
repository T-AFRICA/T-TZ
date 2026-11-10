import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductSearchHit, SearchResponse } from "@tronic/types";
import type { SearchClient } from "@tronic/api-client";
import { SearchBox } from "./SearchBox";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

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

  it("shows an error state when the request fails", async () => {
    const user = userEvent.setup();
    render(<SearchBox client={failingClient} />);
    await user.type(screen.getByRole("combobox", { name: "Search products" }), "led");
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/);
    });
  });
});
