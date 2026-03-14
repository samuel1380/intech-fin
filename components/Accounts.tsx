import React, { useMemo, useState } from 'react';
import { Transaction, TransactionType, TransactionStatus } from '../types';
import { 
    ArrowDownCircle, ArrowUpCircle, Clock, AlertTriangle, CheckCircle, 
    Calendar, DollarSign, Bell, ChevronRight, Filter, Search, Check, X
} from 'lucide-react';
import { format } from 'date-fns';

interface Props {
    transactions: Transaction[];
    onUpdateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
}

const Accounts: React.FC<Props> = ({ transactions, onUpdateTransaction }) => {
    const [activeTab, setActiveTab] = useState<'alerts' | 'receivable' | 'payable'>('alerts');
    const [searchTerm, setSearchTerm] = useState('');
    const [markingId, setMarkingId] = useState<string | null>(null);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parseDateLocal = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const formatDate = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    };

    const getDaysUntil = (t: Transaction) => {
        const targetDate = t.dueDate || t.date;
        const date = parseDateLocal(targetDate);
        const diffTime = date.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    // Contas a RECEBER (RECEITA pendente ou parcial)
    const receivables = useMemo(() => {
        return transactions
            .filter(t => t.type === TransactionType.INCOME && 
                (t.status === TransactionStatus.PENDING || t.status === TransactionStatus.PARTIAL))
            .sort((a, b) => (a.dueDate || a.date).localeCompare(b.dueDate || b.date));
    }, [transactions]);

    // Contas a PAGAR (DESPESA pendente ou parcial)
    const payables = useMemo(() => {
        return transactions
            .filter(t => t.type === TransactionType.EXPENSE && 
                (t.status === TransactionStatus.PENDING || t.status === TransactionStatus.PARTIAL))
            .sort((a, b) => (a.dueDate || a.date).localeCompare(b.dueDate || b.date));
    }, [transactions]);

    // Alertas: tudo que vence HOJE ou nos próximos 7 dias, ou que JÁ VENCEU
    const alerts = useMemo(() => {
        const all = [...receivables, ...payables];
        return all.filter(t => {
            const days = getDaysUntil(t);
            return days <= 7; // vence em até 7 dias OU já venceu (negativo)
        }).sort((a, b) => {
            const dA = getDaysUntil(a);
            const dB = getDaysUntil(b);
            return dA - dB; // já vencidas primeiro, depois as mais próximas
        });
    }, [receivables, payables]);

    // Totais
    const totalReceivable = receivables.reduce((s, t) => s + (t.pendingAmount || t.amount), 0);
    const totalPayable = payables.reduce((s, t) => s + (t.pendingAmount || t.amount), 0);
    const overdueCount = alerts.filter(t => getDaysUntil(t) < 0).length;
    const todayCount = alerts.filter(t => getDaysUntil(t) === 0).length;

    // Marcar como pago/recebido
    const handleMarkCompleted = async (t: Transaction) => {
        setMarkingId(t.id);
        try {
            await onUpdateTransaction(t.id, {
                status: TransactionStatus.COMPLETED,
                pendingAmount: undefined,
            });
        } catch (err: any) {
            alert(`Erro: ${err.message}`);
        } finally {
            setMarkingId(null);
        }
    };

    // Filtrar por busca
    const filterBySearch = (items: Transaction[]) => {
        if (!searchTerm) return items;
        const term = searchTerm.toLowerCase();
        return items.filter(t => 
            t.description.toLowerCase().includes(term) || 
            t.category.toLowerCase().includes(term) ||
            (t.employeeName || '').toLowerCase().includes(term)
        );
    };

    const getUrgencyBadge = (t: Transaction) => {
        const days = getDaysUntil(t);
        if (days < 0) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50 animate-pulse">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    VENCIDA ({Math.abs(days)}d atrás)
                </span>
            );
        }
        if (days === 0) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                    <Bell className="h-2.5 w-2.5" />
                    VENCE HOJE
                </span>
            );
        }
        if (days <= 3) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50">
                    <Clock className="h-2.5 w-2.5" />
                    {days}d restante{days > 1 ? 's' : ''}
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
                <Calendar className="h-2.5 w-2.5" />
                {days}d restantes
            </span>
        );
    };

    const renderTransactionRow = (t: Transaction) => (
        <div key={t.id} className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-700/40 hover:border-slate-300 dark:hover:border-slate-600 transition-all group">
            {/* Icon */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                t.type === TransactionType.INCOME 
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
            }`}>
                {t.type === TransactionType.INCOME 
                    ? <ArrowDownCircle className="h-5 w-5" /> 
                    : <ArrowUpCircle className="h-5 w-5" />
                }
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate">{t.description}</h4>
                    {getUrgencyBadge(t)}
                    {t.installment && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-600">
                            {t.installment}
                        </span>
                    )}
                    {t.isRecurring && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-md border border-purple-200 dark:border-purple-800/50">
                            RECORRENTE
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <div className="flex flex-col gap-0.5">
                        {t.dueDate && t.dueDate !== t.date && (
                             <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                                 Srv: {formatDate(t.date)}
                             </span>
                        )}
                        <span className={`flex items-center gap-1 font-bold ${getDaysUntil(t) < 0 ? 'text-red-500' : getDaysUntil(t) <= 3 ? 'text-amber-500' : 'text-slate-600 dark:text-slate-300'}`}>
                            <Calendar className="h-3 w-3" />
                            Venc: {formatDate(t.dueDate || t.date)}
                        </span>
                    </div>
                    <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700/50 rounded text-[10px] font-medium h-fit">
                        {t.category}
                    </span>
                    {t.employeeName && (
                        <span className="text-indigo-500 font-semibold h-fit">{t.employeeName}</span>
                    )}
                </div>
            </div>

            {/* Valor */}
            <div className="text-right shrink-0">
                <div className={`font-bold font-mono text-sm ${
                    t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                    {formatBRL(t.pendingAmount || t.amount)}
                </div>
                {t.pendingAmount && t.pendingAmount !== t.amount && (
                    <div className="text-[10px] text-slate-400 font-mono">de {formatBRL(t.amount)}</div>
                )}
            </div>

            {/* Ação: marcar como pago */}
            <button
                onClick={() => handleMarkCompleted(t)}
                disabled={markingId === t.id}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all border shadow-sm ${
                    t.type === TransactionType.INCOME
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                        : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/40'
                } disabled:opacity-50`}
                title={t.type === TransactionType.INCOME ? 'Marcar como Recebido' : 'Marcar como Pago'}
            >
                {markingId === t.id ? (
                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                ) : (
                    <Check className="h-3.5 w-3.5" />
                )}
                {t.type === TransactionType.INCOME ? 'Recebido' : 'Pago'}
            </button>
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in w-full pb-8">
            {/* Header */}
            <div className="border-b border-slate-200 dark:border-slate-700/40 pb-6">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Contas</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Contas a pagar, receber e alertas de vencimento.</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Alertas urgentes */}
                <div className={`p-5 rounded-2xl border shadow-sm transition-all cursor-pointer ${
                    activeTab === 'alerts' 
                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/50 ring-2 ring-amber-300 dark:ring-amber-700'
                        : 'bg-white dark:bg-[#111a2e]/80 border-slate-200 dark:border-slate-700/40 hover:border-amber-200'
                }`} onClick={() => setActiveTab('alerts')}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                            <Bell className={`h-5 w-5 text-amber-600 dark:text-amber-400 ${alerts.length > 0 ? 'animate-bounce' : ''}`} />
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase">Alertas</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{alerts.length}</div>
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                        {overdueCount > 0 && (
                            <span className="text-[10px] font-bold text-red-600 dark:text-red-400">{overdueCount} vencida{overdueCount > 1 ? 's' : ''}</span>
                        )}
                        {todayCount > 0 && (
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">{todayCount} p/ hoje</span>
                        )}
                        {alerts.length - overdueCount - todayCount > 0 && (
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{alerts.length - overdueCount - todayCount} próxima{alerts.length - overdueCount - todayCount > 1 ? 's' : ''}</span>
                        )}
                        {alerts.length === 0 && (
                            <span className="text-[10px] font-medium text-slate-400">Tudo em dia! 🎉</span>
                        )}
                    </div>
                </div>

                {/* A Receber */}
                <div className={`p-5 rounded-2xl border shadow-sm transition-all cursor-pointer ${
                    activeTab === 'receivable' 
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700/50 ring-2 ring-emerald-300 dark:ring-emerald-700'
                        : 'bg-white dark:bg-[#111a2e]/80 border-slate-200 dark:border-slate-700/40 hover:border-emerald-200'
                }`} onClick={() => setActiveTab('receivable')}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                            <ArrowDownCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase">A Receber</span>
                    </div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatBRL(totalReceivable)}</div>
                    <p className="text-[10px] font-medium text-slate-400 mt-1">{receivables.length} conta{receivables.length !== 1 ? 's' : ''} pendente{receivables.length !== 1 ? 's' : ''}</p>
                </div>

                {/* A Pagar */}
                <div className={`p-5 rounded-2xl border shadow-sm transition-all cursor-pointer ${
                    activeTab === 'payable' 
                        ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-700/50 ring-2 ring-rose-300 dark:ring-rose-700'
                        : 'bg-white dark:bg-[#111a2e]/80 border-slate-200 dark:border-slate-700/40 hover:border-rose-200'
                }`} onClick={() => setActiveTab('payable')}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/30">
                            <ArrowUpCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase">A Pagar</span>
                    </div>
                    <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{formatBRL(totalPayable)}</div>
                    <p className="text-[10px] font-medium text-slate-400 mt-1">{payables.length} conta{payables.length !== 1 ? 's' : ''} pendente{payables.length !== 1 ? 's' : ''}</p>
                </div>

                {/* Saldo Contas */}
                <div className="p-5 rounded-2xl bg-white dark:bg-[#111a2e]/80 border border-slate-200 dark:border-slate-700/40 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                            <DollarSign className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase">Balanço Pendente</span>
                    </div>
                    <div className={`text-2xl font-bold ${totalReceivable - totalPayable >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {formatBRL(totalReceivable - totalPayable)}
                    </div>
                    <p className="text-[10px] font-medium text-slate-400 mt-1">A receber - A pagar</p>
                </div>
            </div>

            {/* Search */}
            <div className="bg-white dark:bg-[#111a2e]/80 dark:backdrop-blur-xl p-1.5 rounded-2xl shadow-sm dark:shadow-none border border-slate-200 dark:border-slate-700/40">
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar contas por descrição, categoria ou funcionário..."
                        className="w-full pl-10 pr-4 py-2.5 bg-transparent rounded-xl text-sm focus:outline-none focus:bg-slate-50 dark:focus:bg-slate-900/50 transition-all placeholder:text-slate-400 font-medium text-slate-700 dark:text-slate-200"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Content */}
            <div className="space-y-3">
                {activeTab === 'alerts' && (
                    <>
                        {/* Banner de urgência */}
                        {overdueCount > 0 && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl flex items-center gap-3 animate-fade-in">
                                <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg">
                                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-red-800 dark:text-red-300 text-sm">Atenção! Contas Vencidas</h4>
                                    <p className="text-xs text-red-600 dark:text-red-400">Você tem {overdueCount} conta{overdueCount > 1 ? 's' : ''} vencida{overdueCount > 1 ? 's' : ''}. Regularize o mais rápido possível.</p>
                                </div>
                            </div>
                        )}
                        {todayCount > 0 && (
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl flex items-center gap-3 animate-fade-in">
                                <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
                                    <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-amber-800 dark:text-amber-300 text-sm">Contas para Hoje</h4>
                                    <p className="text-xs text-amber-600 dark:text-amber-400">{todayCount} conta{todayCount > 1 ? 's' : ''} vence{todayCount > 1 ? 'm' : ''} hoje.</p>
                                </div>
                            </div>
                        )}
                        
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mt-4">
                            Contas Próximas do Vencimento
                        </h3>

                        {filterBySearch(alerts).length > 0 ? (
                            <div className="space-y-2">
                                {filterBySearch(alerts).map(renderTransactionRow)}
                            </div>
                        ) : (
                            <div className="p-12 text-center bg-white dark:bg-[#111a2e]/80 rounded-2xl border border-slate-200 dark:border-slate-700/40">
                                <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Tudo em dia!</h3>
                                <p className="text-sm text-slate-400">Nenhuma conta com vencimento próximo (7 dias). 🎉</p>
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'receivable' && (
                    <>
                        <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                            <ArrowDownCircle className="h-4 w-4" />
                            Contas a Receber — Boletos, Pix Fiado, Serviços Pendentes
                        </h3>
                        {filterBySearch(receivables).length > 0 ? (
                            <div className="space-y-2">
                                {filterBySearch(receivables).map(renderTransactionRow)}
                            </div>
                        ) : (
                            <div className="p-12 text-center bg-white dark:bg-[#111a2e]/80 rounded-2xl border border-slate-200 dark:border-slate-700/40">
                                <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Nenhuma conta a receber</h3>
                                <p className="text-sm text-slate-400">Todas as receitas foram recebidas. 💰</p>
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'payable' && (
                    <>
                        <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-2">
                            <ArrowUpCircle className="h-4 w-4" />
                            Contas a Pagar — Despesas, Boletos, Contabilidade
                        </h3>
                        {filterBySearch(payables).length > 0 ? (
                            <div className="space-y-2">
                                {filterBySearch(payables).map(renderTransactionRow)}
                            </div>
                        ) : (
                            <div className="p-12 text-center bg-white dark:bg-[#111a2e]/80 rounded-2xl border border-slate-200 dark:border-slate-700/40">
                                <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Nenhuma conta a pagar</h3>
                                <p className="text-sm text-slate-400">Todas as despesas foram pagas. ✅</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default Accounts;
