export enum TransactionType {
  INCOME = 'RECEITA',
  EXPENSE = 'DESPESA'
}

export enum TransactionStatus {
  COMPLETED = 'CONCLUÍDO',
  PENDING = 'PENDENTE',
  PARTIAL = 'PAGTO PARCIAL',
  FAILED = 'FALHOU'
}

export enum TransactionCategory {
  SALES = 'Vendas',
  // Serviços de Desentupidora
  SERVICE_PIA = 'Serviço: Pia',
  SERVICE_RALO = 'Serviço: Ralo',
  SERVICE_ESGOTO = 'Serviço: Esgoto',
  SERVICE_VASO = 'Serviço: Vaso Sanitário',
  SERVICE_CAIXA_GORDURA = 'Serviço: Caixa de Gordura',
  SERVICE_COLUNA = 'Serviço: Coluna de Prédio',
  SERVICE_HIDROJATEAMENTO = 'Serviço: Hidrojateamento',
  SERVICE_OUTROS = 'Serviço: Outros',
  
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
  employeeName?: string;
  commissionAmount?: number;
  commissionPaymentDate?: string;
  pendingAmount?: number;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  pendingInvoices: number;
  taxLiabilityEstimate: number;
  totalCommissions: number;
  pendingCommissions: number;
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