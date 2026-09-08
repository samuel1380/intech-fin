import { it, expect, vi } from 'vitest';
import vm from 'node:vm';
import fs from 'node:fs';
function worker() {
  const handlers: Record<string, (e: any) => void> = {};
  const showNotification = vi.fn().mockResolvedValue(undefined),
    openWindow = vi.fn().mockResolvedValue(undefined),
    remove = vi.fn().mockResolvedValue(true);
  const self = {
    location: { origin: 'https://finance.example' },
    registration: { showNotification },
    skipWaiting: vi.fn(),
    clients: {
      claim: vi.fn(),
      matchAll: vi.fn().mockResolvedValue([]),
      openWindow,
    },
    addEventListener: (name: string, handler: (e: any) => void) => {
      handlers[name] = handler;
    },
  };
  const caches = {
    keys: async () => ['finnexus-v2', 'another-app', 'finnexus-shell-v3'],
    delete: remove,
    open: vi.fn(),
    match: vi.fn(),
  };
  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), {
    self,
    caches,
    URL,
    Response,
    fetch: vi.fn(),
  });
  const emit = async (name: string, event: any = {}) => {
    let result: unknown;
    handlers[name]({
      ...event,
      waitUntil: (promise: Promise<unknown>) => {
        result = promise;
      },
    });
    await result;
  };
  return { emit, handlers, showNotification, openWindow, remove };
}
it('receives malformed push payload without crashing', async () => {
  const w = worker();
  await w.emit('push', {
    data: {
      json: () => {
        throw new Error();
      },
      text: () => 'Mensagem de teste',
    },
  });
  expect(w.showNotification.mock.calls[0][1].body).toBe('Mensagem de teste');
});
it('pins notification URLs to the app origin', async () => {
  const w = worker();
  await w.emit('push', {
    data: {
      json: () => ({ title: 'Alert', url: 'https://evil.example/phishing' }),
    },
  });
  expect(w.showNotification.mock.calls[0][1].data.url).toBe(
    'https://finance.example/',
  );
  await w.emit('notificationclick', {
    notification: { close: vi.fn(), data: { url: 'javascript:alert(1)' } },
  });
  expect(w.openWindow).toHaveBeenCalledWith('https://finance.example/');
});
it('does not intercept APIs or cross-origin resources', () => {
  const w = worker(),
    respondWith = vi.fn();
  for (const url of [
    'https://finance.example/api/private',
    'https://example.supabase.co/rest/v1/transactions',
  ])
    w.handlers.fetch({
      request: { url, method: 'GET', mode: 'cors' },
      respondWith,
    });
  expect(respondWith).not.toHaveBeenCalled();
});
it('only removes its own old caches', async () => {
  const w = worker();
  await w.emit('activate');
  expect(w.remove.mock.calls).toEqual([['finnexus-v2']]);
});
