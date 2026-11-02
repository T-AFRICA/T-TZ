import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { SearchClient } from "@tronic/api-client";
import { SearchBox } from "./SearchBox";

const sampleClient: SearchClient = {
  async search(query: string) {
    const match = query.toLowerCase().includes("light");
    return {
      query,
      results: match
        ? [
            {
              id: "sample-1",
              title: "SAMPLE — Indoor Lighting",
              href: "/categories/lighting",
              section: "Lighting",
            },
          ]
        : [],
      simulated: true,
    };
  },
};

const failingClient: SearchClient = {
  async search() {
    throw new Error("network down");
  },
};

describe("SearchBox", () => {
  it("shows debounced results labelled as sample data", async () => {
    const user = userEvent.setup();
    render(<SearchBox client={sampleClient} />);
    await user.type(screen.getByRole("combobox", { name: "Search products" }), "light");
    await waitFor(() => {
      expect(screen.getByRole("option", { name: /Indoor Lighting/ })).toBeInTheDocument();
    });
    expect(screen.getByText(/Sample data/)).toBeInTheDocument();
  });

  it("shows a meaningful empty state when nothing matches (FR-006)", async () => {
    const user = userEvent.setup();
    render(<SearchBox client={sampleClient} />);
    await user.type(screen.getByRole("combobox", { name: "Search products" }), "zzzz");
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/No matches/);
    });
  });

  it("shows an error state when the adapter fails", async () => {
    const user = userEvent.setup();
    render(<SearchBox client={failingClient} />);
    await user.type(screen.getByRole("combobox", { name: "Search products" }), "light");
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/);
    });
  });
});
