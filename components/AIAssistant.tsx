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
        indigo: 'from-indigo-500 to-indigo-600 shadow-indigo-500/20',
        violet: 'from-violet-500 to-violet-600 shadow-violet-500/20',
        rose: 'from-rose-500 to-rose-600 shadow-rose-500/20',
        emerald: 'from-emerald-500 to-emerald-600 shadow-emerald-500/20',
        amber: 'from-amber-500 to-amber-600 shadow-amber-500/20',
    };

    const colorBorderMap: Record<string, string> = {
        indigo: 'border-indigo-200 dark:border-indigo-800/40 hover:border-indigo-400 dark:hover:border-indigo-600',
        violet: 'border-violet-200 dark:border-violet-800/40 hover:border-violet-400 dark:hover:border-violet-600',
        rose: 'border-rose-200 dark:border-rose-800/40 hover:border-rose-400 dark:hover:border-rose-600',
        emerald: 'border-emerald-200 dark:border-emerald-800/40 hover:border-emerald-400 dark:hover:border-emerald-600',
        amber: 'border-amber-200 dark:border-amber-800/40 hover:border-amber-400 dark:hover:border-amber-600',
    };

    return (
        <div className="space-y-6 animate-fade-in pb-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 border-b border-slate-200 dark:border-slate-700/40 pb-6">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-lg shadow-indigo-500/20">
                            <Sparkles className="h-6 w-6 text-white" />
                        </div>
                        Consultor Inteligente
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm font-medium">
                        CFO Virtual com acesso completo aos seus dados financeiros.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleRefreshInsights}
                        disabled={loadingInsights}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#111a2e]/80 border border-slate-200 dark:border-slate-700/40 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${loadingInsights ? 'animate-spin' : ''}`} />
                        Atualizar Insights
                    </button>
                </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-[#111a2e]/80 rounded-xl p-4 border border-slate-100 dark:border-slate-700/40 shadow-sm dark:shadow-none">
                    <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lucro</span>
                    </div>
                    <p className={`text-xl font-extrabold ${summary.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {formatCurrency(summary.netProfit)}
                    </p>
                </div>
                <div className="bg-white dark:bg-[#111a2e]/80 rounded-xl p-4 border border-slate-100 dark:border-slate-700/40 shadow-sm dark:shadow-none">
                    <div className="flex items-center gap-2 mb-1">
                        <BarChart3 className="h-4 w-4 text-indigo-500" />
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Margem</span>
                    </div>
                    <p className={`text-xl font-extrabold ${margin >= 20 ? 'text-emerald-600 dark:text-emerald-400' : margin >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {margin.toFixed(1)}%
                    </p>
                </div>
                <div className="bg-white dark:bg-[#111a2e]/80 rounded-xl p-4 border border-slate-100 dark:border-slate-700/40 shadow-sm dark:shadow-none">
                    <div className="flex items-center gap-2 mb-1">
                        <Zap className="h-4 w-4 text-violet-500" />
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Concluídos/Mês</span>
                    </div>
                    <p className="text-xl font-extrabold text-slate-800 dark:text-white">{completedThisMonth}</p>
                </div>
                <div className="bg-white dark:bg-[#111a2e]/80 rounded-xl p-4 border border-slate-100 dark:border-slate-700/40 shadow-sm dark:shadow-none">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pendentes</span>
                    </div>
                    <p className={`text-xl font-extrabold ${pendingCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-white'}`}>
                        {pendingCount}
                    </p>
                </div>
            </div>

            {/* Quick Analysis Cards */}
            <div>
                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Análises Rápidas da IA
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {quickActions.map((action) => (
                        <button
                            key={action.id}
                            onClick={() => handleQuickAnalysis(action.id)}
                            disabled={loadingQuickAnalysis}
                            className={`group relative text-left p-4 rounded-xl border transition-all duration-200 hover:shadow-md dark:hover:shadow-none hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-wait bg-white dark:bg-[#111a2e]/80 ${colorBorderMap[action.color]} ${activeQuickAnalysis === action.id ? 'ring-2 ring-indigo-500/50' : ''}`}
                        >
                            <div className={`inline-flex p-2 rounded-lg bg-gradient-to-br ${colorMap[action.color]} shadow-lg mb-3`}>
                                <action.icon className="h-4 w-4 text-white" />
                            </div>
                            <h4 className="text-sm font-bold text-slate-800 dark:text-white">{action.label}</h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{action.description}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Quick Analysis Result Modal */}
            {activeQuickAnalysis && (
                <div className="bg-white dark:bg-[#111a2e]/80 rounded-2xl border border-slate-200 dark:border-slate-700/40 shadow-lg dark:shadow-none overflow-hidden animate-fade-in">
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/40 flex items-center justify-between bg-slate-50 dark:bg-[#0d1526]/60">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg bg-gradient-to-br ${colorMap[quickActions.find(a => a.id === activeQuickAnalysis)?.color || 'indigo']} shadow-lg`}>
                                {(() => {
                                    const action = quickActions.find(a => a.id === activeQuickAnalysis);
                                    const Icon = action?.icon || Sparkles;
                                    return <Icon className="h-5 w-5 text-white" />;
                                })()}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white">
                                    {quickActions.find(a => a.id === activeQuickAnalysis)?.label}
                                </h3>
                                <p className="text-xs text-slate-400">Relatório gerado pela IA</p>
                            </div>
                        </div>
                        <button
                            onClick={() => { setActiveQuickAnalysis(null); setQuickAnalysisResult(''); }}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    <div className="p-6 max-h-[500px] overflow-y-auto">
                        {loadingQuickAnalysis ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-4">
                                <div className="relative">
                                    <div className="w-12 h-12 border-4 border-slate-200 dark:border-slate-700 rounded-full"></div>
                                    <div className="w-12 h-12 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin absolute inset-0"></div>
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 animate-pulse font-medium">Analisando dados financeiros...</p>
                            </div>
                        ) : (
                            <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                {quickAnalysisResult}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Main Content: Insights + Chat */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[500px]">
                {/* Strategic Insights Panel */}
                <div className="lg:col-span-1 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 rounded-2xl shadow-xl text-white p-6 overflow-y-auto flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/20 rounded-lg">
                                <Sparkles className="h-6 w-6 text-indigo-300" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">Inteligência Estratégica</h2>
                                <p className="text-xs text-indigo-300/60 font-medium mt-0.5">Powered by {getActiveProviderName()}</p>
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
                            <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-semibold text-amber-200 text-sm">Faturas Pendentes</h4>
                                        <p className="text-xs text-slate-300 mt-1">
                                            Você tem {formatCurrency(summary.pendingInvoices)} em faturas pendentes. Considere implementar um sistema de lembrete automático.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {margin < 15 && margin >= 0 && (
                            <div className="p-4 bg-rose-500/10 rounded-xl border border-rose-500/20">
                                <div className="flex items-start gap-3">
                                    <TrendingUp className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-semibold text-rose-200 text-sm">Margem Baixa</h4>
                                        <p className="text-xs text-slate-300 mt-1">
                                            Sua margem de lucro está em {margin.toFixed(1)}%. O ideal para o setor é acima de 20%. Revise seus custos operacionais.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {(summary.pendingCommissions || 0) > 0 && (
                            <div className="p-4 bg-violet-500/10 rounded-xl border border-violet-500/20">
                                <div className="flex items-start gap-3">
                                    <Users className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-semibold text-violet-200 text-sm">Comissões a Pagar</h4>
                                        <p className="text-xs text-slate-300 mt-1">
                                            {formatCurrency(summary.pendingCommissions || 0)} em comissões agendadas. Reserve esse valor no caixa.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Chat Interface */}
                <div className="lg:col-span-2 bg-white dark:bg-[#111a2e]/80 dark:backdrop-blur-xl rounded-2xl shadow-lg dark:shadow-none border border-slate-200 dark:border-slate-700/40 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700/40 bg-slate-50 dark:bg-[#0d1526]/60 flex justify-between items-center">
                        <h3 className="font-semibold text-slate-700 dark:text-white flex items-center gap-2">
                            <Bot className="h-5 w-5 text-indigo-600" />
                            Chat com o Consultor
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full font-medium" title={`Modelo: ${getActiveModelName()}`}>
                                ⚡ {getActiveProviderName()}
                            </span>
                            <span className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full font-medium">
                                {messages.length - 1} msgs
                            </span>
                            <button
                                onClick={handleClearChat}
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-rose-500"
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
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20'
                                        }`}>
                                        {m.role === 'user' ? 'Eu' : '🤖'}
                                    </div>

                                    <div>
                                        <div className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${m.role === 'user'
                                            ? 'bg-indigo-600 text-white rounded-tr-sm'
                                            : 'bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 rounded-tl-sm'
                                            }`}>
                                            <div className="whitespace-pre-wrap">{m.text}</div>
                                        </div>
                                        {m.timestamp && (
                                            <p className={`text-[10px] text-slate-400 mt-1 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
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
                                    <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20 text-xs">
                                        🤖
                                    </div>
                                    <div className="bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 rounded-2xl rounded-tl-sm px-4 py-3 text-sm flex items-center gap-2">
                                        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                                        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                                        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
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
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                Sugestões
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {suggestedQuestions.slice(0, 4).map((q, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSuggestedQuestion(q)}
                                        className="text-xs px-3 py-1.5 bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors border border-slate-200 dark:border-slate-700/40 font-medium"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Input */}
                    <form onSubmit={handleSendMessage} className="p-4 bg-white dark:bg-[#0d1526]/50 border-t border-slate-100 dark:border-slate-700/40 flex gap-2">
                        <input
                            type="text"
                            className="flex-1 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white dark:placeholder-slate-500 text-sm"
                            placeholder="Pergunte sobre lucros, funcionários, projeções, corte de custos..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            disabled={chatLoading}
                        />
                        <button
                            type="submit"
                            disabled={chatLoading || !inputValue.trim()}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 active:scale-95"
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