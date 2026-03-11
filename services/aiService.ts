import { Transaction, FinancialSummary, TransactionType, TransactionStatus } from "../types";

// ===== PROVIDER CONFIGURATION =====
// AI_PROVIDER: 'groq' | 'openrouter' (default: 'openrouter')
// Each provider has its own API key and default model

type AIProvider = 'groq' | 'openrouter';

interface ProviderConfig {
  baseUrl: string;
  apiKey: string | undefined;
  model: string;
  name: string;
  extraHeaders: Record<string, string>;
}

const PROVIDER: AIProvider = (process.env.AI_PROVIDER as AIProvider) || 'openrouter';

const PROVIDER_CONFIGS: Record<AIProvider, ProviderConfig> = {
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.AI_MODEL || 'llama3-70b-8192',
    name: 'Groq',
    extraHeaders: {},
  },
  openrouter: {
    baseUrl: process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.AI_MODEL || 'xiaomi/mimo-v2-flash:free',
    name: 'OpenRouter',
    extraHeaders: {
      'HTTP-Referer': 'https://finnexus.enterprise',
      'X-Title': 'FinNexus Enterprise',
    },
  },
};

// Get active config — tries primary provider, falls back to the other if no key
const getActiveConfig = (): ProviderConfig => {
  const primary = PROVIDER_CONFIGS[PROVIDER];
  if (primary.apiKey) return primary;

  // Fallback: try the other provider
  const fallback = PROVIDER === 'groq' ? PROVIDER_CONFIGS.openrouter : PROVIDER_CONFIGS.groq;
  if (fallback.apiKey) return fallback;

  return primary; // Return primary even without key (will show error message)
};

// Export for UI display
export const getActiveProviderName = (): string => {
  const config = getActiveConfig();
  return config.name;
};

export const getActiveModelName = (): string => {
  const config = getActiveConfig();
  return config.model;
};

export const isAIConfigured = (): boolean => {
  const config = getActiveConfig();
  return !!config.apiKey;
};

// ===== UNIFIED API CALL =====
const callAI = async (messages: { role: string; content: string }[]): Promise<string> => {
  const config = getActiveConfig();

  if (!config.apiKey) {
    return `Chave de API não configurada. Configure ${PROVIDER === 'groq' ? 'GROQ_API_KEY' : 'OPENAI_API_KEY'} no seu ambiente (Render).`;
  }

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        ...config.extraHeaders,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`Erro na API ${config.name}:`, response.status, errorData);
      return `Erro na API ${config.name} (${response.status}). Verifique sua chave de API e tente novamente.`;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Não foi possível gerar uma resposta.";
  } catch (error) {
    console.error(`Erro ao conectar com ${config.name}:`, error);
    return `Erro ao conectar com ${config.name}. Verifique sua conexão com a internet.`;
  }
};

