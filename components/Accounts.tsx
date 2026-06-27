import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, TransactionType, TransactionStatus } from '../types';
import { 
    ArrowDownCircle, ArrowUpCircle, Clock, AlertTriangle, CheckCircle, 
    Calendar, DollarSign, Bell, ChevronRight, Filter, Search, Check, X
} from 'lucide-react';
import { format } from 'date-fns';

interface Props {
    transactions: Transaction[];
    onUpdateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
    initialTab?: 'alerts' | 'receivable' | 'payable';
}

const Accounts: React.FC<Props> = ({ transactions, onUpdateTransaction, initialTab = 'alerts' }) => {
    const [activeTab, setActiveTab] = useState<'alerts' | 'receivable' | 'payable'>(initialTab);
    const [searchTerm, setSearchTerm] = useState('');
    const [markingId, setMarkingId] = useState<string | null>(null);

    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

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

    const getDaysUntil = (dateStr: string) => {
        const date = parseDateLocal(dateStr);
        const diffTime = date.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    // Contas a RECEBER (RECEITA pendente ou parcial)
    const receivables = useMemo(() => {
        return transactions
            .filter(t => t.type === TransactionType.INCOME && 
                (t.status === TransactionStatus.PENDING || t.status === TransactionStatus.PARTIAL))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [transactions]);

    // Contas a PAGAR (DESPESA pendente ou parcial)
    const payables = useMemo(() => {
        return transactions
            .filter(t => t.type === TransactionType.EXPENSE && 
                (t.status === TransactionStatus.PENDING || t.status === TransactionStatus.PARTIAL))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [transactions]);

    // Alertas: tudo que vence HOJE ou nos próximos 7 dias, ou que JÁ VENCEU
    const alerts = useMemo(() => {
        const all = [...receivables, ...payables];
        return all.filter(t => {
            const days = getDaysUntil(t.date);
            return days <= 7; // vence em até 7 dias OU já venceu (negativo)
        }).sort((a, b) => {
            const dA = getDaysUntil(a.date);
            const dB = getDaysUntil(b.date);
            return dA - dB; // já vencidas primeiro, depois as mais próximas
        });
    }, [receivables, payables]);

    // Totais
    const totalReceivable = receivables.reduce((s, t) => s + (t.pendingAmount || t.amount), 0);
    const totalPayable = payables.reduce((s, t) => s + (t.pendingAmount || t.amount), 0);
    const overdueCount = alerts.filter(t => getDaysUntil(t.date) < 0).length;
    const todayCount = alerts.filter(t => getDaysUntil(t.date) === 0).length;

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

    const getUrgencyBadge = (dateStr: string) => {
        const days = getDaysUntil(dateStr);
        if (days < 0) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-400 border border-danger-200 dark:border-danger-800/50 animate-pulse">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    VENCIDA ({Math.abs(days)}d atrás)
                </span>
            );
        }
        if (days === 0) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400 border border-warning-200 dark:border-warning-800/50">
                    <Bell className="h-2.5 w-2.5" />
                    VENCE HOJE
                </span>
            );
        }
        if (days <= 3) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400 border border-warning-200 dark:border-warning-800/50">
                    <Clock className="h-2.5 w-2.5" />
                    {days}d restante{days > 1 ? 's' : ''}
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 border border-brand-200 dark:border-brand-800/50">
                <Calendar className="h-2.5 w-2.5" />
                {days}d restantes
            </span>
        );
    };

    const renderTransactionRow = (t: Transaction) => (
        <div key={t.id} className="flex items-center gap-4 p-3.5 bg-white dark:bg-surface-800/40 rounded-lg border border-surface-100/60 dark:border-surface-700/40 hover:border-surface-300 dark:hover:border-surface-600 transition-all group">
            {/* Icon */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                t.type === TransactionType.INCOME 
                    ? 'bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400'
                    : 'bg-danger-100 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400'
            }`}>
                {t.type === TransactionType.INCOME 
                    ? <ArrowDownCircle className="h-5 w-5" /> 
                    : <ArrowUpCircle className="h-5 w-5" />
                }
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-surface-900 dark:text-surface-200 text-xs truncate">{t.description}</h4>
                    {getUrgencyBadge(t.date)}
                    {t.isRecurring && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 rounded-md border border-brand-200 dark:border-brand-800/50">
                            RECORRENTE
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-surface-500">
                    <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(t.date)}
                    </span>
                    <span className="px-1.5 py-0.5 bg-surface-100 dark:bg-surface-700/50 rounded text-[10px] font-medium">
                        {t.category}
                    </span>
                    {t.employeeName && (
                        <span className="text-brand-500 font-semibold">{t.employeeName}</span>
                    )}
                </div>
            </div>

            {/* Valor */}
            <div className="text-right shrink-0">
                <div className={`font-bold font-mono text-xs ${
                    t.type === TransactionType.INCOME ? 'text-success-600' : 'text-danger-600'
                }`}>
                    {formatBRL(t.pendingAmount || t.amount)}
                </div>
                {t.pendingAmount && t.pendingAmount !== t.amount && (
                    <div className="text-[10px] text-surface-400 font-mono">de {formatBRL(t.amount)}</div>
                )}
            </div>

            {/* Ação: marcar como pago */}
            <button
                onClick={() => handleMarkCompleted(t)}
                disabled={markingId === t.id}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-semibold transition-all border shadow-sm ${
                    t.type === TransactionType.INCOME
                        ? 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400 border-success-200 dark:border-success-800/50 hover:bg-success-100 dark:hover:bg-success-900/40'
                        : 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 border-brand-200 dark:border-brand-800/50 hover:bg-brand-100 dark:hover:bg-brand-900/40'
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
            <div className="border-b border-surface-200/60 dark:border-surface-700/40 pb-6">
                <h2 className="text-lg font-semibold text-surface-900 dark:text-white tracking-tight">Contas</h2>
                <p className="text-surface-400 mt-0.5 text-xs font-medium">Contas a pagar, receber e alertas de vencimento.</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Alertas urgentes */}
                <div className={`p-4 rounded-xl border shadow-card transition-all cursor-pointer ${
                    activeTab === 'alerts' 
                        ? 'bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-700/50 ring-2 ring-warning-300 dark:ring-warning-700'
                        : 'bg-white dark:bg-[#111a2e]/80 border-surface-200/60 dark:border-surface-800/60 hover:border-warning-200'
                }`} onClick={() => setActiveTab('alerts')}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-warning-100 dark:bg-warning-900/30">
                            <Bell className={`h-5 w-5 text-warning-600 dark:text-warning-400 ${alerts.length > 0 ? 'animate-bounce' : ''}`} />
                        </div>
                        <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Alertas</span>
                    </div>
                    <div className="text-lg font-bold text-surface-900 dark:text-white">{alerts.length}</div>
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                        {overdueCount > 0 && (
                            <span className="text-[10px] font-bold text-danger-600 dark:text-danger-400">{overdueCount} vencida{overdueCount > 1 ? 's' : ''}</span>
                        )}
                        {todayCount > 0 && (
                            <span className="text-[10px] font-bold text-warning-600 dark:text-warning-400">{todayCount} p/ hoje</span>
                        )}
                        {alerts.length - overdueCount - todayCount > 0 && (
                            <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400">{alerts.length - overdueCount - todayCount} próxima{alerts.length - overdueCount - todayCount > 1 ? 's' : ''}</span>
                        )}
                        {alerts.length === 0 && (
                            <span className="text-[10px] font-medium text-surface-400">Tudo em dia!</span>
                        )}
                    </div>
                </div>

                {/* A Receber */}
                <div className={`p-4 rounded-xl border shadow-card transition-all cursor-pointer ${
                    activeTab === 'receivable' 
                        ? 'bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-700/50 ring-2 ring-success-300 dark:ring-success-700'
                        : 'bg-white dark:bg-[#111a2e]/80 border-surface-200/60 dark:border-surface-800/60 hover:border-success-200'
                }`} onClick={() => setActiveTab('receivable')}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-success-100 dark:bg-success-900/30">
                            <ArrowDownCircle className="h-5 w-5 text-success-600 dark:text-success-400" />
                        </div>
                        <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">A Receber</span>
                    </div>
                    <div className="text-lg font-bold text-success-600 dark:text-success-400">{formatBRL(totalReceivable)}</div>
                    <p className="text-[10px] font-medium text-surface-400 mt-1">{receivables.length} conta{receivables.length !== 1 ? 's' : ''} pendente{receivables.length !== 1 ? 's' : ''}</p>
                </div>

                {/* A Pagar */}
                <div className={`p-4 rounded-xl border shadow-card transition-all cursor-pointer ${
                    activeTab === 'payable' 
                        ? 'bg-danger-50 dark:bg-danger-900/20 border-danger-200 dark:border-danger-700/50 ring-2 ring-danger-300 dark:ring-danger-700'
                        : 'bg-white dark:bg-[#111a2e]/80 border-surface-200/60 dark:border-surface-800/60 hover:border-danger-200'
                }`} onClick={() => setActiveTab('payable')}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-danger-100 dark:bg-danger-900/30">
                            <ArrowUpCircle className="h-5 w-5 text-danger-600 dark:text-danger-400" />
                        </div>
                        <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">A Pagar</span>
                    </div>
                    <div className="text-lg font-bold text-danger-600 dark:text-danger-400">{formatBRL(totalPayable)}</div>
                    <p className="text-[10px] font-medium text-surface-400 mt-1">{payables.length} conta{payables.length !== 1 ? 's' : ''} pendente{payables.length !== 1 ? 's' : ''}</p>
                </div>

                {/* Saldo Contas */}
                <div className="p-4 rounded-xl bg-white dark:bg-[#111a2e]/80 border border-surface-200/60 dark:border-surface-800/60 shadow-card">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-brand-100 dark:bg-brand-900/30">
                            <DollarSign className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                        </div>
                        <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Balanço Pendente</span>
                    </div>
                    <div className={`text-lg font-bold ${totalReceivable - totalPayable >= 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}`}>
                        {formatBRL(totalReceivable - totalPayable)}
                    </div>
                    <p className="text-[10px] font-medium text-surface-400 mt-1">A receber - A pagar</p>
                </div>
            </div>

            {/* Search */}
            <div className="bg-white dark:bg-surface-900/60 p-1.5 rounded-xl shadow-card dark:shadow-none border border-surface-200/60 dark:border-surface-800/60">
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                    <input
                        type="text"
                        placeholder="Buscar contas por descrição, categoria ou funcionário..."
                        className="w-full pl-10 pr-4 py-2.5 bg-transparent rounded-xl text-sm focus:outline-none focus:bg-surface-50 dark:focus:bg-surface-900/50 transition-all placeholder:text-surface-400 font-medium text-surface-700 dark:text-surface-200"
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
                            <div className="p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800/40 rounded-xl flex items-center gap-3 animate-fade-in">
                                <div className="p-2 bg-danger-100 dark:bg-danger-900/40 rounded-lg">
                                    <AlertTriangle className="h-5 w-5 text-danger-600 dark:text-danger-400" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-danger-800 dark:text-danger-300 text-sm">Atenção! Contas Vencidas</h4>
                                    <p className="text-xs text-danger-600 dark:text-danger-400">Você tem {overdueCount} conta{overdueCount > 1 ? 's' : ''} vencida{overdueCount > 1 ? 's' : ''}. Regularize o mais rápido possível.</p>
                                </div>
                            </div>
                        )}
                        {todayCount > 0 && (
                            <div className="p-4 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800/40 rounded-xl flex items-center gap-3 animate-fade-in">
                                <div className="p-2 bg-warning-100 dark:bg-warning-900/40 rounded-lg">
                                    <Bell className="h-5 w-5 text-warning-600 dark:text-warning-400" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-warning-800 dark:text-warning-300 text-sm">Contas para Hoje</h4>
                                    <p className="text-xs text-warning-600 dark:text-warning-400">{todayCount} conta{todayCount > 1 ? 's' : ''} vence{todayCount > 1 ? 'm' : ''} hoje.</p>
                                </div>
                            </div>
                        )}
                        
                        <h3 className="text-sm font-bold text-surface-500 uppercase tracking-wider mt-4">
                            Contas Próximas do Vencimento
                        </h3>

                        {filterBySearch(alerts).length > 0 ? (
                            <div className="space-y-2">
                                {filterBySearch(alerts).map(renderTransactionRow)}
                            </div>
                        ) : (
                            <div className="p-12 text-center bg-white dark:bg-[#111a2e]/80 rounded-2xl border border-surface-200/60 dark:border-surface-800/60">
                                <CheckCircle className="h-12 w-12 text-success-400 mx-auto mb-3" />
                                <h3 className="font-bold text-surface-800 dark:text-surface-200 mb-1">Tudo em dia!</h3>
                                <p className="text-xs text-surface-400">Nenhuma conta com vencimento próximo (7 dias).</p>
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'receivable' && (
                    <>
                        <h3 className="text-sm font-bold text-success-600 dark:text-success-400 uppercase tracking-wider flex items-center gap-2">
                            <ArrowDownCircle className="h-4 w-4" />
                            Contas a Receber — Boletos, Pix Fiado, Serviços Pendentes
                        </h3>
                        {filterBySearch(receivables).length > 0 ? (
                            <div className="space-y-2">
                                {filterBySearch(receivables).map(renderTransactionRow)}
                            </div>
                        ) : (
                            <div className="p-12 text-center bg-white dark:bg-[#111a2e]/80 rounded-2xl border border-surface-200/60 dark:border-surface-800/60">
                                <CheckCircle className="h-12 w-12 text-success-400 mx-auto mb-3" />
                                <h3 className="font-bold text-surface-800 dark:text-surface-200 mb-1">Nenhuma conta a receber</h3>
                                <p className="text-xs text-surface-400">Todas as receitas foram recebidas.</p>
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'payable' && (
                    <>
                        <h3 className="text-sm font-bold text-danger-600 dark:text-danger-400 uppercase tracking-wider flex items-center gap-2">
                            <ArrowUpCircle className="h-4 w-4" />
                            Contas a Pagar — Despesas, Boletos, Contabilidade
                        </h3>
                        {filterBySearch(payables).length > 0 ? (
                            <div className="space-y-2">
                                {filterBySearch(payables).map(renderTransactionRow)}
                            </div>
                        ) : (
                            <div className="p-12 text-center bg-white dark:bg-[#111a2e]/80 rounded-2xl border border-surface-200/60 dark:border-surface-800/60">
                                <CheckCircle className="h-12 w-12 text-success-400 mx-auto mb-3" />
                                <h3 className="font-bold text-surface-800 dark:text-surface-200 mb-1">Nenhuma conta a pagar</h3>
                                <p className="text-xs text-surface-400">Todas as despesas foram pagas.</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default Accounts;
