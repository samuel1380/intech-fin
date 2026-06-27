import React, { useState, useEffect, useRef } from 'react';
import { FinancialSummary, Transaction, TransactionType, TransactionStatus } from '../types';
import { getFinancialInsights, chatWithFinanceAI, generateQuickAnalysis, buildFinancialContext, getActiveProviderName, getActiveModelName, isAIConfigured } from '../services/aiService';
import {
    Bot, Send, Sparkles, AlertTriangle, Loader2, RefreshCw, Trash2,
    TrendingUp, Users, Scissors, Target, UserCheck, DollarSign,
    BarChart3, Zap, MessageSquare, X, ChevronDown
} from 'lucide-react';

interface Props {
    summary: FinancialSummary;
    transactions: Transaction[];
}

type QuickAnalysisType = 'cashflow' | 'employees' | 'reduction' | 'forecast' | 'clients';

interface QuickAction {
    id: QuickAnalysisType;
    label: string;
    icon: React.ElementType;
    description: string;
    color: string;
}

const quickActions: QuickAction[] = [
    { id: 'cashflow', label: 'Fluxo de Caixa', icon: TrendingUp, description: 'Análise completa do fluxo', color: 'indigo' },
    { id: 'employees', label: 'Funcionários', icon: Users, description: 'Performance da equipe', color: 'violet' },
    { id: 'reduction', label: 'Corte de Custos', icon: Scissors, description: 'Onde economizar', color: 'rose' },
    { id: 'forecast', label: 'Projeção 3 Meses', icon: Target, description: 'Previsão financeira', color: 'emerald' },
    { id: 'clients', label: 'Clientes', icon: UserCheck, description: 'Pagamentos e cobranças', color: 'amber' },
];

const suggestedQuestions = [
    "Qual o meu lucro líquido este mês?",
    "Quem é o funcionário que mais gera receita?",
    "Tenho clientes inadimplentes?",
    "Quanto vou pagar de comissão este mês?",
    "Qual serviço dá mais lucro?",
    "Como posso reduzir minhas despesas?",
    "Qual minha margem de lucro atual?",
    "Preciso contratar mais técnicos?",
];

