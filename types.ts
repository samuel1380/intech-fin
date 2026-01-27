export enum TransactionType {
  INCOME = 'RECEITA',
  EXPENSE = 'DESPESA'
}

export enum TransactionStatus {
  COMPLETED = 'CONCLUÍDO',
  PENDING = 'PENDENTE',
  FAILED = 'FALHOU'
}

export enum TransactionCategory {
  SALES = 'Vendas',
  SERVICES = 'Serviços',
  INVESTMENT = 'Investimentos',
  OPERATIONS = 'Operacional',
  PAYROLL = 'Folha de Pagamento',
  MARKETING = 'Marketing',
  TAXES = 'Impostos',
  SOFTWARE = 'Software/SaaS',
  OFFICE = 'Escritório',
  TRAVEL = 'Viagens Corporativas',
  OTHER = 'Outros'
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
  status: TransactionStatus;
  notes?: string;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  pendingInvoices: number;
  taxLiabilityEstimate: number;
}

export interface UserProfile {
  name: string;
  email: string;
  role: 'admin' | 'viewer';
  companyName: string;
}

export interface TaxSetting {
  id: string;
  name: string;
  percentage: number;
}