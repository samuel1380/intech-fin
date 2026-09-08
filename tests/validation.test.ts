import { it, expect } from 'vitest';
import { transactionSchema } from '../services/validation';
const tx = {
  description: 'Serviço',
  date: '2026-02-28',
  amount: 100,
  type: 'RECEITA',
  category: 'Vendas',
  status: 'PENDENTE',
};
it.each([
  { amount: NaN },
  { amount: -1 },
  { date: '2026-02-31' },
  { recurringIntervalMonths: 0 },
  { pendingAmount: 101 },
  { description: '' },
])('rejects invalid financial inputs %j', (bad) =>
  expect(transactionSchema.safeParse({ ...tx, ...bad }).success).toBe(false),
);
it('strips privileged fields from client submissions', () => {
  const clean = transactionSchema.parse({
    ...tx,
    user_id: 'other-user',
    id: 'chosen-id',
  });
  expect(clean).not.toHaveProperty('user_id');
  expect(clean).not.toHaveProperty('id');
});
