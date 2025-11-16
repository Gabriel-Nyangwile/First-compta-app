"use client";

import { useEffect } from "react";
import { useAuthorizedFetch } from "@/lib/apiClient";

export default function AuthorizedFetchBridge() {
  const fetchFn = useAuthorizedFetch();

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.authorizedFetch = fetchFn;
    }
  }, [fetchFn]);

  return null;
}
