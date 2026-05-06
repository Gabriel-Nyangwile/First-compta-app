import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  createElement,
} from "react";

export async function authorizedFetch(input, init = {}) {
  const token =
    typeof window === "undefined"
      ? process.env.ADMIN_TOKEN || process.env.NEXT_PUBLIC_ADMIN_TOKEN || null
      : process.env.NEXT_PUBLIC_ADMIN_TOKEN || null;
  const headers = { ...(init.headers || {}) };
  if (token) {
    headers["x-admin-token"] = token;
  }

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
