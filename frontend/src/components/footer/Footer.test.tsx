import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SOCIAL_LINKS, SUPPORT_PHONE } from "@/config/site";
import { Footer } from "./Footer";

describe("Footer", () => {
  it("carries the support phone and social links since the top bar was hidden (owner decision 2026-11-09)", () => {
    render(<Footer />);
    const phone = screen.getByRole("link", { name: SUPPORT_PHONE.label });
    expect(phone).toHaveAttribute("href", SUPPORT_PHONE.href);

    const socials = screen.getByRole("list", { name: "Social media" });
    const shown = SOCIAL_LINKS.filter((link) => link.href !== null);
    expect(within(socials).getAllByRole("link")).toHaveLength(shown.length);
    for (const link of shown) {
      expect(within(socials).getByRole("link", { name: link.label })).toHaveAttribute("href", link.href);
    }
  });

  it("keeps the founding year line without the countries claim", () => {
    render(<Footer />);
    expect(screen.getByText("Founded 1993")).toBeInTheDocument();
    expect(screen.queryByText(/African countries/)).not.toBeInTheDocument();
  });
});
