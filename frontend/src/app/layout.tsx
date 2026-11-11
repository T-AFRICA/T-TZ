import type { Metadata } from "next";
import localFont from "next/font/local";
import { ToastProvider } from "@tronic/ui";
import { ACTIVE_COUNTRY } from "@tronic/country-config";
import { Header } from "@/components/header/Header";
import { Navbar } from "@/components/header/Navbar";
import { Footer } from "@/components/footer/Footer";
import { BottomNav } from "@/components/nav/BottomNav";
import { WhatsAppButton } from "@/components/whatsapp/WhatsAppButton";
import "./globals.css";

// Brand typography (owner decision 2026-11-07, supersedes Montserrat +
// Poppins): Outfit, one variable file for headings, body and UI. It sets
// --font-body; globals.css points --font-heading at the same family so the
// components' heading/body variables keep working unchanged. Served as
// self-hosted WOFF2 via next/font/local — the next/font/google loader fails
// intermittently on CI (Next 15.5.x "Cannot read properties of null
// (reading '1')") and self-hosting removes the build-time network
// dependency. Asset + SIL OFL license live in src/fonts (see its README).
const outfit = localFont({
  src: [{ path: "../fonts/outfit-latin-variable.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-body",
  display: "swap",
  fallback: [
    "-apple-system",
    "BlinkMacSystemFont",
    "Segoe UI",
    "Roboto",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ],
});

export const metadata: Metadata = {
  title: {
    default: "TRONIC Tanzania",
    template: "%s | TRONIC Tanzania",
  },
  description:
    "Electrical supplies, LED lighting and switchgear for homes, businesses and industry in Tanzania.",
  // Pre-launch shell: keep the site out of search indexes until the
  // Tanzania launch gate. Remove at go-live (SRS NFR-20 applies then).
  robots: { index: false, follow: false },
  // Social-share cards. The production domain is not confirmed yet: set
  // NEXT_PUBLIC_SITE_URL at deploy time; localhost keeps dev/CI honest.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: {
    siteName: "TRONIC Tanzania",
    title: "TRONIC Tanzania",
    description:
      "Electrical supplies, LED lighting and switchgear for homes, businesses and industry in Tanzania.",
    type: "website",
    locale: "en_TZ",
    // A neutral card cut from the hero scene. The campaign banner carried a
    // "Black November — up to 50% off" claim that this pre-launch site does
    // not make, so it must not be what a shared link shows.
    images: [{ url: "/og/tronic-tanzania.jpg", width: 1200, height: 630, alt: "TRONIC Tanzania" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "TRONIC Tanzania",
    description:
      "Electrical supplies, LED lighting and switchgear for homes, businesses and industry in Tanzania.",
    images: ["/og/tronic-tanzania.jpg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={ACTIVE_COUNTRY.locale}>
      {/* max-md bottom padding keeps content clear of the fixed mobile tab
          bar, including the device safe-area inset the bar itself absorbs */}
      <body
        className={`${outfit.variable} flex min-h-screen flex-col max-md:pb-[calc(3.5rem+env(safe-area-inset-bottom))]`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2"
        >
          Skip to main content
        </a>
        <ToastProvider>
          {/* data-site-chrome wrappers are layout-neutral (display: contents);
              the login screen hides them (globals.css, data-auth-screen). */}
          <div data-site-chrome className="contents">
            <Header />
            {/* Outside the sticky header on purpose: on desktop the category
                navbar scrolls away with the page and is back at the top. */}
            <Navbar />
          </div>
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <div data-site-chrome className="contents">
            <Footer />
            <BottomNav />
            <WhatsAppButton />
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
