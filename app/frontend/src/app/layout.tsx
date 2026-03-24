import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/QueryProvider";
import { AppShell } from "@/components/AppShell";
import { AuthSessionBridge } from "@/components/AuthSessionBridge";
import { OnboardingModal } from "@/components/OnboardingModal";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/constants";
import { getPublicEnv } from "@/lib/env";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: `${PRODUCT_NAME} · ${PRODUCT_TAGLINE}`,
    template: `%s · ${PRODUCT_NAME}`,
  },
  description:
    "Football match intelligence: calibrated probabilities, risk flags, watchlists, and vault snapshots — analytical tooling, not a tipping service.",
  applicationName: PRODUCT_NAME,
  openGraph: {
    title: `${PRODUCT_NAME} · ${PRODUCT_TAGLINE}`,
    description:
      "Probabilities, trust rails, watchlists, and vault — for analysis; past results do not guarantee future outcomes.",
    url: appUrl,
    siteName: PRODUCT_NAME,
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${PRODUCT_NAME} · ${PRODUCT_TAGLINE}`,
    description:
      "Probabilities, trust rails, watchlists, and vault — for analysis; past results do not guarantee future outcomes.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${display.variable} ${dmSans.variable} font-sans antialiased`}>
        <QueryProvider>
          <AuthSessionBridge />
          <AppShell>
            {children}
            <OnboardingModal />
          </AppShell>
        </QueryProvider>
      </body>
    </html>
  );
}
