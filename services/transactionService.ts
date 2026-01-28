import { supabase, isSupabaseConfigured } from './supabase';
import { Transaction, FinancialSummary, TransactionType, TransactionStatus, TaxSetting } from '../types';

const ensureConfig = () => {
  if (!isSupabaseConfigured) {
    throw new Error('CONFIGURAÇÃO AUSENTE: O sistema está em modo "Somente Nuvem". Configure as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no Render para continuar.');
  }
};

// Adicionar Transação
export const addTransactionToDb = async (transaction: Omit<Transaction, 'id'>): Promise<Transaction> => {
  ensureConfig();
  const newTransaction = {
    ...transaction,
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
    throw new Error('Erro ao salvar: O banco de dados não retornou os dados salvos.');
  }
  return data[0];
};

// Ler todas as transações
export const getAllTransactionsFromDb = async (): Promise<Transaction[]> => {
  ensureConfig();
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error('Erro ao buscar do Supabase:', error);
    return [];
  }
  return data || [];
};

// Deletar Transação
export const deleteTransactionFromDb = async (id: string): Promise<void> => {
  ensureConfig();
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao deletar no Supabase:', error);
    throw error;
  }
};

// Atualizar Transação Completa
export const updateTransactionInDb = async (id: string, updates: Partial<Transaction>): Promise<void> => {
  ensureConfig();
  const { error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('Erro ao atualizar transação no Supabase:', error);
    throw error;
  }
};

// Atualizar Status
export const updateTransactionStatus = async (id: string, status: TransactionStatus): Promise<void> => {
  await updateTransactionInDb(id, { status });
};

// Limpar Banco de Dados
export const clearDatabase = async (): Promise<void> => {
  ensureConfig();
  try {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .not('id', 'is', null);

    if (error) throw error;
  } catch (error: any) {
    console.error('Erro ao limpar banco de dados:', error);
    throw new Error('Falha ao resetar os dados: ' + (error.message || 'Erro de conexão'));
  }
};

// Calcular Resumo Financeiro
export const calculateSummary = (transactions: Transaction[], taxSettings: TaxSetting[] = []): FinancialSummary => {
  const income = transactions
    .filter(t => t.type === TransactionType.INCOME && (t.status === TransactionStatus.COMPLETED || t.status === TransactionStatus.PARTIAL))
    .reduce((acc, curr) => acc + curr.amount, 0);

  const expense = transactions
    .filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.COMPLETED)
    .reduce((acc, curr) => acc + curr.amount, 0);

  const commissions = transactions
    .filter(t => t.commissionAmount && (t.status === TransactionStatus.COMPLETED || t.status === TransactionStatus.PARTIAL))
    .reduce((acc, curr) => acc + (curr.commissionAmount || 0), 0);

  const pending = transactions
    .filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PENDING)
    .reduce((acc, curr) => acc + curr.amount, 0);

  const today = new Date().toISOString().split('T')[0];
  const pendingCommissions = transactions
    .filter(t => t.commissionAmount && t.commissionPaymentDate && t.commissionPaymentDate > today)
    .reduce((acc, curr) => acc + (curr.commissionAmount || 0), 0);

  const profit = income - expense - commissions;
  
  // Cálculo de imposto dinâmico baseado na receita total (conforme solicitado)
  const totalTaxRate = taxSettings.length > 0
    ? taxSettings.reduce((acc, curr) => acc + (curr.percentage / 100), 0)
    : 0.15; // Fallback se não houver taxas configuradas

  const tax = income * totalTaxRate;
  const netProfitAfterTax = profit - tax;

  return {
    totalIncome: income,
    totalExpense: expense + commissions,
    netProfit: netProfitAfterTax,
    pendingInvoices: pending,
    taxLiabilityEstimate: tax,
    totalCommissions: commissions,
    pendingCommissions: pendingCommissions
  };
};
