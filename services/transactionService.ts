import {
  FinancialSummary,
  TaxSetting,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../types';
import { isSupabaseConfigured, requireUserId, supabase } from './supabase';
import {
  idSchema,
  transactionPatchSchema,
  transactionSchema,
} from './validation';

const ensureConfig = () => {
  if (!isSupabaseConfigured) {
    throw new Error(
      'CONFIGURAÇÃO AUSENTE: O sistema está em modo "Somente Nuvem". Configure as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no Render para continuar.',
    );
  }
};

// Adicionar Transação
export const addTransactionToDb = async (
  transaction: Omit<Transaction, 'id'>,
): Promise<Transaction> => {
  ensureConfig();
  const newTransaction = {
    ...transactionSchema.parse(transaction),
    user_id: await requireUserId(),
    id: crypto.randomUUID(),
  };

  const { data, error } = await supabase
    .from('transactions')
    .insert([newTransaction])
    .select();

  if (error) {
    console.error('Erro ao salvar no Supabase:', error);
    throw new Error(`Erro no Banco de Dados: ${error.message}`);
  }
  if (!data || data.length === 0) {
    throw new Error(
      'Erro ao salvar: O banco de dados não retornou os dados salvos.',
    );
  }
  return data[0];
};

export async function addTransactionsToDb(
  transactions: Omit<Transaction, 'id'>[],
): Promise<void> {
  if (!transactions.length || transactions.length > 120)
    throw new Error('Use de 1 a 120 parcelas.');
  const user_id = await requireUserId();
  const rows = transactions.map((tx) => ({
    ...transactionSchema.parse(tx),
    user_id,
    id: crypto.randomUUID(),
  }));
  const { error } = await supabase.from('transactions').insert(rows);
  if (error) throw error;
}

// Ler todas as transações
export const getAllTransactionsFromDb = async (): Promise<Transaction[]> => {
  ensureConfig();
  const userId = await requireUserId();
  const rows: Transaction[] = [];
  const seen = new Set<string>();
  // PostgREST may cap responses below the requested range. Advance by what
  // was actually returned and stop only at an empty page, never a short one.
  for (let offset = 0; ;) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('id')
      .range(offset, offset + 499);
    if (error) {
      // PostgREST can return 416 when the next offset is beyond the last row.
      if (error.code === 'PGRST103' && rows.length > 0) return rows;
      throw error;
    }
    if (!data || data.length === 0) return rows;
    let added = 0;
    for (const row of data) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        rows.push(row);
        added++;
      }
    }
    if (!added)
      throw new Error(
        'A paginação do Supabase não avançou. Tente carregar novamente.',
      );
    offset += data.length;
  }
};

// Deletar Transação
export const deleteTransactionFromDb = async (id: string): Promise<void> => {
  ensureConfig();
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', idSchema.parse(id))
    .eq('user_id', await requireUserId());

  if (error) {
    console.error('Erro ao deletar no Supabase:', error);
    throw error;
  }
};

// Atualizar Transação Completa
export const updateTransactionInDb = async (
  id: string,
  updates: Partial<Transaction>,
): Promise<void> => {
  ensureConfig();
  const { error } = await supabase
    .from('transactions')
    .update(transactionPatchSchema.parse(updates))
    .eq('id', idSchema.parse(id))
    .eq('user_id', await requireUserId());

  if (error) {
    console.error('Erro ao atualizar transação no Supabase:', error);
    throw error;
  }
};

// Atualizar Status
export const updateTransactionStatus = async (
  id: string,
  status: TransactionStatus,
): Promise<void> => {
  await updateTransactionInDb(id, { status });
};

// Limpar Banco de Dados
export const clearDatabase = async (): Promise<void> => {
  ensureConfig();
  try {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('user_id', await requireUserId());

    if (error) throw error;
  } catch (error: any) {
    console.error('Erro ao limpar banco de dados:', error);
    throw new Error(
      'Falha ao resetar os dados: ' + (error.message || 'Erro de conexão'),
      { cause: error },
    );
  }
};

// Calcular Resumo Financeiro
export const calculateSummary = (
  transactions: Transaction[],
  taxSettings: TaxSetting[] = [],
): FinancialSummary => {
  const income = transactions
    .filter(
      (t) =>
        t.type === TransactionType.INCOME &&
        (t.status === TransactionStatus.COMPLETED ||
          t.status === TransactionStatus.PARTIAL),
    )
    .reduce((acc, curr) => {
      if (curr.status === TransactionStatus.PARTIAL && curr.pendingAmount) {
        return acc + (curr.amount - curr.pendingAmount);
      }
      return acc + curr.amount;
    }, 0);

  const expense = transactions
    .filter(
      (t) =>
        t.type === TransactionType.EXPENSE &&
        t.status === TransactionStatus.COMPLETED,
    )
    .reduce((acc, curr) => acc + curr.amount, 0);

  const commissions = transactions
    .filter(
      (t) =>
        t.commissionAmount &&
        (t.status === TransactionStatus.COMPLETED ||
          t.status === TransactionStatus.PARTIAL),
    )
    .reduce((acc, curr) => {
      // Se for pagamento parcial, a comissão é proporcional ao valor recebido
      if (
        curr.status === TransactionStatus.PARTIAL &&
        curr.pendingAmount !== undefined
      ) {
        const receivedAmount = curr.amount - curr.pendingAmount;
        const totalAmount = curr.amount;
        const proportion =
          totalAmount > 0 ? Math.max(0, receivedAmount / totalAmount) : 0;
        return acc + (curr.commissionAmount || 0) * proportion;
      }
      return acc + (curr.commissionAmount || 0);
    }, 0);

  const pending = transactions
    .filter(
      (t) =>
        t.type === TransactionType.INCOME &&
        [TransactionStatus.PENDING, TransactionStatus.PARTIAL].includes(
          t.status,
        ),
    )
    .reduce(
      (acc, curr) =>
        acc +
        (curr.status === TransactionStatus.PARTIAL
          ? curr.pendingAmount || 0
          : curr.amount),
      0,
    );

  const today = new Date().toISOString().split('T')[0];
  const pendingCommissions = transactions
    .filter(
      (t) =>
        t.commissionAmount &&
        t.commissionPaymentDate &&
        t.commissionPaymentDate > today,
    )
    .reduce((acc, curr) => acc + (curr.commissionAmount || 0), 0);

  const profit = income - expense - commissions;

  // Cálculo de imposto dinâmico baseado na receita total (conforme solicitado)
  const totalTaxRate =
    taxSettings.length > 0
      ? taxSettings.reduce((acc, curr) => acc + curr.percentage / 100, 0)
      : 0; // Fallback se não houver taxas configuradas

  const tax = income * totalTaxRate;
  const netProfitAfterTax = profit - tax;

  return {
    totalIncome: income,
    totalExpense: expense + commissions,
    netProfit: netProfitAfterTax,
    pendingInvoices: pending,
    taxLiabilityEstimate: tax,
    totalCommissions: commissions,
    pendingCommissions: pendingCommissions,
  };
};
