import { supabase } from './supabase';
import { Transaction, FinancialSummary, TransactionType, TransactionStatus } from '../types';

// Adicionar Transação
export const addTransactionToDb = async (transaction: Omit<Transaction, 'id'>): Promise<Transaction> => {
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
    throw error;
  }
  
  return data[0];
};

// Ler todas as transações
export const getAllTransactionsFromDb = async (): Promise<Transaction[]> => {
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
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao deletar no Supabase:', error);
    throw error;
  }
};

// Atualizar Status
export const updateTransactionStatus = async (id: string, status: TransactionStatus): Promise<void> => {
  const { error } = await supabase
    .from('transactions')
    .update({ status })
    .eq('id', id);

  if (error) {
    console.error('Erro ao atualizar status no Supabase:', error);
    throw error;
  }
};

// Limpar Banco de Dados (Cuidado: deleta tudo na nuvem)
export const clearDatabase = async (): Promise<void> => {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .neq('id', '0'); // Deleta todos

  if (error) {
    console.error('Erro ao limpar Supabase:', error);
    throw error;
  }
};

// Calcular Resumo Financeiro (Lógica permanece a mesma)
export const calculateSummary = (transactions: Transaction[]): FinancialSummary => {
  const income = transactions
    .filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.COMPLETED)
    .reduce((acc, curr) => acc + curr.amount, 0);

  const expense = transactions
    .filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.COMPLETED)
    .reduce((acc, curr) => acc + curr.amount, 0);

  const pending = transactions
    .filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PENDING)
    .reduce((acc, curr) => acc + curr.amount, 0);

  const profit = income - expense;
  const tax = profit > 0 ? profit * 0.15 : 0;

  return {
    totalIncome: income,
    totalExpense: expense,
    netProfit: profit,
    pendingInvoices: pending,
    taxLiabilityEstimate: tax
  };
};
