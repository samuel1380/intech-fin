import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Transaction, TransactionType, TransactionCategory, TransactionStatus } from '../types';
import { Plus, Search, Trash2, Download, ChevronLeft, ChevronRight, CheckCircle, Clock, Filter, X, ArrowUpDown, Edit2, AlertCircle, RefreshCw, Check, Users, UserPlus, ChevronDown, Layers } from 'lucide-react';
import { format, addDays } from 'date-fns';

interface Props {
    transactions: Transaction[];
    onAddTransaction: (t: Omit<Transaction, 'id'>) => Promise<void>;
    onDeleteTransaction: (id: string) => Promise<void>;
    onUpdateStatus: (id: string, status: TransactionStatus) => Promise<void>;
    onUpdateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
}

const ITEMS_PER_PAGE = 10;

const TransactionList: React.FC<Props> = ({ transactions, onAddTransaction, onDeleteTransaction, onUpdateStatus, onUpdateTransaction }) => {
    const [filter, setFilter] = useState('ALL');
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
    const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
    const [employeeSearch, setEmployeeSearch] = useState('');
    const employeeDropdownRef = useRef<HTMLDivElement>(null);

    // Extrair funcionários únicos das transações existentes
    const savedEmployees = useMemo(() => {
        const names = transactions
            .map(t => t.employeeName)
            .filter((name): name is string => !!name && name.trim() !== '');
        return [...new Set(names)].sort();
    }, [transactions]);

    // Filtrar funcionários pela busca
    const filteredEmployees = useMemo(() => {
        if (!employeeSearch) return savedEmployees;
        return savedEmployees.filter(name =>
            name.toLowerCase().includes(employeeSearch.toLowerCase())
        );
    }, [savedEmployees, employeeSearch]);

    // Fechar dropdown ao clicar fora
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(e.target as Node)) {
                setShowEmployeeDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const [formData, setFormData] = useState({
        description: '',
        amount: '',
        type: TransactionType.EXPENSE,
        category: TransactionCategory.OPERATIONS,
        date: format(new Date(), 'yyyy-MM-dd'),
        status: TransactionStatus.COMPLETED,
        employeeName: '',
        commissionRate: '',
        commissionAmount: '',
        commissionPaymentDate: '',
        pendingAmount: '',
        isRecurring: false,
        recurringIntervalMonths: '1',
        recurringDay: new Date().getDate().toString()
    });

    const filtered = transactions.filter(t => {
        const matchesFilter = filter === 'ALL' || t.type === filter;
        const matchesSearch = t.description.toLowerCase().includes(search.toLowerCase()) ||
            t.category.toLowerCase().includes(search.toLowerCase()) ||
            (t.employeeName && t.employeeName.toLowerCase().includes(search.toLowerCase()));
        return matchesFilter && matchesSearch;
    });

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paginatedTransactions = filtered.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handleEdit = (t: Transaction) => {
        setIsEditing(true);
        setEditingId(t.id);
        setFormData({
            description: t.description,
            amount: t.amount.toString(),
            type: t.type,
            category: t.category,
            date: t.date,
            status: t.status,
            employeeName: t.employeeName || '',
            commissionRate: t.commissionRate?.toString() || '',
            commissionAmount: t.commissionAmount?.toString() || '',
            commissionPaymentDate: t.commissionPaymentDate || '',
            pendingAmount: t.pendingAmount?.toString() || '',
            isRecurring: t.isRecurring || false,
            recurringIntervalMonths: t.recurringIntervalMonths?.toString() || '1',
            recurringDay: t.recurringDay?.toString() || new Date().getDate().toString()
        });
        setShowModal(true);
    };

    const resetForm = () => {
        setFormData({
            description: '',
            amount: '',
            type: TransactionType.EXPENSE,
            category: TransactionCategory.OPERATIONS,
            date: format(new Date(), 'yyyy-MM-dd'), // Data de Vencimento
            serviceDate: format(new Date(), 'yyyy-MM-dd'), // Data do Serviço
            status: TransactionStatus.COMPLETED,
            employeeName: '',
            commissionRate: '',
            commissionAmount: '',
            commissionPaymentDate: '',
            pendingAmount: '',
            isRecurring: false,
            recurringIntervalMonths: '1',
            recurringDay: new Date().getDate().toString(),
            isInstallment: false,
            installCount: '2',
            installInterval: '30'
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const baseData: any = {
                description: formData.description,
                amount: parseFloat(formData.amount),
                type: formData.type,
                category: formData.category as TransactionCategory,
                date: formData.date,
                serviceDate: formData.serviceDate,
                status: formData.status as TransactionStatus,
                employeeName: formData.employeeName || undefined,
                commissionRate: formData.commissionRate ? parseFloat(formData.commissionRate) : undefined,
                commissionAmount: formData.commissionAmount ? parseFloat(formData.commissionAmount) : undefined,
                commissionPaymentDate: formData.commissionPaymentDate || undefined,
                pendingAmount: formData.pendingAmount && parseFloat(formData.pendingAmount) > 0 ? parseFloat(formData.pendingAmount) : undefined,
                isRecurring: formData.isRecurring || undefined,
                recurringIntervalMonths: formData.isRecurring ? parseInt(formData.recurringIntervalMonths) : undefined,
                recurringDay: formData.isRecurring ? parseInt(formData.recurringDay) : undefined,
            };

            if (isEditing && editingId) {
                await onUpdateTransaction(editingId, baseData);
            } else {
                if (formData.isInstallment && !formData.isRecurring) {
                    const count = parseInt(formData.installCount) || 1;
                    const interval = parseInt(formData.installInterval) || 30;
                    const totalAmount = baseData.amount;
                    const totalCommission = baseData.commissionAmount || 0;
                    const totalPending = baseData.pendingAmount !== undefined ? baseData.pendingAmount : (baseData.status === TransactionStatus.PENDING ? totalAmount : 0);
                    
                    const amountPerInstallment = parseFloat((totalAmount / count).toFixed(2));
                    const commissionPerInstallment = parseFloat((totalCommission / count).toFixed(2));
                    const pendingPerInstallment = parseFloat((totalPending / count).toFixed(2));
                    
                    let createdAmount = 0;
                    let createdCommission = 0;
                    let createdPending = 0;

                    let [y, m, d] = formData.date.split('-').map(Number);
                    let firstDueDate = new Date(y, m - 1, d);

                    for (let i = 1; i <= count; i++) {
                        const isLast = i === count;
                        const instAmount = isLast ? parseFloat((totalAmount - createdAmount).toFixed(2)) : amountPerInstallment;
                        const instCommission = isLast && totalCommission > 0 ? parseFloat((totalCommission - createdCommission).toFixed(2)) : commissionPerInstallment;
                        const instPending = isLast && totalPending > 0 ? parseFloat((totalPending - createdPending).toFixed(2)) : pendingPerInstallment;
                        
                        createdAmount += instAmount;
                        createdCommission += instCommission;
                        createdPending += instPending;

                        const dueDate = addDays(firstDueDate, (i - 1) * interval);

                        await onAddTransaction({
                            ...baseData,
                            description: `${baseData.description} (Parcela ${i}/${count})`,
                            amount: instAmount,
                            commissionAmount: totalCommission > 0 ? instCommission : undefined,
                            pendingAmount: totalPending > 0 ? instPending : undefined,
                            date: format(dueDate, 'yyyy-MM-dd')
                        });
                    }
                } else {
                    await onAddTransaction(baseData);
                }
            }

            setShowModal(false);
            setIsEditing(false);
            setEditingId(null);
            resetForm();
        } catch (error: any) {
            console.error('Erro ao salvar transação:', error);
            alert(`Erro ao salvar: ${error.message || 'Erro desconhecido'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ===== MARCAR COMO PAGO =====
    const handleMarkAsPaid = async (t: Transaction) => {
        setMarkingPaidId(t.id);
        try {
            const updates: Partial<Transaction> = {
                status: TransactionStatus.COMPLETED,
                pendingAmount: undefined,
            };
            await onUpdateTransaction(t.id, updates);
        } catch (error: any) {
            alert(`Erro ao marcar como pago: ${error.message}`);
        } finally {
            setMarkingPaidId(null);
        }
    };

    const handleExportCSV = () => {
        const excelSeparator = 'sep=;';
        const headers = ['ID;Data;Descrição;Categoria;Tipo;Valor;Status;Funcionário;Comissão;Data Pagto Comissão;Valor Pendente;Recorrente'];

        const rows = filtered.map(t => {
            const [year, month, day] = t.date.split('-');
            const formattedDate = `${day}/${month}/${year}`;

            let formattedCommDate = '';
            if (t.commissionPaymentDate) {
                const [cYear, cMonth, cDay] = t.commissionPaymentDate.split('-');
                formattedCommDate = `${cDay}/${cMonth}/${cYear}`;
            }

            const formattedAmount = t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const formattedCommission = t.commissionAmount
                ? t.commissionAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '0,00';
            const formattedPending = t.pendingAmount
                ? t.pendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '0,00';
            const recurring = t.isRecurring ? `Sim (${t.recurringIntervalMonths}m dia ${t.recurringDay})` : 'Não';

            return `${t.id.substring(0, 8)};${formattedDate};"${t.description.replace(/"/g, '""')}";${t.category};${t.type};${formattedAmount};${t.status};"${t.employeeName || ''}";${formattedCommission};${formattedCommDate};${formattedPending};${recurring}`;
        });

        const csvContent = "\uFEFF" + excelSeparator + "\n" + [headers, ...rows].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `transacoes_${format(new Date(), 'dd-MM-yyyy')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    // Check if a transaction can be marked as paid
    const canMarkAsPaid = (t: Transaction) => {
        return t.type === TransactionType.EXPENSE && t.status !== TransactionStatus.COMPLETED;
    };

    return (<div className="space-y-5 animate-fade-in w-full pb-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pb-5">
            <div>
                <h2 className="text-[22px] font-bold text-[#0F172A] dark:text-white tracking-tight">Atividades Recentes</h2>
                <p className="text-[#94A3B8] dark:text-slate-400 mt-1 font-medium text-[13px]">Controle de caixa e histórico financeiro.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
                <button
                    onClick={handleExportCSV}
                    className="flex items-center justify-center px-6 py-3 bg-white dark:bg-slate-800/60 border border-[#EEF2F7] dark:border-slate-700/40 text-[#0F172A] dark:text-slate-200 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 shadow-sm font-bold text-[13px] w-full sm:w-auto"
                >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                </button>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center justify-center px-6 py-3 bg-finexyBlack dark:bg-white text-white dark:text-slate-900 rounded-full hover:opacity-90 transition-all duration-200 shadow-md font-bold text-[13px] w-full sm:w-auto"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Novo
                </button>
            </div>
        </div>

        {/* Main Table Card */}
        <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-premium dark:shadow-none border border-[#EEF2F7] dark:border-white/[0.06] overflow-hidden w-full flex flex-col h-[650px] p-2">
            
            {/* Inner Header with Search */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-4 sm:px-6 py-5 border-b border-[#EEF2F7] dark:border-white/[0.06]">
                <h3 className="font-bold text-slate-800 dark:text-white text-[16px]">Atividades</h3>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            className="w-full sm:w-48 pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600/50 rounded-full text-[13px] focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-600 transition-all text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-400"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-600/50 rounded-full text-slate-600 dark:text-slate-300 text-[13px] font-bold hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        Filter <Filter className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            <div className="overflow-auto custom-scrollbar flex-1 relative px-2">
                <table className="hidden md:table w-full text-left border-collapse min-w-[900px]">
                    <thead className="bg-white dark:bg-slate-800 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-4 text-[12px] font-semibold text-slate-400 border-b border-slate-100 dark:border-slate-700/50 w-[120px]">Data</th>
                            <th className="px-6 py-4 text-[12px] font-semibold text-slate-400 border-b border-slate-100 dark:border-slate-700/50">Atividade</th>
                            <th className="px-6 py-4 text-[12px] font-semibold text-slate-400 border-b border-slate-100 dark:border-slate-700/50 w-[150px]">Categoria</th>
                            <th className="px-6 py-4 text-[12px] font-semibold text-slate-400 border-b border-slate-100 dark:border-slate-700/50 w-[150px]">Preço</th>
                            <th className="px-6 py-4 text-[12px] font-semibold text-slate-400 border-b border-slate-100 dark:border-slate-700/50 w-[140px]">Status</th>
                            <th className="px-6 py-4 text-[12px] font-semibold text-slate-400 border-b border-slate-100 dark:border-slate-700/50 w-[100px] text-center"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/30">
                        {paginatedTransactions.map((t) => {
                            const [year, month, day] = t.date.split('-');
                            const isPending = canMarkAsPaid(t);
                            return (
                                <tr key={t.id} className="hover:bg-[#F8F9FC]/60 dark:hover:bg-white/[0.02] transition-colors duration-150 group table-row-hover">
                                    <td className="px-6 py-4 text-[#64748B] font-medium tabular-nums text-[13px]">{day}/{month}/{year}</td>
                                    <td className="px-6 py-4 font-medium text-[#0F172A] dark:text-slate-200 text-[13px]">
                                        <div className="flex items-center gap-2">
                                            {t.description}
                                            {t.isRecurring && (
                                                <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-full border border-purple-100 dark:border-purple-800/40">
                                                    <RefreshCw className="h-2.5 w-2.5" />
                                                    {t.recurringIntervalMonths === 1 ? 'Mensal' : `${t.recurringIntervalMonths}m`}
                                                </span>
                                            )}
                                        </div>
                                        {t.employeeName && (
                                            <div className="text-[10px] text-indigo-500 font-medium uppercase mt-1 flex flex-col">
                                                <span>Técnico: {t.employeeName}</span>
                                                {t.commissionPaymentDate && (
                                                    <span className="text-[#94A3B8] normal-case font-medium">
                                                        Pagto Comissão: {format(new Date(t.commissionPaymentDate + 'T12:00:00'), 'dd/MM/yyyy')}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        {t.pendingAmount && t.pendingAmount > 0 && (
                                            <div className="text-[10px] text-rose-500 font-semibold uppercase mt-0.5">
                                                Pendente: {t.pendingAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#F8F9FC] dark:bg-slate-800/40 text-[#64748B] dark:text-slate-300 border border-[#EEF2F7] dark:border-slate-700/30 whitespace-nowrap">
                                            {t.category}
                                        </span>
                                    </td>
                                    <td className={`px-6 py-5 font-bold font-mono text-[14px] ${t.type === TransactionType.INCOME ? 'text-slate-800 dark:text-white' : 'text-slate-800 dark:text-white'}`}>
                                        {formatBRL(t.amount)}
                                    </td>
                                    <td className="px-6 py-5 text-left">
                                        <button
                                            onClick={() => {
                                                const nextStatus = t.status === TransactionStatus.COMPLETED ? TransactionStatus.PENDING :
                                                    t.status === TransactionStatus.PENDING ? TransactionStatus.PARTIAL :
                                                        TransactionStatus.COMPLETED;
                                                onUpdateStatus(t.id, nextStatus);
                                            }}
                                            className="flex items-center gap-2 text-[12px] font-bold text-slate-700 dark:text-slate-300 transition-opacity hover:opacity-70"
                                        >
                                            <div className={`w-2 h-2 rounded-full ${
                                                t.status === TransactionStatus.COMPLETED ? 'bg-emerald-500' :
                                                t.status === TransactionStatus.PARTIAL ? 'bg-amber-500' :
                                                'bg-rose-500'
                                            }`}></div>
                                            {t.status === TransactionStatus.COMPLETED ? 'Concluído' :
                                             t.status === TransactionStatus.PARTIAL ? 'Em Andamento' : 'Pendente'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            {/* Botão Marcar como Pago */}
                                            {isPending && (
                                                <button
                                                    onClick={() => handleMarkAsPaid(t)}
                                                    disabled={markingPaidId === t.id}
                                                    className="p-2 text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-[10px] transition-all duration-200 disabled:opacity-50"
                                                    title="Marcar como Pago"
                                                >
                                                    {markingPaidId === t.id ? (
                                                        <div className="w-4 h-4 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin"></div>
                                                    ) : (
                                                        <Check className="h-4 w-4" />
                                                    )}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleEdit(t)}
                                                className="p-2 text-[#94A3B8] hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-[10px] transition-all duration-200 lg:opacity-0 group-hover:opacity-100"
                                                title="Editar Registro"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => onDeleteTransaction(t.id)}
                                                className="p-2 text-[#94A3B8] hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-[10px] transition-all duration-200 lg:opacity-0 group-hover:opacity-100"
                                                title="Excluir Registro"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>

                {/* Mobile Cards View */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedTransactions.map(t => {
                        const [year, month, day] = t.date.split('-');
                        const isPending = canMarkAsPaid(t);
                        return (
                            <div key={t.id} className="p-4 flex flex-col gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold text-slate-500">{day}/{month}/{year}</span>
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600/50 truncate">{t.category}</span>
                                        </div>
                                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm leading-snug break-words">{t.description}</h4>
                                        {t.isRecurring && (
                                            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 mt-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-md border border-purple-200 dark:border-purple-800/50 w-fit">
                                                <RefreshCw className="h-2.5 w-2.5" />
                                                {t.recurringIntervalMonths === 1 ? 'Mensal' : `${t.recurringIntervalMonths}m`}
                                            </span>
                                        )}
                                        {t.employeeName && (
                                            <div className="text-[10px] text-indigo-500 font-bold uppercase mt-1.5 flex flex-col">
                                                <span>Téc: {t.employeeName}</span>
                                                {t.commissionPaymentDate && (
                                                    <span className="text-slate-400 normal-case font-medium">Pagto: {format(new Date(t.commissionPaymentDate + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end shrink-0 gap-1.5">
                                        <span className={`font-bold font-mono text-base ${t.type === TransactionType.INCOME ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                            {t.type === TransactionType.INCOME ? '+' : '-'}{formatBRL(t.amount)}
                                        </span>
                                        <button
                                            onClick={() => {
                                                const nextStatus = t.status === TransactionStatus.COMPLETED ? TransactionStatus.PENDING :
                                                    t.status === TransactionStatus.PENDING ? TransactionStatus.PARTIAL :
                                                        TransactionStatus.COMPLETED;
                                                onUpdateStatus(t.id, nextStatus);
                                            }}
                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all border shadow-sm ${t.status === TransactionStatus.COMPLETED ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/50' :
                                                    t.status === TransactionStatus.PARTIAL ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50' :
                                                        'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800/50'
                                                }`}
                                        >
                                            {t.status === TransactionStatus.COMPLETED ? <CheckCircle className="w-3 h-3" /> :
                                                t.status === TransactionStatus.PARTIAL ? <AlertCircle className="w-3 h-3" /> :
                                                    <Clock className="w-3 h-3" />}
                                            {t.status}
                                        </button>
                                        {t.pendingAmount && t.pendingAmount > 0 && (
                                            <span className="text-[10px] text-rose-500 font-bold mt-0.5">Pend: {formatBRL(t.pendingAmount)}</span>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Ações mobile */}
                                <div className="flex items-center justify-end gap-2 pt-3 mt-1 border-t border-slate-100 dark:border-slate-800/50">
                                    {isPending && (
                                        <button
                                            onClick={() => handleMarkAsPaid(t)}
                                            disabled={markingPaidId === t.id}
                                            className="flex-1 flex justify-center items-center py-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-lg font-bold text-xs gap-1.5 transition-colors"
                                        >
                                            {markingPaidId === t.id ? (
                                                <div className="w-3 h-3 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin"></div>
                                            ) : (
                                                <Check className="h-3.5 w-3.5" />
                                            )}
                                            Marcar Pago
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleEdit(t)}
                                        className="flex-1 py-2 px-3 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-lg transition-colors flex items-center justify-center gap-1.5 text-xs font-bold"
                                    >
                                        <Edit2 className="h-3.5 w-3.5" /> Editar
                                    </button>
                                    <button
                                        onClick={() => onDeleteTransaction(t.id)}
                                        className="flex-[0.5] py-2 px-3 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50 rounded-lg transition-colors flex items-center justify-center gap-1.5 text-xs font-bold"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Pagination */}
            {filtered.length > 0 ? (
                <div className="px-6 py-4 border-t border-[#EEF2F7] dark:border-white/[0.06] flex items-center justify-between bg-[#F8F9FC]/50 dark:bg-[#0B1120]/50 shrink-0">
                    <span className="text-[11px] font-medium text-[#94A3B8]">
                        Mostrando <span className="text-[#0F172A] dark:text-slate-200">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span className="text-[#0F172A] dark:text-slate-200">{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</span> de <span className="text-[#0F172A] dark:text-slate-200">{filtered.length}</span>
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-[10px] border border-[#EEF2F7] dark:border-slate-700/40 bg-white dark:bg-slate-800/60 hover:bg-[#F8F9FC] dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-[#64748B] dark:text-slate-300 shadow-sm transition-all duration-200 hover:shadow-md"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-[10px] border border-[#EEF2F7] dark:border-slate-700/40 bg-white dark:bg-slate-800/60 hover:bg-[#F8F9FC] dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-[#64748B] dark:text-slate-300 shadow-sm transition-all duration-200 hover:shadow-md"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="p-16 text-center text-[#94A3B8] flex flex-col items-center justify-center flex-1">
                    <div className="p-4 bg-[#F8F9FC] dark:bg-slate-800/30 rounded-full mb-4">
                        <Search className="h-6 w-6 text-[#CBD5E1] dark:text-slate-600" />
                    </div>
                    <h3 className="text-[#0F172A] dark:text-slate-200 font-semibold mb-1 text-[15px]">Nenhum resultado</h3>
                    <p className="text-[13px] font-medium">Tente ajustar seus filtros ou busca.</p>
                </div>
            )}
        </div>

        {/* Add/Edit Modal */}
        {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md p-4 animate-fade-in">
                <div className="bg-white dark:bg-[#0F172A] border border-[#EEF2F7] dark:border-white/[0.06] rounded-[24px] shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up max-h-[90vh] overflow-y-auto">
                    <div className="px-6 py-5 border-b border-[#EEF2F7] dark:border-white/[0.06] flex justify-between items-center bg-white dark:bg-[#0F172A] sticky top-0 z-10">
                        <div>
                            <h3 className="text-lg font-semibold text-[#0F172A] dark:text-white">
                                {isEditing ? 'Editar Lançamento' : 'Novo Lançamento'}
                            </h3>
                            <p className="text-[11px] text-[#94A3B8] dark:text-slate-400 mt-0.5 font-medium">
                                {isEditing ? 'Atualize os detalhes da transação.' : 'Preencha os detalhes da transação.'}
                            </p>
                        </div>
                        <button onClick={() => { setShowModal(false); setIsEditing(false); setEditingId(null); resetForm(); }} className="p-2 bg-[#F8F9FC] dark:bg-slate-800 hover:bg-[#EEF2F7] dark:hover:bg-slate-700 rounded-full text-[#64748B] dark:text-slate-400 transition-colors duration-200">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        {/* Transaction Type Toggle */}
                        <div className="p-1 bg-[#F8F9FC] dark:bg-slate-800/60 rounded-[14px] grid grid-cols-2 gap-1">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, type: TransactionType.INCOME })}
                                className={`py-2.5 rounded-[10px] text-[13px] font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${formData.type === TransactionType.INCOME
                                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                    : 'text-[#64748B] dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'
                                    }`}
                            >
                                <span className={`w-2 h-2 rounded-full ${formData.type === TransactionType.INCOME ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                                Receita
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, type: TransactionType.EXPENSE })}
                                className={`py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${formData.type === TransactionType.EXPENSE
                                    ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400'
                                    }`}
                            >
                                <span className={`w-2 h-2 rounded-full ${formData.type === TransactionType.EXPENSE ? 'bg-rose-500' : 'bg-slate-300'}`}></span>
                                Despesa
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Descrição</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Ex: Pagamento Fornecedor XYZ"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Valor (R$)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                                        <input
                                            required
                                            type="number"
                                            step="0.01"
                                            className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-mono font-bold text-slate-800 dark:text-slate-200"
                                            value={formData.amount}
                                            onChange={e => {
                                                const val = e.target.value;
                                                const rate = formData.commissionRate;
                                                const commAmount = val && rate ? (parseFloat(val) * parseFloat(rate) / 100).toFixed(2) : formData.commissionAmount;
                                                setFormData({ ...formData, amount: val, commissionAmount: commAmount });
                                            }}
                                            placeholder="0,00"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Data do Serviço / Lançamento</label>
                                    <input
                                        required
                                        type="date"
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-medium text-slate-700 dark:text-slate-200"
                                        value={formData.serviceDate}
                                        onChange={e => setFormData({ ...formData, serviceDate: e.target.value })}
                                        title="Quando o serviço foi executado ou a despesa contraída"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Data do Vencimento / Pagamento</label>
                                    <input
                                        required
                                        type="date"
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-medium text-slate-700 dark:text-slate-200"
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                        title="Quando essa conta vence ou foi paga"
                                    />
                                </div>
                            </div>
                            
                            {/* ===== SEÇÃO: PARCELAMENTO ===== */}
                            {!isEditing && !formData.isRecurring && (
                                <div className="p-4 bg-sky-50/50 dark:bg-sky-900/10 rounded-2xl border border-sky-100 dark:border-sky-800/50 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <Layers className="h-3 w-3" />
                                            Pagamento Parcelado / Múltiplos Boletos?
                                        </h4>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, isInstallment: !formData.isInstallment })}
                                            className={`relative w-11 h-6 rounded-full transition-all duration-200 ${formData.isInstallment
                                                ? 'bg-sky-600'
                                                : 'bg-slate-200 dark:bg-slate-700'
                                                }`}
                                        >
                                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${formData.isInstallment ? 'translate-x-5' : ''}`}></div>
                                        </button>
                                    </div>

                                    {formData.isInstallment && (
                                        <div className="grid grid-cols-2 gap-4 animate-fade-in">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Qtd. de Parcelas</label>
                                                <input
                                                    type="number"
                                                    min="2"
                                                    max="72"
                                                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none transition-all font-medium text-slate-800 dark:text-slate-200"
                                                    value={formData.installCount}
                                                    onChange={e => setFormData({ ...formData, installCount: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Intervalo (Dias)</label>
                                                <div className="relative">
                                                    <select
                                                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none transition-all text-sm font-medium text-slate-700 dark:text-slate-200 appearance-none"
                                                        value={formData.installInterval}
                                                        onChange={e => setFormData({ ...formData, installInterval: e.target.value })}
                                                    >
                                                        <option value="7">Semanal (7 dias)</option>
                                                        <option value="15">Quinzenal (15 dias)</option>
                                                        <option value="30">Mensal (30 dias)</option>
                                                        <option value="45">45 dias</option>
                                                        <option value="60">Bimestral (60 dias)</option>
                                                    </select>
                                                    <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                                </div>
                                            </div>
                                            <p className="col-span-2 text-[10px] text-sky-500 dark:text-sky-400 italic ml-1 leading-relaxed">
                                                * O valor total de {formatBRL(parseFloat(formData.amount || '0'))} será dividido em {formData.installCount} boletos/parcelas.<br />
                                                * O primeiro vencimento será na "Data do Vencimento" preenchida acima ({formData.date.split('-').reverse().join('/')}).
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Categoria</label>
                                    <div className="relative">
                                        <select
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm font-medium text-slate-700 dark:text-slate-200 appearance-none"
                                            value={formData.category}
                                            onChange={e => setFormData({ ...formData, category: e.target.value as TransactionCategory })}
                                        >
                                            <optgroup label="Serviços de Desentupidora">
                                                <option value={TransactionCategory.SERVICE_PIA}>Pia</option>
                                                <option value={TransactionCategory.SERVICE_RALO}>Ralo</option>
                                                <option value={TransactionCategory.SERVICE_ESGOTO}>Esgoto</option>
                                                <option value={TransactionCategory.SERVICE_VASO}>Vaso Sanitário</option>
                                                <option value={TransactionCategory.SERVICE_CAIXA_GORDURA}>Caixa de Gordura</option>
                                                <option value={TransactionCategory.SERVICE_COLUNA}>Coluna de Prédio</option>
                                                <option value={TransactionCategory.SERVICE_HIDROJATEAMENTO}>Hidrojateamento</option>
                                                <option value={TransactionCategory.SERVICE_OUTROS}>Outros Serviços</option>
                                            </optgroup>
                                            <optgroup label="Outras Categorias">
                                                <option value={TransactionCategory.SALES}>Vendas</option>
                                                <option value={TransactionCategory.OPERATIONS}>Operacional</option>
                                                <option value={TransactionCategory.PAYROLL}>Folha de Pagamento</option>
                                                <option value={TransactionCategory.MARKETING}>Marketing</option>
                                                <option value={TransactionCategory.TAXES}>Impostos</option>
                                                <option value={TransactionCategory.SOFTWARE}>Software/SaaS</option>
                                                <option value={TransactionCategory.OFFICE}>Escritório</option>
                                                <option value={TransactionCategory.INVESTMENT}>Investimentos</option>
                                                <option value={TransactionCategory.PERSONAL}>Pessoal</option>
                                                <option value={TransactionCategory.OTHER}>Outros</option>
                                            </optgroup>
                                        </select>
                                        <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Status</label>
                                    <div className="relative">
                                        <select
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm font-medium text-slate-700 dark:text-slate-200 appearance-none"
                                            value={formData.status}
                                            onChange={e => setFormData({ ...formData, status: e.target.value as TransactionStatus })}
                                        >
                                            <option value={TransactionStatus.COMPLETED}>Concluído</option>
                                            <option value={TransactionStatus.PENDING}>Pendente</option>
                                            <option value={TransactionStatus.PARTIAL}>Pagto Parcial</option>
                                        </select>
                                        <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            {/* ===== SEÇÃO: DESPESA RECORRENTE ===== */}
                            {formData.type === TransactionType.EXPENSE && (
                                <div className="p-4 bg-purple-50/50 dark:bg-purple-900/10 rounded-2xl border border-purple-100 dark:border-purple-800/50 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <RefreshCw className="h-3 w-3" />
                                            Despesa Recorrente
                                        </h4>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, isRecurring: !formData.isRecurring })}
                                            className={`relative w-11 h-6 rounded-full transition-all duration-200 ${formData.isRecurring
                                                ? 'bg-purple-600'
                                                : 'bg-slate-200 dark:bg-slate-700'
                                                }`}
                                        >
                                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${formData.isRecurring ? 'translate-x-5' : ''
                                                }`}></div>
                                        </button>
                                    </div>

                                    {formData.isRecurring && (
                                        <div className="grid grid-cols-2 gap-4 animate-fade-in">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Repetir a cada</label>
                                                <div className="relative">
                                                    <select
                                                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all text-sm font-medium text-slate-700 dark:text-slate-200 appearance-none"
                                                        value={formData.recurringIntervalMonths}
                                                        onChange={e => setFormData({ ...formData, recurringIntervalMonths: e.target.value })}
                                                    >
                                                        <option value="1">1 mês</option>
                                                        <option value="2">2 meses</option>
                                                        <option value="3">3 meses</option>
                                                        <option value="6">6 meses</option>
                                                        <option value="12">12 meses (anual)</option>
                                                    </select>
                                                    <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Dia do Vencimento</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="28"
                                                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all font-mono font-bold text-slate-800 dark:text-slate-200"
                                                    value={formData.recurringDay}
                                                    onChange={e => setFormData({ ...formData, recurringDay: e.target.value })}
                                                    placeholder="10"
                                                />
                                            </div>
                                            <p className="col-span-2 text-[10px] text-purple-500 dark:text-purple-400 italic ml-1">
                                                * A despesa será lançada automaticamente todo dia {formData.recurringDay || '?'} a cada {formData.recurringIntervalMonths === '1' ? 'mês' : `${formData.recurringIntervalMonths} meses`} como PENDENTE.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Campos de Funcionário, Comissão e Pendência */}
                            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 space-y-4">
                                <h4 className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Users className="h-3 w-3" />
                                    Equipe, Comissão & Pagamento
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2" ref={employeeDropdownRef}>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Funcionário</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                className="w-full px-4 py-3 pr-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                                                value={formData.employeeName}
                                                onChange={e => {
                                                    setFormData({ ...formData, employeeName: e.target.value });
                                                    setEmployeeSearch(e.target.value);
                                                    setShowEmployeeDropdown(true);
                                                }}
                                                onFocus={() => {
                                                    setEmployeeSearch(formData.employeeName);
                                                    setShowEmployeeDropdown(true);
                                                }}
                                                placeholder={savedEmployees.length > 0 ? 'Selecione ou digite um nome' : 'Nome do técnico'}
                                            />
                                            {savedEmployees.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowEmployeeDropdown(!showEmployeeDropdown)}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-indigo-500 transition-colors rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                                                >
                                                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showEmployeeDropdown ? 'rotate-180' : ''}`} />
                                                </button>
                                            )}

                                            {/* Dropdown de funcionários salvos */}
                                            {showEmployeeDropdown && savedEmployees.length > 0 && (
                                                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-fade-in">
                                                    <div className="max-h-48 overflow-y-auto">
                                                        {filteredEmployees.length > 0 ? (
                                                            filteredEmployees.map((name) => (
                                                                <button
                                                                    type="button"
                                                                    key={name}
                                                                    onClick={() => {
                                                                        setFormData({ ...formData, employeeName: name });
                                                                        setShowEmployeeDropdown(false);
                                                                        setEmployeeSearch('');
                                                                    }}
                                                                    className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-3 ${
                                                                        formData.employeeName === name
                                                                            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                                                                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                                                    }`}
                                                                >
                                                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                                                                        {name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                                                                    </div>
                                                                    <span>{name}</span>
                                                                    {formData.employeeName === name && (
                                                                        <CheckCircle className="h-4 w-4 text-indigo-500 ml-auto" />
                                                                    )}
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <div className="px-4 py-3 text-sm text-slate-400 text-center">
                                                                Nenhum funcionário encontrado
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Opção de adicionar novo se o texto digitado não é um dos existentes */}
                                                    {formData.employeeName && !savedEmployees.includes(formData.employeeName) && (
                                                        <div className="border-t border-slate-100 dark:border-slate-700">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setShowEmployeeDropdown(false);
                                                                    setEmployeeSearch('');
                                                                }}
                                                                className="w-full text-left px-4 py-2.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors flex items-center gap-2"
                                                            >
                                                                <UserPlus className="h-4 w-4" />
                                                                Adicionar "{formData.employeeName}" como novo
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Comissão (%)</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                step="0.1"
                                                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono font-bold text-slate-800 dark:text-slate-200"
                                                value={formData.commissionRate}
                                                onChange={e => {
                                                    const rate = e.target.value;
                                                    const amount = formData.amount ? (parseFloat(formData.amount) * parseFloat(rate) / 100).toFixed(2) : '';
                                                    setFormData({ ...formData, commissionRate: rate, commissionAmount: amount });
                                                }}
                                                placeholder="Ex: 10"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Comissão (R$)</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="w-full pl-11 pr-4 py-3 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono font-bold text-slate-500 dark:text-slate-400 cursor-not-allowed"
                                                value={formData.commissionAmount}
                                                readOnly
                                                placeholder="0,00"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Data de Pagamento da Comissão</label>
                                    <input
                                        type="date"
                                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800 dark:text-slate-200"
                                        value={formData.commissionPaymentDate}
                                        onChange={e => setFormData({ ...formData, commissionPaymentDate: e.target.value })}
                                    />
                                </div>

                                <div className="pt-2 border-t border-indigo-100/50 dark:border-indigo-800/50">
                                    <label className="block text-xs font-bold text-rose-500 uppercase mb-1.5 ml-1">Valor Pendente a Receber (R$)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-400 font-bold">R$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full pl-11 pr-4 py-3 bg-rose-50/30 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800/50 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-all font-mono font-bold text-rose-700 dark:text-rose-400"
                                            value={formData.pendingAmount}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setFormData({
                                                    ...formData,
                                                    pendingAmount: val,
                                                    status: parseFloat(val) > 0 ? TransactionStatus.PARTIAL : formData.status
                                                });
                                            }}
                                            placeholder="0,00"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-2 ml-1 italic">* Se houver valor pendente, o status mudará para "PAGTO PARCIAL" automaticamente.</p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-2">
                            <button disabled={isSubmitting} type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 disabled:opacity-70 transition-all transform active:scale-[0.98] flex justify-center items-center gap-2">
                                {isSubmitting ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Salvando...
                                    </div>
                                ) : (
                                    <>
                                        <CheckCircle className="h-5 w-5" />
                                        Confirmar Lançamento
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
    );
};

export default TransactionList;