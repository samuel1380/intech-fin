import { it, expect } from 'vitest';
import { calculateSummary } from '../services/transactionService';
import { csvCell } from '../services/csv';
import {
  TransactionType,
  TransactionStatus,
  TransactionCategory,
} from '../types';
const tx = {
  id: '00000000-0000-4000-8000-000000000001',
  date: '2026-09-08',
  description: 'Test',
  amount: 100,
  type: TransactionType.INCOME,
  status: TransactionStatus.PARTIAL,
  category: TransactionCategory.SALES,
  commissionAmount: 10,
};
it('does not pay commission on an entirely unpaid partial transaction', () => {
  const summary = calculateSummary([{ ...tx, pendingAmount: 100 }]);
  expect(summary.totalIncome).toBe(0);
  expect(summary.totalCommissions).toBe(0);
  expect(summary.pendingInvoices).toBe(100);
});
it('calculates proportional commission and only configured taxes', () => {
  const result = calculateSummary(
    [{ ...tx, pendingAmount: 30 }],
    [{ id: 'tax', name: 'Imposto', percentage: 10 }],
  );
  expect(result.totalIncome).toBe(70);
  expect(result.totalCommissions).toBe(7);
  expect(result.taxLiabilityEstimate).toBe(7);
  expect(result.netProfit).toBe(56);
});
it.each(['=SUM(A1:A2)', '+CMD', '@SUM(1)', '-1+2', '  =malicious', '\t=cmd'])(
  'escapes formula cells %s',
  (value) => expect(csvCell(value)).toMatch(/^"'/),
);
it('escapes quotes and separators inside exported text', () =>
  expect(csvCell('Ana;"Silva"')).toBe('"Ana;""Silva"""'));
