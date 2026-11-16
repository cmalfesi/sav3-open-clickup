"use client";

import {failWrite} from "@/lib/write-status";
import {WriteFeedback} from "./write-feedback";
import { QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster, toast } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({onError:(error)=>{failWrite(error);toast.error("No se pudo guardar el cambio",{description:error.message});}}),
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}<WriteFeedback/><Toaster position="bottom-right" /></QueryClientProvider>;
}
