import { api, apiCached, ApiError } from '../services/apiClient';

// Mock metaStateService
jest.mock('../services/metaStateService', () => ({
  getMeta: jest.fn(),
  setMeta: jest.fn(),
}));

// Mock authEvents
jest.mock('../services/authEvents', () => ({
  emitAuthChange: jest.fn(),
}));

const { getMeta, setMeta } = require('../services/metaStateService');
const { emitAuthChange } = require('../services/authEvents');

// Mock global fetch
const mockFetch = jest.fn();
(globalThis as Record<string, unknown>).fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
  getMeta.mockResolvedValue('test-token');
});

describe('api', () => {
  it('injects auth token from meta_state', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    });

    await api('/api/test');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/test'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  it('skips auth when skipAuth is true', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    });

    await api('/api/auth/login', { skipAuth: true, method: 'POST', body: { email: 'x' } });

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers).not.toHaveProperty('Authorization');
  });

  it('sends JSON body for POST requests', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await api('/api/test', { method: 'POST', body: { key: 'value' } });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ key: 'value' }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('throws ApiError on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ errors: ['Invalid'] }),
    });

    await expect(api('/api/test')).rejects.toThrow(ApiError);

    try {
      await api('/api/test');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(422);
      expect((err as ApiError).body).toEqual({ errors: ['Invalid'] });
    }
  });

  it('auto-logouts on 401 response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    });

    await expect(api('/api/test')).rejects.toThrow(ApiError);

    expect(setMeta).toHaveBeenCalledWith('auth_token', '');
    expect(setMeta).toHaveBeenCalledWith('has_preferences', 'false');
    expect(emitAuthChange).toHaveBeenCalledWith(null);
  });

  it('does not auto-logout on 401 when skipAuth is true', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Bad credentials' }),
    });

    await expect(api('/api/auth/login', { skipAuth: true })).rejects.toThrow(ApiError);

    expect(setMeta).not.toHaveBeenCalled();
    expect(emitAuthChange).not.toHaveBeenCalled();
  });

  it('returns parsed JSON on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: 42 }),
    });

    const data = await api<{ result: number }>('/api/test');
    expect(data.result).toBe(42);
  });
});

describe('apiCached', () => {
  it('caches response on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ plan: 'data' }),
    });

    const result = await apiCached('/api/plans/current', 'cache_key');

    expect(result).toEqual({ plan: 'data' });
    expect(setMeta).toHaveBeenCalledWith('cache_key', JSON.stringify({ plan: 'data' }));
  });

  it('returns cached data on network failure', async () => {
    mockFetch.mockRejectedValue(new TypeError('Network error'));
    getMeta.mockImplementation((key: string) => {
      if (key === 'auth_token') return Promise.resolve('test-token');
      if (key === 'cache_key') return Promise.resolve(JSON.stringify({ plan: 'cached' }));
      return Promise.resolve(null);
    });

    const result = await apiCached('/api/plans/current', 'cache_key');
    expect(result).toEqual({ plan: 'cached' });
  });

  it('throws on network failure with no cache', async () => {
    mockFetch.mockRejectedValue(new TypeError('Network error'));
    getMeta.mockImplementation((key: string) => {
      if (key === 'auth_token') return Promise.resolve('test-token');
      return Promise.resolve(null);
    });

    await expect(apiCached('/api/plans/current', 'cache_key')).rejects.toThrow('Network error');
  });

  it('re-throws ApiError without falling back to cache', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: 'Forbidden' }),
    });

    await expect(apiCached('/api/test', 'cache_key')).rejects.toThrow(ApiError);
  });
});
