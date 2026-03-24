import type { Metadata } from "next";
import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Terms",
  description: `Terms of use for ${PRODUCT_NAME}.`,
};

export default function TermsPage() {
  return (
    <div className="max-w-2xl pb-12">
      <div className="glass-strong rounded-[1.75rem] border border-white/[0.08] p-8 md:p-10 space-y-8 relative overflow-hidden">
        <div className="absolute -top-24 -right-16 w-72 h-72 bg-knuckle-primary/12 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div>
            <p className="page-eyebrow">Knuckle · Legal</p>
            <h1 className="page-title mt-3">Terms of use</h1>
            <p className="text-slate-500 text-sm mt-2">
              Last updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="space-y-6 text-slate-300 leading-relaxed text-sm pt-2">
            <p>
              By accessing {PRODUCT_NAME}, you agree to these terms. If you disagree, do not use the service.
            </p>
            <h2 className="text-lg font-semibold text-white mt-8">Nature of the service</h2>
            <p>
              The product provides probabilistic analysis and tooling for information purposes. It is not gambling advice,
              financial advice, or a promise of results. Past model behaviour does not guarantee future performance.
            </p>
            <h2 className="text-lg font-semibold text-white mt-8">Accounts and billing</h2>
            <p>
              Subscriptions and renewals are governed by the checkout flow and your payment provider. You are responsible for
              maintaining account security and for activity under your credentials.
            </p>
            <h2 className="text-lg font-semibold text-white mt-8">Acceptable use</h2>
            <p>
              You may not misuse the API, scrape in violation of our rules, attempt to disrupt the service, or use outputs in
              ways that violate applicable law in your jurisdiction.
            </p>
            <h2 className="text-lg font-semibold text-white mt-8">Disclaimer</h2>
            <p>
              The service is provided &quot;as is&quot; without warranties of any kind. To the maximum extent permitted by law,
              we disclaim liability for indirect or consequential damages arising from use of the product.
            </p>
            <p className="text-slate-500 text-xs pt-4">
              Template only — obtain legal review before publishing to customers.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex mt-8 text-sm text-knuckle-primary font-semibold hover:text-sky-200 transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
