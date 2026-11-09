import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WHATSAPP, whatsappHref } from "@/config/site";
import { WhatsAppButton } from "./WhatsAppButton";

describe("WhatsAppButton", () => {
  it("links to a WhatsApp chat with the configured number in a new tab", () => {
    render(<WhatsAppButton />);
    const link = screen.getByRole("link", { name: /WhatsApp/ });
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith(`https://wa.me/${WHATSAPP.number}?text=`)).toBe(true);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
    expect(link).toHaveAccessibleName(/opens in a new tab/);
  });

  it("keeps the visual label out of the accessibility tree", () => {
    render(<WhatsAppButton />);
    expect(screen.getByText("Chat with us")).toHaveAttribute("aria-hidden", "true");
  });

  it("encodes the greeting so special characters survive the URL", () => {
    expect(whatsappHref("Hi & bye?")).toBe(`https://wa.me/${WHATSAPP.number}?text=Hi%20%26%20bye%3F`);
    expect(WHATSAPP.number).toMatch(/^\d+$/);
  });
});
