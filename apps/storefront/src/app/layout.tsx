import type { Metadata } from "next";
import localFont from "next/font/local";
import { ToastProvider } from "@tronic/ui";
import { ACTIVE_COUNTRY } from "@tronic/country-config";
import { Header } from "@/components/header/Header";
import { Footer } from "@/components/footer/Footer";
import { BottomNav } from "@/components/nav/BottomNav";
import "./globals.css";

// Brand typography (owner decision 2026-11-04, supersedes the interim
// system-stack body): Montserrat 500/600/700 for headings (800/900
// intentionally not loaded), Poppins 400-700 for body/UI. Served as
// self-hosted WOFF2 via next/font/local — the next/font/google loader
// fails intermittently on CI (Next 15.5.x "Cannot read properties of
// null (reading '1')") and self-hosting removes the build-time network
// dependency. Assets + SIL OFL licenses live in src/fonts (see its README).
const montserrat = localFont({
  src: [
    { path: "../fonts/montserrat-latin-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/montserrat-latin-600.woff2", weight: "600", style: "normal" },
    { path: "../fonts/montserrat-latin-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-heading",
  display: "swap",
  fallback: ["Segoe UI", "Arial", "sans-serif"],
});

const poppins = localFont({
  src: [
    { path: "../fonts/poppins-latin-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/poppins-latin-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/poppins-latin-600.woff2", weight: "600", style: "normal" },
    { path: "../fonts/poppins-latin-700.woff2", weight: "700", style: "normal" },
  ],
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
    images: [{ url: "/banners/black-november-pendants.webp", width: 1920, height: 500 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "TRONIC Tanzania",
    description:
      "Electrical supplies, LED lighting and switchgear for homes, businesses and industry in Tanzania.",
    images: ["/banners/black-november-pendants.webp"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={ACTIVE_COUNTRY.locale}>
      {/* max-md bottom padding keeps content clear of the fixed mobile tab
          bar, including the device safe-area inset the bar itself absorbs */}
      <body
        className={`${montserrat.variable} ${poppins.variable} flex min-h-screen flex-col max-md:pb-[calc(3.5rem+env(safe-area-inset-bottom))]`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2"
        >
          Skip to main content
        </a>
        <ToastProvider>
          <Header />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer />
          <BottomNav />
        </ToastProvider>
      </body>
    </html>
  );
}
