import { API_BASE_URL } from '../config';
import { getMeta, setMeta } from './metaStateService';
import { emitAuthChange } from './authEvents';

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message?: string,
  ) {
    super(message ?? `API error ${status}`);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 1 day before expiry
let refreshing: Promise<void> | null = null;

async function refreshTokenIfNeeded(): Promise<void> {
  const expiresAt = await getMeta('token_expires_at');
  if (!expiresAt) return;

  const expiresMs = new Date(expiresAt).getTime();
  if (expiresMs - Date.now() > REFRESH_THRESHOLD_MS) return;

  // Already refreshing — wait for it
  if (refreshing) return refreshing;

  refreshing = (async () => {
    try {
      const token = await getMeta('auth_token');
      if (!token) return;

      const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const body = await res.json();
        await setMeta('auth_token', body.api_token);
        await setMeta('token_expires_at', body.token_expires_at);
      }
    } catch {
      // Non-fatal — will retry on next request
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, skipAuth = false } = options;

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (!skipAuth) {
    await refreshTokenIfNeeded();
    const token = await getMeta('auth_token');
    if (token) {
      finalHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: finalHeaders,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      parsed = null;
    }

    // Auto-logout on 401 — token was invalidated server-side
    if (res.status === 401 && !skipAuth) {
      await setMeta('auth_token', '');
      await setMeta('has_preferences', 'false');
      emitAuthChange(null);
    }

    throw new ApiError(res.status, parsed);
  }

  return res.json() as Promise<T>;
}

/**
 * Fetch with offline cache fallback.
 * On success: caches response in meta_state under the given key.
 * On failure: returns cached data if available, otherwise re-throws.
 */
export async function apiCached<T = unknown>(
  path: string,
  cacheKey: string,
  options: RequestOptions = {},
): Promise<T> {
  try {
    const data = await api<T>(path, options);
    await setMeta(cacheKey, JSON.stringify(data));
    return data;
  } catch (err) {
    // On network failure (not API errors like 401/403), try cache
    if (err instanceof ApiError) throw err;

    const cached = await getMeta(cacheKey);
    if (cached) {
      return JSON.parse(cached) as T;
    }
    throw err;
  }
}
