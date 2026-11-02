import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import { ACTIVE_COUNTRY } from "@tronic/country-config";
import { Header } from "@/components/header/Header";
import { Footer } from "@/components/footer/Footer";
import { BottomNav } from "@/components/nav/BottomNav";
import "./globals.css";

// Headings: Montserrat 500/600/700 (master prompt §4; 800/900 intentionally
// not loaded). Body/UI: Inter — owner decision (Nov 2026) replacing Poppins
// for an SF Pro-like interface feel; SF Pro itself is Apple-proprietary and
// cannot legally be embedded as a web font.
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-heading",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={ACTIVE_COUNTRY.locale}>
      {/* max-md bottom padding keeps content clear of the fixed mobile tab bar */}
      <body className={`${montserrat.variable} ${inter.variable} flex min-h-screen flex-col max-md:pb-14`}>
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
