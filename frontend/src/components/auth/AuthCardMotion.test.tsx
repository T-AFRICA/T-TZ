import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthCardMotion } from "./AuthCardMotion";

describe("account card motion", () => {
  it("plays the full entrance first, then a short swap after moving between account pages", () => {
    const first = render(<AuthCardMotion long={false}>card</AuthCardMotion>);
    const firstCard = first.container.firstElementChild;
    expect(firstCard).not.toHaveAttribute("data-swap");
    expect(firstCard).not.toHaveAttribute("data-long");
    first.unmount();

    // The next account page mounts its card while the stage stays on screen.
    const next = render(<AuthCardMotion long>card</AuthCardMotion>);
    const nextCard = next.container.firstElementChild;
    expect(nextCard).toHaveAttribute("data-swap");
    expect(nextCard).toHaveAttribute("data-long");
  });
});
