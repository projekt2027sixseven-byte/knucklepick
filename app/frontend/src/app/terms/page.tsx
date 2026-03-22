import type { Metadata } from "next";
import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Terms",
  description: `Terms of use for ${PRODUCT_NAME}.`,
};

export default function TermsPage() {
  return (
    <div className="max-w-2xl space-y-8 pb-12">
      <div>
        <p className="page-eyebrow">Legal</p>
        <h1 className="page-title mt-3">Terms of use</h1>
        <p className="text-slate-500 text-sm mt-2">Last updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
      </div>
      <div className="space-y-6 text-slate-300 leading-relaxed text-sm">
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
      <Link href="/" className="text-sm text-cyan-300/90 hover:text-cyan-200 font-medium">
        ← Back to home
      </Link>
    </div>
  );
}
