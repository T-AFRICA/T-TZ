import { WhatsAppIcon } from "@tronic/ui";
import { whatsappHref } from "@/config/site";

/**
 * Floating WhatsApp chat button (owner request 2026-11-10), bottom-right on
 * every page. It opens a WhatsApp chat with a short greeting in a new tab.
 *
 * Motion and placement live in globals.css (`.wa-float`): a soft entrance
 * shortly after load, a few gentle pulse rings, a lift and icon wiggle on
 * hover, and a "Chat with us" label on hover or keyboard focus (pointer
 * devices only). Reduced-motion users get the button without any of it.
 * On phones it sits above the bottom tab bar; on phone product pages it is
 * hidden, since the sticky purchase bar is there and the button would cover
 * the quantity stepper (owner decision 2026-11-10).
 *
 * The number is still a placeholder in config/site.ts (WHATSAPP).
 */
export function WhatsAppButton() {
  return (
    <div className="wa-float">
      <a
        href={whatsappHref()}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with TRONIC on WhatsApp (opens in a new tab)"
        className="wa-float__button"
      >
        <WhatsAppIcon size={28} />
      </a>
      <span aria-hidden="true" className="wa-float__label">
        Chat with us
      </span>
    </div>
  );
}
