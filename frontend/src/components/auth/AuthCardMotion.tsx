"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Set once the first account card has mounted in this browser tab. Module
 * state survives client-side navigation, so a card opened by moving between
 * login, register and the password pages knows it is a swap.
 */
let entered = false;

/**
 * Card column of an account screen. On the first page load the card plays
 * the full entrance (globals.css, "Account screen motion"); after a client
 * navigation it carries data-swap and plays a short swap instead, because
 * the stage around it is already on screen. data-long turns on the compact
 * card rules for the longer forms.
 *
 * The server render never has data-swap (entered is false there and on the
 * first hydration), so server and client markup match.
 */
export function AuthCardMotion({ long, children }: { long: boolean; children: ReactNode }) {
  const [swap] = useState(() => entered);
  useEffect(() => {
    entered = true;
  }, []);
  return (
    <div
      data-long={long || undefined}
      data-swap={swap || undefined}
      className="login-panel-wrap mt-4 flex w-full flex-col items-center sm:mt-6 lg:mt-0"
    >
      {children}
    </div>
  );
}