// ===== HELPER: Build rich context from transactions =====
export const buildFinancialContext = (summary: FinancialSummary, transactions: Transaction[]): string => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Transactions this month
  const thisMonth = transactions.filter(t => {
    const [y, m] = t.date.split('-').map(Number);
    return y === currentYear && m === currentMonth + 1;
  });

  // Transactions last month
  const lastMonth = transactions.filter(t => {
    const [y, m] = t.date.split('-').map(Number);
    const lastM = currentMonth === 0 ? 12 : currentMonth;
    const lastY = currentMonth === 0 ? currentYear - 1 : currentYear;
    return y === lastY && m === lastM;
  });

  // Category breakdown
  const categoryBreakdown: Record<string, { income: number; expense: number; count: number }> = {};
  transactions.forEach(t => {
    if (!categoryBreakdown[t.category]) {
      categoryBreakdown[t.category] = { income: 0, expense: 0, count: 0 };
    }
    categoryBreakdown[t.category].count++;
    if (t.type === TransactionType.INCOME) {
      categoryBreakdown[t.category].income += t.amount;
    } else {
      categoryBreakdown[t.category].expense += t.amount;
    }
  });

  const categoryStr = Object.entries(categoryBreakdown)
    .sort((a, b) => (b[1].income + b[1].expense) - (a[1].income + a[1].expense))
    .slice(0, 10)
    .map(([cat, data]) => `  - ${cat}: ${data.count} transações | Receita: R$${data.income.toFixed(2)} | Despesa: R$${data.expense.toFixed(2)}`)
    .join('\n');

  // Employee/commission analysis
  const employeeData: Record<string, { totalRevenue: number; totalCommission: number; jobs: number }> = {};
  transactions.filter(t => t.employeeName).forEach(t => {
    const name = t.employeeName!;
    if (!employeeData[name]) employeeData[name] = { totalRevenue: 0, totalCommission: 0, jobs: 0 };
    employeeData[name].jobs++;
    if (t.type === TransactionType.INCOME) employeeData[name].totalRevenue += t.amount;
    employeeData[name].totalCommission += (t.commissionAmount || 0);
  });

  const employeeStr = Object.entries(employeeData)
    .map(([name, data]) => `  - ${name}: ${data.jobs} serviços | Gerou R$${data.totalRevenue.toFixed(2)} | Comissão: R$${data.totalCommission.toFixed(2)}`)
    .join('\n') || '  Nenhum funcionário registrado.';

  // Pending payments
  const pendingPayments = transactions
    .filter(t => t.status === TransactionStatus.PARTIAL && t.pendingAmount && t.pendingAmount > 0)
    .map(t => `  - ${t.description}: R$${t.pendingAmount!.toFixed(2)} pendente (de R$${t.amount.toFixed(2)})`)
    .join('\n') || '  Nenhum pagamento pendente.';

  // Upcoming commissions
  const today = new Date().toISOString().split('T')[0];
  const upcomingCommissions = transactions
    .filter(t => t.commissionAmount && t.commissionPaymentDate && t.commissionPaymentDate >= today)
    .sort((a, b) => a.commissionPaymentDate!.localeCompare(b.commissionPaymentDate!))
    .slice(0, 5)
    .map(t => `  - ${t.employeeName || 'Técnico'}: R$${t.commissionAmount!.toFixed(2)} em ${t.commissionPaymentDate}`)
    .join('\n') || '  Nenhuma comissão pendente.';

  // Recent transactions (last 15)
  const recentTx = transactions.slice(0, 15).map(t =>
    `  ${t.date} | ${t.type} | R$${t.amount.toFixed(2)} | ${t.category} | ${t.description} | Status: ${t.status}${t.pendingAmount ? ` | Pendente: R$${t.pendingAmount.toFixed(2)}` : ''}${t.employeeName ? ` | Técnico: ${t.employeeName}` : ''}`
  ).join('\n');

  // Monthly comparison
  const thisMonthIncome = thisMonth.filter(t => t.type === TransactionType.INCOME && (t.status === TransactionStatus.COMPLETED || t.status === TransactionStatus.PARTIAL)).reduce((s, t) => s + t.amount, 0);
  const thisMonthExpense = thisMonth.filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.COMPLETED).reduce((s, t) => s + t.amount, 0);
  const lastMonthIncome = lastMonth.filter(t => t.type === TransactionType.INCOME && (t.status === TransactionStatus.COMPLETED || t.status === TransactionStatus.PARTIAL)).reduce((s, t) => s + t.amount, 0);
  const lastMonthExpense = lastMonth.filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.COMPLETED).reduce((s, t) => s + t.amount, 0);

  const margin = summary.totalIncome > 0 ? ((summary.netProfit / summary.totalIncome) * 100).toFixed(1) : '0';

  return `
[DADOS FINANCEIROS COMPLETOS - EMPRESA DE DESENTUPIDORA]
Data de hoje: ${now.toLocaleDateString('pt-BR')}
Total de transações registradas: ${transactions.length}

═══ RESUMO GERAL ═══
- Receita Total: R$${summary.totalIncome.toFixed(2)}
- Despesas Totais (com comissões): R$${summary.totalExpense.toFixed(2)}
- Lucro Líquido: R$${summary.netProfit.toFixed(2)}
- Margem de Lucro: ${margin}%
- Faturas Pendentes: R$${summary.pendingInvoices.toFixed(2)}
- Impostos Estimados: R$${summary.taxLiabilityEstimate.toFixed(2)}
- Total Comissões Pagas: R$${(summary.totalCommissions || 0).toFixed(2)}
- Comissões Pendentes: R$${(summary.pendingCommissions || 0).toFixed(2)}

═══ COMPARATIVO MENSAL ═══
Mês Atual: Receita R$${thisMonthIncome.toFixed(2)} | Despesa R$${thisMonthExpense.toFixed(2)} | Saldo R$${(thisMonthIncome - thisMonthExpense).toFixed(2)}
Mês Anterior: Receita R$${lastMonthIncome.toFixed(2)} | Despesa R$${lastMonthExpense.toFixed(2)} | Saldo R$${(lastMonthIncome - lastMonthExpense).toFixed(2)}
Variação Receita: ${lastMonthIncome > 0 ? (((thisMonthIncome - lastMonthIncome) / lastMonthIncome) * 100).toFixed(1) : '0'}%

═══ POR CATEGORIA (Top 10) ═══
${categoryStr}

═══ FUNCIONÁRIOS & COMISSÕES ═══
${employeeStr}

═══ PAGAMENTOS PENDENTES DE CLIENTES ═══
${pendingPayments}

═══ PRÓXIMAS COMISSÕES A PAGAR ═══
${upcomingCommissions}

═══ TRANSAÇÕES RECENTES (últimas 15) ═══
${recentTx}
  `.trim();
};

