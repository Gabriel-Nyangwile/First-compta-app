let resolvedHeadersFn = null;

function getEnvOrigin() {
  const envValue =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.VERCEL_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;
  if (!envValue) return null;
  if (envValue.startsWith("http://") || envValue.startsWith("https://")) {
    return envValue.replace(/\/$/, "");
  }
  return `https://${envValue.replace(/\/$/, "")}`;
}

async function resolveHeadersModule() {
  if (resolvedHeadersFn !== null) return resolvedHeadersFn;
  try {
    const mod = await import("next/headers");
    resolvedHeadersFn = typeof mod.headers === "function" ? mod.headers : null;
  } catch (err) {
    resolvedHeadersFn = null;
  }
  return resolvedHeadersFn;
}

/**
 * Build an absolute URL for internal API calls in server components / routes.
 * Falls back to environment configuration when request headers are unavailable.
 */
export async function absoluteUrl(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  const headersFn = await resolveHeadersModule();
  if (headersFn) {
    try {
      const result = headersFn();
      const h =
        result && typeof result.then === "function" ? await result : result;
      if (h) {
        const host =
          h.get("x-forwarded-host") ||
          h.get("host") ||
          process.env.VERCEL_URL ||
          "localhost:3000";
        const proto =
          h.get("x-forwarded-proto") ||
          (host.startsWith("localhost") ? "http" : "https");
        return `${proto}://${host}${path}`;
      }
    } catch (err) {
      // Ignore and fallback to env configuration
    }
  }

  const origin = getEnvOrigin() || "http://localhost:3000";
  return `${origin}${path}`;
}
