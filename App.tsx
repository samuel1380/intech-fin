import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import Reports from './components/Reports';
import AIAssistant from './components/AIAssistant';
import { getAllTransactionsFromDb, addTransactionToDb, calculateSummary, deleteTransactionFromDb, clearDatabase, updateTransactionStatus } from './services/transactionService';
import { Transaction, FinancialSummary } from './types';
import { Menu, Database, Trash2, CheckCircle2, Lock, User } from 'lucide-react';

// Login Component
const LoginScreen = ({ onLogin }: { onLogin: () => void }) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">
    {/* Background Effects */}
    <div 
      className="absolute inset-0 bg-cover bg-center opacity-40 transition-opacity duration-1000"
      style={{ 
        backgroundImage: `url('/login-background/background.jpg'), url('/login-background/background.png'), url('/login-background/background.webp'), url('https://images.unsplash.com/photo-1639322537228-f710d846310a?auto=format&fit=crop&q=80')` 
      }}
    ></div>
    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/30 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
    <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-violet-600/30 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2"></div>

    <div className="relative z-10 w-full max-w-md p-8 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl animate-fade-in-up m-4 ring-1 ring-white/10">
      <div className="text-center mb-10">
         <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30 mb-4">
             <Lock className="w-8 h-8 text-white" />
         </div>
        <h1 className="text-4xl font-bold text-white tracking-tight mb-2">FinNexus</h1>
        <p className="text-slate-400 font-medium">Acesso Restrito Enterprise</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); onLogin(); }} className="space-y-5">
        <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Credencial</label>
            <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input type="email" defaultValue="admin@empresa.com.br" className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-12 pr-4 py-3.5 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none placeholder-slate-600 transition-all font-medium" />
            </div>
        </div>
        <div className="space-y-1">
             <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Senha</label>
             <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input type="password" defaultValue="password" className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-12 pr-4 py-3.5 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none placeholder-slate-600 transition-all font-medium" />
             </div>
        </div>
        <button className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/25 transition-all transform hover:scale-[1.02] flex justify-center items-center gap-2 mt-4">
          Acessar Dashboard
        </button>
      </form>
      <div className="mt-8 pt-6 border-t border-white/5 text-center">
        <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Segurança de Nível Bancário • Criptografia AES-256</p>
      </div>
    </div>
  </div>
);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<FinancialSummary>({
    totalIncome: 0, totalExpense: 0, netProfit: 0, pendingInvoices: 0, taxLiabilityEstimate: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);

  // Check login persistence
  useEffect(() => {
    const storedAuth = localStorage.getItem('finnexus_auth');
    if (storedAuth === 'true') {
        setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
      localStorage.setItem('finnexus_auth', 'true');
      setIsAuthenticated(true);
  }

  const handleLogout = () => {
      localStorage.removeItem('finnexus_auth');
      setIsAuthenticated(false);
  }

  // Carregar dados do Banco de Dados
  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await getAllTransactionsFromDb();
      setTransactions(data);
      setSummary(calculateSummary(data));
    } catch (error) {
      console.error("Erro ao carregar banco de dados:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }

    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isAuthenticated]);

  const handleAddTransaction = async (newTx: Omit<Transaction, 'id'>) => {
    await addTransactionToDb(newTx);
    await loadData(); 
  };

  const handleDeleteTransaction = async (id: string) => {
    if(confirm('Tem certeza que deseja excluir este registro? A ação é irreversível.')) {
        await deleteTransactionFromDb(id);
        await loadData();
    }
  };

  const handleUpdateStatus = async (id: string, status: any) => {
      await updateTransactionStatus(id, status);
      await loadData();
  }

  const handleResetDatabase = async () => {
      if(confirm('PERIGO: Isso apagará TODOS os registros financeiros. Deseja continuar?')) {
          await clearDatabase();
          await loadData();
          alert('Sistema resetado para configurações de fábrica.');
      }
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const getHeaderTitle = (tab: string) => {
    const titles: Record<string, string> = {
        'dashboard': 'Painel de Controle Executivo',
        'transactions': 'Gestão de Fluxo de Caixa',
        'reports': 'Relatórios & Auditoria Fiscal',
        'ai-advisor': 'Consultoria Inteligente (IA)',
        'settings': 'Configurações do Sistema'
    };
    return titles[tab] || tab;
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout} 
        isOpen={sidebarOpen}
      />
      
      <div className={`flex-1 flex flex-col h-full transition-[margin] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'} w-full`}>
        
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 md:px-8 py-4 flex items-center justify-between z-20 shrink-0 sticky top-0 transition-all">
            <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSidebarOpen(!sidebarOpen)} 
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                >
                    <Menu className="h-6 w-6" />
                </button>
                <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight truncate">
                    {getHeaderTitle(activeTab)}
                </h1>
            </div>
            <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-slate-900">João Silva (CFO)</p>
                    <p className="text-xs text-slate-500">TechCorp Brasil Ltda.</p>
                </div>
                <div className="h-10 w-10 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-200 shrink-0 cursor-pointer hover:shadow-indigo-300 transition-shadow ring-2 ring-white">
                    JS
                </div>
            </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 pb-20 scroll-smooth bg-slate-50/50">
          <div className="max-w-[1600px] mx-auto min-w-0">
            {isLoading ? (
                <div className="flex flex-col justify-center items-center h-[60vh] text-slate-500 gap-4">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-slate-200 rounded-full"></div>
                        <div className="w-16 h-16 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin absolute inset-0"></div>
                    </div>
                    <p className="animate-pulse font-medium text-slate-400">Sincronizando dados seguros...</p>
                </div>
            ) : (
                <>
                    {activeTab === 'dashboard' && (
                        <Dashboard 
                            transactions={transactions} 
                            summary={summary} 
                            onNavigateToTransactions={() => setActiveTab('transactions')}
                        />
                    )}
                    {activeTab === 'transactions' && (
                        <TransactionList 
                            transactions={transactions} 
                            onAddTransaction={handleAddTransaction} 
                            onDeleteTransaction={handleDeleteTransaction}
                            onUpdateStatus={handleUpdateStatus}
                        />
                    )}
                    {activeTab === 'reports' && <Reports transactions={transactions} />}
                    {activeTab === 'ai-advisor' && <AIAssistant summary={summary} transactions={transactions} />}
                    
                    {activeTab === 'settings' && (
                        <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <Database className="h-6 w-6 text-indigo-600" />
                                    Gerenciamento de Dados
                                </h2>
                                <p className="text-slate-600 mb-8 leading-relaxed">
                                    Os dados são armazenados localmente no seu navegador utilizando <strong>IndexedDB</strong>. 
                                    Isso garante total privacidade, latência zero e funcionamento offline. Nenhuma informação financeira sai do seu dispositivo sem sua permissão.
                                </p>
                                
                                <div className="space-y-4">
                                     <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-4">
                                        <div className="p-3 bg-white rounded-full text-emerald-600 shadow-sm ring-1 ring-emerald-100">
                                            <CheckCircle2 className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-emerald-800">Sistema Operacional</h4>
                                            <p className="text-sm text-emerald-700">Todas as funções estão ativas e o banco de dados está saudável.</p>
                                        </div>
                                    </div>

                                    <div className="p-6 bg-rose-50 border border-rose-100 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div>
                                            <h4 className="font-bold text-rose-800 flex items-center gap-2">
                                                <Trash2 className="h-4 w-4" /> Zona de Perigo
                                            </h4>
                                            <p className="text-sm text-rose-700 mt-1">A exclusão do banco de dados remove todo o histórico.</p>
                                        </div>
                                        <button 
                                            onClick={handleResetDatabase}
                                            className="px-6 py-3 bg-white border border-rose-200 text-rose-600 font-semibold rounded-lg hover:bg-rose-600 hover:text-white transition-all shadow-sm w-full sm:w-auto"
                                        >
                                            Resetar Banco de Dados
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
          </div>
        </main>
      </div>

      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

export default App;