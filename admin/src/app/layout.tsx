import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { ToastProvider } from "@tronic/ui";
import { THEME_COOKIE, parseTheme } from "@/features/theme";
import "./globals.css";

// Brand typography: Myriad Pro for the interface, Arial Black for the few
// display headings (stacks in @tronic/ui tokens.css). Myriad Pro is served
// by the owner's Adobe Fonts web project, as on the storefront; it cannot
// be self-hosted. The kit ID is public; its hosts are allowed in the CSP.
const ADOBE_FONTS_KIT_CSS = "https://use.typekit.net/ikx8ykc.css";

export const metadata: Metadata = {
  title: { default: "TRONIC Central Admin", template: "%s | TRONIC Central Admin" },
  description: "Administration of the TRONIC country storefronts.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The stored theme is applied on the server, so the page never flashes
  // the other theme. No cookie means "follow the device" (globals.css).
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="en" data-theme={theme === "system" ? undefined : theme}>
      <head>
        <link rel="preconnect" href="https://use.typekit.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href={ADOBE_FONTS_KIT_CSS} />
      </head>
      <body className="min-h-screen">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-ink"
        >
          Skip to main content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
