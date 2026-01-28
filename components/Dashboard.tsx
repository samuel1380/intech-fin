import React, { useState, useMemo } from 'react';
import { Transaction, FinancialSummary, TransactionType, TaxSetting } from '../types';
import { ArrowUpRight, ArrowDownRight, Activity, AlertCircle, TrendingUp, Calendar, ArrowRight, Wallet, CreditCard, ChevronDown, Clock } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, ReferenceLine
} from 'recharts';
import { format, isSameMonth, isSameDay } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';

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
    const [viewMode, setViewMode] = useState<ViewMode>('month');

    // Helper to parse "YYYY-MM-DD" to local Date object
    const parseDateLocal = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (!value) return;

        if (viewMode === 'month') {
            const [year, month] = value.split('-').map(Number);
            setSelectedDate(new Date(year, month - 1, 1));
        } else {
            // Input type="date" returns YYYY-MM-DD
            const [year, month, day] = value.split('-').map(Number);
            setSelectedDate(new Date(year, month - 1, day));
        }
    };

    // --- FILTER LOGIC ---

    // 1. Transactions for the selected period (Specific Day OR Whole Month)
    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const txDate = parseDateLocal(t.date);
            if (viewMode === 'month') {
                return isSameMonth(txDate, selectedDate);
            } else {
                return isSameDay(txDate, selectedDate);
            }
        });
    }, [transactions, selectedDate, viewMode]);

    // 2. Transactions for the previous period (Last Month OR Yesterday) - For Trends
    const previousTransactions = useMemo(() => {
        return transactions.filter(t => {
            const txDate = parseDateLocal(t.date);
            if (viewMode === 'month') {
                const prevMonthDate = subMonths(selectedDate, 1);
                return isSameMonth(txDate, prevMonthDate);
            } else {
                const prevDayDate = subDays(selectedDate, 1);
                return isSameDay(txDate, prevDayDate);
            }
        });
    }, [transactions, selectedDate, viewMode]);

    // 3. Transactions for the CHART context (Always shows the Month of the selected date)
    const chartContextTransactions = useMemo(() => {
        return transactions.filter(t => {
            const txDate = parseDateLocal(t.date);
            return isSameMonth(txDate, selectedDate);
        });
    }, [transactions, selectedDate]);


    // --- SUMMARY CALCULATIONS ---

    const calculateSummary = (txs: Transaction[]) => {
        const income = txs
            .filter(t => t.type === TransactionType.INCOME && (t.status === 'CONCLUÍDO' || t.status === 'PAGTO PARCIAL'))
            .reduce((acc, curr) => acc + curr.amount, 0);
            
        const expense = txs
            .filter(t => t.type === TransactionType.EXPENSE && t.status === 'CONCLUÍDO')
            .reduce((acc, curr) => acc + curr.amount, 0);
            
        const commissions = txs
            .filter(t => t.commissionAmount && (t.status === 'CONCLUÍDO' || t.status === 'PAGTO PARCIAL'))
            .reduce((acc, curr) => acc + (curr.commissionAmount || 0), 0);

        const today = new Date().toISOString().split('T')[0];
        const pendingCommissions = txs
            .filter(t => t.commissionAmount && t.commissionPaymentDate && t.commissionPaymentDate > today)
            .reduce((acc, curr) => acc + (curr.commissionAmount || 0), 0);

        return { 
            income, 
            expense: expense + commissions, 
            commissions,
            pendingCommissions,
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

    // --- CHART DATA PREPARATION (Always Month Context) ---

    const chartData = useMemo(() => {
        const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
        const data = [];

        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

            // Filter specifically for the chart data (monthly context)
            const dailyTx = chartContextTransactions.filter(t => t.date === dateStr);

            const dailyIncome = dailyTx.filter(t => t.type === TransactionType.INCOME && t.status === 'CONCLUÍDO').reduce((acc, t) => acc + t.amount, 0);
            const dailyExpense = dailyTx.filter(t => t.type === TransactionType.EXPENSE && t.status === 'CONCLUÍDO').reduce((acc, t) => acc + t.amount, 0);

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
    }, [chartContextTransactions, selectedDate, viewMode]);

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
                <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md p-4 border border-slate-100 dark:border-slate-700 shadow-xl rounded-xl min-w-[180px]">
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mb-2 uppercase tracking-wider">Dia {label}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-300 capitalize">{entry.name}</span>
                            </div>
                            <span className="text-sm font-bold text-slate-800 dark:text-white font-mono">
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
        <div className="space-y-8 animate-fade-in w-full pb-8">
            {/* Header & Filter */}
            <div className="flex flex-col md:flex-row justify-between md:items-end gap-6 border-b border-slate-200 pb-6">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Dashboard</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm font-medium">
                        {viewMode === 'month'
                            ? 'Visão consolidada mensal.'
                            : `Detalhamento do dia ${format(selectedDate, 'dd/MM/yyyy')}.`}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-center">
                    {/* View Toggle */}
                    <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex border border-slate-200 dark:border-slate-700">
                        <button
                            onClick={() => setViewMode('month')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'month' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                        >
                            Mensal
                        </button>
                        <button
                            onClick={() => setViewMode('day')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'day' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                        >
                            Diário
                        </button>
                    </div>

                    {/* Date Picker Customizado */}
                    <div className="relative min-w-[200px] group">
                        {/* Camada Visual Personalizada */}
                        <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 shadow-sm group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50 transition-colors cursor-pointer">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-indigo-500 shrink-0 group-hover:scale-110 transition-transform" />
                                <span className="text-slate-700 dark:text-slate-200 font-bold text-sm capitalize">
                                    {viewMode === 'month'
                                        ? format(selectedDate, 'MMMM yyyy', { locale: ptBR })
                                        : format(selectedDate, 'dd/MM/yyyy')}
                                </span>
                            </div>
                            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                        </div>

                        {/* Input Nativo Invisível (Trigger do Calendário) */}
                        <input
                            type={viewMode === 'month' ? "month" : "date"}
                            value={viewMode === 'month' ? format(selectedDate, 'yyyy-MM') : format(selectedDate, 'yyyy-MM-dd')}
                            onChange={handleDateChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 appearance-none [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0"
                            style={{ colorScheme: 'light' }}
                        />
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6">
                <KPICard
                    title={viewMode === 'month' ? "Receita Total" : "Receita do Dia"}
                    value={currentSummary.income}
                    icon={Wallet}
                    trend={trends.income}
                    trendUp={trends.incomeIsUp}
                    color="indigo"
                    subtitle={viewMode === 'month' ? "Vs. Mês Anterior" : "Vs. Ontem"}
                />
                <KPICard
                    title={viewMode === 'month' ? "Despesas + Comis." : "Saídas do Dia"}
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
                    trend="A Pagar"
                    trendUp={false}
                    color="amber"
                    subtitle="Pagamento futuro"
                />
                <KPICard
                    title="Provisão Fiscal"
                    value={currentSummary.profit > 0 ? currentSummary.profit * totalTaxRate : 0}
                    icon={AlertCircle}
                    trend="Estimativa"
                    trendUp={false}
                    color="slate"
                    subtitle={`${(totalTaxRate * 100).toFixed(1)}% sobre lucro`}
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Main Flow Chart */}
                <div className="xl:col-span-2 bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 flex flex-col min-h-[350px]">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {viewMode === 'month' ? 'Fluxo de Caixa Mensal' : 'Contexto Mensal do Fluxo'}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {viewMode === 'month'
                                    ? 'Evolução diária do saldo durante o mês.'
                                    : `Visualizando posição do dia ${selectedDate.getDate()} no contexto do mês.`}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <span className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-100 dark:border-indigo-800/50 uppercase tracking-wide">
                                {format(selectedDate, 'MMMM yyyy', { locale: ptBR })}
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
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#94a3b8"
                                        fontSize={9}
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={10}
                                    />
                                    <YAxis
                                        stroke="#94a3b8"
                                        fontSize={9}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(val) => `R$${val / 1000}k`}
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }} />

                                    {/* Reference line for the specific day when in day view */}
                                    {viewMode === 'day' && (
                                        <ReferenceLine x={String(selectedDate.getDate())} stroke="#f43f5e" strokeDasharray="3 3" label="Dia Selecionado" />
                                    )}

                                    <Area
                                        type="monotone"
                                        name="Saldo"
                                        dataKey="saldo"
                                        stroke="#6366f1"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorSaldo)"
                                        activeDot={{ r: 6, strokeWidth: 0, fill: '#4338ca' }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyState message={`Sem dados para exibir em ${format(selectedDate, 'MMMM', { locale: ptBR })}.`} />
                        )}
                    </div>
                </div>

                {/* Breakdown Bar Chart */}
                <div className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 flex flex-col min-h-[350px]">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Entradas vs Saídas</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Comparativo de volume {viewMode === 'month' ? 'diário' : 'no mês'}.</p>
                    </div>
                    <div className="flex-1 w-full relative">
                        {hasData ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData.filter(d => d.receita > 0 || d.despesa > 0)} barGap={4}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={8} tickLine={false} axisLine={false} tickMargin={10} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                                    <Bar name="Receita" dataKey="receita" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                    <Bar name="Despesa" dataKey="despesa" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyState message="Sem movimentações." />
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Transactions Preview */}
            <div className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200 dark:border-white/5 overflow-hidden w-full">
                <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-white dark:bg-transparent">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            {viewMode === 'month' ? 'Transações Recentes' : `Transações de ${format(selectedDate, 'dd/MM')}`}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {viewMode === 'month' ? 'Histórico de atividades do mês.' : 'Detalhamento do dia selecionado.'}
                        </p>
                    </div>
                    <button
                        onClick={onNavigateToTransactions}
                        className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold flex items-center group transition-colors px-4 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg"
                    >
                        Ver Extrato Completo
                        <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
                <div className="overflow-x-auto">
                    {hasFilteredData ? (
                        <table className="w-full text-sm text-left min-w-[600px]">
                            <thead className="text-xs text-slate-400 dark:text-slate-500 uppercase bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                                <tr>
                                    <th className="px-8 py-4 font-semibold tracking-wider">Descrição</th>
                                    <th className="px-8 py-4 font-semibold tracking-wider">Data</th>
                                    <th className="px-8 py-4 font-semibold tracking-wider">Categoria</th>
                                    <th className="px-8 py-4 font-semibold tracking-wider text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {filteredTransactions.slice(0, 5).map((t) => {
                                    const [year, month, day] = t.date.split('-');
                                    return (
                                        <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors group">
                                            <td className="px-8 py-5">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-900 dark:text-slate-200 text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{t.description}</span>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`w-2 h-2 rounded-full ${t.status === 'CONCLUÍDO' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t.status}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-slate-500 dark:text-slate-400 font-medium tabular-nums">{day}/{month}/{year}</td>
                                            <td className="px-8 py-5">
                                                <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md text-xs font-bold border border-slate-200 dark:border-slate-600">
                                                    {t.category}
                                                </span>
                                            </td>
                                            <td className={`px-8 py-5 text-right font-bold text-base font-mono ${t.type === 'RECEITA' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {t.type === 'RECEITA' ? '+' : '-'}{formatCurrency(t.amount)}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-16 text-center text-slate-400 flex flex-col items-center">
                            <div className="p-4 bg-slate-50 rounded-full mb-3">
                                <Clock className="h-6 w-6 text-slate-300" />
                            </div>
                            <p>Nenhuma transação encontrada para este período.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const KPICard = ({ title, value, icon: Icon, trend, trendUp, color, subtitle, invertColor = false }: any) => {
    const colorConfigs: any = {
        indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-100 dark:border-indigo-800/30', iconBg: 'bg-indigo-100 dark:bg-indigo-800/50' },
        rose: { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-100 dark:border-rose-800/30', iconBg: 'bg-rose-100 dark:bg-rose-800/50' },
        emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-100 dark:border-emerald-800/30', iconBg: 'bg-emerald-100 dark:bg-emerald-800/50' },
        amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-100 dark:border-amber-800/30', iconBg: 'bg-amber-100 dark:bg-amber-800/50' },
    };

    const gradients: any = {
        indigo: "from-indigo-600 to-violet-600",
        rose: "from-rose-600 to-pink-600",
        emerald: "from-emerald-600 to-teal-600",
        amber: "from-amber-500 to-orange-500"
    };

    const theme = colorConfigs[color] || colorConfigs.indigo;
    const textGradient = gradients[color] || gradients.indigo;

    let trendColor = trendUp ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20';
    let IconTrend = trendUp ? ArrowUpRight : ArrowDownRight;

    if (invertColor) {
        trendColor = trendUp ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20' : 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20';
    }

    // Fallback for neutral trend
    if (trend === '--%' || trend === '0.0%') {
        trendColor = 'text-slate-500 bg-slate-100';
    }

    // Format currency manually to split symbol from value
    const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);
    // Remove default NBSP and split
    const cleanFormatted = formatted.replace(/\s/g, ' ');
    const symbol = "R$";
    const valueStr = cleanFormatted.replace("R$", "").trim();

    return (
        <div className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl p-6 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border border-slate-100 dark:border-white/5 flex flex-col justify-between h-full group relative overflow-hidden">
            {/* Background blob removed as per request */}

            <div className="flex justify-between items-start mb-2 relative z-10">
                <div className={`p-3 rounded-xl ${theme.bg} ${theme.text} transition-colors ring-1 ring-inset ring-black/5 dark:ring-white/10`}>
                    <Icon className="h-6 w-6" />
                </div>
                <div className={`flex items-center px-2 py-1 rounded-lg text-xs font-bold ${trendColor}`}>
                    {trend !== '--%' && <IconTrend className="h-3 w-3 mr-1" />}
                    {trend}
                </div>
            </div>

            <div className="relative z-10">
                <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-sm font-bold text-slate-400 self-start mt-2">{symbol}</span>
                    <h4 className={`text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r ${textGradient} bg-clip-text text-transparent`}>
                        {valueStr}
                    </h4>
                </div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">{title}</p>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-700/50 relative z-10">
                <p className="text-xs text-slate-400 font-medium flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${trendUp && !invertColor ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                    {subtitle}
                </p>
            </div>
        </div>
    );
}

const EmptyState = ({ message }: { message: string }) => (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
        <div className="p-4 bg-slate-50 rounded-full mb-3 shadow-sm">
            <TrendingUp className="h-6 w-6 text-slate-300" />
        </div>
        <p className="text-slate-500 text-sm font-medium">{message}</p>
    </div>
);

export default Dashboard;