import type { Metadata } from "next";
import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Privacy",
  description: `Privacy practices for ${PRODUCT_NAME}.`,
};

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl pb-12">
      <div className="glass-strong rounded-[1.75rem] border border-white/[0.08] p-8 md:p-10 space-y-8 relative overflow-hidden">
        <div className="absolute -bottom-20 -left-12 w-64 h-64 bg-knuckle-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div>
            <p className="page-eyebrow">Knuckle · Legal</p>
            <h1 className="page-title mt-3">Privacy</h1>
            <p className="text-slate-500 text-sm mt-2">
              Last updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="space-y-6 text-slate-300 leading-relaxed text-sm pt-2">
            <p>
              {PRODUCT_NAME} (&quot;we&quot;, &quot;us&quot;) provides analytical tools. This page describes how we handle information in
              connection with the service. For payment processing, our payment provider (e.g. Stripe) processes billing data under
              their own terms and privacy policy.
            </p>
            <h2 className="text-lg font-semibold text-white mt-8">Information you provide</h2>
            <p>
              Account details you submit (such as email and name) are used to operate authentication, entitlements, and support.
              You can request access or deletion of personal data subject to legal and operational retention needs.
            </p>
            <h2 className="text-lg font-semibold text-white mt-8">Usage and analytics</h2>
            <p>
              We may log technical data (such as IP, device, and timestamps) for security, abuse prevention, and product
              improvement. We do not sell your personal information.
            </p>
            <h2 className="text-lg font-semibold text-white mt-8">Cookies</h2>
            <p>
              We use cookies or similar technologies where needed for sessions and preferences. You can control cookies through
              your browser.
            </p>
            <h2 className="text-lg font-semibold text-white mt-8">Contact</h2>
            <p>
              Questions about privacy should go to your support channel after you configure it for production. This template is
              not legal advice — have counsel review before launch.
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
