import React, { useState, useMemo } from 'react';
import { Transaction, FinancialSummary, TransactionType, TransactionStatus, TaxSetting } from '../types';
import { ArrowUpRight, ArrowDownRight, Activity, AlertCircle, TrendingUp, Calendar, ArrowRight, Wallet, CreditCard, ChevronDown, Clock, User, DollarSign, Bell, CalendarRange } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, ReferenceLine
} from 'recharts';
import { format, isSameMonth, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';

interface DashboardProps {
    transactions: Transaction[];
    summary?: FinancialSummary;
    onNavigateToTransactions: () => void;
    taxSettings?: TaxSetting[];
}

type ViewMode = 'month' | 'day';

const subMonths = (date: Date, amount: number) => {
    const newDate = new Date(date);
    newDate.setMonth(newDate.getMonth() - amount);
    return newDate;
};

const subDays = (date: Date, amount: number) => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() - amount);
    return newDate;
};

const Dashboard: React.FC<DashboardProps> = ({ transactions, onNavigateToTransactions, taxSettings = [] }) => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<ViewMode>('month');

    const parseDateLocal = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    const handleStartMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (!value) return;
        const [year, month] = value.split('-').map(Number);
        const newStart = new Date(year, month - 1, 1);
        setStartDate(newStart);
        if (newStart > endDate) setEndDate(newStart);
    };

    const handleEndMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (!value) return;
        const [year, month] = value.split('-').map(Number);
        const newEnd = new Date(year, month - 1, 1);
        setEndDate(newEnd);
        if (newEnd < startDate) setStartDate(newEnd);
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (!value) return;
        const [year, month, day] = value.split('-').map(Number);
        setSelectedDate(new Date(year, month - 1, day));
    };

    const isInMonthRange = (txDate: Date) => {
        const txVal = txDate.getFullYear() * 12 + txDate.getMonth();
        const startVal = startDate.getFullYear() * 12 + startDate.getMonth();
        const endVal = endDate.getFullYear() * 12 + endDate.getMonth();
        return txVal >= startVal && txVal <= endVal;
    };

    const isSingleMonth = startDate.getFullYear() === endDate.getFullYear() && startDate.getMonth() === endDate.getMonth();

    const monthsInRange = useMemo(() => {
        const months: Date[] = [];
        let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        while (current <= end) {
            months.push(new Date(current));
            current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
        }
        return months;
    }, [startDate, endDate]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const txDate = parseDateLocal(t.date);
            if (viewMode === 'month') {
                return isInMonthRange(txDate);
            } else {
                return isSameDay(txDate, selectedDate);
            }
        });
    }, [transactions, selectedDate, startDate, endDate, viewMode]);

    const previousTransactions = useMemo(() => {
        return transactions.filter(t => {
            const txDate = parseDateLocal(t.date);
            if (viewMode === 'month') {
                const rangeMonths = monthsInRange.length;
                const prevEnd = subMonths(startDate, 1);
                const prevStart = subMonths(startDate, rangeMonths);
                const txVal = txDate.getFullYear() * 12 + txDate.getMonth();
                const startVal = prevStart.getFullYear() * 12 + prevStart.getMonth();
                const endVal = prevEnd.getFullYear() * 12 + prevEnd.getMonth();
                return txVal >= startVal && txVal <= endVal;
            } else {
                const prevDayDate = subDays(selectedDate, 1);
                return isSameDay(txDate, prevDayDate);
            }
        });
    }, [transactions, selectedDate, startDate, endDate, viewMode, monthsInRange]);

    const chartContextTransactions = useMemo(() => {
        return transactions.filter(t => {
            const txDate = parseDateLocal(t.date);
            if (viewMode === 'month') {
                return isInMonthRange(txDate);
            }
            return isSameMonth(txDate, selectedDate);
        });
    }, [transactions, selectedDate, startDate, endDate, viewMode]);

    const calculateSummary = (txs: Transaction[]) => {
        const income = txs
            .filter(t => t.type === TransactionType.INCOME && (t.status === TransactionStatus.COMPLETED || t.status === TransactionStatus.PARTIAL))
            .reduce((acc, curr) => {
                if (curr.status === TransactionStatus.PARTIAL && curr.pendingAmount) {
                    return acc + (curr.amount - curr.pendingAmount);
                }
                return acc + curr.amount;
            }, 0);

        const expense = txs
            .filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.COMPLETED)
            .reduce((acc, curr) => acc + curr.amount, 0);

        const commissions = txs
            .filter(t => t.commissionAmount && (t.status === TransactionStatus.COMPLETED || t.status === TransactionStatus.PARTIAL))
            .reduce((acc, curr) => {
                if (curr.status === TransactionStatus.PARTIAL && curr.pendingAmount && curr.amount > curr.pendingAmount) {
                    const receivedAmount = curr.amount - curr.pendingAmount;
                    const proportion = receivedAmount / curr.amount;
                    return acc + ((curr.commissionAmount || 0) * proportion);
                }
                return acc + (curr.commissionAmount || 0);
            }, 0);

        const todayStr = new Date().toISOString().split('T')[0];
        const pendingCommissions = txs
            .filter(t => t.commissionAmount && t.commissionPaymentDate && t.commissionPaymentDate > todayStr)
            .reduce((acc, curr) => {
                if (curr.status === TransactionStatus.PARTIAL && curr.pendingAmount && curr.amount > curr.pendingAmount) {
                    const receivedAmount = curr.amount - curr.pendingAmount;
                    const proportion = receivedAmount / curr.amount;
                    return acc + ((curr.commissionAmount || 0) * proportion);
                }
                return acc + (curr.commissionAmount || 0);
            }, 0);

        const totalPendingFromClients = txs
            .filter(t => t.status === TransactionStatus.PARTIAL && t.pendingAmount)
            .reduce((acc, curr) => acc + (curr.pendingAmount || 0), 0);

        const futureCommissionsFromPending = txs
            .filter(t => t.status === TransactionStatus.PARTIAL && t.commissionAmount && t.pendingAmount)
            .reduce((acc, curr) => {
                const proportion = (curr.pendingAmount || 0) / curr.amount;
                return acc + ((curr.commissionAmount || 0) * proportion);
            }, 0);

        return {
            income,
            expense: expense + commissions,
            commissions,
            pendingCommissions,
            totalPendingFromClients,
            futureCommissionsFromPending,
            profit: income - expense - commissions
        };
    };

    const currentSummary = useMemo(() => calculateSummary(filteredTransactions), [filteredTransactions]);
    const previousSummary = useMemo(() => calculateSummary(previousTransactions), [previousTransactions]);

    const calculateTrend = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? "+100%" : "0%";
        const percent = ((current - previous) / previous) * 100;
        return `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`;
    };

    const trends = {
        income: calculateTrend(currentSummary.income, previousSummary.income),
        incomeIsUp: currentSummary.income >= previousSummary.income,
        expense: calculateTrend(currentSummary.expense, previousSummary.expense),
        expenseIsGood: currentSummary.expense <= previousSummary.expense,
        profit: calculateTrend(currentSummary.profit, previousSummary.profit),
        profitIsUp: currentSummary.profit >= previousSummary.profit
    };

    const chartData = useMemo(() => {
        if (viewMode === 'month' && !isSingleMonth) {
            return monthsInRange.map(monthDate => {
                const monthTx = chartContextTransactions.filter(t => {
                    const txDate = parseDateLocal(t.date);
                    return txDate.getFullYear() === monthDate.getFullYear() && txDate.getMonth() === monthDate.getMonth();
                });

                const monthIncome = monthTx.filter(t => t.type === TransactionType.INCOME && (t.status === TransactionStatus.COMPLETED || t.status === TransactionStatus.PARTIAL))
                    .reduce((acc, t) => {
                        if (t.status === TransactionStatus.PARTIAL && t.pendingAmount) return acc + (t.amount - t.pendingAmount);
                        return acc + t.amount;
                    }, 0);
                const monthExpense = monthTx.filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.COMPLETED).reduce((acc, t) => acc + t.amount, 0);

                return {
                    date: format(monthDate, 'MMM', { locale: ptBR }),
                    fullDate: format(monthDate, 'yyyy-MM'),
                    receita: monthIncome,
                    despesa: monthExpense,
                    saldo: monthIncome - monthExpense,
                    isCurrentDay: false
                };
            });
        }

        const refDate = viewMode === 'day' ? selectedDate : startDate;
        const daysInMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate();
        const data = [];

        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dailyTx = chartContextTransactions.filter(t => t.date === dateStr);

            const dailyIncome = dailyTx.filter(t => t.type === TransactionType.INCOME && (t.status === TransactionStatus.COMPLETED || t.status === TransactionStatus.PARTIAL))
                .reduce((acc, t) => {
                    if (t.status === TransactionStatus.PARTIAL && t.pendingAmount) {
                        return acc + (t.amount - t.pendingAmount);
                    }
                    return acc + t.amount;
                }, 0);
            const dailyExpense = dailyTx.filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.COMPLETED).reduce((acc, t) => acc + t.amount, 0);

            data.push({
                date: String(i),
                fullDate: dateStr,
                receita: dailyIncome,
                despesa: dailyExpense,
                saldo: dailyIncome - dailyExpense,
                isCurrentDay: viewMode === 'day' && i === selectedDate.getDate()
            });
        }
        return data;
    }, [chartContextTransactions, selectedDate, startDate, endDate, viewMode, isSingleMonth, monthsInRange]);

    const totalTaxRate = taxSettings.length > 0
        ? taxSettings.reduce((acc, curr) => acc + (curr.percentage / 100), 0)
        : 0.15;

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const hasData = chartContextTransactions.length > 0;
    const hasFilteredData = filteredTransactions.length > 0;

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-surface-800/95 backdrop-blur-xl p-4 border border-surface-100 dark:border-surface-700/50 shadow-elevated rounded-xl min-w-[180px]">
                    <p className="text-surface-400 dark:text-surface-500 text-[10px] font-semibold mb-2.5 uppercase tracking-wider">Dia {label}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                <span className="text-xs font-medium text-surface-600 dark:text-surface-300 capitalize">{entry.name}</span>
                            </div>
                            <span className="text-xs font-semibold text-surface-900 dark:text-white font-mono">
                                {formatCurrency(entry.value)}
                            </span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6 animate-fade-in w-full min-w-0 pb-8">
            {/* Header & Filter */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 pb-2">
                <div className="flex items-center text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider">
                    <Calendar className="w-3.5 h-3.5 mr-2" />
                    {viewMode === 'month'
                        ? (isSingleMonth
                            ? `Resumo de ${format(startDate, 'MMMM yyyy', { locale: ptBR })}`
                            : `Período: ${format(startDate, 'MMM/yy', { locale: ptBR })} a ${format(endDate, 'MMM/yy', { locale: ptBR })}`
                        )
                        : `Visão do Dia: ${format(selectedDate, 'dd/MM/yyyy')}`}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    {/* View Toggle */}
                    <div className="bg-surface-100 dark:bg-surface-800 p-0.5 rounded-lg inline-flex w-max border border-surface-200/60 dark:border-surface-700/60">
                        <button
                            onClick={() => setViewMode('month')}
                            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${viewMode === 'month' ? 'bg-white dark:bg-surface-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200'}`}
                        >
                            Mensal
                        </button>
                        <button
                            onClick={() => setViewMode('day')}
                            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${viewMode === 'day' ? 'bg-white dark:bg-surface-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200'}`}
                        >
                            Diário
                        </button>
                    </div>

                    {/* Date Pickers */}
                    {viewMode === 'month' ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative group min-w-[140px]">
                                <div className="flex items-center justify-between gap-2 bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-surface-700/60 rounded-lg px-3 py-2 shadow-sm group-hover:border-surface-300 dark:group-hover:border-surface-600 transition-colors duration-200 cursor-pointer">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="h-3.5 w-3.5 text-brand-500 shrink-0" />
                                        <span className="text-surface-700 dark:text-surface-200 font-semibold text-xs capitalize">
                                            {format(startDate, 'MMM yyyy', { locale: ptBR })}
                                        </span>
                                    </div>
                                    <ChevronDown className="h-3 w-3 text-surface-400 shrink-0" />
                                </div>
                                <input
                                    type="month"
                                    value={format(startDate, 'yyyy-MM')}
                                    onChange={handleStartMonthChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 appearance-none [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0"
                                    style={{ colorScheme: 'light' }}
                                />
                            </div>

                            <span className="text-surface-300 dark:text-surface-600 font-medium text-xs">até</span>

                            <div className="relative group min-w-[140px]">
                                <div className="flex items-center justify-between gap-2 bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-surface-700/60 rounded-lg px-3 py-2 shadow-sm group-hover:border-surface-300 dark:group-hover:border-surface-600 transition-colors duration-200 cursor-pointer">
                                    <div className="flex items-center gap-1.5">
                                        <CalendarRange className="h-3.5 w-3.5 text-brand-400 shrink-0" />
                                        <span className="text-surface-700 dark:text-surface-200 font-semibold text-xs capitalize">
                                            {format(endDate, 'MMM yyyy', { locale: ptBR })}
                                        </span>
                                    </div>
                                    <ChevronDown className="h-3 w-3 text-surface-400 shrink-0" />
                                </div>
                                <input
                                    type="month"
                                    value={format(endDate, 'yyyy-MM')}
                                    onChange={handleEndMonthChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 appearance-none [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0"
                                    style={{ colorScheme: 'light' }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="relative min-w-[180px] group">
                            <div className="flex items-center justify-between gap-3 bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-surface-700/60 rounded-lg px-3 py-2 shadow-sm group-hover:border-surface-300 dark:group-hover:border-surface-600 transition-colors duration-200 cursor-pointer">
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-brand-500 shrink-0" />
                                    <span className="text-surface-700 dark:text-surface-200 font-semibold text-xs">
                                        {format(selectedDate, 'dd/MM/yyyy')}
                                    </span>
                                </div>
                                <ChevronDown className="h-3.5 w-3.5 text-surface-400 shrink-0" />
                            </div>
                            <input
                                type="date"
                                value={format(selectedDate, 'yyyy-MM-dd')}
                                onChange={handleDateChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 appearance-none [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0"
                                style={{ colorScheme: 'light' }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Alertas de Contas Vencendo */}
            {(() => {
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                const pendingAccounts = transactions.filter(t =>
                    (t.status === TransactionStatus.PENDING || t.status === TransactionStatus.PARTIAL)
                );
                const overdue = pendingAccounts.filter(t => {
                    const [y, m, d] = t.date.split('-').map(Number);
                    return new Date(y, m - 1, d) < now;
                });
                const dueToday = pendingAccounts.filter(t => {
                    const [y, m, d] = t.date.split('-').map(Number);
                    const td = new Date(y, m - 1, d);
                    return td.getTime() === now.getTime();
                });
                const dueSoon = pendingAccounts.filter(t => {
                    const [y, m, d] = t.date.split('-').map(Number);
                    const td = new Date(y, m - 1, d);
                    const diff = (td.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
                    return diff >= 1 && diff <= 3;
                });

                const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
                const overdueTotal = overdue.reduce((s, t) => s + (t.pendingAmount || t.amount), 0);
                const todayTotal = dueToday.reduce((s, t) => s + (t.pendingAmount || t.amount), 0);
                const soonTotal = dueSoon.reduce((s, t) => s + (t.pendingAmount || t.amount), 0);

                if (overdue.length === 0 && dueToday.length === 0 && dueSoon.length === 0) return null;

                return (
                    <div className="space-y-2.5 mb-1">
                        {overdue.length > 0 && (
                            <div
                                onClick={onNavigateToTransactions}
                                className="relative overflow-hidden p-4 bg-danger-50 dark:bg-danger-500/[0.06] border border-danger-100 dark:border-danger-500/20 rounded-xl flex items-center gap-3.5 cursor-pointer hover:shadow-card-hover hover:-translate-y-px transition-all duration-200 group animate-fade-in"
                            >
                                <div className="p-2.5 bg-danger-100 dark:bg-danger-500/10 rounded-lg shrink-0">
                                    <AlertCircle className="h-4 w-4 text-danger-500 dark:text-danger-400" />
                                </div>
                                <div className="flex-1 min-w-0 z-10">
                                    <h4 className="font-semibold text-danger-700 dark:text-danger-300 text-sm flex items-center gap-2">
                                        {overdue.length} conta{overdue.length > 1 ? 's' : ''} vencida{overdue.length > 1 ? 's' : ''}
                                    </h4>
                                    <p className="text-xs text-danger-600/70 dark:text-danger-400/70 mt-0.5 font-medium">Pendência total de <span className="font-semibold text-danger-600 dark:text-danger-400">{formatBRL(overdueTotal)}</span></p>
                                </div>
                                <ArrowRight className="h-4 w-4 text-danger-400 dark:text-danger-500 shrink-0 group-hover:translate-x-0.5 transition-transform duration-200" />
                            </div>
                        )}
                        {dueToday.length > 0 && (
                            <div
                                onClick={onNavigateToTransactions}
                                className="relative overflow-hidden p-4 bg-warning-50 dark:bg-warning-500/[0.06] border border-warning-100 dark:border-warning-500/20 rounded-xl flex items-center gap-3.5 cursor-pointer hover:shadow-card-hover hover:-translate-y-px transition-all duration-200 group animate-fade-in"
                            >
                                <div className="p-2.5 bg-warning-100 dark:bg-warning-500/10 rounded-lg shrink-0">
                                    <Bell className="h-4 w-4 text-warning-500 dark:text-warning-400" />
                                </div>
                                <div className="flex-1 min-w-0 z-10">
                                    <h4 className="font-semibold text-warning-700 dark:text-warning-300 text-sm">
                                        {dueToday.length} conta{dueToday.length > 1 ? 's' : ''} vence{dueToday.length > 1 ? 'm' : ''} hoje
                                    </h4>
                                    <p className="text-xs text-warning-600/70 dark:text-warning-400/70 mt-0.5 font-medium">Vencimentos no valor de <span className="font-semibold text-warning-600 dark:text-warning-400">{formatBRL(todayTotal)}</span></p>
                                </div>
                                <ArrowRight className="h-4 w-4 text-warning-400 dark:text-warning-500 shrink-0 group-hover:translate-x-0.5 transition-transform duration-200" />
                            </div>
                        )}
                        {dueSoon.length > 0 && (
                            <div
                                onClick={onNavigateToTransactions}
                                className="relative overflow-hidden p-4 bg-brand-50 dark:bg-brand-500/[0.06] border border-brand-100 dark:border-brand-500/20 rounded-xl flex items-center gap-3.5 cursor-pointer hover:shadow-card-hover hover:-translate-y-px transition-all duration-200 group animate-fade-in"
                            >
                                <div className="p-2.5 bg-brand-100 dark:bg-brand-500/10 rounded-lg shrink-0">
                                    <Clock className="h-4 w-4 text-brand-500 dark:text-brand-400" />
                                </div>
                                <div className="flex-1 min-w-0 z-10">
                                    <h4 className="font-semibold text-brand-700 dark:text-brand-300 text-sm">
                                        {dueSoon.length} vencimento{dueSoon.length > 1 ? 's' : ''} em breve
                                    </h4>
                                    <p className="text-xs text-brand-600/70 dark:text-brand-400/70 mt-0.5 font-medium">Vencem nos próximos 3 dias (<span className="font-semibold text-brand-600 dark:text-brand-400">{formatBRL(soonTotal)}</span>)</p>
                                </div>
                                <ArrowRight className="h-4 w-4 text-brand-400 dark:text-brand-500 shrink-0 group-hover:translate-x-0.5 transition-transform duration-200" />
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <KPICard
                    title={viewMode === 'month' ? (isSingleMonth ? "Receita Total" : "Receita Período") : "Receita do Dia"}
                    value={currentSummary.income}
                    icon={Wallet}
                    trend={trends.income}
                    trendUp={trends.incomeIsUp}
                    color="brand"
                    subtitle={viewMode === 'month' ? (isSingleMonth ? "Vs. Mês Anterior" : `Vs. ${monthsInRange.length} meses anteriores`) : "Vs. Ontem"}
                />
                <KPICard
                    title={viewMode === 'month' ? (isSingleMonth ? "Despesas + Comis." : "Desp. Período") : "Saídas do Dia"}
                    value={currentSummary.expense}
                    icon={CreditCard}
                    trend={trends.expense}
                    trendUp={trends.expenseIsGood}
                    invertColor={true}
                    color="danger"
                    subtitle="Inclui comissões"
                />
                <KPICard
                    title="Lucro Líquido"
                    value={currentSummary.profit}
                    icon={Activity}
                    trend={trends.profit}
                    trendUp={trends.profitIsUp}
                    color="success"
                    subtitle="Após despesas e comissões"
                />
                <KPICard
                    title="Comis. Pendentes"
                    value={currentSummary.pendingCommissions}
                    icon={Clock}
                    trend={formatCurrency(currentSummary.futureCommissionsFromPending)}
                    trendUp={false}
                    color="warning"
                    subtitle="A pagar (proporcional)"
                />
                <KPICard
                    title="Pendente Clientes"
                    value={currentSummary.totalPendingFromClients}
                    icon={AlertCircle}
                    trend="A Receber"
                    trendUp={true}
                    color="danger"
                    subtitle="Pagamentos parciais"
                />
            </div>

            {/* Commissions & Pending Payments Lists */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Próximas Comissões */}
                <div className="bg-white dark:bg-surface-900/60 p-5 rounded-xl shadow-card border border-surface-100 dark:border-surface-800/60">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-warning-50 dark:bg-warning-500/10 rounded-lg">
                                <Clock className="h-4 w-4 text-warning-500 dark:text-warning-400" />
                            </div>
                            <h3 className="text-sm font-semibold text-surface-900 dark:text-white">Próximas Comissões</h3>
                        </div>
                        <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Próximos Pagamentos</span>
                    </div>

                    <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                        {filteredTransactions
                            .filter(t => t.commissionAmount && t.commissionPaymentDate)
                            .sort((a, b) => new Date(a.commissionPaymentDate!).getTime() - new Date(b.commissionPaymentDate!).getTime())
                            .filter(t => new Date(t.commissionPaymentDate!) >= new Date(new Date().setHours(0, 0, 0, 0)))
                            .slice(0, 15)
                            .map(t => {
                                const isPartial = t.status === TransactionStatus.PARTIAL;
                                const totalCommission = t.commissionAmount || 0;
                                let dueAmount = totalCommission;
                                let remainingAmount = 0;

                                if (isPartial && t.pendingAmount && t.amount > t.pendingAmount) {
                                    const receivedAmount = t.amount - t.pendingAmount;
                                    const proportion = receivedAmount / t.amount;
                                    dueAmount = totalCommission * proportion;
                                    remainingAmount = totalCommission - dueAmount;
                                }

                                return (
                                    <div key={t.id} className="flex flex-col p-3.5 bg-surface-50 dark:bg-surface-800/40 rounded-lg border border-surface-100 dark:border-surface-700/40 group hover:border-surface-200 dark:hover:border-surface-600/40 transition-all duration-200">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-white dark:bg-surface-700 flex items-center justify-center border border-surface-100 dark:border-surface-600/50">
                                                    <User className="h-3.5 w-3.5 text-surface-400" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-surface-900 dark:text-white">{t.employeeName || 'Funcionário'}</p>
                                                    <p className="text-[10px] text-surface-400 dark:text-surface-500 flex items-center gap-1">
                                                        <Calendar className="h-2.5 w-2.5" />
                                                        Recebe em {format(parseDateLocal(t.commissionPaymentDate!), 'dd/MM/yyyy')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-semibold text-warning-600 dark:text-warning-400">{formatCurrency(dueAmount)}</p>
                                                {isPartial && (
                                                    <p className="text-[9px] text-danger-500 font-semibold uppercase tracking-wider">Proporcional</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between pt-2 border-t border-surface-100/60 dark:border-surface-700/40">
                                            <p className="text-[10px] text-surface-400 uppercase font-semibold truncate max-w-[200px] tracking-wider">{t.description}</p>
                                            {isPartial && remainingAmount > 0 && (
                                                <p className="text-[10px] text-surface-400 italic">
                                                    Pendente: {formatCurrency(remainingAmount)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        {filteredTransactions.filter(t => t.commissionAmount && t.commissionPaymentDate && new Date(t.commissionPaymentDate) >= new Date(new Date().setHours(0, 0, 0, 0))).length === 0 && (
                            <div className="text-center py-8">
                                <p className="text-surface-400 text-xs font-medium">Nenhuma comissão agendada.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Pendências de Clientes */}
                <div className="bg-white dark:bg-surface-900/60 p-5 rounded-xl shadow-card border border-surface-100 dark:border-surface-800/60">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-danger-50 dark:bg-danger-500/10 rounded-lg">
                                <AlertCircle className="h-4 w-4 text-danger-500 dark:text-danger-400" />
                            </div>
                            <h3 className="text-sm font-semibold text-surface-900 dark:text-white">Pagamentos Pendentes</h3>
                        </div>
                        <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">A Receber</span>
                    </div>

                    <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                        {filteredTransactions
                            .filter(t => t.status === TransactionStatus.PARTIAL && t.pendingAmount && t.pendingAmount > 0)
                            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                            .map(t => (
                                <div key={t.id} className="flex items-center justify-between p-3.5 bg-surface-50 dark:bg-surface-800/40 rounded-lg border border-surface-100 dark:border-surface-700/40 group hover:border-surface-200 dark:hover:border-surface-600/40 transition-all duration-200 gap-3">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className="w-8 h-8 shrink-0 rounded-full bg-white dark:bg-surface-700 flex items-center justify-center border border-surface-100 dark:border-surface-600/50">
                                            <DollarSign className="h-3.5 w-3.5 text-danger-400" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-semibold text-surface-900 dark:text-white truncate">{t.description}</p>
                                            <p className="text-[10px] text-surface-400 dark:text-surface-500 flex items-center gap-1 truncate">
                                                <Calendar className="h-2.5 w-2.5 shrink-0" />
                                                <span className="truncate">Serviço em {format(parseDateLocal(t.date), 'dd/MM')}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-xs font-semibold text-danger-600 dark:text-danger-400">{formatCurrency(t.pendingAmount || 0)}</p>
                                        <p className="text-[9px] text-surface-400 uppercase font-semibold tracking-wider">Total: {formatCurrency(t.amount)}</p>
                                    </div>
                                </div>
                            ))}
                        {filteredTransactions.filter(t => t.status === TransactionStatus.PARTIAL && t.pendingAmount && t.pendingAmount > 0).length === 0 && (
                            <div className="text-center py-8">
                                <p className="text-surface-400 text-xs font-medium">Nenhum pagamento pendente.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Main Flow Chart */}
                <div className="xl:col-span-2 bg-white dark:bg-surface-900/60 p-5 md:p-6 rounded-xl shadow-card border border-surface-100 dark:border-surface-800/60 flex flex-col min-h-[340px]">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-sm font-semibold text-surface-900 dark:text-white">
                                {viewMode === 'month'
                                    ? (isSingleMonth ? 'Fluxo de Caixa Mensal' : 'Fluxo de Caixa do Período')
                                    : 'Contexto Mensal do Fluxo'}
                            </h3>
                            <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5 font-medium">
                                {viewMode === 'month'
                                    ? (isSingleMonth
                                        ? 'Evolução diária do saldo durante o mês.'
                                        : `Evolução mensal de ${format(startDate, 'MMM/yy', { locale: ptBR })} a ${format(endDate, 'MMM/yy', { locale: ptBR })}.`)
                                    : `Visualizando posição do dia ${selectedDate.getDate()} no contexto do mês.`}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <span className="px-2.5 py-1 rounded-md bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-semibold border border-brand-100 dark:border-brand-500/20 uppercase tracking-wider">
                                {viewMode === 'month'
                                    ? (isSingleMonth
                                        ? format(startDate, 'MMMM yyyy', { locale: ptBR })
                                        : `${format(startDate, 'MMM/yy', { locale: ptBR })} — ${format(endDate, 'MMM/yy', { locale: ptBR })}`)
                                    : format(selectedDate, 'MMMM yyyy', { locale: ptBR })}
                            </span>
                        </div>
                    </div>
                    <div className="flex-1 w-full relative">
                        {hasData ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366F1" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" strokeOpacity={0.8} />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#94A3B8"
                                        fontSize={9}
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                    />
                                    <YAxis
                                        stroke="#94A3B8"
                                        fontSize={9}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(val) => `R$${val / 1000}k`}
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6366F1', strokeWidth: 1, strokeDasharray: '4 4', strokeOpacity: 0.3 }} />
                                    {viewMode === 'day' && (
                                        <ReferenceLine x={String(selectedDate.getDate())} stroke="#EF4444" strokeDasharray="3 3" strokeOpacity={0.5} />
                                    )}
                                    <Area
                                        type="monotone"
                                        name="Saldo"
                                        dataKey="saldo"
                                        stroke="#6366F1"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorSaldo)"
                                        activeDot={{ r: 5, strokeWidth: 0, fill: '#4338CA' }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyState message={`Sem dados para exibir ${viewMode === 'month' && !isSingleMonth ? 'no período selecionado' : `em ${format(startDate, 'MMMM', { locale: ptBR })}`}.`} />
                        )}
                    </div>
                </div>

                {/* Breakdown Bar Chart */}
                <div className="bg-white dark:bg-surface-900/60 p-5 md:p-6 rounded-xl shadow-card border border-surface-100 dark:border-surface-800/60 flex flex-col min-h-[340px]">
                    <div>
                        <h3 className="text-sm font-semibold text-surface-900 dark:text-white">Entradas vs Saídas</h3>
                        <p className="text-xs text-surface-400 dark:text-surface-500 mb-5 font-medium">Comparativo de volume {viewMode === 'month' ? 'diário' : 'no mês'}.</p>
                    </div>
                    <div className="flex-1 w-full relative">
                        {hasData ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData.filter(d => d.receita > 0 || d.despesa > 0)} barGap={4}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" strokeOpacity={0.8} />
                                    <XAxis dataKey="date" stroke="#94A3B8" fontSize={8} tickLine={false} axisLine={false} tickMargin={8} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC', fillOpacity: 0.5 }} />
                                    <Bar name="Receita" dataKey="receita" fill="#10B981" radius={[3, 3, 0, 0]} maxBarSize={36} />
                                    <Bar name="Despesa" dataKey="despesa" fill="#EF4444" radius={[3, 3, 0, 0]} maxBarSize={36} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyState message="Sem movimentações." />
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Transactions Preview */}
            <div className="bg-white dark:bg-surface-900/60 rounded-xl shadow-card border border-surface-200/60 dark:border-surface-800/60 overflow-hidden w-full">
                <div className="px-5 py-4 border-b border-surface-100/60 dark:border-surface-800/60 flex justify-between items-center">
                    <div>
                        <h3 className="text-sm font-semibold text-surface-900 dark:text-white">
                            {viewMode === 'month'
                                ? (isSingleMonth ? 'Transações Recentes' : `Transações do Período (${monthsInRange.length} meses)`)
                                : `Transações de ${format(selectedDate, 'dd/MM')}`}
                        </h3>
                        <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5 font-medium">
                            {viewMode === 'month'
                                ? (isSingleMonth ? 'Histórico de atividades do mês.' : `De ${format(startDate, 'MMM/yy', { locale: ptBR })} até ${format(endDate, 'MMM/yy', { locale: ptBR })}.`)
                                : 'Detalhamento do dia selecionado.'}
                        </p>
                    </div>
                    <button
                        onClick={onNavigateToTransactions}
                        className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-semibold flex items-center group transition-colors duration-200 px-3 py-1.5 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg"
                    >
                        Ver Extrato Completo
                        <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-0.5 transition-transform duration-200" />
                    </button>
                </div>
                <div className="overflow-x-auto custom-scrollbar w-full">
                    {hasFilteredData ? (
                        <table className="w-full text-sm text-left min-w-[500px]">
                            <thead className="text-[10px] text-surface-400 dark:text-surface-500 uppercase bg-surface-50/50 dark:bg-surface-800/30 border-b border-surface-100/60 dark:border-surface-800/60">
                                <tr>
                                    <th className="px-5 py-3 font-semibold tracking-wider">Descrição</th>
                                    <th className="px-5 py-3 font-semibold tracking-wider">Data</th>
                                    <th className="px-5 py-3 font-semibold tracking-wider">Categoria</th>
                                    <th className="px-5 py-3 font-semibold tracking-wider text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-100/60 dark:divide-surface-800/60">
                                {filteredTransactions.slice(0, 5).map((t) => {
                                    const [year, month, day] = t.date.split('-');
                                    return (
                                        <tr key={t.id} className="hover:bg-surface-50/50 dark:hover:bg-surface-800/20 transition-colors duration-150 group table-row-hover">
                                            <td className="px-5 py-3.5 sm:py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-surface-900 dark:text-surface-200 text-xs group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors duration-200">{t.description}</span>
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <span className={`w-1.5 h-1.5 rounded-full ${t.status === 'CONCLUÍDO' ? 'bg-success-500' : 'bg-warning-500'}`}></span>
                                                        <span className="text-[10px] text-surface-400 dark:text-surface-500 font-medium">{t.status}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 sm:py-4 text-surface-400 dark:text-surface-500 font-medium tabular-nums text-xs">{day}/{month}/{year}</td>
                                            <td className="px-5 py-3.5 sm:py-4">
                                                <span className="px-2 py-0.5 bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 rounded text-[10px] font-semibold border border-surface-200/50 dark:border-surface-700/50">
                                                    {t.category}
                                                </span>
                                            </td>
                                            <td className={`px-5 py-3.5 sm:py-4 text-right font-semibold text-xs font-mono ${t.type === 'RECEITA' ? 'text-success-600 dark:text-success-500' : 'text-danger-600 dark:text-danger-500'}`}>
                                                {t.type === 'RECEITA' ? '+' : '-'}{formatCurrency(t.amount)}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-12 text-center text-surface-400 flex flex-col items-center">
                            <div className="p-3 bg-surface-50 dark:bg-surface-800/40 rounded-full mb-3">
                                <Clock className="h-5 w-5 text-surface-300" />
                            </div>
                            <p className="text-xs font-medium">Nenhuma transação encontrada para este período.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const KPICard = ({ title, value, icon: Icon, trend, trendUp, color, subtitle, invertColor = false }: any) => {
    let IconTrend = trendUp ? ArrowUpRight : ArrowDownRight;
    const isNeutral = trend === '--%' || trend === '0%' || trend === '0.0%' || trend === '+0.0%';

    let trendBadge = trendUp
        ? 'text-success-600 bg-success-50 dark:text-success-400 dark:bg-success-500/10'
        : 'text-danger-600 bg-danger-50 dark:text-danger-400 dark:bg-danger-500/10';
    if (invertColor) {
        trendBadge = trendUp
            ? 'text-danger-600 bg-danger-50 dark:text-danger-400 dark:bg-danger-500/10'
            : 'text-success-600 bg-success-50 dark:text-success-400 dark:bg-success-500/10';
    }
    if (isNeutral) {
        trendBadge = 'text-surface-500 bg-surface-100 dark:text-surface-400 dark:bg-surface-800';
    }

    const colorStyles: Record<string, any> = {
        brand: {
            text: 'text-brand-600 dark:text-brand-400',
            bg: 'bg-brand-50 dark:bg-brand-500/10',
            glow: 'group-hover:shadow-[0_8px_30px_-5px_rgba(99,102,241,0.12)]',
            border: 'group-hover:border-brand-200 dark:group-hover:border-brand-500/20',
        },
        danger: {
            text: 'text-danger-500 dark:text-danger-400',
            bg: 'bg-danger-50 dark:bg-danger-500/10',
            glow: 'group-hover:shadow-[0_8px_30px_-5px_rgba(239,68,68,0.12)]',
            border: 'group-hover:border-danger-200 dark:group-hover:border-danger-500/20',
        },
        success: {
            text: 'text-success-500 dark:text-success-400',
            bg: 'bg-success-50 dark:bg-success-500/10',
            glow: 'group-hover:shadow-[0_8px_30px_-5px_rgba(16,185,129,0.12)]',
            border: 'group-hover:border-success-200 dark:group-hover:border-success-500/20',
        },
        warning: {
            text: 'text-warning-500 dark:text-warning-400',
            bg: 'bg-warning-50 dark:bg-warning-500/10',
            glow: 'group-hover:shadow-[0_8px_30px_-5px_rgba(245,158,11,0.12)]',
            border: 'group-hover:border-warning-200 dark:group-hover:border-warning-500/20',
        },
    };

    const style = colorStyles[color] || colorStyles.brand;

    const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);
    const cleanFormatted = formatted.replace(/\s/g, ' ');
    const symbol = "R$";
    const valueStr = cleanFormatted.replace("R$", "").trim();

    return (
        <div className={`relative flex flex-col justify-between p-5 h-full bg-white dark:bg-surface-900/60 rounded-xl shadow-card border border-surface-100 dark:border-surface-800/60 transition-all duration-300 ${style.glow} ${style.border} group overflow-hidden`}>
            <div className="flex justify-between items-start mb-6 relative z-10">
                <div className={`p-2.5 rounded-lg ${style.bg} ${style.text} transition-transform duration-300 group-hover:scale-105`}>
                    <Icon className="w-5 h-5" strokeWidth={2} />
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold ${trendBadge}`}>
                    {!isNeutral && <IconTrend className="w-3 h-3" strokeWidth={2.5} />}
                    <span>{trend}</span>
                </div>
            </div>

            <div className="relative z-10">
                <h3 className="text-[11px] font-medium tracking-wide text-surface-400 dark:text-surface-500 mb-1.5 uppercase">{title}</h3>
                <div className="flex items-baseline gap-1">
                    <span className="text-xs font-semibold text-surface-400 dark:text-surface-500">{symbol}</span>
                    <span className="text-2xl font-bold text-surface-900 dark:text-white tracking-tight">
                        {valueStr}
                    </span>
                </div>
            </div>

            <div className="mt-5 pt-4 border-t border-surface-100/60 dark:border-surface-800/60 relative z-10">
                <p className="text-[10px] font-medium text-surface-400 dark:text-surface-500 flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${style.text} bg-current opacity-60`} />
                    {subtitle}
                </p>
            </div>

            <div className={`absolute -right-8 -top-8 w-32 h-32 ${style.bg} rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none blur-2xl`} />
        </div>
    );
}

const EmptyState = ({ message }: { message: string }) => (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
        <div className="p-3 bg-surface-50 dark:bg-surface-800/40 rounded-full mb-3">
            <TrendingUp className="h-5 w-5 text-surface-300 dark:text-surface-600" />
        </div>
        <p className="text-surface-400 dark:text-surface-500 text-xs font-medium">{message}</p>
    </div>
);

export default Dashboard;
