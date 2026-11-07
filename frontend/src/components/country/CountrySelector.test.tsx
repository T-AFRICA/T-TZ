import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CountrySelector } from "./CountrySelector";

describe("CountrySelector", () => {
  it("shows Tanzania with TZS as the active country", () => {
    render(<CountrySelector />);
    expect(screen.getByText(/Tanzania/)).toBeInTheDocument();
    expect(screen.getByText(/TZS/)).toBeInTheDocument();
  });

  it("shows no switcher while no other deployment is live (SSD AD-02)", () => {
    render(<CountrySelector />);
    // Kenya and Uganda have no origin yet, so they are hidden entirely —
    // no dropdown, no links, no invented URLs.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/Kenya/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Uganda/)).not.toBeInTheDocument();
  });
});
