import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import Reports from './components/Reports';
import AIAssistant from './components/AIAssistant';
import Accounts from './components/Accounts';
import ThemeToggle from './components/ThemeToggle';
import Settings from './components/Settings';
import DatabaseManager from './components/DatabaseManager';
import { getAllTransactionsFromDb, addTransactionToDb, calculateSummary, deleteTransactionFromDb, clearDatabase, updateTransactionStatus, updateTransactionInDb } from './services/transactionService';
import { getTaxSettingsFromDb, addTaxSettingToDb, deleteTaxSettingFromDb } from './services/taxService';
import { isSupabaseConfigured } from './services/supabase';
import { loadNotificationPrefs, checkAndTriggerLocalNotifications } from './services/notificationService';
import { Transaction, FinancialSummary, TaxSetting } from './types';
import { Menu, Lock, User } from 'lucide-react';
import { checkAndTriggerKeepAlive } from './services/keepAliveService';

const LoginScreen = ({ onLogin }: { onLogin: (email: string, pass: string) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 relative overflow-hidden">
      {/* Background Effects */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30 transition-opacity duration-1000"
        style={{
          backgroundImage: `url('/login-background/background.jpg'), url('/login-background/background.png'), url('/login-background/background.webp'), url('https://images.unsplash.com/photo-1639322537228-f710d846310a?auto=format&fit=crop&q=80')`
        }}
      ></div>
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-600/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-brand-700/15 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4"></div>

      <div className="relative z-10 w-full max-w-[400px] p-8 sm:p-10 bg-white/[0.04] backdrop-blur-3xl border border-white/[0.08] rounded-2xl shadow-2xl animate-fade-in-up mx-4 ring-1 ring-white/[0.05]">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-xl overflow-hidden shadow-lg mb-4 bg-white border border-white/10">
            <img src="/logo.png" alt="FinNexus Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-1">FinNexus</h1>
          <p className="text-surface-400 font-medium text-sm">Acesso Restrito Enterprise</p>
        </div>

        {/* Form */}
        <form onSubmit={(e) => { e.preventDefault(); onLogin(email, password); }} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider ml-0.5">Credencial</label>
            <div className="relative group">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 group-focus-within:text-brand-400 transition-colors duration-200" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/40 outline-none placeholder-surface-600 transition-all duration-200 font-medium"
                placeholder="Digite seu e-mail"
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider ml-0.5">Senha</label>
            <div className="relative group">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 group-focus-within:text-brand-400 transition-colors duration-200" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/40 outline-none placeholder-surface-600 transition-all duration-200 font-medium"
                placeholder="Digite sua senha"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-brand-600 hover:bg-brand-500 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-brand-600/20 transition-all duration-200 flex justify-center items-center gap-2 mt-2 btn-premium text-sm"
          >
            Acessar Dashboard
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-white/[0.04] text-center">
          <p className="text-[10px] text-surface-500 font-medium tracking-wider uppercase">Segurança de Nível Bancário · Criptografia AES-256</p>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<FinancialSummary>({
    totalIncome: 0, totalExpense: 0, netProfit: 0, pendingInvoices: 0, taxLiabilityEstimate: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [taxSettings, setTaxSettings] = useState<TaxSetting[]>([]);
  const [newTaxName, setNewTaxName] = useState('');
  const [newTaxPercent, setNewTaxPercent] = useState('');

  useEffect(() => {
    const storedAuth = localStorage.getItem('finnexus_auth');
    if (storedAuth === 'true') {
      setIsAuthenticated(true);
    }

    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash) {
        const tab = hash.replace('#', '');
        const validTabs = ['dashboard', 'transactions', 'receivables', 'payables', 'accounts', 'reports', 'ai-advisor', 'settings', 'database'];
        if (validTabs.includes(tab)) {
          setActiveTab(tab);
        }
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleLogin = (email: string, pass: string) => {
    const VALID_EMAIL = 'intechfin@financeiro.com.br';
    const VALID_PASS = 'Intech2026#';

    if (email === VALID_EMAIL && pass === VALID_PASS) {
      localStorage.setItem('finnexus_auth', 'true');
      setIsAuthenticated(true);
    } else {
      alert('Credenciais inválidas. Verifique seu e-mail e senha.');
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('finnexus_auth');
    setIsAuthenticated(false);
  }

  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [data, taxes] = await Promise.all([
        getAllTransactionsFromDb(),
        getTaxSettingsFromDb()
      ]);

      const today = new Date();
      const recurringTemplates = data.filter(t => t.isRecurring && t.type === 'DESPESA');

      for (const template of recurringTemplates) {
        const interval = template.recurringIntervalMonths || 1;
        const day = template.recurringDay || 1;
        const existingDates = data
          .filter(t => t.description === template.description && t.category === template.category && t.amount === template.amount)
          .map(t => t.date);

        const templateDate = new Date(template.date + 'T12:00:00');
        let checkDate = new Date(templateDate);
        checkDate.setMonth(checkDate.getMonth() + interval);

        let safetyCounter = 0;
        while (checkDate <= today && safetyCounter < 24) {
          safetyCounter++;
          const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

          if (!existingDates.includes(dateStr)) {
            try {
              await addTransactionToDb({
                description: template.description,
                amount: template.amount,
                type: template.type,
                category: template.category,
                status: 'PENDENTE' as any,
                date: dateStr,
                notes: `Gerado automaticamente (recorrente a cada ${interval} ${interval === 1 ? 'mês' : 'meses'})`,
                isRecurring: true,
                recurringIntervalMonths: interval,
                recurringDay: day,
              });
            } catch (err) {
              console.warn('Erro ao gerar recorrência:', err);
            }
          }
          checkDate.setMonth(checkDate.getMonth() + interval);
        }
      }

      const finalData = recurringTemplates.length > 0 ? await getAllTransactionsFromDb() : data;

      setTransactions(finalData);
      setTaxSettings(taxes);
      setSummary(calculateSummary(finalData, taxes));

      try {
        const notifPrefs = await loadNotificationPrefs();
        await checkAndTriggerLocalNotifications(finalData, notifPrefs);
      } catch (notifError) {
        console.warn('Notification check failed:', notifError);
      }

      try {
        await checkAndTriggerKeepAlive();
      } catch (keepAliveError) {
        console.warn('Keep-alive check failed:', keepAliveError);
      }
    } catch (error: any) {
      console.error("Erro ao carregar banco de dados:", error);
      if (!isSupabaseConfigured) {
        alert("ERRO DE CONFIGURAÇÃO: O banco de dados Supabase não está configurado. Os dados não serão salvos localmente por segurança.");
      }
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

  useEffect(() => {
    if (!isAuthenticated || transactions.length === 0) return;

    let intervalId: any;

    const triggerCheck = async () => {
      try {
        const notifPrefs = await loadNotificationPrefs();
        await checkAndTriggerLocalNotifications(transactions, notifPrefs);

        const val = notifPrefs.checkIntervalValue || 15;
        const unit = notifPrefs.checkIntervalUnit || 'minutes';
        let ms = 15 * 60 * 1000;
        if (unit === 'seconds') ms = val * 1000;
        else if (unit === 'minutes') ms = val * 60 * 1000;
        else if (unit === 'hours') ms = val * 60 * 60 * 1000;

        clearInterval(intervalId);
        intervalId = setInterval(triggerCheck, ms);
      } catch (err) {
        console.warn('Erro ao verificar notificações locais:', err);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerCheck();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    triggerCheck();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, [isAuthenticated, transactions]);

  const handleAddTransaction = async (newTx: Omit<Transaction, 'id'>) => {
    await addTransactionToDb(newTx);
    await loadData(true);
  };

  const handleDeleteTransaction = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este registro? A ação é irreversível.')) {
      await deleteTransactionFromDb(id);
      await loadData(true);
    }
  };

  const handleUpdateStatus = async (id: string, status: any) => {
    await updateTransactionStatus(id, status);
    await loadData(true);
  };

  const handleUpdateTransaction = async (id: string, updates: any) => {
    await updateTransactionInDb(id, updates);
    await loadData(true);
  };

  const handleResetDatabase = async () => {
    try {
      await clearDatabase();
      await loadData();
      alert('Sistema resetado para configurações de fábrica.');
    } catch (error: any) {
      alert(error.message || 'Ocorreu um erro ao resetar os dados.');
    }
  };

  const handleAddTax = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaxName || !newTaxPercent) return;
    try {
      await addTaxSettingToDb({
        name: newTaxName,
        percentage: parseFloat(newTaxPercent)
      });
      setNewTaxName('');
      setNewTaxPercent('');
      await loadData(true);
    } catch (error) {
      alert('Erro ao adicionar imposto.');
    }
  };

  const handleDeleteTax = async (id: string) => {
    if (confirm('Remover este imposto?')) {
      await deleteTaxSettingFromDb(id);
      await loadData(true);
    }
  };

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const getHeaderTitle = (tab: string) => {
    const titles: Record<string, string> = {
      'dashboard': 'Visão Consolidada',
      'transactions': 'Gestão de Fluxo de Caixa',
      'receivables': 'Contas a Receber',
      'payables': 'Contas a Pagar',
      'accounts': 'Contas a Pagar & Receber',
      'reports': 'Relatórios & Auditoria Fiscal',
      'ai-advisor': 'Consultoria Inteligente (IA)',
      'settings': 'Configurações do Sistema',
      'database': 'Gerenciamento de Banco de Dados'
    };
    return titles[tab] || tab;
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="flex h-screen supports-[height:100dvh]:h-[100dvh] bg-surface-50 dark:bg-[#0B1120] overflow-hidden font-sans transition-colors duration-300">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-surface-950/40 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
      />

      <div className={`flex-1 flex flex-col h-full transition-[margin] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${sidebarOpen ? 'lg:ml-[260px]' : 'lg:ml-[72px]'} w-full`}>
        {/* Header */}
        <header className="h-16 bg-white/90 dark:bg-surface-900/80 backdrop-blur-xl border-b border-surface-200/60 dark:border-surface-800/60 px-4 md:px-6 safe-padding-top flex items-center justify-between z-20 shrink-0 sticky top-0 transition-colors duration-300 gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg text-surface-500 dark:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 transition-colors duration-200 shrink-0"
            >
              <Menu className="h-5 w-5" strokeWidth={1.8} />
            </button>
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold text-surface-900 dark:text-surface-100 tracking-tight truncate leading-tight">
                {getHeaderTitle(activeTab)}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <ThemeToggle />
            <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-surface-200 dark:border-surface-700/60">
              <div className="text-right">
                <p className="text-[13px] font-semibold text-surface-900 dark:text-surface-100 leading-tight">João Silva</p>
                <p className="text-[11px] text-surface-400 dark:text-surface-500 font-medium">CFO · TechCorp Brasil</p>
              </div>
              <div className="h-8 w-8 bg-gradient-to-br from-brand-500 to-brand-700 rounded-full flex items-center justify-center text-white font-semibold shadow-sm shrink-0 cursor-pointer hover:shadow-md transition-shadow duration-200 text-[11px]">
                JS
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8 pb-20 scroll-smooth bg-surface-50/50 dark:bg-[#0B1120] transition-colors duration-300">
          <div className="max-w-[1600px] mx-auto min-w-0">
            {isLoading ? (
              <div className="flex flex-col justify-center items-center h-[60vh] text-surface-400 gap-4">
                <div className="relative">
                  <div className="w-12 h-12 border-[3px] border-surface-200 dark:border-surface-700 rounded-full"></div>
                  <div className="w-12 h-12 border-[3px] border-brand-600 rounded-full border-t-transparent animate-spin absolute inset-0"></div>
                </div>
                <p className="animate-pulse font-medium text-surface-400 text-sm">Sincronizando dados seguros...</p>
              </div>
            ) : (
              <>
                {activeTab === 'dashboard' && (
                  <Dashboard
                    transactions={transactions}
                    summary={summary}
                    taxSettings={taxSettings}
                    onNavigateToTransactions={() => setActiveTab('transactions')}
                  />
                )}
                {activeTab === 'transactions' && (
                  <TransactionList
                    transactions={transactions}
                    onAddTransaction={handleAddTransaction}
                    onDeleteTransaction={handleDeleteTransaction}
                    onUpdateStatus={handleUpdateStatus}
                    onUpdateTransaction={handleUpdateTransaction}
                  />
                )}
                {activeTab === 'receivables' && (
                  <Accounts
                    transactions={transactions}
                    onUpdateTransaction={handleUpdateTransaction}
                    initialTab="receivable"
                  />
                )}
                {activeTab === 'payables' && (
                  <Accounts
                    transactions={transactions}
                    onUpdateTransaction={handleUpdateTransaction}
                    initialTab="payable"
                  />
                )}
                {activeTab === 'accounts' && (
                  <Accounts
                    transactions={transactions}
                    onUpdateTransaction={handleUpdateTransaction}
                  />
                )}
                {activeTab === 'reports' && <Reports transactions={transactions} taxSettings={taxSettings} />}
                {activeTab === 'ai-advisor' && <AIAssistant summary={summary} transactions={transactions} />}

                {activeTab === 'settings' && (
                  <Settings
                    transactions={transactions}
                    taxSettings={taxSettings}
                    onAddTax={handleAddTax}
                    onDeleteTax={handleDeleteTax}
                    newTaxName={newTaxName}
                    setNewTaxName={setNewTaxName}
                    newTaxPercent={newTaxPercent}
                    setNewTaxPercent={setNewTaxPercent}
                  />
                )}
                {activeTab === 'database' && (
                  <DatabaseManager onResetDatabase={handleResetDatabase} />
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
