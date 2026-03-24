"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { authSession } from "@/lib/authSession";

export function AuthSessionBridge() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    authSession.onUnauthorized = () => {
      logout();
      router.replace("/account?session=expired");
    };
    return () => {
      authSession.onUnauthorized = null;
    };
  }, [logout, router]);

  return null;
}
