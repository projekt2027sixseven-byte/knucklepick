import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/QueryProvider";
import { AppShell } from "@/components/AppShell";
import { OnboardingModal } from "@/components/OnboardingModal";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/constants";
import { getPublicEnv } from "@/lib/env";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: `${PRODUCT_NAME} · ${PRODUCT_TAGLINE}`,
    template: `%s · ${PRODUCT_NAME}`,
  },
  description:
    "Oracle Pitch — a premium football intelligence desk: calibrated probabilities, trust indexing, similarity cohorts, and vault workflows. Built for analysts who want process, not hype.",
  applicationName: PRODUCT_NAME,
  openGraph: {
    title: `${PRODUCT_NAME} · ${PRODUCT_TAGLINE}`,
    description:
      "Calibrated match intelligence, trust & risk governance, watchlists and vaults — a serious control room for football probabilities.",
    url: appUrl,
    siteName: PRODUCT_NAME,
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${PRODUCT_NAME} · ${PRODUCT_TAGLINE}`,
    description:
      "Calibrated match intelligence, trust & risk governance, watchlists and vaults — a serious control room for football probabilities.",
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
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <QueryProvider>
          <AppShell>
            {children}
            <OnboardingModal />
          </AppShell>
        </QueryProvider>
      </body>
    </html>
  );
}
