import { beforeEach, it, expect, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  pages: [] as any[],
  offsets: [] as number[],
  user: vi.fn(async () => 'account-id'),
}));
vi.mock('../services/supabase', () => ({
  isSupabaseConfigured: true,
  requireUserId: mock.user,
  supabase: {
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        range: (start: number) => {
          mock.offsets.push(start);
          return Promise.resolve(
            mock.pages.shift() || { data: [], error: null },
          );
        },
      };
      return query;
    },
  },
}));
import { getAllTransactionsFromDb } from '../services/transactionService';
beforeEach(() => {
  mock.pages = [];
  mock.offsets = [];
  mock.user.mockClear();
});
it('reads through a server cap of 100 and includes March history', async () => {
  const all = Array.from({ length: 623 }, (_, i) => ({
    id: String(i),
    date: i < 100 ? '2026-07-20' : '2026-03-09',
  }));
  for (let i = 0; i < all.length; i += 100)
    mock.pages.push({ data: all.slice(i, i + 100), error: null });
  const result = await getAllTransactionsFromDb();
  expect(result).toHaveLength(623);
  expect(result.at(-1)?.date).toBe('2026-03-09');
  expect(mock.offsets).toEqual([0, 100, 200, 300, 400, 500, 600, 623]);
  expect(mock.user).toHaveBeenCalledTimes(1);
});
it('does not turn a later page failure into a partial financial history', async () => {
  mock.pages = [
    { data: [{ id: 'first' }], error: null },
    { data: null, error: { code: '42501' } },
  ];
  await expect(getAllTransactionsFromDb()).rejects.toMatchObject({
    code: '42501',
  });
});
it('stops at an empty database', async () =>
  expect(await getAllTransactionsFromDb()).toEqual([]));
it('rejects a server that ignores pagination', async () => {
  mock.pages = [
    { data: [{ id: 'same' }], error: null },
    { data: [{ id: 'same' }], error: null },
  ];
  await expect(getAllTransactionsFromDb()).rejects.toThrow('não avançou');
});
