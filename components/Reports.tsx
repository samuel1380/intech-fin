import React, { useState } from 'react';
import { Transaction, TransactionType, TransactionStatus, TaxSetting } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts';
import { Download, PieChart as PieIcon, FileText, TrendingUp, TrendingDown, DollarSign, Receipt, Users, Percent, X, ChevronRight, User, Calendar, Briefcase, ArrowUpRight, ArrowDownRight, CalendarRange, ChevronDown } from 'lucide-react';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
    transactions: Transaction[];
    taxSettings: TaxSetting[];
}

interface EmployeeReport {
    name: string;
    totalRevenue: number;
    totalCommission: number;
    totalVales: number;
    jobCount: number;
    avgPerJob: number;
    commissionRate: number;
    transactions: Transaction[];
}

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f43f5e', '#14b8a6', '#f97316', '#a855f7'];
const EMPLOYEE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f43f5e', '#14b8a6'];

const Reports: React.FC<Props> = ({ transactions, taxSettings }) => {
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

    // Filters
    const [viewMode, setViewMode] = useState<'month' | 'day'>('month');
    const [startMonth, setStartMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [endMonth, setEndMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    const handleStartMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setStartMonth(val);
        if (val > endMonth) setEndMonth(val);
    };

    const handleEndMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setEndMonth(val);
        if (val < startMonth) setStartMonth(val);
    };

    const filteredTransactions = transactions.filter(t => {
        if (viewMode === 'day') {
            return t.date === selectedDate;
        } else {
            const txMonth = t.date.substring(0, 7);
            return txMonth >= startMonth && txMonth <= endMonth;
        }
    });

    const isSingleMonth = startMonth === endMonth;

    const hasData = filteredTransactions.length > 0;
    // End of duplicates

    // ===== CÁLCULOS FINANCEIROS =====
    const totalIncome = filteredTransactions
        .filter(t => t.type === TransactionType.INCOME && (t.status === TransactionStatus.COMPLETED || t.status === TransactionStatus.PARTIAL))
        .reduce((s, t) => {
            if (t.status === TransactionStatus.PARTIAL && t.pendingAmount) {
                return s + (t.amount - t.pendingAmount);
            }
            return s + t.amount;
        }, 0);

    const totalExpense = filteredTransactions
        .filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.COMPLETED)
        .reduce((s, t) => s + t.amount, 0);

    const totalCommissions = filteredTransactions
        .filter(t => t.commissionAmount && (t.status === TransactionStatus.COMPLETED || t.status === TransactionStatus.PARTIAL))
        .reduce((acc, curr) => {
            if (curr.status === TransactionStatus.PARTIAL && curr.pendingAmount && curr.amount > curr.pendingAmount) {
                const receivedAmount = curr.amount - curr.pendingAmount;
                const proportion = receivedAmount / curr.amount;
                return acc + ((curr.commissionAmount || 0) * proportion);
            }
            return acc + (curr.commissionAmount || 0);
        }, 0);

    const grossProfit = totalIncome - totalExpense - totalCommissions;
    const totalTaxRate = taxSettings.length > 0
        ? taxSettings.reduce((acc, curr) => acc + (curr.percentage / 100), 0)
        : 0.15;
    const estimatedTax = totalIncome > 0 ? totalIncome * totalTaxRate : 0;
    const netAfterTax = grossProfit - estimatedTax;
    const profitMargin = totalIncome > 0 ? (netAfterTax / totalIncome) * 100 : 0;

    const pendingTotal = filteredTransactions
        .filter(t => t.status === TransactionStatus.PARTIAL && t.pendingAmount)
        .reduce((s, t) => s + (t.pendingAmount || 0), 0);

    // ===== DADOS DE FUNCIONÁRIOS =====
    const employeeMap: Record<string, EmployeeReport> = {};
    const today = new Date().toISOString().split('T')[0];

    filteredTransactions.filter(t => t.employeeName).forEach(t => {
        const name = t.employeeName!;
        if (!employeeMap[name]) {
            employeeMap[name] = {
                name,
                totalRevenue: 0,
                totalCommission: 0,
                totalVales: 0,
                jobCount: 0,
                avgPerJob: 0,
                commissionRate: 0,
                transactions: [],
            };
        }
        const emp = employeeMap[name];
        emp.transactions.push(t);

        if (t.type === TransactionType.INCOME) {
            emp.jobCount++;
            emp.totalRevenue += t.amount;
            if (t.commissionAmount) {
                emp.totalCommission += t.commissionAmount;
                if (t.commissionRate) {
                    emp.commissionRate = t.commissionRate;
                }
            }
        } else if (t.type === TransactionType.EXPENSE) {
            emp.totalVales += t.amount;
        }
    });

    // Calculate average per job
    Object.values(employeeMap).forEach(emp => {
        emp.avgPerJob = emp.jobCount > 0 ? emp.totalRevenue / emp.jobCount : 0;
    });

    const employees = Object.values(employeeMap).sort((a, b) => b.totalRevenue - a.totalRevenue);
    const selectedEmp = selectedEmployee ? employeeMap[selectedEmployee] : null;

    // ===== DADOS PARA GRÁFICOS =====
    const expenseDataMap = filteredTransactions
        .filter(t => t.type === TransactionType.EXPENSE)
        .reduce((acc, curr) => {
            acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
            return acc;
        }, {} as Record<string, number>);

    const totalExpenseForPie = Object.values(expenseDataMap).reduce((s, v) => s + v, 0);

    const pieData = Object.keys(expenseDataMap)
        .map(key => ({
            name: key,
            value: expenseDataMap[key],
            percentage: totalExpenseForPie > 0 ? ((expenseDataMap[key] / totalExpenseForPie) * 100).toFixed(1) : '0'
        }))
        .sort((a, b) => b.value - a.value);

    const barData = [
        { name: 'Receita', value: totalIncome, fill: '#10b981' },
        { name: 'Despesa Op.', value: totalExpense, fill: '#f43f5e' },
        { name: 'Comissões', value: totalCommissions, fill: '#f59e0b' },
        { name: 'Líquido', value: netAfterTax, fill: netAfterTax >= 0 ? '#6366f1' : '#ef4444' },
    ];

    const formatBRL = (val: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const formatCompact = (val: number) => {
        if (val >= 1000000) return `R$${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `R$${(val / 1000).toFixed(1)}K`;
        return formatBRL(val);
    };

    const formatDate = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    };

    // ===== TOOLTIP CUSTOMIZADO =====
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700">
                    <p className="text-sm font-bold text-slate-800 dark:text-white">{payload[0].name || payload[0].payload.name}</p>
                    <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mt-1">
                        {formatBRL(payload[0].value)}
                    </p>
                    {payload[0].payload.percentage && (
                        <p className="text-xs text-slate-400 mt-0.5">{payload[0].payload.percentage}% do total</p>
                    )}
                </div>
            );
        }
        return null;
    };

    // ===== CUSTOM PIE LABEL =====
    const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage }: any) => {
        if (parseFloat(percentage) < 5) return null;
        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        return (
            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
                {percentage}%
            </text>
        );
    };

    const renderLegend = (props: any) => {
        const { payload } = props;
        return (
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
                {payload.map((entry: any, index: number) => (
                    <div key={`legend-${index}`} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{entry.value}</span>
                    </div>
                ))}
            </div>
        );
    };

    // ===== PDF GENERATION =====
    const handleDownloadPDF = () => {
        if (!hasData) return;
        const doc = new jsPDF();
        const companyName = "FinNexus Enterprise";
        const primaryColor = [79, 70, 229] as [number, number, number];

        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.text(companyName, 14, 20);
        doc.setFontSize(12);
        doc.text("Controle & Auditoria", 14, 28);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 195, 20, { align: 'right' });
        doc.text(`Solicitado por: Admin`, 195, 28, { align: 'right' });

        doc.setTextColor(40, 40, 40);
        doc.setFontSize(14);
        doc.text("Resumo Executivo", 14, 55);

        const startY = 60;

        doc.setFillColor(240, 253, 244);
        doc.setDrawColor(22, 163, 74);
        doc.roundedRect(14, startY, 45, 25, 3, 3, 'FD');
        doc.setFontSize(8);
        doc.setTextColor(22, 163, 74);
        doc.text("Receita Total", 17, startY + 8);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(formatBRL(totalIncome), 17, startY + 18);

        doc.setFillColor(255, 241, 242);
        doc.setDrawColor(225, 29, 72);
        doc.roundedRect(61, startY, 45, 25, 3, 3, 'FD');
        doc.setFontSize(8);
        doc.setTextColor(225, 29, 72);
        doc.text("Despesa Operac.", 64, startY + 8);
        doc.setFontSize(11);
        doc.text(formatBRL(totalExpense), 64, startY + 18);

        doc.setFillColor(254, 243, 232);
        doc.setDrawColor(234, 88, 12);
        doc.roundedRect(108, startY, 45, 25, 3, 3, 'FD');
        doc.setFontSize(8);
        doc.setTextColor(234, 88, 12);
        doc.text("Comissões", 111, startY + 8);
        doc.setFontSize(11);
        doc.text(formatBRL(totalCommissions), 111, startY + 18);

        doc.setFillColor(238, 242, 255);
        doc.setDrawColor(79, 70, 229);
        doc.roundedRect(155, startY, 45, 25, 3, 3, 'FD');
        doc.setFontSize(8);
        doc.setTextColor(79, 70, 229);
        doc.text("Resultado Bruto", 158, startY + 8);
        doc.setFontSize(11);
        doc.text(formatBRL(grossProfit), 158, startY + 18);

        const secondRowY = startY + 30;

        doc.setFillColor(254, 249, 195);
        doc.setDrawColor(202, 138, 4);
        doc.roundedRect(14, secondRowY, 92, 25, 3, 3, 'FD');
        doc.setFontSize(10);
        doc.setTextColor(161, 98, 7);
        doc.text(`Impostos Estimados (${(totalTaxRate * 100).toFixed(1)}%)`, 19, secondRowY + 8);
        doc.setFontSize(14);
        doc.text(formatBRL(estimatedTax), 19, secondRowY + 18);

        doc.setFillColor(236, 253, 245);
        doc.setDrawColor(5, 150, 105);
        doc.roundedRect(111, secondRowY, 85, 25, 3, 3, 'FD');
        doc.setFontSize(10);
        doc.setTextColor(5, 150, 105);
        doc.text("Resultado Líquido (Real)", 116, secondRowY + 8);
        doc.setFontSize(14);
        doc.text(formatBRL(netAfterTax), 116, secondRowY + 18);

        // Employee section in PDF
        if (employees.length > 0) {
            doc.setFont("helvetica", "normal");
            doc.setTextColor(40);
            doc.setFontSize(14);
            doc.text("Relatório de Funcionários", 14, secondRowY + 40);

            const empColumns = ["Funcionário", "Serviços", "Receita Gerada", "Comissão Total", "Comissão Pendente", "Média/Serviço", "Taxa %"];
            const empRows = employees.map(emp => [
                emp.name,
                emp.jobCount.toString(),
                formatBRL(emp.totalRevenue),
                formatBRL(emp.totalCommission),
                formatBRL(emp.pendingCommission),
                formatBRL(emp.avgPerJob),
                emp.commissionRate ? `${emp.commissionRate}%` : '-'
            ]);

            autoTable(doc, {
                startY: secondRowY + 45,
                head: [empColumns],
                body: empRows,
                theme: 'grid',
                headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: 'bold' },
                styles: { fontSize: 7, cellPadding: 2 },
                alternateRowStyles: { fillColor: [255, 251, 235] },
                columnStyles: {
                    2: { halign: 'right', fontStyle: 'bold' },
                    3: { halign: 'right' },
                    4: { halign: 'right', textColor: [225, 29, 72] },
                    5: { halign: 'right' }
                }
            });
        }

        // Transactions table
        const lastTableY = (doc as any).lastAutoTable?.finalY || secondRowY + 45;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(40);
        doc.setFontSize(14);
        doc.text("Detalhamento de Transações", 14, lastTableY + 15);

        const tableColumn = ["Data", "Descrição", "Categoria", "Valor", "Pendente", "Status", "Funcionário", "Comissão", "Pgto Comis."];
        const tableRows = filteredTransactions.map(t => {
            const [year, month, day] = t.date.split('-');
            let formattedCommDate = '-';
            if (t.commissionPaymentDate) {
                const [cYear, cMonth, cDay] = t.commissionPaymentDate.split('-');
                formattedCommDate = `${cDay}/${cMonth}/${cYear}`;
            }
            const isPartial = t.status === TransactionStatus.PARTIAL;
            const totalComm = t.commissionAmount || 0;
            let displayComm = totalComm;
            if (isPartial && t.pendingAmount && t.amount > t.pendingAmount) {
                const received = t.amount - t.pendingAmount;
                displayComm = totalComm * (received / t.amount);
            }
            return [
                `${day}/${month}/${year}`,
                t.description,
                t.category,
                formatBRL(t.amount),
                t.pendingAmount ? formatBRL(t.pendingAmount) : 'R$ 0,00',
                t.status,
                t.employeeName || '-',
                t.commissionAmount ? `${formatBRL(displayComm)}${isPartial ? ' (Prop.)' : ''}` : '-',
                formattedCommDate
            ];
        });

        autoTable(doc, {
            startY: lastTableY + 20,
            head: [tableColumn],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 6.5, cellPadding: 2 },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            columnStyles: {
                3: { halign: 'right', fontStyle: 'bold' },
                4: { halign: 'right', textColor: [225, 29, 72] },
                7: { halign: 'right' }
            }
        });

        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Página ${i} de ${pageCount} - FinNexus Enterprise System`, 105, 290, { align: 'center' });
        }

        doc.save(`Relatorio_Financeiro_FinNexus_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    // ===== RENDER =====
    return (
        <div className="space-y-8 w-full animate-fade-in pb-8">
            {/* Header & Filter */}
            <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6 border-b border-slate-200 dark:border-slate-700/40 pb-6">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Relatórios & Auditoria</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm font-medium">Emissão de documentos e análise fiscal.</p>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl inline-flex w-max border border-slate-200 dark:border-slate-700">
                        <button onClick={() => setViewMode('month')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'month' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Mensal</button>
                        <button onClick={() => setViewMode('day')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'day' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Diário</button>
                    </div>

                    {viewMode === 'month' ? (
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Mês Início */}
                            <div className="relative group min-w-[140px]">
                                <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 shadow-sm group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50 transition-colors cursor-pointer">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="h-4 w-4 text-indigo-500 shrink-0" />
                                        <span className="text-slate-700 dark:text-slate-200 font-bold text-sm capitalize">
                                            {format(parseISO(`${startMonth}-01`), 'MMM yyyy', { locale: ptBR })}
                                        </span>
                                    </div>
                                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                </div>
                                <input
                                    type="month"
                                    value={startMonth}
                                    onChange={handleStartMonthChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 appearance-none [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0"
                                    style={{ colorScheme: 'light' }}
                                />
                            </div>

                            <span className="text-slate-400 dark:text-slate-500 font-bold text-sm">até</span>

                            {/* Mês Fim */}
                            <div className="relative group min-w-[140px]">
                                <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 shadow-sm group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50 transition-colors cursor-pointer">
                                    <div className="flex items-center gap-1.5">
                                        <CalendarRange className="h-4 w-4 text-violet-500 shrink-0" />
                                        <span className="text-slate-700 dark:text-slate-200 font-bold text-sm capitalize">
                                            {format(parseISO(`${endMonth}-01`), 'MMM yyyy', { locale: ptBR })}
                                        </span>
                                    </div>
                                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                </div>
                                <input
                                    type="month"
                                    value={endMonth}
                                    onChange={handleEndMonthChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 appearance-none [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0"
                                    style={{ colorScheme: 'light' }}
                                />
                            </div>
                        </div>
                    ) : (
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 shadow-sm font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                        />
                    )}

                    <button
                        onClick={handleDownloadPDF}
                        disabled={!hasData}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all w-full sm:w-auto justify-center font-bold text-sm
                            ${hasData
                                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:from-indigo-700 hover:to-indigo-800 shadow-lg shadow-indigo-500/20 active:scale-[0.98]'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                            }`}
                    >
                        <FileText className="h-4 w-4" />
                        PDF
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white dark:bg-[#111a2e]/80 rounded-xl p-4 border border-slate-100 dark:border-slate-700/40 shadow-sm dark:shadow-none">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
                            <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Receita</span>
                    </div>
                    <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">{formatCompact(totalIncome)}</p>
                </div>

                <div className="bg-white dark:bg-[#111a2e]/80 rounded-xl p-4 border border-slate-100 dark:border-slate-700/40 shadow-sm dark:shadow-none">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-rose-50 dark:bg-rose-900/30 rounded-lg">
                            <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                        </div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Despesa</span>
                    </div>
                    <p className="text-lg font-extrabold text-rose-600 dark:text-rose-400">{formatCompact(totalExpense)}</p>
                </div>

                <div className="bg-white dark:bg-[#111a2e]/80 rounded-xl p-4 border border-slate-100 dark:border-slate-700/40 shadow-sm dark:shadow-none">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
                            <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Comissões</span>
                    </div>
                    <p className="text-lg font-extrabold text-amber-600 dark:text-amber-400">{formatCompact(totalCommissions)}</p>
                </div>

                <div className="bg-white dark:bg-[#111a2e]/80 rounded-xl p-4 border border-slate-100 dark:border-slate-700/40 shadow-sm dark:shadow-none">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
                            <Receipt className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Impostos</span>
                    </div>
                    <p className="text-lg font-extrabold text-yellow-600 dark:text-yellow-400">{formatCompact(estimatedTax)}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{(totalTaxRate * 100).toFixed(1)}% sobre receita</p>
                </div>

                <div className="bg-white dark:bg-[#111a2e]/80 rounded-xl p-4 border border-slate-100 dark:border-slate-700/40 shadow-sm dark:shadow-none">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                            <DollarSign className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Líquido</span>
                    </div>
                    <p className={`text-lg font-extrabold ${netAfterTax >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {formatCompact(netAfterTax)}
                    </p>
                </div>

                <div className="bg-white dark:bg-[#111a2e]/80 rounded-xl p-4 border border-slate-100 dark:border-slate-700/40 shadow-sm dark:shadow-none">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-violet-50 dark:bg-violet-900/30 rounded-lg">
                            <Percent className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                        </div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Margem</span>
                    </div>
                    <p className={`text-lg font-extrabold ${profitMargin >= 20 ? 'text-emerald-600 dark:text-emerald-400' : profitMargin >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {profitMargin.toFixed(1)}%
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">{profitMargin >= 20 ? 'Saudável' : profitMargin >= 10 ? 'Aceitável' : profitMargin >= 0 ? 'Baixa' : 'Negativa'}</p>
                </div>
            </div>

            {/* ===== FUNCIONÁRIOS & COMISSÕES ===== */}
            {employees.length > 0 && (
                <div className="bg-white dark:bg-[#111a2e]/80 dark:backdrop-blur-xl rounded-2xl shadow-sm dark:shadow-none border border-slate-100 dark:border-slate-700/40 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-700/40">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-xl">
                                    <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Funcionários & Comissões</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">Clique em um funcionário para ver o relatório completo</p>
                                </div>
                            </div>
                            <span className="text-xs font-bold px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
                                {employees.length} {employees.length === 1 ? 'funcionário' : 'funcionários'}
                            </span>
                        </div>
                    </div>

                    {/* Employee List */}
                    <div className="divide-y divide-slate-100 dark:divide-slate-700/30">
                        {employees.map((emp, idx) => (
                            <button
                                key={emp.name}
                                onClick={() => setSelectedEmployee(selectedEmployee === emp.name ? null : emp.name)}
                                className={`w-full p-4 md:p-5 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all text-left group
                                    ${selectedEmployee === emp.name ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
                            >
                                {/* Avatar */}
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                                    style={{ backgroundColor: EMPLOYEE_COLORS[idx % EMPLOYEE_COLORS.length] }}
                                >
                                    {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-slate-800 dark:text-white truncate">{emp.name}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        {emp.jobCount} {emp.jobCount === 1 ? 'serviço' : 'serviços'} • Média {formatBRL(emp.avgPerJob)}/serviço
                                    </p>
                                </div>

                                {/* Stats */}
                                <div className="hidden md:flex items-center gap-6">
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Receita</p>
                                        <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">{formatCompact(emp.totalRevenue)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Comissão</p>
                                        <p className="text-sm font-extrabold text-amber-600 dark:text-amber-400">{formatCompact(emp.totalCommission)}</p>
                                    </div>
                                    {emp.pendingCommission > 0 && (
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Pendente</p>
                                            <p className="text-sm font-extrabold text-rose-500">{formatCompact(emp.pendingCommission)}</p>
                                        </div>
                                    )}
                                </div>

                                <ChevronRight className={`h-5 w-5 text-slate-300 dark:text-slate-600 transition-transform ${selectedEmployee === emp.name ? 'rotate-90' : 'group-hover:translate-x-0.5'}`} />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ===== MODAL: RELATÓRIO DO FUNCIONÁRIO ===== */}
            {selectedEmp && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-[5vh] overflow-y-auto" onClick={() => setSelectedEmployee(null)}>
                    <div className="bg-white dark:bg-[#0d1526] rounded-2xl shadow-2xl dark:shadow-none border border-slate-200 dark:border-slate-700/40 w-full max-w-3xl max-h-[85vh] overflow-y-auto animate-fade-in" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-indigo-700 p-6 rounded-t-2xl text-white z-10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center font-bold text-lg">
                                        {selectedEmp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold">{selectedEmp.name}</h3>
                                        <p className="text-indigo-200 text-sm">Relatório Individual Completo</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedEmployee(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        {/* Stats Cards */}
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                                    <div className="flex items-center gap-2 mb-1">
                                        <ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Receita Gerada</span>
                                    </div>
                                    <p className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300">{formatBRL(selectedEmp.totalRevenue)}</p>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800/30">
                                    <div className="flex items-center gap-2 mb-1">
                                        <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">Comissão Total</span>
                                    </div>
                                    <p className="text-xl font-extrabold text-amber-700 dark:text-amber-300">{formatBRL(selectedEmp.totalCommission)}</p>
                                    {selectedEmp.commissionRate > 0 && (
                                        <p className="text-[10px] text-amber-500 font-medium mt-0.5">Taxa: {selectedEmp.commissionRate}%</p>
                                    )}
                                </div>
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Briefcase className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">Serviços</span>
                                    </div>
                                    <p className="text-xl font-extrabold text-indigo-700 dark:text-indigo-300">{selectedEmp.jobCount}</p>
                                    <p className="text-[10px] text-indigo-400 font-medium mt-0.5">Média: {formatBRL(selectedEmp.avgPerJob)}</p>
                                </div>
                                <div className={`p-4 rounded-xl border ${selectedEmp.totalVales > 0
                                        ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800/30'
                                        : 'bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-700/30'
                                    }`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                                        <span className={`text-[10px] font-bold uppercase ${selectedEmp.totalVales > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                                            Vales / Despesas
                                        </span>
                                    </div>
                                    <p className={`text-xl font-extrabold ${selectedEmp.totalVales > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-slate-300 dark:text-slate-600'}`}>
                                        {formatBRL(selectedEmp.totalVales)}
                                    </p>
                                </div>
                            </div>

                            {/* Transaction Table */}
                            <div>
                                <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                                    <Receipt className="h-4 w-4 text-indigo-500" />
                                    Todas as Transações de {selectedEmp.name}
                                    <span className="text-xs font-medium text-slate-400 ml-auto">{selectedEmp.transactions.length} registros</span>
                                </h4>
                                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/40">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-800/50 text-left">
                                                <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase">Data</th>
                                                <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase">Descrição</th>
                                                <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase">Tipo</th>
                                                <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase text-right">Valor</th>
                                                <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase text-right">Comissão</th>
                                                <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase">Status</th>
                                                <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase">Pgto Comis.</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
                                            {selectedEmp.transactions
                                                .sort((a, b) => b.date.localeCompare(a.date))
                                                .map((t, i) => (
                                                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">{formatDate(t.date)}</td>
                                                        <td className="px-4 py-3 text-slate-800 dark:text-white font-medium max-w-[200px] truncate">{t.description}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full
                                                                ${t.type === TransactionType.INCOME
                                                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                                    : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
                                                                }`}>
                                                                {t.type === TransactionType.INCOME ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                                                {t.type}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-white whitespace-nowrap">
                                                            {formatBRL(t.amount)}
                                                            {t.pendingAmount ? (
                                                                <span className="block text-[10px] text-rose-500 font-medium">Pend: {formatBRL(t.pendingAmount)}</span>
                                                            ) : null}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                                                            {t.commissionAmount ? formatBRL(t.commissionAmount) : '-'}
                                                            {t.commissionRate ? <span className="block text-[10px] text-slate-400">({t.commissionRate}%)</span> : null}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                                                                ${t.status === TransactionStatus.COMPLETED ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                                    : t.status === TransactionStatus.PENDING ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                                                        : t.status === TransactionStatus.PARTIAL ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                                                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                                                }`}>
                                                                {t.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                            {t.commissionPaymentDate ? formatDate(t.commissionPaymentDate) : '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico de Pizza */}
                <div className="bg-white dark:bg-[#111a2e]/80 dark:backdrop-blur-xl p-6 rounded-2xl shadow-sm dark:shadow-none border border-slate-100 dark:border-slate-700/40 flex flex-col min-h-[420px]">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Distribuição de Despesas</h3>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Por categoria de gasto</p>
                        </div>
                        {pieData.length > 0 && (
                            <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 rounded-full">
                                {pieData.length} categorias
                            </span>
                        )}
                    </div>
                    <div className="flex-1 w-full relative">
                        {hasData && pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={pieData} cx="50%" cy="45%" innerRadius={70} outerRadius={110} fill="#8884d8" paddingAngle={3} dataKey="value" label={renderPieLabel} labelLine={false}>
                                        {pieData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={2} stroke={isDark ? '#0c1222' : '#fff'} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend content={renderLegend} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-full mb-3">
                                    <PieIcon className="h-6 w-6 text-slate-300 dark:text-slate-600" />
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Adicione despesas para gerar a análise gráfica.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Coluna Direita */}
                <div className="space-y-6">
                    {/* Auditoria Fiscal */}
                    <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 p-8 rounded-2xl shadow-xl text-white relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-xl font-bold mb-1">Auditoria Automática</h3>
                            <p className="text-indigo-200/70 text-sm mb-6">Análise fiscal ref. ao período selecionado ({filteredTransactions.length} registros).</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                                    <span className="text-[11px] text-indigo-300/80 uppercase tracking-wider font-bold">Lucro Bruto</span>
                                    <div className={`text-xl font-extrabold mt-1 ${grossProfit >= 0 ? 'text-white' : 'text-rose-400'}`}>{formatBRL(grossProfit)}</div>
                                </div>
                                <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                                    <span className="text-[11px] text-amber-300/80 uppercase tracking-wider font-bold">Impostos ({(totalTaxRate * 100).toFixed(1)}%)</span>
                                    <div className="text-xl font-extrabold mt-1 text-amber-400">{formatBRL(estimatedTax)}</div>
                                </div>
                                <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                                    <span className="text-[11px] text-emerald-300/80 uppercase tracking-wider font-bold">Resultado Líquido</span>
                                    <div className={`text-xl font-extrabold mt-1 ${netAfterTax >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatBRL(netAfterTax)}</div>
                                </div>
                                <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                                    <span className="text-[11px] text-violet-300/80 uppercase tracking-wider font-bold">Pendências</span>
                                    <div className={`text-xl font-extrabold mt-1 ${pendingTotal > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{formatBRL(pendingTotal)}</div>
                                </div>
                            </div>
                        </div>
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600 rounded-full blur-3xl opacity-20 -mr-16 -mt-16"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-600 rounded-full blur-2xl opacity-20 -ml-10 -mb-10"></div>
                    </div>

                    {/* Gráfico de Barras */}
                    <div className="bg-white dark:bg-[#111a2e]/80 dark:backdrop-blur-xl p-6 rounded-2xl shadow-sm dark:shadow-none border border-slate-100 dark:border-slate-700/40">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Balanço Geral</h3>
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Comparativo financeiro completo</p>
                            </div>
                        </div>
                        <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={barData} margin={{ left: 10, right: 60 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: isDark ? '#94a3b8' : '#64748b' }} width={85} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} />
                                    <Bar dataKey="value" barSize={28} radius={[0, 6, 6, 0]} background={{ fill: isDark ? '#1e293b40' : '#f8fafc', radius: 6 }}>
                                        {barData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                        <LabelList dataKey="value" position="right" formatter={(val: number) => formatCompact(val)} style={{ fontSize: 11, fontWeight: 700, fill: isDark ? '#94a3b8' : '#64748b' }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reports;