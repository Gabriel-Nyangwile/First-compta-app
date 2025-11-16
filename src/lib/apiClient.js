import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  createElement,
} from "react";

const defaultToken =
  (typeof process !== "undefined" && process.env.ADMIN_TOKEN) ||
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_ADMIN_TOKEN) ||
  "GLN-2709";

/**
 * Wrapper around fetch that injects the x-admin-token header required by protected API routes.
 * The token comes from NEXT_PUBLIC_ADMIN_TOKEN (client) or ADMIN_TOKEN (server).
 * Fallback default is "GLN-2709" so you can replace it later.
 */
export async function authorizedFetch(input, init = {}) {
  const headers = {
    ...(init.headers || {}),
    "x-admin-token":
      (typeof window === "undefined"
        ? process.env.ADMIN_TOKEN || process.env.NEXT_PUBLIC_ADMIN_TOKEN
        : process.env.NEXT_PUBLIC_ADMIN_TOKEN) || defaultToken,
  };

  return fetch(input, {
    ...init,
    headers,
  });
}

export const AuthorizedFetchContext = createContext(authorizedFetch);
AuthorizedFetchContext.displayName = "AuthorizedFetchContext";

export function AuthorizedFetchProvider({ children, fetchImpl }) {
  const value = useMemo(() => fetchImpl || authorizedFetch, [fetchImpl]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.authorizedFetch = value;
    }
  }, [value]);

  return createElement(
    AuthorizedFetchContext.Provider,
    { value },
    children
  );
}

export function useAuthorizedFetch() {
  return useContext(AuthorizedFetchContext);
}
