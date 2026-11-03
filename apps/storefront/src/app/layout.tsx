import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { ACTIVE_COUNTRY } from "@tronic/country-config";
import { Header } from "@/components/header/Header";
import { Footer } from "@/components/footer/Footer";
import { BottomNav } from "@/components/nav/BottomNav";
import "./globals.css";

// Headings: Montserrat 500/600/700 (master prompt §4; 800/900 intentionally
// not loaded). Body/UI: the native system font stack — owner decision
// (Nov 2026): real SF Pro on Apple devices, Segoe UI on Windows, Roboto on
// Android, with zero font download. The stack lives in tokens.css as
// --font-fallback-body; no --font-body is injected, so the fallback applies.
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-heading",
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
        className={`${montserrat.variable} flex min-h-screen flex-col max-md:pb-[calc(3.5rem+env(safe-area-inset-bottom))]`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2"
        >
          Skip to main content
        </a>
        <Header />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
        <BottomNav />
      </body>
    </html>
  );
}
