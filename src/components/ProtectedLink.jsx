"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getClientRole, can } from "@/lib/clientRbac";

/**
 * Renders a link only if the user has the required action permission.
 * mode="hide" (default) hides the element; mode="disable" renders a disabled span.
 */
export default function ProtectedLink({
  action,
  href,
  children,
  mode = "hide",
  className = "",
  ...rest
}) {
  const [hydrated, setHydrated] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const role = getClientRole();
    setAllowed(can(action, role));
    setHydrated(true);
  }, [action]);

  if (!hydrated && mode === "hide") return null;
  if (!hydrated && mode === "disable") {
    return (
      <span
        aria-disabled="true"
        className={`${className} opacity-50 cursor-not-allowed`}
        {...rest}
      >
        {children}
      </span>
    );
  }

  if (!allowed && mode === "hide") return null;
  if (!allowed && mode === "disable") {
    return (
      <span
        aria-disabled="true"
        className={`${className} opacity-50 cursor-not-allowed`}
        {...rest}
      >
        {children}
      </span>
    );
  }

  return (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  );
}
