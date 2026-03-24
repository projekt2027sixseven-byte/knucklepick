"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        /** Fast failure on bad networks; pages can still call refetch(). */
        retry: 1,
        refetchOnWindowFocus: true,
        /** Reduces empty flashes on navigation; screens with live data override when needed. */
        staleTime: 30_000,
      },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => makeClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