// ===== Insights Panel =====
export const getFinancialInsights = async (
  summary: FinancialSummary,
  recentTransactions: Transaction[]
): Promise<string> => {
  const config = getActiveConfig();
  if (!config.apiKey) {
    return `<p>Chave de API não configurada. Configure <strong>${PROVIDER === 'groq' ? 'GROQ_API_KEY' : 'OPENAI_API_KEY'}</strong> no Render.</p>`;
  }

  const context = buildFinancialContext(summary, recentTransactions);

  const prompt = `
    [SISTEMA: CARTA DE TREINAMENTO]
    Você é um Consultor Financeiro Sênior (CFO) e Auditor especializado em empresas brasileiras de pequeno e médio porte.
    Especialidade: Empresas de desentupidora e serviços hidráulicos.
    Sua missão é fornecer análises de elite, funcionais e diretas para otimizar o fluxo de caixa do usuário.

    ${context}

    [DIRETRIZES ESTRITAS DE RESPOSTA]
    1. **Identidade**: Aja como um parceiro de negócios experiente. Seja sério, mas encorajador.
    2. **Formato**: 
       - Use uma lista não ordenada HTML (<ul>) com 4 (quatro) itens (<li>).
       - Use <strong> para destacar números e termos-chave.
       - *NUNCA* use markdown (como ** ou -). Use apenas tags HTML.
    3. **Conteúdo**:
       - Item 1: Uma análise de *Eficiência Operacional* (Receita vs Despesa, margem de lucro).
       - Item 2: Um alerta de *Risco* ou *Oportunidade* imediata (baseado nas transações, pendências ou comissões).
       - Item 3: Análise de *Performance dos Funcionários* (quem gera mais receita, quem tem mais comissão).
       - Item 4: Uma *Ação Recomendada* prática e específica para executar hoje.
    4. **Idioma**: Português do Brasil (pt-BR) formal e corporativo.
    5. **Dados**: Cite números REAIS dos dados fornecidos. Nunca invente valores.
  `;

  return callAI([{ role: 'user', content: prompt }]);
};

