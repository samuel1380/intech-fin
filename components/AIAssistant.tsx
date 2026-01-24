import React, { useState, useEffect, useRef } from 'react';
import { FinancialSummary, Transaction } from '../types';
import { getFinancialInsights, chatWithFinanceAI } from '../services/aiService';
import { Bot, Send, Sparkles, AlertTriangle, Loader2 } from 'lucide-react';

interface Props {
  summary: FinancialSummary;
  transactions: Transaction[];
}

const AIAssistant: React.FC<Props> = ({ summary, transactions }) => {
  const [insights, setInsights] = useState<string>('');
  const [loadingInsights, setLoadingInsights] = useState(false);
  
  const [messages, setMessages] = useState<{role: 'user'|'ai', text: string}[]>([
      { role: 'ai', text: "Olá! Sou seu CFO Inteligente. Como posso ajudar com o planejamento financeiro da sua empresa hoje?" }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Generate initial strategic insights on mount
    const fetchInsights = async () => {
        setLoadingInsights(true);
        const result = await getFinancialInsights(summary, transactions);
        setInsights(result);
        setLoadingInsights(false);
    };
    fetchInsights();
  }, [summary, transactions]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMsg = inputValue;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInputValue('');
    setChatLoading(true);

    const context = `Receita: ${summary.totalIncome}, Despesas: ${summary.totalExpense}`;
    const response = await chatWithFinanceAI(userMsg, context);

    setMessages(prev => [...prev, { role: 'ai', text: response }]);
    setChatLoading(false);
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
      {/* Strategic Insights Panel */}
      <div className="lg:col-span-1 bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl shadow-xl text-white p-6 overflow-y-auto">
        <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
                <Sparkles className="h-6 w-6 text-indigo-300" />
            </div>
            <h2 className="text-xl font-bold">Inteligência Estratégica</h2>
        </div>

        {loadingInsights ? (
            <div className="flex flex-col items-center justify-center h-64 opacity-70">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                <p>Analisando dados fiscais...</p>
            </div>
        ) : (
            <div className="prose prose-invert prose-sm">
                 <div dangerouslySetInnerHTML={{ __html: insights }} />
            </div>
        )}
          <div className="mt-8 p-4 bg-white/5 rounded-xl border border-white/10">
            <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                    <h4 className="font-semibold text-amber-200 text-sm">Dica de Otimização</h4>
                    <p className="text-xs text-slate-300 mt-1">Baseado nos padrões de pagamento, mudar os fornecedores de Software (SaaS) para pagamento anual poderia economizar cerca de 15%.</p>
                </div>
            </div>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg border border-slate-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <Bot className="h-5 w-5 text-indigo-600" />
                Consultor FinNexus
            </h3>
            <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full font-medium">OpenRouter IA</span>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                        m.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-br-none' 
                        : 'bg-slate-100 text-slate-800 rounded-bl-none'
                    }`}>
                        {m.text}
                    </div>
                </div>
            ))}
            {chatLoading && (
                 <div className="flex justify-start">
                    <div className="bg-slate-100 text-slate-500 rounded-2xl rounded-bl-none px-4 py-3 text-sm flex items-center gap-2">
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"></span>
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></span>
                    </div>
                </div>
            )}
            <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-100 flex gap-2">
            <input 
                type="text" 
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                placeholder="Pergunte sobre lucros, tendências de gastos ou fluxo de caixa..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
            />
            <button 
                type="submit"
                disabled={chatLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-xl transition-colors disabled:opacity-50"
            >
                <Send className="h-5 w-5" />
            </button>
        </form>
      </div>
    </div>
  );
};

export default AIAssistant;