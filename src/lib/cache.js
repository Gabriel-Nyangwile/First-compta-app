// Simple in-memory cache with TTL and promise coalescing.
// Not suitable for multi-instance deployments (per-process only).
const caches = {
  personnel: {
    summary: new Map(),
    trend: new Map(),
  }
};

function getTTL() {
  const v = parseInt(process.env.PERSONNEL_CACHE_TTL_MS || '30000', 10);
  return Number.isNaN(v) ? 30000 : v;
}

function makeKey(parts) {
  return parts.join('|');
}

export async function cachedComputePersonnel(kind, keyParts, computeFn, { refresh = false } = {}) {
  const store = caches.personnel[kind];
  const key = makeKey(keyParts);
  const now = Date.now();
  const ttl = getTTL();
  const existing = store.get(key);
  if (!refresh && existing && existing.expires > now && existing.data) {
    return { hit: true, data: existing.data };
  }
  if (!refresh && existing && existing.promise) {
    const data = await existing.promise; // Await in-flight computation
    return { hit: true, data };
  }
  // Start new computation
  const promise = (async () => {
    const data = await computeFn();
    store.set(key, { data, expires: Date.now() + ttl });
    return data;
  })();
  store.set(key, { promise });
  try {
    const data = await promise;
    return { hit: false, data };
  } finally {
    const entry = store.get(key);
    if (entry && entry.promise) {
      // If promise resolved but data not set (error path), ensure cleanup.
      if (!entry.data) store.delete(key);
    }
  }
}

export function invalidatePersonnel(kind, keyParts) {
  const store = caches.personnel[kind];
  const key = makeKey(keyParts);
  store.delete(key);
}
