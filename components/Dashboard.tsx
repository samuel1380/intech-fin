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

// Helper functions for date manipulation to avoid import errors
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

    // Helper to parse "YYYY-MM-DD" to local Date object
    const parseDateLocal = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    // Helpers for month range
    const handleStartMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (!value) return;
        const [year, month] = value.split('-').map(Number);
        const newStart = new Date(year, month - 1, 1);
        setStartDate(newStart);
        // Se o início ficar depois do fim, iguala
        if (newStart > endDate) setEndDate(newStart);
    };

    const handleEndMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (!value) return;
        const [year, month] = value.split('-').map(Number);
        const newEnd = new Date(year, month - 1, 1);
        setEndDate(newEnd);
        // Se o fim ficar antes do início, iguala
        if (newEnd < startDate) setStartDate(newEnd);
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (!value) return;
        // Input type="date" returns YYYY-MM-DD
        const [year, month, day] = value.split('-').map(Number);
        setSelectedDate(new Date(year, month - 1, day));
    };

    // Helper: check if a date is within the selected month range (inclusive)
    const isInMonthRange = (txDate: Date) => {
        const txYear = txDate.getFullYear();
        const txMonth = txDate.getMonth();
        const startYear = startDate.getFullYear();
        const startMonth = startDate.getMonth();
        const endYear = endDate.getFullYear();
        const endMonth = endDate.getMonth();
        const txVal = txYear * 12 + txMonth;
        const startVal = startYear * 12 + startMonth;
        const endVal = endYear * 12 + endMonth;
        return txVal >= startVal && txVal <= endVal;
    };

    // Check if single month or range
    const isSingleMonth = startDate.getFullYear() === endDate.getFullYear() && startDate.getMonth() === endDate.getMonth();

    // Calculate months in selection for labels
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

    // --- FILTER LOGIC ---

    // 1. Transactions for the selected period (Month Range OR Specific Day)
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

    // 2. Transactions for the previous period - For Trends
    // Se range = 1 mês, compara com mês anterior. Se range > 1, compara com range anterior equivalente.
    const previousTransactions = useMemo(() => {
        return transactions.filter(t => {
            const txDate = parseDateLocal(t.date);
            if (viewMode === 'month') {
                const rangeMonths = monthsInRange.length;
                const prevEnd = subMonths(startDate, 1);
                const prevStart = subMonths(startDate, rangeMonths);
                const txYear = txDate.getFullYear();
                const txMonth = txDate.getMonth();
                const txVal = txYear * 12 + txMonth;
                const startVal = prevStart.getFullYear() * 12 + prevStart.getMonth();
                const endVal = prevEnd.getFullYear() * 12 + prevEnd.getMonth();
                return txVal >= startVal && txVal <= endVal;
            } else {
                const prevDayDate = subDays(selectedDate, 1);
                return isSameDay(txDate, prevDayDate);
            }
        });
    }, [transactions, selectedDate, startDate, endDate, viewMode, monthsInRange]);

    // 3. Transactions for the CHART context (month range or single month)
    const chartContextTransactions = useMemo(() => {
        return transactions.filter(t => {
            const txDate = parseDateLocal(t.date);
            if (viewMode === 'month') {
                return isInMonthRange(txDate);
            }
            return isSameMonth(txDate, selectedDate);
        });
    }, [transactions, selectedDate, startDate, endDate, viewMode]);


    // --- SUMMARY CALCULATIONS ---

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
                    const totalAmount = curr.amount;
                    const proportion = receivedAmount / totalAmount;
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

    // --- TRENDS ---

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

    // --- CHART DATA PREPARATION ---

    const chartData = useMemo(() => {
        if (viewMode === 'month' && !isSingleMonth) {
            // Range mode: aggregate per month
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

        // Single month or day mode: daily breakdown
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

    // Calcula taxa total para exibição
    const totalTaxRate = taxSettings.length > 0
        ? taxSettings.reduce((acc, curr) => acc + (curr.percentage / 100), 0)
        : 0.15;

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const hasData = chartContextTransactions.length > 0;
    const hasFilteredData = filteredTransactions.length > 0;

    // Custom Tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-[#1E293B] backdrop-blur-xl p-4 border border-[#EEF2F7] dark:border-slate-700/60 shadow-premium-lg rounded-[14px] min-w-[180px]">
                    <p className="text-[#64748B] dark:text-slate-400 text-[11px] font-medium mb-2.5 uppercase tracking-[0.08em]">Dia {label}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                <span className="text-[13px] font-medium text-[#64748B] dark:text-slate-300 capitalize">{entry.name}</span>
                            </div>
                            <span className="text-[13px] font-semibold text-[#0F172A] dark:text-white font-mono">
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
        <div className="space-y-7 animate-fade-in w-full min-w-0 pb-8">
            {/* Header & Filter */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 pb-4">
                <div className="flex items-center text-[13px] font-medium text-[#64748B] dark:text-slate-400">
                    <Calendar className="w-4 h-4 mr-2 text-[#94A3B8]" />
                    {viewMode === 'month'
                        ? (isSingleMonth
                            ? `Resumo de ${format(startDate, 'MMMM yyyy', { locale: ptBR })}`
                            : `Período: ${format(startDate, 'MMM/yy', { locale: ptBR })} a ${format(endDate, 'MMM/yy', { locale: ptBR })}`
                            )
                        : `Visão do Dia: ${format(selectedDate, 'dd/MM/yyyy')}`}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    {/* View Toggle */}
                    <div className="bg-[#EEF2F7] dark:bg-slate-800/60 p-1 rounded-[14px] inline-flex w-max border border-[#EEF2F7] dark:border-slate-700/40">
                        <button
                            onClick={() => setViewMode('month')}
                            className={`px-4 py-2 rounded-[10px] text-[13px] font-semibold transition-all duration-200 ${viewMode === 'month' ? 'bg-white dark:bg-slate-700 text-[#0F172A] dark:text-white shadow-sm' : 'text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'}`}
                        >
                            Mensal
                        </button>
                        <button
                            onClick={() => setViewMode('day')}
                            className={`px-4 py-2 rounded-[10px] text-[13px] font-semibold transition-all duration-200 ${viewMode === 'day' ? 'bg-white dark:bg-slate-700 text-[#0F172A] dark:text-white shadow-sm' : 'text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'}`}
                        >
                            Diário
                        </button>
                    </div>

                    {/* Date Picker: Month Range or Single Day */}
                    {viewMode === 'month' ? (
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Mês Início */}
                            <div className="relative group min-w-[140px]">
                                <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800/60 border border-[#EEF2F7] dark:border-slate-700/40 rounded-[12px] px-3.5 py-2.5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="h-4 w-4 text-indigo-500 shrink-0" />
                                        <span className="text-[#0F172A] dark:text-slate-200 font-semibold text-[13px] capitalize">
                                            {format(startDate, 'MMM yyyy', { locale: ptBR })}
                                        </span>
                                    </div>
                                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                </div>
                                <input
                                    type="month"
                                    value={format(startDate, 'yyyy-MM')}
                                    onChange={handleStartMonthChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 appearance-none [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0"
                                    style={{ colorScheme: 'light' }}
                                />
                            </div>

                            <span className="text-[#94A3B8] dark:text-slate-500 font-medium text-[13px]">até</span>

                            {/* Mês Fim */}
                            <div className="relative group min-w-[140px]">
                                <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800/60 border border-[#EEF2F7] dark:border-slate-700/40 rounded-[12px] px-3.5 py-2.5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer">
                                    <div className="flex items-center gap-1.5">
                                        <CalendarRange className="h-4 w-4 text-violet-500 shrink-0" />
                                        <span className="text-[#0F172A] dark:text-slate-200 font-semibold text-[13px] capitalize">
                                            {format(endDate, 'MMM yyyy', { locale: ptBR })}
                                        </span>
                                    </div>
                                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
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
                        <div className="relative min-w-[200px] group">
                            <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-800/60 border border-[#EEF2F7] dark:border-slate-700/40 rounded-[12px] px-4 py-2.5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer">
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-indigo-500 shrink-0" />
                                    <span className="text-[#0F172A] dark:text-slate-200 font-semibold text-[13px]">
                                        {format(selectedDate, 'dd/MM/yyyy')}
                                    </span>
                                </div>
                                <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
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

            {/* === ALERTAS DE CONTAS VENCENDO === */}
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
                    <div className="space-y-3 mb-2">
                        {overdue.length > 0 && (
                            <div 
                                onClick={onNavigateToTransactions}
                                className="relative overflow-hidden p-4 sm:p-5 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/10 border border-red-200/60 dark:border-red-800/40 rounded-2xl flex items-center gap-4 cursor-pointer hover:shadow-lg hover:shadow-red-500/10 hover:-translate-y-0.5 transition-all group animate-fade-in"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-[0.03] dark:opacity-[0.05] group-hover:opacity-10 transition-opacity">
                                    <AlertCircle className="h-32 w-32 text-red-500 -mt-12 -mr-8" />
                                </div>
                                <div className="p-3 bg-red-100 dark:bg-red-900/50 rounded-xl shrink-0 shadow-inner">
                                    <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 animate-pulse" />
                                </div>
                                <div className="flex-1 min-w-0 z-10">
                                    <h4 className="font-extrabold text-red-900 dark:text-red-300 text-base flex items-center gap-2">
                                        {overdue.length} conta{overdue.length > 1 ? 's' : ''} vencida{overdue.length > 1 ? 's' : ''}
                                    </h4>
                                    <p className="text-sm font-medium text-red-700/80 dark:text-red-400/80 mt-0.5">Pendência total de <span className="font-bold text-red-700 dark:text-red-400">{formatBRL(overdueTotal)}</span></p>
                                </div>
                                <div className="shrink-0 z-10 bg-white/50 dark:bg-black/20 p-2.5 rounded-full group-hover:bg-red-600 group-hover:text-white transition-colors text-red-600 dark:text-red-400 shadow-sm border border-red-200/50 dark:border-red-800/50">
                                    <ArrowRight className="h-4 w-4" />
                                </div>
                            </div>
                        )}
                        {dueToday.length > 0 && (
                            <div 
                                onClick={onNavigateToTransactions}
                                className="relative overflow-hidden p-4 sm:p-5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/10 border border-amber-200/60 dark:border-amber-800/40 rounded-2xl flex items-center gap-4 cursor-pointer hover:shadow-lg hover:shadow-amber-500/10 hover:-translate-y-0.5 transition-all group animate-fade-in"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-[0.03] dark:opacity-[0.05] group-hover:opacity-10 transition-opacity">
                                    <Bell className="h-32 w-32 text-amber-500 -mt-12 -mr-8" />
                                </div>
                                <div className="p-3 bg-amber-100 dark:bg-amber-900/50 rounded-xl shrink-0 shadow-inner">
                                    <Bell className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div className="flex-1 min-w-0 z-10">
                                    <h4 className="font-extrabold text-amber-900 dark:text-amber-300 text-base">
                                        {dueToday.length} conta{dueToday.length > 1 ? 's' : ''} vence{dueToday.length > 1 ? 'm' : ''} hoje
                                    </h4>
                                    <p className="text-sm font-medium text-amber-700/80 dark:text-amber-400/80 mt-0.5">Vencimentos no valor de <span className="font-bold text-amber-700 dark:text-amber-400">{formatBRL(todayTotal)}</span></p>
                                </div>
                                <div className="shrink-0 z-10 bg-white/50 dark:bg-black/20 p-2.5 rounded-full group-hover:bg-amber-500 group-hover:text-white transition-colors text-amber-600 dark:text-amber-400 shadow-sm border border-amber-200/50 dark:border-amber-800/50">
                                    <ArrowRight className="h-4 w-4" />
                                </div>
                            </div>
                        )}
                        {dueSoon.length > 0 && (
                            <div 
                                onClick={onNavigateToTransactions}
                                className="relative overflow-hidden p-4 sm:p-5 bg-gradient-to-r from-blue-50 to-sky-50 dark:from-blue-900/20 dark:to-sky-900/10 border border-blue-200/60 dark:border-blue-800/40 rounded-2xl flex items-center gap-4 cursor-pointer hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-0.5 transition-all group animate-fade-in"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-[0.03] dark:opacity-[0.05] group-hover:opacity-10 transition-opacity">
                                    <Clock className="h-32 w-32 text-blue-500 -mt-12 -mr-8" />
                                </div>
                                <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-xl shrink-0 shadow-inner">
                                    <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="flex-1 min-w-0 z-10">
                                    <h4 className="font-extrabold text-blue-900 dark:text-blue-300 text-base">
                                        {dueSoon.length} vencimento{dueSoon.length > 1 ? 's' : ''} em breve
                                    </h4>
                                    <p className="text-sm font-medium text-blue-700/80 dark:text-blue-400/80 mt-0.5">Vencem nos próximos 3 dias (<span className="font-bold text-blue-700 dark:text-blue-400">{formatBRL(soonTotal)}</span>)</p>
                                </div>
                                <div className="shrink-0 z-10 bg-white/50 dark:bg-black/20 p-2.5 rounded-full group-hover:bg-blue-500 group-hover:text-white transition-colors text-blue-600 dark:text-blue-400 shadow-sm border border-blue-200/50 dark:border-blue-800/50">
                                    <ArrowRight className="h-4 w-4" />
                                </div>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
                <KPICard
                    title={viewMode === 'month' ? (isSingleMonth ? "Receita Total" : "Receita Período") : "Receita do Dia"}
                    value={currentSummary.income}
                    icon={Wallet}
                    trend={trends.income}
                    trendUp={trends.incomeIsUp}
                    color="indigo"
                    subtitle={viewMode === 'month' ? (isSingleMonth ? "Vs. Mês Anterior" : `Vs. ${monthsInRange.length} meses anteriores`) : "Vs. Ontem"}
                />
                <KPICard
                    title={viewMode === 'month' ? (isSingleMonth ? "Despesas + Comis." : "Desp. Período") : "Saídas do Dia"}
                    value={currentSummary.expense}
                    icon={CreditCard}
                    trend={trends.expense}
                    trendUp={trends.expenseIsGood}
                    invertColor={true}
                    color="rose"
                    subtitle="Inclui comissões"
                />
                <KPICard
                    title="Lucro Líquido"
                    value={currentSummary.profit}
                    icon={Activity}
                    trend={trends.profit}
                    trendUp={trends.profitIsUp}
                    color="emerald"
                    subtitle="Após despesas e comissões"
                />
                <KPICard
                    title="Comis. Pendentes"
                    value={currentSummary.pendingCommissions}
                    icon={Clock}
                    trend={formatCurrency(currentSummary.futureCommissionsFromPending)}
                    trendUp={false}
                    color="amber"
                    subtitle="A pagar (proporcional)"
                />
                <KPICard
                    title="Pendente Clientes"
                    value={currentSummary.totalPendingFromClients}
                    icon={AlertCircle}
                    trend="A Receber"
                    trendUp={true}
                    color="rose"
                    subtitle="Pagamentos parciais"
                />
            </div>

            {/* Commissions & Pending Payments Lists */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Próximas Comissões */}
                <div className="bg-white dark:bg-[#0F172A]/80 dark:backdrop-blur-xl p-6 rounded-[20px] shadow-premium dark:shadow-none border border-[#EEF2F7] dark:border-white/[0.06]">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-[12px]">
                                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <h3 className="text-[15px] font-semibold text-[#0F172A] dark:text-white">Próximas Comissões</h3>
                        </div>
                        <span className="text-[11px] font-medium text-[#94A3B8] uppercase tracking-[0.08em]">Próximos Pagamentos</span>
                    </div>

                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
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
                                    <div key={t.id} className="flex flex-col p-4 bg-[#F8F9FC] dark:bg-slate-800/30 rounded-[14px] border border-[#EEF2F7] dark:border-slate-700/30 group hover:border-amber-200/60 dark:hover:border-amber-800/40 transition-all duration-200">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center border border-[#EEF2F7] dark:border-slate-600">
                                                    <User className="h-4 w-4 text-[#94A3B8]" />
                                                </div>
                                                <div>
                                                    <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white">{t.employeeName || 'Funcionário'}</p>
                                                    <p className="text-[11px] text-[#64748B] dark:text-slate-400 flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        Recebe em {format(parseDateLocal(t.commissionPaymentDate!), 'dd/MM/yyyy')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[13px] font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(dueAmount)}</p>
                                                {isPartial && (
                                                    <p className="text-[10px] text-rose-500 font-bold uppercase">Proporcional</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between pt-2.5 border-t border-[#EEF2F7] dark:border-slate-700/30">
                                            <p className="text-[10px] text-[#94A3B8] uppercase font-medium tracking-wide truncate max-w-[200px]">{t.description}</p>
                                            {isPartial && remainingAmount > 0 && (
                                                <p className="text-[10px] text-slate-400 italic">
                                                    Pendente: {formatCurrency(remainingAmount)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        {filteredTransactions.filter(t => t.commissionAmount && t.commissionPaymentDate && new Date(t.commissionPaymentDate) >= new Date(new Date().setHours(0, 0, 0, 0))).length === 0 && (
                            <div className="text-center py-8">
                                <p className="text-slate-400 text-sm italic">Nenhuma comissão agendada.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Pendências de Clientes */}
                <div className="bg-white dark:bg-[#0F172A]/80 dark:backdrop-blur-xl p-6 rounded-[20px] shadow-premium dark:shadow-none border border-[#EEF2F7] dark:border-white/[0.06]">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2.5 bg-rose-50 dark:bg-rose-900/20 rounded-[12px]">
                                <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                            </div>
                            <h3 className="text-[15px] font-semibold text-[#0F172A] dark:text-white">Pagamentos Pendentes</h3>
                        </div>
                        <span className="text-[11px] font-medium text-[#94A3B8] uppercase tracking-[0.08em]">A Receber</span>
                    </div>

                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {filteredTransactions
                            .filter(t => t.status === TransactionStatus.PARTIAL && t.pendingAmount && t.pendingAmount > 0)
                            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                            .map(t => (
                                <div key={t.id} className="flex items-center justify-between p-3.5 sm:p-4 bg-[#F8F9FC] dark:bg-slate-800/30 rounded-[14px] border border-[#EEF2F7] dark:border-slate-700/30 group hover:border-rose-200/60 dark:hover:border-rose-800/40 transition-all duration-200 gap-2">
                                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                                        <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center border border-[#EEF2F7] dark:border-slate-600">
                                            <DollarSign className="h-4 w-4 text-rose-400" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white truncate">{t.description}</p>
                                            <p className="text-[11px] text-[#64748B] dark:text-slate-400 flex items-center gap-1 truncate">
                                                <Calendar className="h-3 w-3 shrink-0" />
                                                <span className="truncate">Serviço em {format(parseDateLocal(t.date), 'dd/MM')}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[13px] font-semibold text-rose-500 dark:text-rose-400">{formatCurrency(t.pendingAmount || 0)}</p>
                                        <p className="text-[10px] text-[#94A3B8] uppercase font-medium">Total: {formatCurrency(t.amount)}</p>
                                    </div>
                                </div>
                            ))}
                        {filteredTransactions.filter(t => t.status === TransactionStatus.PARTIAL && t.pendingAmount && t.pendingAmount > 0).length === 0 && (
                            <div className="text-center py-8">
                                <p className="text-slate-400 text-sm italic">Nenhum pagamento pendente.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                {/* Main Flow Chart */}
                <div className="xl:col-span-2 bg-white dark:bg-[#0F172A]/80 dark:backdrop-blur-xl p-6 md:p-8 rounded-[20px] shadow-premium dark:shadow-none border border-[#EEF2F7] dark:border-white/[0.06] flex flex-col min-h-[350px]">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h3 className="text-[15px] font-semibold text-[#0F172A] dark:text-white">
                                {viewMode === 'month'
                                    ? (isSingleMonth ? 'Fluxo de Caixa Mensal' : 'Fluxo de Caixa do Período')
                                    : 'Contexto Mensal do Fluxo'}
                            </h3>
                            <p className="text-[13px] text-[#64748B] dark:text-slate-400 mt-0.5">
                                {viewMode === 'month'
                                    ? (isSingleMonth
                                        ? 'Evolução diária do saldo durante o mês.'
                                        : `Evolução mensal de ${format(startDate, 'MMM/yy', { locale: ptBR })} a ${format(endDate, 'MMM/yy', { locale: ptBR })}.`)
                                    : `Visualizando posição do dia ${selectedDate.getDate()} no contexto do mês.`}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <span className="px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 text-[11px] font-medium border border-indigo-100 dark:border-indigo-800/40 capitalize">
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
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2F7" />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#94A3B8"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={10}
                                    />
                                    <YAxis
                                        stroke="#94A3B8"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(val) => `R$${val / 1000}k`}
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#4F46E5', strokeWidth: 1, strokeDasharray: '4 4' }} />

                                    {/* Reference line for the specific day when in day view */}
                                    {viewMode === 'day' && (
                                        <ReferenceLine x={String(selectedDate.getDate())} stroke="#f43f5e" strokeDasharray="3 3" label="Dia Selecionado" />
                                    )}

                                    <Area
                                        type="monotone"
                                        name="Saldo"
                                        dataKey="saldo"
                                        stroke="#4F46E5"
                                        strokeWidth={2.5}
                                        fillOpacity={1}
                                        fill="url(#colorSaldo)"
                                        activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff', fill: '#4F46E5' }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyState message={`Sem dados para exibir ${viewMode === 'month' && !isSingleMonth ? 'no período selecionado' : `em ${format(startDate, 'MMMM', { locale: ptBR })}`}.`} />
                        )}
                    </div>
                </div>

                {/* Breakdown Bar Chart */}
                <div className="bg-white dark:bg-[#0F172A]/80 dark:backdrop-blur-xl p-6 md:p-8 rounded-[20px] shadow-premium dark:shadow-none border border-[#EEF2F7] dark:border-white/[0.06] flex flex-col min-h-[350px]">
                    <div>
                        <h3 className="text-[15px] font-semibold text-[#0F172A] dark:text-white">Entradas vs Saídas</h3>
                        <p className="text-[13px] text-[#64748B] dark:text-slate-400 mb-6 mt-0.5">Comparativo de volume {viewMode === 'month' ? 'diário' : 'no mês'}.</p>
                    </div>
                    <div className="flex-1 w-full relative">
                        {hasData ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData.filter(d => d.receita > 0 || d.despesa > 0)} barGap={4}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2F7" />
                                    <XAxis dataKey="date" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} tickMargin={10} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                                    <Bar name="Receita" dataKey="receita" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={36} />
                                    <Bar name="Despesa" dataKey="despesa" fill="#EF4444" radius={[6, 6, 0, 0]} maxBarSize={36} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyState message="Sem movimentações." />
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Transactions Preview */}
            <div className="bg-white dark:bg-[#0F172A]/80 dark:backdrop-blur-xl rounded-[20px] shadow-premium dark:shadow-none border border-[#EEF2F7] dark:border-white/[0.06] overflow-hidden w-full">
                <div className="px-6 md:px-8 py-5 border-b border-[#EEF2F7] dark:border-white/[0.06] flex justify-between items-center bg-white dark:bg-transparent">
                    <div>
                        <h3 className="text-[15px] font-semibold text-[#0F172A] dark:text-white">
                            {viewMode === 'month'
                                ? (isSingleMonth ? 'Transações Recentes' : `Transações do Período (${monthsInRange.length} meses)`)
                                : `Transações de ${format(selectedDate, 'dd/MM')}`}
                        </h3>
                        <p className="text-[13px] text-[#64748B] dark:text-slate-400 mt-0.5">
                            {viewMode === 'month'
                                ? (isSingleMonth ? 'Histórico de atividades do mês.' : `De ${format(startDate, 'MMM/yy', { locale: ptBR })} até ${format(endDate, 'MMM/yy', { locale: ptBR })}.`)
                                : 'Detalhamento do dia selecionado.'}
                        </p>
                    </div>
                    <button
                        onClick={onNavigateToTransactions}
                        className="text-[13px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center group transition-colors duration-200 px-4 py-2 hover:bg-indigo-50/80 dark:hover:bg-indigo-900/15 rounded-[10px]"
                    >
                        Ver Extrato Completo
                        <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
                <div className="overflow-x-auto custom-scrollbar w-full">
                    {hasFilteredData ? (
                        <table className="w-full text-[13px] text-left min-w-[500px]">
                            <thead className="text-[11px] text-[#94A3B8] dark:text-slate-500 uppercase bg-[#F8F9FC] dark:bg-[#0B1120]/60 border-b border-[#EEF2F7] dark:border-white/[0.06]">
                                <tr>
                                    <th className="px-5 py-3.5 sm:px-7 font-medium tracking-[0.06em]">Descrição</th>
                                    <th className="px-5 py-3.5 sm:px-7 font-medium tracking-[0.06em]">Data</th>
                                    <th className="px-5 py-3.5 sm:px-7 font-medium tracking-[0.06em]">Categoria</th>
                                    <th className="px-5 py-3.5 sm:px-7 font-medium tracking-[0.06em] text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#EEF2F7] dark:divide-white/[0.04]">
                                {filteredTransactions.slice(0, 5).map((t) => {
                                    const [year, month, day] = t.date.split('-');
                                    return (
                                        <tr key={t.id} className="hover:bg-[#F8F9FC]/60 dark:hover:bg-white/[0.02] transition-colors duration-150 group">
                                            <td className="px-5 py-4 sm:px-7 sm:py-5">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-[#0F172A] dark:text-slate-200 text-[13px] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-200">{t.description}</span>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`w-[6px] h-[6px] rounded-full ${t.status === 'CONCLUÍDO' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                                        <span className="text-[11px] text-[#64748B] dark:text-slate-400 font-medium">{t.status}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 sm:px-7 sm:py-5 text-[#64748B] dark:text-slate-400 font-medium tabular-nums text-[13px]">{day}/{month}/{year}</td>
                                            <td className="px-5 py-4 sm:px-7 sm:py-5">
                                                <span className="px-2.5 py-1 bg-[#F8F9FC] dark:bg-slate-800/60 text-[#64748B] dark:text-slate-300 rounded-full text-[11px] font-medium border border-[#EEF2F7] dark:border-slate-700/40">
                                                    {t.category}
                                                </span>
                                            </td>
                                            <td className={`px-5 py-4 sm:px-7 sm:py-5 text-right font-semibold text-[13px] sm:text-[14px] font-mono ${t.type === 'RECEITA' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                                                {t.type === 'RECEITA' ? '+' : '-'}{formatCurrency(t.amount)}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-16 text-center text-[#94A3B8] flex flex-col items-center">
                            <div className="p-4 bg-[#F8F9FC] dark:bg-slate-800/30 rounded-full mb-3">
                                <Clock className="h-5 w-5 text-[#CBD5E1]" />
                            </div>
                            <p className="text-[13px] font-medium">Nenhuma transação encontrada para este período.</p>
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
    
    // Determine trend colors
    let trendBadge = trendUp 
        ? 'text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/10' 
        : 'text-rose-700 bg-rose-100 dark:text-rose-400 dark:bg-rose-500/10';
    if (invertColor) {
        trendBadge = trendUp 
            ? 'text-rose-700 bg-rose-100 dark:text-rose-400 dark:bg-rose-500/10' 
            : 'text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/10';
    }
    if (isNeutral) {
        trendBadge = 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-white/5';
    }

    const colorStyles: Record<string, any> = {
        indigo: { 
            text: 'text-indigo-600 dark:text-indigo-400',
            bg: 'bg-indigo-50 dark:bg-indigo-500/10',
            glow: 'hover:shadow-premium-hover hover:border-indigo-200/60 dark:hover:border-indigo-500/20',
            valueColor: 'text-[#0F172A] dark:text-white',
            symbolColor: 'text-[#64748B] dark:text-slate-400'
        },
        rose: { 
            text: 'text-rose-500 dark:text-rose-400',
            bg: 'bg-rose-50 dark:bg-rose-500/10',
            glow: 'hover:shadow-premium-hover hover:border-rose-200/60 dark:hover:border-rose-500/20',
            valueColor: 'text-[#0F172A] dark:text-white',
            symbolColor: 'text-[#64748B] dark:text-slate-400'
        },
        emerald: { 
            text: 'text-emerald-600 dark:text-emerald-400',
            bg: 'bg-emerald-50 dark:bg-emerald-500/10',
            glow: 'hover:shadow-premium-hover hover:border-emerald-200/60 dark:hover:border-emerald-500/20',
            valueColor: 'text-[#0F172A] dark:text-white',
            symbolColor: 'text-[#64748B] dark:text-slate-400'
        },
        amber: { 
            text: 'text-amber-600 dark:text-amber-400',
            bg: 'bg-amber-50 dark:bg-amber-500/10',
            glow: 'hover:shadow-premium-hover hover:border-amber-200/60 dark:hover:border-amber-500/20',
            valueColor: 'text-[#0F172A] dark:text-white',
            symbolColor: 'text-[#64748B] dark:text-slate-400'
        },
    };

    const style = colorStyles[color] || colorStyles.indigo;

    const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);
    const cleanFormatted = formatted.replace(/\s/g, ' ');
    const symbol = "R$";
    const valueStr = cleanFormatted.replace("R$", "").trim();

    return (
        <div className={`relative flex flex-col justify-between p-6 h-full bg-white dark:bg-[#0F172A] rounded-[20px] shadow-premium border border-[#EEF2F7] dark:border-white/[0.06] transition-all duration-300 ${style.glow} group overflow-hidden hover:-translate-y-0.5`}>
            
            {/* Top row with distinct Icon box and Badge */}
            <div className="flex justify-between items-start mb-6 relative z-10">
                <div className={`p-3 rounded-[14px] ${style.bg} ${style.text} transition-transform duration-300 group-hover:scale-105`}>
                    <Icon className="w-5 h-5" strokeWidth={1.75} />
                </div>
                
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${trendBadge}`}>
                    {!isNeutral && <IconTrend className="w-3.5 h-3.5" strokeWidth={2} />}
                    <span>{trend}</span>
                </div>
            </div>

            {/* Value Section */}
            <div className="relative z-10">
                <h3 className="text-[13px] font-medium text-[#64748B] dark:text-slate-400 mb-2">{title}</h3>
                <div className="flex items-baseline gap-1">
                    <span className={`text-[15px] font-semibold ${style.symbolColor}`}>{symbol}</span>
                    <span className={`text-[26px] lg:text-[28px] font-bold tracking-[-0.02em] ${style.valueColor}`}>
                        {valueStr}
                    </span>
                </div>
            </div>

            {/* Subtitle Footer */}
            <div className="mt-5 pt-4 border-t border-[#EEF2F7] dark:border-white/[0.04] relative z-10 flex items-center justify-between">
                <p className="text-[11px] font-medium text-[#94A3B8] dark:text-slate-500 flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full bg-[#E2E8F0] dark:bg-slate-700 group-hover:bg-current ${style.text} transition-colors duration-300`} />
                    {subtitle}
                </p>
            </div>
            
            {/* Atmospheric Glow on Hover */}
            <div className={`absolute -right-10 -top-10 w-32 h-32 ${style.bg} rounded-full opacity-0 group-hover:opacity-40 transition-opacity duration-500 pointer-events-none blur-2xl`} />
        </div>
    );
}

const EmptyState = ({ message }: { message: string }) => (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
        <div className="p-4 bg-[#F8F9FC] dark:bg-slate-800/30 rounded-full mb-3">
            <TrendingUp className="h-5 w-5 text-[#CBD5E1] dark:text-slate-600" />
        </div>
        <p className="text-[#64748B] dark:text-slate-400 text-[13px] font-medium">{message}</p>
    </div>
);

export default Dashboard;