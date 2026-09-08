import { describe, it, expect, vi } from 'vitest';
import { runPing } from '../scripts/keepalive-ping.js';
const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-server-secret',
};
describe('keepalive', () => {
  it('fails closed without configuration', async () => {
    const fetcher = vi.fn();
    await expect(runPing({ env: {}, fetcher })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('retries transient failures and only writes maintenance health', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValue({ ok: true, json: async () => [{ id: 1 }] });
    const log = vi.fn(),
      sleep = vi.fn();
    await runPing({ env, fetcher, log, sleep });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][0].pathname).toBe(
      '/rest/v1/maintenance_health',
    );
    expect(fetcher.mock.calls[0][1].method).toBe('PATCH');
    expect(JSON.stringify(log.mock.calls)).not.toContain(
      env.SUPABASE_SERVICE_ROLE_KEY,
    );
  });
  it('does not retry invalid credentials', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    await expect(
      runPing({ env, fetcher, log: vi.fn(), sleep: vi.fn() }),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('caps retries and detects missing sentinel', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [] });
    await expect(
      runPing({ env, fetcher, log: vi.fn(), sleep: vi.fn() }),
    ).rejects.toThrow('não inicializada');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
