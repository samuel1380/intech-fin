import React, { useState } from 'react';
import { Transaction, TransactionType, TransactionCategory, TransactionStatus } from '../types';
import { Plus, Search, Trash2, Download, ChevronLeft, ChevronRight, CheckCircle, Clock, Filter, X, ArrowUpDown, Edit2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

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
        pendingAmount: ''
    });

    const filtered = transactions.filter(t => {
        const matchesFilter = filter === 'ALL' || t.type === filter;
        const matchesSearch = t.description.toLowerCase().includes(search.toLowerCase()) ||
            t.category.toLowerCase().includes(search.toLowerCase());
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
            pendingAmount: t.pendingAmount?.toString() || ''
        });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        try {
            const data = {
                description: formData.description,
                amount: parseFloat(formData.amount),
                type: formData.type,
                category: formData.category as TransactionCategory,
                date: formData.date,
                status: formData.status as TransactionStatus,
                employeeName: formData.employeeName || undefined,
                commissionRate: formData.commissionRate ? parseFloat(formData.commissionRate) : undefined,
                commissionAmount: formData.commissionAmount ? parseFloat(formData.commissionAmount) : undefined,
                commissionPaymentDate: formData.commissionPaymentDate || undefined,
                pendingAmount: formData.pendingAmount ? parseFloat(formData.pendingAmount) : undefined
            };

            if (isEditing && editingId) {
                await onUpdateTransaction(editingId, data);
            } else {
                await onAddTransaction(data);
            }

            setShowModal(false);
            setIsEditing(false);
            setEditingId(null);
            setFormData({
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
                pendingAmount: ''
            });
        } catch (error: any) {
            console.error('Erro ao salvar transação:', error);
            alert(`Erro ao salvar: ${error.message || 'Erro desconhecido'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleExportCSV = () => {
        // sep=; força o Excel a usar ponto e vírgula como separador independente da região
        const excelSeparator = 'sep=;';
        const headers = ['ID;Data;Descrição;Categoria;Tipo;Valor;Status;Funcionário;Comissão;Data Pagto Comissão;Valor Pendente'];
        
        const rows = filtered.map(t => {
            const [year, month, day] = t.date.split('-');
            const formattedDate = `${day}/${month}/${year}`;

            let formattedCommDate = '';
            if (t.commissionPaymentDate) {
                const [cYear, cMonth, cDay] = t.commissionPaymentDate.split('-');
                formattedCommDate = `${cDay}/${cMonth}/${cYear}`;
            }

            // Formata o valor para o padrão brasileiro (vírgula como decimal)
            const formattedAmount = t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const formattedCommission = t.commissionAmount 
                ? t.commissionAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '0,00';
            const formattedPending = t.pendingAmount
                ? t.pendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '0,00';
            
            return `${t.id.substring(0, 8)};${formattedDate};"${t.description.replace(/"/g, '""')}";${t.category};${t.type};${formattedAmount};${t.status};"${t.employeeName || ''}";${formattedCommission};${formattedCommDate};${formattedPending}`;
        });

        // Adiciona BOM (Byte Order Mark) e a instrução de separador para o Excel
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

    return (<div className="space-y-6 animate-fade-in w-full pb-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 dark:border-white/5 pb-6">
            <div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Transações</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Controle de caixa e histórico financeiro.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
                <button
                    onClick={handleExportCSV}
                    className="flex items-center justify-center px-4 py-2.5 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm font-semibold text-sm hover:border-slate-300 w-full sm:w-auto"
                >
                    <Download className="h-4 w-4 mr-2 text-slate-500" />
                    Exportar CSV
                </button>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center justify-center px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 hover:shadow-indigo-300 font-bold text-sm transform active:scale-95 w-full sm:w-auto"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Lançamento
                </button>
            </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl p-1.5 rounded-2xl shadow-sm border border-slate-200 dark:border-white/5 flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="relative w-full lg:w-96">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar por descrição..."
                    className="w-full pl-10 pr-4 py-2.5 bg-transparent rounded-xl text-sm focus:outline-none focus:bg-slate-50 dark:focus:bg-slate-900/50 transition-all placeholder:text-slate-400 font-medium text-slate-700 dark:text-slate-200"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="flex bg-slate-100/50 dark:bg-slate-900/50 p-1 rounded-xl w-full lg:w-auto border border-slate-100 dark:border-slate-800">
                {[
                    { label: 'Todos', value: 'ALL' },
                    { label: 'Receitas', value: TransactionType.INCOME },
                    { label: 'Despesas', value: TransactionType.EXPENSE }
                ].map((opt) => (
                    <button
                        key={opt.value}
                        onClick={() => setFilter(opt.value)}
                        className={`flex-1 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap ${filter === opt.value
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                            }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>

        {/* Main Table Card */}
        <div className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200 dark:border-white/5 overflow-hidden w-full flex flex-col h-[600px]">
            <div className="overflow-auto custom-scrollbar flex-1 relative">
                <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead className="bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-[120px]">Data</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Descrição</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-[150px]">Categoria</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right w-[150px]">Valor</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-[140px]">Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-[100px]">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {paginatedTransactions.map((t) => {
                            const [year, month, day] = t.date.split('-');
                            return (
                                <tr key={t.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors group table-row-hover">
                                    <td className="px-6 py-4 text-slate-500 font-medium tabular-nums text-sm">{day}/{month}/{year}</td>
                                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200 text-sm">
                                        {t.description}
                                        {t.employeeName && (
                                            <div className="text-[10px] text-indigo-500 font-bold uppercase mt-1 flex flex-col">
                                                <span>Técnico: {t.employeeName}</span>
                                                {t.commissionPaymentDate && (
                                                    <span className="text-slate-400 normal-case font-medium">
                                                        Pagto Comissão: {format(new Date(t.commissionPaymentDate + 'T12:00:00'), 'dd/MM/yyyy')}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        {t.pendingAmount && t.pendingAmount > 0 && (
                                            <div className="text-[10px] text-rose-500 font-bold uppercase mt-0.5">
                                                Pendente: {t.pendingAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                                            {t.category}
                                        </span>
                                    </td>
                                    <td className={`px-6 py-4 text-right font-bold font-mono text-sm ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {t.type === TransactionType.INCOME ? '+' : '-'}{formatBRL(t.amount)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => {
                                                const nextStatus = t.status === TransactionStatus.COMPLETED ? TransactionStatus.PENDING :
                                                                 t.status === TransactionStatus.PENDING ? TransactionStatus.PARTIAL : 
                                                                 TransactionStatus.COMPLETED;
                                                onUpdateStatus(t.id, nextStatus);
                                            }}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all border shadow-sm cursor-pointer whitespace-nowrap ${
                                                t.status === TransactionStatus.COMPLETED ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200' :
                                                t.status === TransactionStatus.PARTIAL ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200' :
                                                'bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200'
                                            }`}
                                        >
                                            {t.status === TransactionStatus.COMPLETED ? <CheckCircle className="w-3 h-3" /> : 
                                             t.status === TransactionStatus.PARTIAL ? <AlertCircle className="w-3 h-3" /> :
                                             <Clock className="w-3 h-3" />}
                                            {t.status}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={() => handleEdit(t)}
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all lg:opacity-0 group-hover:opacity-100"
                                                title="Editar Registro"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => onDeleteTransaction(t.id)}
                                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all lg:opacity-0 group-hover:opacity-100"
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
            </div>

            {/* Pagination */}
            {filtered.length > 0 ? (
                <div className="px-6 py-4 border-t border-slate-200 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                    <span className="text-xs font-medium text-slate-500">
                        Mostrando <span className="text-slate-800">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span className="text-slate-800">{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</span> de <span className="text-slate-800">{filtered.length}</span>
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 shadow-sm transition-all"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 shadow-sm transition-all"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center flex-1">
                    <div className="p-4 bg-slate-50 rounded-full mb-4">
                        <Search className="h-8 w-8 text-slate-300" />
                    </div>
                    <h3 className="text-slate-900 font-semibold mb-1">Nenhum resultado</h3>
                    <p className="text-sm">Tente ajustar seus filtros ou busca.</p>
                </div>
            )}
        </div>

        {/* Add Modal */}
        {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-fade-in">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up ring-1 ring-slate-900/5">
                    <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                        <div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                {isEditing ? 'Editar Lançamento' : 'Novo Lançamento'}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {isEditing ? 'Atualize os detalhes da transação.' : 'Preencha os detalhes da transação.'}
                            </p>
                        </div>
                        <button onClick={() => setShowModal(false)} className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 transition-colors shadow-sm">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* Transaction Type Toggle */}
                        <div className="p-1 bg-slate-100 rounded-xl grid grid-cols-2 gap-1 shadow-inner">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, type: TransactionType.INCOME })}
                                className={`py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${formData.type === TransactionType.INCOME
                                    ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-black/5'
                                    : 'text-slate-500 hover:text-emerald-600'
                                    }`}
                            >
                                <span className={`w-2 h-2 rounded-full ${formData.type === TransactionType.INCOME ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                                Receita
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, type: TransactionType.EXPENSE })}
                                className={`py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${formData.type === TransactionType.EXPENSE
                                    ? 'bg-white text-rose-600 shadow-sm ring-1 ring-black/5'
                                    : 'text-slate-500 hover:text-rose-600'
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
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-medium text-slate-800 placeholder:text-slate-400"
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
                                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-mono font-bold text-slate-800"
                                            value={formData.amount}
                                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                            placeholder="0,00"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Data</label>
                                    <input
                                        required
                                        type="date"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-medium text-slate-700"
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Categoria</label>
                                    <div className="relative">
                                        <select
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm font-medium text-slate-700 appearance-none"
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
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm font-medium text-slate-700 appearance-none"
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

                            {/* Campos de Funcionário, Comissão e Pendência */}
                            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 space-y-4">
                                <h4 className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Equipe, Comissão & Pagamento</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Funcionário</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                                            value={formData.employeeName}
                                            onChange={e => setFormData({ ...formData, employeeName: e.target.value })}
                                            placeholder="Nome do técnico"
                                        />
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
                            <button disabled={isSubmitting} type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 disabled:opacity-70 transition-all transform active:scale-[0.98] flex justify-center items-center gap-2">
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