// ===== Chat with full context and conversation history =====
export const chatWithFinanceAI = async (
  message: string,
  contextData: string,
  conversationHistory: { role: 'user' | 'ai'; text: string }[] = []
): Promise<string> => {
  // Build conversation messages for context
  const historyMessages = conversationHistory.slice(-10).map(m => ({
    role: m.role === 'ai' ? 'assistant' : 'user',
    content: m.text
  }));

  return callAI([
    {
      role: 'system', content: `
      [PROTOCOLO DE ASSISTENTE FINANCEIRO - CONSULTOR FINNEXUS]
      Você é o 'Consultor FinNexus', um CFO virtual inteligente especializado em empresas de desentupidora e serviços hidráulicos no Brasil.
      
      ${contextData}

      SUAS REGRAS DE OURO:
      1. **Baseado em Dados**: Use os dados financeiros acima para embasar TODAS as respostas. Cite números reais.
      2. **Funcionalidade**: Responda EXATAMENTE o que foi perguntado. Sem enrolação.
      3. **Proatividade**: Se a pergunta abrir margem, sugira ações práticas adicionais.
      4. **Organização**: Respostas concisas. Use parágrafos curtos e listas quando necessário.
      5. **Profissionalismo**: Tom executivo, prestativo e confiante.
      6. **Números Formatados**: Sempre formate valores como R$ X.XXX,XX.
      7. **Idioma**: Português do Brasil formal.
      8. **Personalização**: Lembre-se que é uma empresa de DESENTUPIDORA. Adapte conselhos ao setor.
      9. **Nunca invente dados**: Se não tiver informação suficiente, diga claramente.
      10. **Formato**: Texto puro, sem markdown. Pode usar emojis com moderação (📊 💰 📈 ⚠️).
    ` },
    ...historyMessages,
    { role: 'user', content: message }
  ]);
};

// ===== Quick Analysis Functions =====
export const generateQuickAnalysis = async (
  type: 'cashflow' | 'employees' | 'reduction' | 'forecast' | 'clients',
  summary: FinancialSummary,
  transactions: Transaction[]
): Promise<string> => {
  const context = buildFinancialContext(summary, transactions);

  const prompts: Record<string, string> = {
    cashflow: `
      ${context}
      
      Com base nos dados acima, faça uma análise COMPLETA do fluxo de caixa:
      1. Saldo atual e tendência (melhorando ou piorando?)
      2. Dias com maior movimentação
      3. Previsão para os próximos 30 dias baseada no padrão atual
      4. Recomendações para melhorar o fluxo
      
      Seja direto, use números reais, e dê insights práticos. Formato texto puro pt-BR. Use emojis com moderação.
    `,
    employees: `
      ${context}
      
      Com base nos dados acima, faça uma análise de PERFORMANCE DOS FUNCIONÁRIOS:
      1. Ranking de funcionários por receita gerada
      2. Custo de comissão vs receita gerada por cada um
      3. Eficiência de cada funcionário (receita por serviço)
      4. Recomendações: quem precisa de treinamento? Quem merece bonificação?
      
      Seja direto, use números reais, e dê insights práticos. Formato texto puro pt-BR. Use emojis com moderação.
    `,
    reduction: `
      ${context}
      
      Com base nos dados acima, faça uma análise de REDUÇÃO DE CUSTOS:
      1. Top 3 categorias que mais consomem recursos
      2. Custos que podem ser eliminados ou reduzidos
      3. Comparativo de gastos por período
      4. Meta de economia sugerida (valor e prazo)
      5. Ações específicas para cortar gastos sem impactar a operação
      
      Seja direto, use números reais, e dê insights práticos. Formato texto puro pt-BR. Use emojis com moderação.
    `,
    forecast: `
      ${context}
      
      Com base nos dados acima e nas tendências, faça uma PROJEÇÃO FINANCEIRA para os próximos 3 meses:
      1. Receita projetada (baseada na tendência atual)
      2. Despesas projetadas
      3. Lucro estimado
      4. Cenário otimista vs pessimista
      5. Riscos e oportunidades identificados
      6. Ações preventivas recomendadas
      
      Seja direto, use números reais, e dê insights práticos. Formato texto puro pt-BR. Use emojis com moderação.
    `,
    clients: `
      ${context}
      
      Com base nos dados acima, faça uma análise de CLIENTES E PAGAMENTOS:
      1. Pagamentos pendentes: valor total e detalhamento
      2. Clientes com maior volume de serviço
      3. Taxa de inadimplência/pagamento parcial
      4. Estratégias para melhorar a cobrança
      5. Serviços mais procurados e oportunidades de upsell
      
      Seja direto, use números reais, e dê insights práticos. Formato texto puro pt-BR. Use emojis com moderação.
    `
  };

  return callAI([
    {
      role: 'system',
      content: 'Você é um CFO virtual especializado em empresas de desentupidora no Brasil. Responda em português formal com dados reais. Texto puro, sem markdown.'
    },
    { role: 'user', content: prompts[type] }
  ]);
};
