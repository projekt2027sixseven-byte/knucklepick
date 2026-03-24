import { Suspense } from "react";
import AccountClient from "./AccountClient";

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl space-y-6 pb-8">
          <div className="h-10 w-48 rounded-lg skeleton-shimmer border border-white/[0.06]" />
          <div className="h-32 rounded-2xl skeleton-shimmer border border-white/[0.06]" />
        </div>
      }
    >
      <AccountClient />
    </Suspense>
  );
}
