import React, { useState, useMemo } from 'react';
import { Transaction, FinancialSummary, TransactionType, TransactionStatus, TaxSetting } from '../types';
import { ArrowUpRight, ArrowDownRight, Activity, AlertCircle, TrendingUp, Calendar, ArrowRight, Wallet, CreditCard, ChevronDown, Clock, User, DollarSign, Bell, CalendarRange, Search } from 'lucide-react';
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
    userName?: string;
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

const Dashboard: React.FC<DashboardProps> = ({ transactions, onNavigateToTransactions, taxSettings = [], userName = 'Administrador' }) => {
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

    // Top Technicians calculation
    const topTechnicians = useMemo(() => {
        const techCommissions: Record<string, number> = {};
        filteredTransactions.forEach(t => {
            if (t.employeeName && t.commissionAmount) {
                let val = t.commissionAmount;
                if (t.status === TransactionStatus.PARTIAL && t.pendingAmount && t.amount > t.pendingAmount) {
                     val = (t.commissionAmount * ((t.amount - t.pendingAmount) / t.amount));
                } else if (t.status === TransactionStatus.PENDENTE) {
                     val = 0;
                }
                if (val > 0) {
                    techCommissions[t.employeeName] = (techCommissions[t.employeeName] || 0) + val;
                }
            }
        });
        const list = Object.entries(techCommissions)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name, total]) => ({ name, total }));
            
        // Fill empty slots if less than 3
        while (list.length < 3) {
            list.push({ name: '---', total: 0 });
        }
        return list;
    }, [filteredTransactions]);

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
        <div className="space-y-8 animate-fade-in w-full min-w-0 pb-8 text-slate-800 dark:text-slate-100">
            {/* Saudação Finexy e Filtros */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-[28px] font-bold tracking-tight text-slate-900 dark:text-white">Bom dia, {userName}</h1>
                    <p className="text-xs font-semibold text-slate-400 mt-1">Acompanhe seus serviços, métricas financeiras e status da desentupidora.</p>
                </div>
                
                {/* Painel de Filtro de Datas */}
                <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2.5 rounded-[18px] border border-[#EEF2F7] dark:border-white/[0.06] shadow-sm">
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-1 flex items-center">
                        <button 
                            onClick={() => setViewMode('month')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'month' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >
                            Mensal
                        </button>
                        <button 
                            onClick={() => setViewMode('day')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'day' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >
                            Diário
                        </button>
                    </div>

                    <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700"></div>

                    {viewMode === 'month' ? (
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <input 
                                    type="month" 
                                    value={format(startDate, 'yyyy-MM')} 
                                    onChange={handleStartMonthChange}
                                    className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50"
                                />
                            </div>
                            <span className="text-[10px] font-bold text-slate-400">até</span>
                            <div className="relative">
                                <input 
                                    type="month" 
                                    value={format(endDate, 'yyyy-MM')} 
                                    onChange={handleEndMonthChange}
                                    className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center">
                            <input 
                                type="date" 
                                value={format(selectedDate, 'yyyy-MM-dd')} 
                                onChange={handleDateChange}
                                className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Layout Principal da Dashboard Finexy: 3 Colunas superiores */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                
                {/* Lado Esquerdo (4 colunas): Total Balance, Wallets, Monthly Limit, My Cards */}
                <div className="lg:col-span-4 space-y-6 flex flex-col justify-between">
                    
                    {/* Total Balance Card */}
                    <div className="bg-white dark:bg-slate-800 border border-[#EEF2F7] dark:border-white/[0.06] rounded-[24px] p-6 shadow-premium relative flex-1 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Saldo Total (Lucro)</span>
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-700 rounded-full cursor-pointer hover:bg-slate-200 transition-colors">
                                    <span className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300">🇧🇷 BRL</span>
                                    <ChevronDown className="h-3 w-3 text-slate-400" />
                                </div>
                            </div>
                            <div className="flex items-baseline gap-1.5 mt-2">
                                <span className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">{formatCurrency(currentSummary.profit)}</span>
                            </div>
                            <div className="flex items-center gap-1 mt-1 text-[11px] font-bold text-emerald-500">
                                {trends.profitIsUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3 text-rose-500" />}
                                <span className={trends.profitIsUp ? 'text-emerald-500' : 'text-rose-500'}>{trends.profit} em relação ao mês anterior</span>
                            </div>
                        </div>

                        {/* Botões de Ação */}
                        <div className="grid grid-cols-2 gap-3 my-5">
                            <button className="flex items-center justify-center gap-2 bg-finexyBlack hover:bg-black text-white py-3 rounded-full text-xs font-bold transition-all shadow-sm">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                                Novo Serviço
                            </button>
                            <button className="flex items-center justify-center gap-2 bg-[#F3F4F6] hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white py-3 rounded-full text-xs font-bold transition-all">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"></path></svg>
                                Nova Despesa
                            </button>
                        </div>

                        {/* Top Técnicos */}
                        <div className="pt-4 border-t border-[#EEF2F7] dark:border-white/[0.04]">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-[11px] font-bold text-slate-400">Top Técnicos | <span className="text-slate-600 dark:text-slate-300">Comissões</span></span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {topTechnicians.map((tech, idx) => (
                                    <div key={idx} className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold truncate max-w-[70%]">{tech.name.split(' ')[0]}</span>
                                            <div className={`w-1 h-1 rounded-full ${idx === 0 ? 'bg-finexyOrange' : 'bg-slate-300'}`}></div>
                                        </div>
                                        <p className="text-[11px] font-bold mt-1.5">{formatCurrency(tech.total)}</p>
                                        <span className={`text-[9px] font-bold mt-1 block ${idx === 0 ? 'text-finexyOrange' : 'text-slate-400'}`}>
                                            {idx === 0 ? '1º Lugar' : `${idx + 1}º Lugar`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Saúde Financeira */}
                    <div className="bg-white dark:bg-slate-800 border border-[#EEF2F7] dark:border-white/[0.06] rounded-[24px] p-5 shadow-premium">
                        <div className="flex justify-between items-center mb-2.5">
                            <span className="text-xs font-bold text-slate-400">Saúde Financeira (Despesas x Receitas)</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden mb-2">
                            <div className={`h-full rounded-full ${currentSummary.income > 0 && (currentSummary.expense / currentSummary.income) > 0.7 ? 'bg-rose-500' : 'bg-finexyOrange'}`} style={{ width: `${Math.min(currentSummary.income > 0 ? (currentSummary.expense / currentSummary.income) * 100 : 0, 100)}%` }}></div>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                            <span><span className="text-slate-800 dark:text-white font-extrabold">{formatCurrency(currentSummary.expense)}</span> consumidos de</span>
                            <span className="text-slate-800 dark:text-white font-extrabold">{formatCurrency(currentSummary.income)}</span>
                        </div>
                    </div>

                    {/* Status Financeiro Widget */}
                    <div className="bg-white dark:bg-slate-800 border border-[#EEF2F7] dark:border-white/[0.06] rounded-[24px] p-5 shadow-premium">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-xs font-bold text-slate-400">Status Financeiro (Faturamento)</span>
                        </div>
                        <div className="flex gap-4 overflow-x-auto pb-1 custom-scrollbar">
                            {/* Card 1: Em Caixa (Black) */}
                            <div className="min-w-[200px] flex-1 bg-finexyBlack text-white p-4 rounded-[18px] flex flex-col justify-between h-[115px] relative overflow-hidden shadow-md">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                                        <span className="text-[9px] font-extrabold tracking-wider uppercase opacity-80">Em Caixa</span>
                                    </div>
                                    <div className="w-6 h-4 opacity-70">
                                        <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.879.518.518 3.518-3.518M12 6.25l7.5 7.5-7.5-7.5"></path></svg>
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <p className="text-[10px] font-mono tracking-widest text-slate-300">Recebido</p>
                                    <p className="text-[15px] font-mono font-bold tracking-widest mt-0.5 text-white">{formatCurrency(currentSummary.income - currentSummary.totalPendingFromClients)}</p>
                                </div>
                            </div>
                            
                            {/* Card 2: A Receber (Orange) */}
                            <div className="min-w-[140px] bg-finexyOrange text-white p-4 rounded-[18px] flex flex-col justify-between h-[115px] relative overflow-hidden shadow-md">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
                                        <span className="text-[9px] font-extrabold tracking-wider uppercase opacity-90">A Receber</span>
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <p className="text-[10px] font-mono tracking-widest opacity-80 text-white">Inadimplência</p>
                                    <p className="text-[15px] font-mono font-bold tracking-widest mt-0.5 text-white">{formatCurrency(currentSummary.totalPendingFromClients)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Centro (4 colunas): Grid 2x2 de métricas rápidas */}
                <div className="lg:col-span-4 grid grid-cols-2 gap-4">
                    {/* Metric 1: Earnings (Laranja) */}
                    <div className="bg-finexyOrange text-white rounded-[24px] p-6 flex flex-col justify-between h-full shadow-premium-hover min-h-[170px] relative overflow-hidden group">
                        <div className="flex justify-between items-start">
                            <span className="text-xs font-bold opacity-80">Total de Receitas (Entradas)</span>
                            <div className="p-2 bg-white/10 rounded-xl">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.879.518.518 3.518-3.518M12 6.25l7.5 7.5-7.5-7.5"></path></svg>
                            </div>
                        </div>
                        <div>
                            <span className="text-3xl font-extrabold tracking-tight block mt-6">{formatCurrency(currentSummary.income)}</span>
                            <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5 mt-2">
                                {trends.incomeIsUp ? <ArrowUpRight className="h-3 w-3" strokeWidth={3} /> : <ArrowDownRight className="h-3 w-3" strokeWidth={3} />} {trends.income}
                            </span>
                        </div>
                    </div>

                    {/* Metric 2: Spending */}
                    <div className="bg-white dark:bg-slate-800 border border-[#EEF2F7] dark:border-white/[0.06] rounded-[24px] p-6 flex flex-col justify-between h-full shadow-premium min-h-[170px] relative overflow-hidden group">
                        <div className="flex justify-between items-start">
                            <span className="text-xs font-bold text-slate-400">Total de Despesas (Saídas)</span>
                            <div className="p-2 bg-slate-50 dark:bg-slate-700 rounded-xl">
                                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"></path></svg>
                            </div>
                        </div>
                        <div>
                            <span className="text-3xl font-extrabold tracking-tight block mt-6 text-slate-800 dark:text-white">{formatCurrency(currentSummary.expense)}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-0.5 mt-2 ${trends.expenseIsGood ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'text-rose-500 bg-rose-50 dark:bg-rose-950/20'}`}>
                                {trends.expenseIsGood ? <ArrowDownRight className="h-3 w-3" strokeWidth={3} /> : <ArrowUpRight className="h-3 w-3" strokeWidth={3} />} {trends.expense}
                            </span>
                        </div>
                    </div>

                    {/* Metric 3: Profit */}
                    <div className="bg-white dark:bg-slate-800 border border-[#EEF2F7] dark:border-white/[0.06] rounded-[24px] p-6 flex flex-col justify-between h-full shadow-premium min-h-[170px] relative overflow-hidden group">
                        <div className="flex justify-between items-start">
                            <span className="text-xs font-bold text-slate-400">Fluxo de Caixa (Lucro)</span>
                            <div className="p-2 bg-slate-50 dark:bg-slate-700 rounded-xl">
                                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg>
                            </div>
                        </div>
                        <div>
                            <span className="text-3xl font-extrabold tracking-tight block mt-6 text-slate-800 dark:text-white">{formatCurrency(currentSummary.profit)}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-0.5 mt-2 ${trends.profitIsUp ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'text-rose-500 bg-rose-50 dark:bg-rose-950/20'}`}>
                                {trends.profitIsUp ? <ArrowUpRight className="h-3 w-3" strokeWidth={3} /> : <ArrowDownRight className="h-3 w-3" strokeWidth={3} />} {trends.profit}
                            </span>
                        </div>
                    </div>

                    {/* Metric 4: Commissions */}
                    <div className="bg-white dark:bg-slate-800 border border-[#EEF2F7] dark:border-white/[0.06] rounded-[24px] p-6 flex flex-col justify-between h-full shadow-premium min-h-[170px] relative overflow-hidden group">
                        <div className="flex justify-between items-start">
                            <span className="text-xs font-bold text-slate-400">Comissões (Técnicos)</span>
                            <div className="p-2 bg-slate-50 dark:bg-slate-700 rounded-xl">
                                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.905 0-5.64-.53-8.157-1.499"></path></svg>
                            </div>
                        </div>
                        <div>
                            <span className="text-3xl font-extrabold tracking-tight block mt-6 text-slate-800 dark:text-white">{formatCurrency(currentSummary.commissions)}</span>
                            <div className="flex gap-2 mt-2">
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                                    Pendentes: {formatCurrency(currentSummary.pendingCommissions)}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                                    Próximas: {formatCurrency(currentSummary.futureCommissionsFromPending)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lado Direito (4 colunas): Gráfico Total Income */}
                <div className="lg:col-span-4 bg-white dark:bg-slate-800 border border-[#EEF2F7] dark:border-white/[0.06] rounded-[24px] p-6 shadow-premium flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xs font-bold text-slate-400">Resumo Financeiro</h3>
                                <p className="text-[10px] font-semibold text-slate-400/80 mt-0.5">Visão do seu faturamento no período</p>
                            </div>
                        </div>
                        
                        {/* Legenda e título secundário */}
                        <div className="flex justify-between items-center mt-5 mb-4">
                            <span className="text-xs font-bold text-slate-800 dark:text-white">Receitas e Despesas</span>
                            <div className="flex items-center gap-3 text-[10px] font-bold">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-md bg-finexyOrange"></div>
                                    <span className="text-slate-400">Receitas</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-md bg-finexyBlack dark:bg-slate-600"></div>
                                    <span className="text-slate-400">Despesas</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Área Gráfica com barras bicolores arredondadas */}
                    <div className="h-[200px] w-full mt-4">
                        {hasData ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} barGap={4}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226,232,240,0.15)" />
                                    <XAxis 
                                        dataKey="date" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 'bold' }} 
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 'bold' }}
                                        width={25}
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                                    <Bar name="Profit" dataKey="receita" fill="#FF4C15" radius={[4, 4, 0, 0]} maxBarSize={12} />
                                    <Bar name="Loss" dataKey="despesa" fill="#1A1A1A" radius={[4, 4, 0, 0]} maxBarSize={12} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyState message="Sem dados de gráfico para o período." />
                        )}
                    </div>
                </div>

            </div>

            {/* Atividades Recentes com visual idêntico ao print */}
            <div className="bg-white dark:bg-slate-800 border border-[#EEF2F7] dark:border-white/[0.06] rounded-[24px] shadow-premium overflow-hidden w-full">
                {/* Cabeçalho da tabela */}
                <div className="px-6 py-5 border-b border-[#EEF2F7] dark:border-white/[0.06] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-transparent">
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white">Atividades Recentes</h3>
                    </div>
                    {/* Barra de Filtros e Busca */}
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative flex-1 sm:flex-initial">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <input 
                                type="text"
                                placeholder="Pesquisar serviços..."
                                className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-700/60 border border-slate-200/50 dark:border-slate-700/30 rounded-full text-xs outline-none focus:ring-1 focus:ring-finexyOrange w-full sm:w-48 font-semibold text-slate-600 dark:text-slate-300"
                            />
                        </div>
                        <button className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 dark:bg-slate-700/60 border border-slate-200/50 dark:border-slate-700/30 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.477 8 1.4V14a8 8 0 01-16 0V4.4C6.545 3.477 9.245 3 12 3z"></path></svg>
                            Filtrar
                        </button>
                    </div>
                </div>

                {/* Tabela de Atividades */}
                <div className="overflow-x-auto custom-scrollbar w-full">
                    {hasFilteredData ? (
                        <table className="w-full text-xs text-left min-w-[700px] border-collapse">
                            <thead className="text-[10px] text-slate-400 uppercase bg-slate-50/50 dark:bg-slate-800/80 border-b border-[#EEF2F7] dark:border-white/[0.04]">
                                <tr>
                                    <th className="px-6 py-3.5 w-12 text-center">
                                        <input type="checkbox" className="rounded border-slate-300 text-finexyOrange focus:ring-finexyOrange" />
                                    </th>
                                    <th className="px-6 py-3.5 font-bold tracking-wider">ID do Serviço</th>
                                    <th className="px-6 py-3.5 font-bold tracking-wider">Atividade</th>
                                    <th className="px-6 py-3.5 font-bold tracking-wider">Valor</th>
                                    <th className="px-6 py-3.5 font-bold tracking-wider">Status</th>
                                    <th className="px-6 py-3.5 font-bold tracking-wider">Data</th>
                                    <th className="px-6 py-3.5 w-12"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#EEF2F7] dark:divide-white/[0.04]">
                                {filteredTransactions.slice(0, 6).map((t, idx) => {
                                    const [year, month, day] = t.date.split('-');
                                    
                                    // Determinar estilos das tags de status
                                    let statusStyle = 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20';
                                    let statusText = 'Concluído';
                                    if (t.status === 'PENDENTE') {
                                        statusStyle = 'text-rose-600 bg-rose-50 dark:bg-rose-950/20';
                                        statusText = 'Pendente';
                                    } else if (t.status === 'PARCIAL') {
                                        statusStyle = 'text-amber-600 bg-amber-50 dark:bg-amber-950/20';
                                        statusText = 'Em Andamento';
                                    }

                                    return (
                                        <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors duration-150">
                                            <td className="px-6 py-4 text-center">
                                                <input type="checkbox" className="rounded border-slate-300 text-finexyOrange focus:ring-finexyOrange" />
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">
                                                OS_{t.id.slice(0,6).toUpperCase()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3.5">
                                                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500">
                                                        {t.type === 'RECEITA' ? '💰' : '📦'}
                                                    </div>
                                                    <span className="font-semibold text-slate-800 dark:text-white">{t.description}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">
                                                {formatCurrency(t.amount)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${statusStyle} inline-flex items-center gap-1.5`}>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                                    {statusText}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-400 font-semibold">
                                                {day} {format(parseDateLocal(t.date), 'MMM, yyyy', { locale: ptBR })}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM18 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="py-16 text-center text-slate-400 flex flex-col items-center">
                            <p className="text-xs font-semibold">Nenhuma movimentação recente encontrada.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const KPICard = ({ title, value, icon: Icon, trend, trendUp, color, subtitle, invertColor = false }: any) => {
    return null;
};

const EmptyState = ({ message }: { message: string }) => (
    <div className="h-full w-full flex flex-col items-center justify-center text-center p-4">
        <p className="text-slate-400 text-xs font-bold">{message}</p>
    </div>
);

export default Dashboard;