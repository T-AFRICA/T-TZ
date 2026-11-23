import type { ReactNode } from "react";
import { WhatsAppIcon } from "@tronic/ui";
import { whatsAppHref } from "@/features/orders/labels";

/**
 * Opens a WhatsApp chat with a customer's number in a new tab, for the
 * people who already see that number (staff on the order, the rider on
 * their delivery). Renders nothing for a number that is not in the
 * international form. The console's address, which carries the order
 * number, is not sent along as the referrer. Nothing is sent by the
 * console itself: the person writes and sends the message in WhatsApp.
 */
export function WhatsAppLink({ phone, className, children = "Message on WhatsApp" }: { phone: string | null | undefined; className: string; children?: ReactNode }) {
  const href = whatsAppHref(phone);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className={className}>
      <WhatsAppIcon size={16} />
      {children}
    </a>
  );
}
