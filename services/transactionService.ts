import { db } from '../db';
import { Transaction, FinancialSummary, TransactionType, TransactionStatus } from '../types';

// Adicionar Transação
export const addTransactionToDb = async (transaction: Omit<Transaction, 'id'>): Promise<Transaction> => {
  const newTransaction: Transaction = {
    ...transaction,
    id: crypto.randomUUID(), // Gera um ID único real
  };
  await db.transactions.add(newTransaction);
  return newTransaction;
};

// Ler todas as transações
export const getAllTransactionsFromDb = async (): Promise<Transaction[]> => {
  const txs = await db.transactions.toArray();
  // Ordenar por data decrescente
  return txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

// Deletar Transação
export const deleteTransactionFromDb = async (id: string): Promise<void> => {
  await db.transactions.delete(id);
};

// Atualizar Status
export const updateTransactionStatus = async (id: string, status: TransactionStatus): Promise<void> => {
    await db.transactions.update(id, { status });
}

// Limpar Banco de Dados (Para configurações)
export const clearDatabase = async (): Promise<void> => {
  await db.transactions.clear();
};

// Calcular Resumo Financeiro (Mantendo a lógica de negócio separada do banco)
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
  
  // Lógica de Imposto (Ex: 15% sobre lucro positivo)
  const tax = profit > 0 ? profit * 0.15 : 0;

  return {
    totalIncome: income,
    totalExpense: expense,
    netProfit: profit,
    pendingInvoices: pending,
    taxLiabilityEstimate: tax
  };
};