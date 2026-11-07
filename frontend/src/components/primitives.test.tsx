import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AccordionSection, Badge, EmptyState, Input, Tabs } from "@tronic/ui";

describe("UI primitives (master prompt §10)", () => {
  it("exposes the accordion as a labelled button and region", async () => {
    const user = userEvent.setup();
    render(
      <>
        <AccordionSection title="Product Overview" defaultOpen>
          <p>Overview body</p>
        </AccordionSection>
        <AccordionSection title="Warranty Information">
          <p>Warranty body</p>
        </AccordionSection>
      </>,
    );
    const overview = screen.getByRole("button", { name: "Product Overview" });
    expect(overview).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "Product Overview" })).toHaveTextContent(
      "Overview body",
    );
    expect(screen.getByRole("heading", { level: 2, name: "Product Overview" })).toBeInTheDocument();

    const warranty = screen.getByRole("button", { name: "Warranty Information" });
    expect(warranty).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Warranty body")).not.toBeInTheDocument();
    await user.click(warranty);
    expect(warranty).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "Warranty Information" })).toHaveTextContent(
      "Warranty body",
    );
  });

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