const AIAssistant: React.FC<Props> = ({ summary, transactions }) => {
    const [insights, setInsights] = useState<string>('');
    const [loadingInsights, setLoadingInsights] = useState(false);

    const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string; timestamp?: Date }[]>([
        {
            role: 'ai',
            text: "Olá! 👋 Sou o Consultor FinNexus, seu CFO Inteligente. Posso analisar seu fluxo de caixa, performance dos funcionários, projeções financeiras e muito mais. Como posso ajudar hoje?",
            timestamp: new Date()
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [activeQuickAnalysis, setActiveQuickAnalysis] = useState<string | null>(null);
    const [quickAnalysisResult, setQuickAnalysisResult] = useState<string>('');
    const [loadingQuickAnalysis, setLoadingQuickAnalysis] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Financial metrics for the sidebar
    const margin = summary.totalIncome > 0 ? ((summary.netProfit / summary.totalIncome) * 100) : 0;
    const totalTx = transactions.length;
    const pendingCount = transactions.filter(t => t.status === TransactionStatus.PARTIAL && t.pendingAmount && t.pendingAmount > 0).length;
    const completedThisMonth = transactions.filter(t => {
        const now = new Date();
        const [y, m] = t.date.split('-').map(Number);
        return y === now.getFullYear() && m === now.getMonth() + 1 && t.status === TransactionStatus.COMPLETED;
    }).length;

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    useEffect(() => {
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

    const handleRefreshInsights = async () => {
        setLoadingInsights(true);
        const result = await getFinancialInsights(summary, transactions);
        setInsights(result);
        setLoadingInsights(false);
    };

    const handleSendMessage = async (e?: React.FormEvent, customMessage?: string) => {
        if (e) e.preventDefault();
        const msg = customMessage || inputValue.trim();
        if (!msg) return;

        setShowSuggestions(false);
        const newUserMsg = { role: 'user' as const, text: msg, timestamp: new Date() };
        setMessages(prev => [...prev, newUserMsg]);
        setInputValue('');
        setChatLoading(true);

        const context = buildFinancialContext(summary, transactions);
        const response = await chatWithFinanceAI(msg, context, [...messages, newUserMsg]);

        setMessages(prev => [...prev, { role: 'ai', text: response, timestamp: new Date() }]);
        setChatLoading(false);
    };

    const handleQuickAnalysis = async (type: QuickAnalysisType) => {
        setActiveQuickAnalysis(type);
        setLoadingQuickAnalysis(true);
        setQuickAnalysisResult('');

        const result = await generateQuickAnalysis(type, summary, transactions);
        setQuickAnalysisResult(result);
        setLoadingQuickAnalysis(false);
    };

    const handleClearChat = () => {
        setMessages([{
            role: 'ai',
            text: "Chat limpo! 🧹 Como posso ajudar agora?",
            timestamp: new Date()
        }]);
        setShowSuggestions(true);
    };

    const handleSuggestedQuestion = (q: string) => {
        handleSendMessage(undefined, q);
    };

    const colorMap: Record<string, string> = {
        indigo: 'from-brand-500 to-brand-600 shadow-brand-500/20',
        violet: 'from-brand-400 to-brand-600 shadow-brand-500/20',
        rose: 'from-danger-500 to-danger-600 shadow-danger-500/20',
        emerald: 'from-success-500 to-success-600 shadow-success-500/20',
        amber: 'from-warning-500 to-warning-600 shadow-warning-500/20',
    };

    const colorBorderMap: Record<string, string> = {
        indigo: 'border-brand-200 dark:border-brand-800/40 hover:border-brand-400 dark:hover:border-brand-600',
        violet: 'border-brand-200 dark:border-brand-800/40 hover:border-brand-400 dark:hover:border-brand-600',
        rose: 'border-danger-200 dark:border-danger-800/40 hover:border-danger-400 dark:hover:border-danger-600',
        emerald: 'border-success-200 dark:border-success-800/40 hover:border-success-400 dark:hover:border-success-600',
        amber: 'border-warning-200 dark:border-warning-800/40 hover:border-warning-400 dark:hover:border-warning-600',
    };

    return (
        <div className="space-y-6 animate-fade-in pb-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 border-b border-surface-200/60 dark:border-surface-700/40 pb-6">
                <div>
                    <h2 className="text-lg font-semibold text-surface-900 dark:text-white tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-brand-600 rounded-lg shadow-sm">
                            <Sparkles className="h-5 w-5 text-white" />
                        </div>
                        Consultor Inteligente
                    </h2>
                    <p className="text-surface-400 mt-0.5 text-xs font-medium">
                        CFO Virtual com acesso completo aos seus dados financeiros.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleRefreshInsights}
                        disabled={loadingInsights}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-surface-700/60 rounded-lg text-xs font-semibold text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 transition-all shadow-sm disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${loadingInsights ? 'animate-spin' : ''}`} />
                        Atualizar Insights
                    </button>
                </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-surface-900/60 rounded-xl p-3.5 border border-surface-100/60 dark:border-surface-800/60 shadow-card">
                    <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="h-4 w-4 text-success-500" />
                        <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Lucro</span>
                    </div>
                    <p className={`text-lg font-bold ${summary.netProfit >= 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}`}>
                        {formatCurrency(summary.netProfit)}
                    </p>
                </div>
                <div className="bg-white dark:bg-surface-900/60 rounded-xl p-3.5 border border-surface-100/60 dark:border-surface-800/60 shadow-card">
                    <div className="flex items-center gap-2 mb-1">
                        <BarChart3 className="h-4 w-4 text-brand-500" />
                        <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Margem</span>
                    </div>
                    <p className={`text-lg font-bold ${margin >= 20 ? 'text-success-600 dark:text-success-400' : margin >= 0 ? 'text-warning-600 dark:text-warning-400' : 'text-danger-600 dark:text-danger-400'}`}>
                        {margin.toFixed(1)}%
                    </p>
                </div>
                <div className="bg-white dark:bg-surface-900/60 rounded-xl p-3.5 border border-surface-100/60 dark:border-surface-800/60 shadow-card">
                    <div className="flex items-center gap-2 mb-1">
                        <Zap className="h-4 w-4 text-brand-400" />
                        <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Concluídos/Mês</span>
                    </div>
                    <p className="text-lg font-bold text-surface-800 dark:text-white">{completedThisMonth}</p>
                </div>
                <div className="bg-white dark:bg-surface-900/60 rounded-xl p-3.5 border border-surface-100/60 dark:border-surface-800/60 shadow-card">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4 text-warning-500" />
                        <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Pendentes</span>
                    </div>
                    <p className={`text-lg font-bold ${pendingCount > 0 ? 'text-warning-600 dark:text-warning-400' : 'text-surface-800 dark:text-white'}`}>
                        {pendingCount}
                    </p>
                </div>
            </div>

            {/* Quick Analysis Cards */}
            <div>
                <h3 className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Análises Rápidas da IA
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {quickActions.map((action) => (
                        <button
                            key={action.id}
                            onClick={() => handleQuickAnalysis(action.id)}
                            disabled={loadingQuickAnalysis}
                            className={`group relative text-left p-4 rounded-xl border transition-all duration-200 hover:shadow-md dark:hover:shadow-none hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-wait bg-white dark:bg-surface-900/60 ${colorBorderMap[action.color]} ${activeQuickAnalysis === action.id ? 'ring-2 ring-brand-500/50' : ''}`}
                        >
                            <div className={`inline-flex p-2 rounded-lg bg-gradient-to-br ${colorMap[action.color]} shadow-lg mb-3`}>
                                <action.icon className="h-4 w-4 text-white" />
                            </div>
                            <h4 className="text-sm font-bold text-surface-800 dark:text-white">{action.label}</h4>
                            <p className="text-[11px] text-surface-400 mt-0.5">{action.description}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Quick Analysis Result Modal */}
            {activeQuickAnalysis && (
                <div className="bg-white dark:bg-surface-900/60 rounded-xl border border-surface-200/60 dark:border-surface-800/60 shadow-elevated dark:shadow-none overflow-hidden animate-fade-in">
                    <div className="px-6 py-4 border-b border-surface-100/60 dark:border-surface-800/60 flex items-center justify-between bg-surface-50/50 dark:bg-surface-800/30">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg bg-gradient-to-br ${colorMap[quickActions.find(a => a.id === activeQuickAnalysis)?.color || 'indigo']} shadow-lg`}>
                                {(() => {
                                    const action = quickActions.find(a => a.id === activeQuickAnalysis);
                                    const Icon = action?.icon || Sparkles;
                                    return <Icon className="h-5 w-5 text-white" />;
                                })()}
                            </div>
                            <div>
                                <h3 className="font-bold text-surface-800 dark:text-white">
                                    {quickActions.find(a => a.id === activeQuickAnalysis)?.label}
                                </h3>
                                <p className="text-xs text-surface-400">Relatório gerado pela IA</p>
                            </div>
                        </div>
                        <button
                            onClick={() => { setActiveQuickAnalysis(null); setQuickAnalysisResult(''); }}
                            className="p-2 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    <div className="p-6 max-h-[500px] overflow-y-auto">
                        {loadingQuickAnalysis ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-4">
                                <div className="relative">
                                    <div className="w-12 h-12 border-4 border-surface-200 dark:border-surface-700 rounded-full"></div>
                                    <div className="w-12 h-12 border-4 border-brand-600 rounded-full border-t-transparent animate-spin absolute inset-0"></div>
                                </div>
                                <p className="text-sm text-surface-500 dark:text-surface-400 animate-pulse font-medium">Analisando dados financeiros...</p>
                            </div>
                        ) : (
                            <div className="prose prose-sm dark:prose-invert max-w-none text-surface-700 dark:text-surface-300 leading-relaxed whitespace-pre-wrap">
                                {quickAnalysisResult}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Main Content: Insights + Chat */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[500px]">
                {/* Strategic Insights Panel */}
                <div className="lg:col-span-1 bg-gradient-to-br from-brand-900 via-brand-950 to-surface-900 rounded-2xl shadow-xl text-white p-6 overflow-y-auto flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-brand-500/20 rounded-lg">
                                <Sparkles className="h-6 w-6 text-brand-300" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold">Inteligência Estratégica</h2>
                                <p className="text-xs text-brand-300/60 font-medium mt-0.5">Powered by {getActiveProviderName()}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1">
                        {loadingInsights ? (
                            <div className="flex flex-col items-center justify-center h-64 opacity-70">
                                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                                <p className="text-sm">Analisando dados fiscais...</p>
                            </div>
                        ) : (
                            <div className="prose prose-invert prose-sm">
                                <div dangerouslySetInnerHTML={{ __html: insights }} />
                            </div>
                        )}
                    </div>

                    {/* Dynamic Tip based on data */}
                    <div className="mt-6 space-y-3">
                        {summary.pendingInvoices > 0 && (
                            <div className="p-4 bg-warning-500/10 rounded-xl border border-warning-500/20">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="h-5 w-5 text-warning-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-semibold text-warning-200 text-sm">Faturas Pendentes</h4>
                                        <p className="text-xs text-surface-300 mt-1">
                                            Você tem {formatCurrency(summary.pendingInvoices)} em faturas pendentes. Considere implementar um sistema de lembrete automático.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {margin < 15 && margin >= 0 && (
                            <div className="p-4 bg-danger-500/10 rounded-xl border border-danger-500/20">
                                <div className="flex items-start gap-3">
                                    <TrendingUp className="h-5 w-5 text-danger-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-semibold text-danger-200 text-sm">Margem Baixa</h4>
                                        <p className="text-xs text-surface-300 mt-1">
                                            Sua margem de lucro está em {margin.toFixed(1)}%. O ideal para o setor é acima de 20%. Revise seus custos operacionais.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {(summary.pendingCommissions || 0) > 0 && (
                            <div className="p-4 bg-brand-500/10 rounded-xl border border-brand-500/20">
                                <div className="flex items-start gap-3">
                                    <Users className="h-5 w-5 text-brand-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-semibold text-brand-200 text-sm">Comissões a Pagar</h4>
                                        <p className="text-xs text-surface-300 mt-1">
                                            {formatCurrency(summary.pendingCommissions || 0)} em comissões agendadas. Reserve esse valor no caixa.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Chat Interface */}
                <div className="lg:col-span-2 bg-white dark:bg-surface-900/60 dark:backdrop-blur-xl rounded-xl shadow-card dark:shadow-none border border-surface-200/60 dark:border-surface-800/60 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-surface-100/60 dark:border-surface-800/60 bg-surface-50/50 dark:bg-surface-800/30 flex justify-between items-center">
                        <h3 className="font-semibold text-surface-700 dark:text-white flex items-center gap-2">
                            <Bot className="h-5 w-5 text-brand-600" />
                            Chat com o Consultor
                            <span className="w-2 h-2 bg-success-500 rounded-full animate-pulse"></span>
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] px-2 py-1 bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300 rounded-full font-semibold" title={`Modelo: ${getActiveModelName()}`}>
                                ⚡ {getActiveProviderName()}
                            </span>
                            <span className="text-[10px] px-2 py-1 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-full font-semibold">
                                {messages.length - 1} msgs
                            </span>
                            <button
                                onClick={handleClearChat}
                                className="p-1.5 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors text-surface-400 hover:text-danger-500"
                                title="Limpar chat"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[300px] max-h-[500px]">
                        {messages.map((m, idx) => (
                            <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                    {/* Avatar */}
                                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${m.role === 'user'
                                        ? 'bg-brand-600 text-white'
                                        : 'bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/20'
                                        }`}>
                                        {m.role === 'user' ? 'Eu' : '🤖'}
                                    </div>

                                    <div>
                                        <div className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${m.role === 'user'
                                            ? 'bg-brand-600 text-white rounded-tr-sm'
                                            : 'bg-surface-100 dark:bg-surface-800/60 text-surface-800 dark:text-surface-200 rounded-tl-sm'
                                            }`}>
                                            <div className="whitespace-pre-wrap">{m.text}</div>
                                        </div>
                                        {m.timestamp && (
                                            <p className={`text-[10px] text-surface-400 mt-1 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                                                {m.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {chatLoading && (
                            <div className="flex justify-start">
                                <div className="flex gap-3">
                                    <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/20 text-xs">
                                        🤖
                                    </div>
                                    <div className="bg-surface-100 dark:bg-surface-800/60 text-surface-500 dark:text-surface-400 rounded-2xl rounded-tl-sm px-4 py-3 text-sm flex items-center gap-2">
                                        <span className="w-2 h-2 bg-brand-400 rounded-full animate-bounce"></span>
                                        <span className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                                        <span className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                        <span className="text-xs font-medium ml-1">Analisando...</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={chatEndRef} />
                    </div>

                    {/* Suggested Questions */}
                    {showSuggestions && messages.length <= 2 && (
                        <div className="px-6 pb-2">
                            <p className="text-[10px] font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                Sugestões
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {suggestedQuestions.slice(0, 4).map((q, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSuggestedQuestion(q)}
                                        className="text-xs px-3 py-1.5 bg-surface-100 dark:bg-surface-800/60 text-surface-600 dark:text-surface-300 rounded-full hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600 dark:hover:text-brand-400 transition-colors border border-surface-200 dark:border-surface-700/40 font-medium"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Input */}
                    <form onSubmit={handleSendMessage} className="p-4 bg-white dark:bg-surface-900/40 border-t border-surface-100/60 dark:border-surface-800/60 flex gap-2">
                        <input
                            type="text"
                            className="flex-1 bg-surface-50 dark:bg-surface-900/50 border border-surface-200 dark:border-surface-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all dark:text-white dark:placeholder-surface-500 text-sm"
                            placeholder="Pergunte sobre lucros, funcionários, projeções, corte de custos..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            disabled={chatLoading}
                        />
                        <button
                            type="submit"
                            disabled={chatLoading || !inputValue.trim()}
                            className="bg-brand-600 hover:bg-brand-500 text-white p-3 rounded-lg transition-all disabled:opacity-50 shadow-sm hover:shadow-brand-500/20 active:scale-95"
                        >
                            <Send className="h-5 w-5" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AIAssistant;