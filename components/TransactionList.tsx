import React, { useState } from 'react';
import { Transaction, TransactionType, TransactionCategory, TransactionStatus } from '../types';
import { Plus, Search, Trash2, Download, ChevronLeft, ChevronRight, CheckCircle, Clock, Filter, X, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  transactions: Transaction[];
  onAddTransaction: (t: Omit<Transaction, 'id'>) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onUpdateStatus: (id: string, status: TransactionStatus) => Promise<void>;
}

const ITEMS_PER_PAGE = 10;

const TransactionList: React.FC<Props> = ({ transactions, onAddTransaction, onDeleteTransaction, onUpdateStatus }) => {
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    type: TransactionType.EXPENSE,
    category: TransactionCategory.OPERATIONS,
    date: format(new Date(), 'yyyy-MM-dd'),
    status: TransactionStatus.COMPLETED
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onAddTransaction({
      description: formData.description,
      amount: parseFloat(formData.amount),
      type: formData.type,
      category: formData.category,
      date: formData.date,
      status: formData.status
    });
    setIsSubmitting(false);
    setShowModal(false);
    setFormData({ 
        description: '', 
        amount: '', 
        type: TransactionType.EXPENSE, 
        category: TransactionCategory.OPERATIONS, 
        date: format(new Date(), 'yyyy-MM-dd'),
        status: TransactionStatus.COMPLETED
    });
  };

  const handleExportCSV = () => {
    const headers = ['ID,Data,Descrição,Categoria,Tipo,Valor,Status'];
    const rows = filtered.map(t => 
        `${t.id},${t.date},"${t.description}",${t.category},${t.type},${t.amount},${t.status}`
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `transacoes_${format(new Date(), 'dd-MM-yyyy')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-6 animate-fade-in w-full pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-slate-200 pb-6">
        <div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Transações</h2>
            <p className="text-slate-500 mt-1 font-medium">Controle de caixa e histórico financeiro.</p>
        </div>
        <div className="flex gap-3">
            <button 
                onClick={handleExportCSV}
                className="flex items-center justify-center px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors shadow-sm font-semibold text-sm hover:border-slate-300"
            >
                <Download className="h-4 w-4 mr-2 text-slate-500" />
                Exportar CSV
            </button>
            <button 
                onClick={() => setShowModal(true)}
                className="flex items-center justify-center px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 hover:shadow-indigo-300 font-bold text-sm transform active:scale-95"
            >
                <Plus className="h-4 w-4 mr-2" />
                Novo Lançamento
            </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative w-full lg:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
                type="text" 
                placeholder="Buscar por descrição..." 
                className="w-full pl-10 pr-4 py-2.5 bg-transparent rounded-xl text-sm focus:outline-none focus:bg-slate-50 transition-all placeholder:text-slate-400 font-medium text-slate-700"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
        </div>
        
        <div className="flex bg-slate-100/50 p-1 rounded-xl w-full lg:w-auto border border-slate-100">
            {[
                { label: 'Todos', value: 'ALL' },
                { label: 'Receitas', value: TransactionType.INCOME },
                { label: 'Despesas', value: TransactionType.EXPENSE }
            ].map((opt) => (
                <button 
                    key={opt.value}
                    onClick={() => setFilter(opt.value)}
                    className={`flex-1 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                        filter === opt.value 
                        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                    }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden w-full flex flex-col h-[600px]">
        <div className="overflow-auto custom-scrollbar flex-1 relative">
            <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="bg-slate-50/90 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-[120px]">Data</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Descrição</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-[150px]">Categoria</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right w-[150px]">Valor</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-[140px]">Status</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-[100px]">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {paginatedTransactions.map((t) => {
                         const [year, month, day] = t.date.split('-');
                        return (
                        <tr key={t.id} className="hover:bg-slate-50/60 transition-colors group table-row-hover">
                            <td className="px-6 py-4 text-slate-500 font-medium tabular-nums text-sm">{day}/{month}/{year}</td>
                            <td className="px-6 py-4 font-semibold text-slate-800 text-sm">{t.description}</td>
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
                                    onClick={() => onUpdateStatus(t.id, t.status === TransactionStatus.COMPLETED ? TransactionStatus.PENDING : TransactionStatus.COMPLETED)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all border shadow-sm cursor-pointer whitespace-nowrap ${
                                        t.status === TransactionStatus.COMPLETED 
                                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200' 
                                        : 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200'
                                    }`}
                                >
                                    {t.status === TransactionStatus.COMPLETED ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                    {t.status}
                                </button>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <button 
                                    onClick={() => onDeleteTransaction(t.id)}
                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                    title="Excluir Registro"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </td>
                        </tr>
                    )})}
                </tbody>
            </table>
        </div>
        
        {/* Pagination */}
        {filtered.length > 0 ? (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50/50 shrink-0">
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
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up border border-slate-200 ring-1 ring-slate-900/5">
                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">Novo Lançamento</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Preencha os detalhes da transação.</p>
                    </div>
                    <button onClick={() => setShowModal(false)} className="p-2 bg-white hover:bg-slate-100 rounded-full text-slate-500 border border-slate-200 transition-colors shadow-sm">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Transaction Type Toggle */}
                    <div className="p-1 bg-slate-100 rounded-xl grid grid-cols-2 gap-1 shadow-inner">
                         <button 
                            type="button"
                            onClick={() => setFormData({...formData, type: TransactionType.INCOME})}
                            className={`py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                                formData.type === TransactionType.INCOME 
                                ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-black/5' 
                                : 'text-slate-500 hover:text-emerald-600'
                            }`}
                        >
                            <span className={`w-2 h-2 rounded-full ${formData.type === TransactionType.INCOME ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                            Receita
                        </button>
                        <button 
                            type="button"
                            onClick={() => setFormData({...formData, type: TransactionType.EXPENSE})}
                            className={`py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                                formData.type === TransactionType.EXPENSE 
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
                                onChange={e => setFormData({...formData, description: e.target.value})}
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
                                        onChange={e => setFormData({...formData, amount: e.target.value})}
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
                                    onChange={e => setFormData({...formData, date: e.target.value})}
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
                                        onChange={e => setFormData({...formData, category: e.target.value as TransactionCategory})}
                                    >
                                        {Object.values(TransactionCategory).map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
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
                                        onChange={e => setFormData({...formData, status: e.target.value as TransactionStatus})}
                                    >
                                        <option value={TransactionStatus.COMPLETED}>Concluído</option>
                                        <option value={TransactionStatus.PENDING}>Pendente</option>
                                    </select>
                                    <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-2">
                         <button disabled={isSubmitting} type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 disabled:opacity-70 transition-all transform active:scale-[0.98] flex justify-center items-center gap-2">
                            {isSubmitting ? (
                                <>Salavando...</>
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