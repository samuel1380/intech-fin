import Dexie, { Table } from 'dexie';
import { Transaction } from './types';

class FinNexusDB extends Dexie {
  transactions!: Table<Transaction>;

  constructor() {
    super('FinNexusDatabase');
    // Fix: Cast 'this' to avoid TypeScript error "Property 'version' does not exist" in some environments
    (this as any).version(1).stores({
      transactions: 'id, date, type, category, status' // Índices para busca rápida
    });
  }
}

export const db = new FinNexusDB();