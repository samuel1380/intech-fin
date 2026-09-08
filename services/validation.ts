import { z } from 'zod';
import {
  TransactionCategory,
  TransactionStatus,
  TransactionType,
} from '../types';
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + 'T12:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Data inválida');
const optionalDate = z.union([date, z.literal('')]).optional();
const money = z.number().finite().min(0).max(999999999999);
const fields = z.object({
  date,
  serviceDate: optionalDate,
  description: z.string().trim().min(1).max(500),
  amount: money,
  type: z.enum(TransactionType),
  category: z.enum(TransactionCategory),
  status: z.enum(TransactionStatus),
  notes: z.string().max(5000).optional(),
  employeeName: z.string().max(160).optional(),
  commissionRate: z.number().finite().min(0).max(100).optional(),
  commissionAmount: money.optional(),
  commissionPaymentDate: optionalDate,
  pendingAmount: money.optional(),
  isRecurring: z.boolean().optional(),
  recurringIntervalMonths: z.number().int().min(1).max(120).optional(),
  recurringDay: z.number().int().min(1).max(31).optional(),
});
export const transactionSchema = fields.refine(
  (t) => t.pendingAmount === undefined || t.pendingAmount <= t.amount,
  'Saldo pendente superior ao valor',
);
export const transactionPatchSchema = fields.partial();
export const taxSchema = z.object({
  name: z.string().trim().min(1).max(120),
  percentage: z.number().finite().min(0).max(100),
});
export const idSchema = z.string().uuid();
