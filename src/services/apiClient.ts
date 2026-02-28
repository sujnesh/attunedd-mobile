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

/**
 * Shared API client — centralized fetch with auth token injection.
 *
 * Usage:
 *   const data = await api('/api/coaching/projections');
 *   const data = await api('/api/auth/login', { method: 'POST', body: { email, password }, skipAuth: true });
 */
export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, skipAuth = false } = options;

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (!skipAuth) {
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
