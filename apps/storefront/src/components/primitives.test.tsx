import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Badge, EmptyState, Input, Tabs } from "@tronic/ui";

describe("UI primitives (master prompt §10)", () => {
  it("wires the Input validation state up for assistive tech", () => {
    render(<Input id="meter" label="Meter number" error="Enter a valid meter number" />);
    const input = screen.getByLabelText("Meter number");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter a valid meter number");
  });

  it("moves between tabs with arrow keys", async () => {
    const user = userEvent.setup();
    render(
      <Tabs
        tabs={[
          { id: "specs", label: "Specifications", content: <p>Specs body</p> },
          { id: "warranty", label: "Warranty", content: <p>Warranty body</p> },
        ]}
      />,
    );
    const first = screen.getByRole("tab", { name: "Specifications" });
    first.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Warranty" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Warranty body")).toBeInTheDocument();
  });

  it("renders Badge content and the EmptyState status", () => {
    render(
      <>
        <Badge variant="dark">Sample</Badge>
        <EmptyState title="No results" description="Try a category name." />
      </>,
    );
    expect(screen.getByText("Sample")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No results");
  });
});
