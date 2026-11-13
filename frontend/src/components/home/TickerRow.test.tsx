import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TickerRow } from "./TickerRow";

describe("TickerRow", () => {
  it("exposes one set of items; the loop copy is hidden and inert", () => {
    const { container } = render(
      <TickerRow label="Offers" seconds={48}>
        <li>One</li>
        <li>Two</li>
      </TickerRow>,
    );
    const list = screen.getByRole("list", { name: "Offers" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    const copy = container.querySelector(".ticker-copy");
    expect(copy).toHaveAttribute("aria-hidden", "true");
    expect(copy).toHaveAttribute("inert");
    expect(container.querySelector(".ticker-frame")).toHaveStyle({ "--ticker-duration": "48s" });
  });
});
