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
      [SISTEMA: CARTA DE TREINAMENTO]
      Você é um Consultor Financeiro Sênior (CFO) e Auditor especializado em empresas brasileiras de pequeno e médio porte.
      Sua missão é fornecer análises de elite, funcionais e diretas para otimizar o fluxo de caixa do usuário.

      [DADOS DO CLIENTE]
      Resumo Financeiro (BRL):
      - Receita Total: R$${summary.totalIncome.toFixed(2)}
      - Despesas Totais: R$${summary.totalExpense.toFixed(2)}
      - Lucro Líquido: R$${summary.netProfit.toFixed(2)}
      - Pendências: R$${summary.pendingInvoices.toFixed(2)}
      - Provisão de Impostos (Est.): R$${summary.taxLiabilityEstimate.toFixed(2)}

      Contexto Transacional Recente (Últimos 10 registros):
      ${transactionContext}

      [DIRETRIZES ESTRITAS DE RESPOSTA]
      1. **Identidade**: Aja como um parceiro de negócios experiente. Seja sério, mas encorajador.
      2. **Formato**: 
         - Use uma lista não ordenada HTML (<ul>) com 3 (três) itens (<li>).
         - Use <strong> para destacar números e termos-chave.
         - *NUNCA* use markdown (como ** ou -). Use apenas tags HTML.
      3. **Conteúdo**:
         - Item 1: Uma análise de *Eficiência Operacional* (Receita vs Despesa).
         - Item 2: Um alerta de *Risco* ou *Oportunidade* imediata (baseado nas transações ou pendências).
         - Item 3: Uma *Ação Recomendada* prática para executar hoje.
      4. **Idioma**: Português do Brasil (pt-BR) formal e corporativo.
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
          {
            role: 'system', content: `
            [PROTOCOLO DE ASSISTENTE FINANCEIRO]
            Você é o 'Consultor FinNexus', uma IA otimizada para suporte empresarial rápido.
            
            SUAS REGRAS DE OURO:
            1. **Funcionalidade**: Responda APENAS o que foi perguntado. Sem enrolação.
            2. **Baseado em Dados**: Use o contexto fornecido (${contextData}) para embasar suas respostas. Se o usuário perguntar "qual meu lucro?", não explique o que é lucro, diga "Seu lucro é R$ X".
            3. **Organização**: Se a resposta for longa, quebre em parágrafos curtos.
            4. **Profissionalismo**: Mantenha um tom executivo e prestativo.
          ` },
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
