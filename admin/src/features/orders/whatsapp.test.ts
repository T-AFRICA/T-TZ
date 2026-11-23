import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { whatsAppHref } from "./labels";

/**
 * The "Message on WhatsApp" link beside a customer's number: built from
 * digits only, for numbers in the international form, and never from text
 * as it came from a country.
 */
describe("the WhatsApp link", () => {
  it("opens a chat with the number, digits only", () => {
    expect(whatsAppHref("+255712345678")).toBe("https://wa.me/255712345678");
    expect(whatsAppHref("+254712345678")).toBe("https://wa.me/254712345678");
    expect(whatsAppHref("+14155550123")).toBe("https://wa.me/14155550123");
  });

  it("gives no link for anything that is not a stored number", () => {
    for (const value of [null, undefined, "", "0712345678", "255712345678", "+0712345678", "+12345678", "+1234567890123456", "+255 712 345 678", "+255712345678?text=hello", "+255712345678/../x", "javascript:alert(1)", "+255712345678\n", "<script>"]) {
      expect(whatsAppHref(value), String(value)).toBeNull();
    }
  });

  it("renders a link that opens in a new tab without telling WhatsApp where it came from, or nothing at all", () => {
    const html = renderToStaticMarkup(createElement(WhatsAppLink, { phone: "+255712345678", className: "x" }));
    expect(html).toContain('href="https://wa.me/255712345678"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('referrerPolicy="no-referrer"');
    expect(html).toContain("Message on WhatsApp");
    // No message text, no order number: only the number is in the address.
    expect(html).not.toMatch(/wa\.me\/[0-9]+[?#/]/);
    expect(renderToStaticMarkup(createElement(WhatsAppLink, { phone: "0712 345 678", className: "x" }))).toBe("");
    expect(renderToStaticMarkup(createElement(WhatsAppLink, { phone: null, className: "x" }))).toBe("");
  });
});
