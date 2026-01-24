import { supabase, isSupabaseConfigured } from './supabase';
import { db } from '../db';
import { Transaction, FinancialSummary, TransactionType, TransactionStatus } from '../types';

// Adicionar Transação
export const addTransactionToDb = async (transaction: Omit<Transaction, 'id'>): Promise<Transaction> => {
  const newTransaction = {
    ...transaction,
    id: crypto.randomUUID(),
  };

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('transactions')
      .insert([newTransaction])
      .select();

    if (error) {
      console.error('Erro ao salvar no Supabase:', error);
      throw error;
    }
    return data[0];
  } else {
    // IndexedDB Fallback
    await db.transactions.add(newTransaction as Transaction);
    return newTransaction as Transaction;
  }
};

// Ler todas as transações
export const getAllTransactionsFromDb = async (): Promise<Transaction[]> => {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error('Erro ao buscar do Supabase:', error);
      return [];
    }
    return data || [];
  } else {
    // IndexedDB Fallback
    return await db.transactions.orderBy('date').reverse().toArray();
  }
};

// Deletar Transação
export const deleteTransactionFromDb = async (id: string): Promise<void> => {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar no Supabase:', error);
      throw error;
    }
  } else {
    // IndexedDB Fallback
    await db.transactions.delete(id);
  }
};

// Atualizar Status
export const updateTransactionStatus = async (id: string, status: TransactionStatus): Promise<void> => {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('transactions')
      .update({ status })
      .eq('id', id);

    if (error) {
      console.error('Erro ao atualizar status no Supabase:', error);
      throw error;
    }
  } else {
    // IndexedDB Fallback
    await db.transactions.update(id, { status });
  }
};

// Limpar Banco de Dados
export const clearDatabase = async (): Promise<void> => {
  try {
    if (isSupabaseConfigured) {
      // Deleta todos os registros. O filtro 'not.is.null' é o mais seguro para UUIDs e para limpar tabelas inteiras
      const { error } = await supabase
        .from('transactions')
        .delete()
        .not('id', 'is', null);

      if (error) throw error;
    } else {
      // IndexedDB Fallback
      await db.transactions.clear();
    }
  } catch (error: any) {
    console.error('Erro ao limpar banco de dados:', error);
    throw new Error('Falha ao resetar os dados: ' + (error.message || 'Erro de conexão'));
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
