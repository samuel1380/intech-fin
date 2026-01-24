import { Transaction, FinancialSummary } from "../types";

const BASE_URL = process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1';
const MODEL = process.env.AI_MODEL || 'xiaomi/mimo-v2-flash:free';
const API_KEY = process.env.OPENAI_API_KEY;

export const getFinancialInsights = async (
  summary: FinancialSummary, 
  recentTransactions: Transaction[]
): Promise<string> => {
  if (!API_KEY) {
    return "Chave de API (OPENAI_API_KEY) não configurada no Render/Ambiente.";
  }

  try {
    const transactionContext = recentTransactions.slice(0, 10).map(t => 
      `${t.date}: ${t.type} de R$${t.amount} em ${t.category} (${t.description})`
    ).join('\n');

    const prompt = `
      Você é um consultor financeiro sênior (CFO) especializado em empresas brasileiras. Analise o seguinte resumo financeiro e forneça 3 insights estratégicos ou alertas importantes.
      
      Resumo Financeiro (Valores em Reais - BRL):
      - Receita Total: R$${summary.totalIncome}
      - Despesas Totais: R$${summary.totalExpense}
      - Lucro Líquido: R$${summary.netProfit}
      - Recebíveis Pendentes: R$${summary.pendingInvoices}
      - Estimativa de Impostos: R$${summary.taxLiabilityEstimate}

      Amostra de Transações Recentes:
      ${transactionContext}

      Regras:
      1. Responda estritamente em Português do Brasil (pt-BR).
      2. Use terminologia de negócios brasileira.
      3. Formate a saída como uma string HTML limpa (usando <ul>, <li>, <strong> tags).
      4. Não use blocos de código markdown.
      5. Seja direto e profissional.
    `;

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'HTTP-Referer': 'https://finnexus.enterprise', // Required by OpenRouter
        'X-Title': 'FinNexus Enterprise', // Required by OpenRouter
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Não foi possível gerar insights no momento.";
  } catch (error) {
    console.error("Erro na API OpenRouter:", error);
    return "Serviço de IA indisponível. Verifique sua conexão.";
  }
};

export const chatWithFinanceAI = async (message: string, contextData: string): Promise<string> => {
  if (!API_KEY) return "Chave de API ausente.";
  
  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'HTTP-Referer': 'https://finnexus.enterprise',
        'X-Title': 'FinNexus Enterprise',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: `Você é um assistente financeiro prestativo para uma empresa brasileira. Contexto atual: ${contextData}` },
          { role: 'user', content: message }
        ],
      }),
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Sem resposta gerada.";
  } catch (e) {
    console.error("Erro no Chat IA:", e);
    return "Erro ao comunicar com o assistente IA.";
  }
}
