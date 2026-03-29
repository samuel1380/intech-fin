import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import Reports from './components/Reports';
import AIAssistant from './components/AIAssistant';
import Accounts from './components/Accounts';
import ThemeToggle from './components/ThemeToggle';
import Settings from './components/Settings';
import { getAllTransactionsFromDb, addTransactionToDb, calculateSummary, deleteTransactionFromDb, clearDatabase, updateTransactionStatus, updateTransactionInDb } from './services/transactionService';
import { getTaxSettingsFromDb, addTaxSettingToDb, deleteTaxSettingFromDb } from './services/taxService';
import { isSupabaseConfigured } from './services/supabase';
import { loadNotificationPrefs, checkAndTriggerLocalNotifications } from './services/notificationService';
import { Transaction, FinancialSummary, TaxSetting } from './types';
import { Menu, Lock, User } from 'lucide-react';

const LoginScreen = ({ onLogin }: { onLogin: (email: string, pass: string) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
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
        <form onSubmit={(e) => { e.preventDefault(); onLogin(email, password); }} className="space-y-5">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Credencial</label>
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-12 pr-4 py-3.5 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none placeholder-slate-600 transition-all font-medium"
                placeholder="Digite seu e-mail"
                required
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Senha</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-12 pr-4 py-3.5 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none placeholder-slate-600 transition-all font-medium"
                placeholder="Digite sua senha"
                required
              />
            </div>
          </div>
          <button type="submit" className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/25 transition-all transform hover:scale-[1.02] flex justify-center items-center gap-2 mt-4">
            Acessar Dashboard
          </button>
        </form>
        <div className="mt-8 pt-6 border-t border-white/5 text-center">
          <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Segurança de Nível Bancário • Criptografia AES-256</p>
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

  // Check login persistence
  useEffect(() => {
    const storedAuth = localStorage.getItem('finnexus_auth');
    if (storedAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (email: string, pass: string) => {
    // Credenciais Definitivas
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

  // Carregar dados do Banco de Dados + Gerar Recorrências
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [data, taxes] = await Promise.all([
        getAllTransactionsFromDb(),
        getTaxSettingsFromDb()
      ]);

      // ===== AUTO-GERAR DESPESAS RECORRENTES =====
      const today = new Date();
      const recurringTemplates = data.filter(t => t.isRecurring && t.type === 'DESPESA');

      for (const template of recurringTemplates) {
        const interval = template.recurringIntervalMonths || 1;
        const day = template.recurringDay || 1;

        // Find all existing instances of this recurring expense (same description, category, amount, recurring)
        const existingDates = data
          .filter(t => t.description === template.description && t.category === template.category && t.amount === template.amount)
          .map(t => t.date);

        // Generate dates from template date forward
        const templateDate = new Date(template.date + 'T12:00:00');
        let checkDate = new Date(templateDate);

        // Move to the next occurrence after the template
        checkDate.setMonth(checkDate.getMonth() + interval);

        // Generate up to 12 months ahead max, only if the date has passed or is today
        let safetyCounter = 0;
        while (checkDate <= today && safetyCounter < 24) {
          safetyCounter++;
          const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

          // Only create if it doesn't already exist
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
              console.log(`📅 Despesa recorrente gerada: ${template.description} em ${dateStr}`);
            } catch (err) {
              console.warn('Erro ao gerar recorrência:', err);
            }
          }

          checkDate.setMonth(checkDate.getMonth() + interval);
        }
      }

      // Reload data if we generated anything
      const finalData = recurringTemplates.length > 0 ? await getAllTransactionsFromDb() : data;

      setTransactions(finalData);
      setTaxSettings(taxes);
      setSummary(calculateSummary(finalData, taxes));

      // Check and trigger local notifications based on user preferences
      try {
        const notifPrefs = await loadNotificationPrefs();
        await checkAndTriggerLocalNotifications(finalData, notifPrefs);
      } catch (notifError) {
        console.warn('Notification check failed:', notifError);
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

  const handleAddTransaction = async (newTx: Omit<Transaction, 'id'>) => {
    await addTransactionToDb(newTx);
    await loadData();
  };

  const handleDeleteTransaction = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este registro? A ação é irreversível.')) {
      await deleteTransactionFromDb(id);
      await loadData();
    }
  };

  const handleUpdateStatus = async (id: string, status: any) => {
    await updateTransactionStatus(id, status);
    await loadData();
  }

  const handleUpdateTransaction = async (id: string, updates: any) => {
    await updateTransactionInDb(id, updates);
    await loadData();
  }

  const handleResetDatabase = async () => {
    if (confirm('PERIGO: Isso apagará TODOS os registros financeiros. Deseja continuar?')) {
      try {
        await clearDatabase();
        await loadData();
        alert('Sistema resetado para configurações de fábrica.');
      } catch (error: any) {
        alert(error.message || 'Ocorreu um erro ao resetar os dados.');
      }
    }
  }

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
      await loadData();
    } catch (error) {
      alert('Erro ao adicionar imposto.');
    }
  };

  const handleDeleteTax = async (id: string) => {
    if (confirm('Remover este imposto?')) {
      await deleteTaxSettingFromDb(id);
      await loadData();
    }
  };

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const getHeaderTitle = (tab: string) => {
    const titles: Record<string, string> = {
      'dashboard': '',
      'transactions': 'Gestão de Fluxo de Caixa',
      'accounts': 'Contas a Pagar & Receber',
      'reports': 'Relatórios & Auditoria Fiscal',
      'ai-advisor': 'Consultoria Inteligente (IA)',
      'settings': 'Configurações do Sistema'
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
    <div className="flex h-screen supports-[height:100dvh]:h-[100dvh] bg-slate-50 dark:bg-[#0c1222] overflow-hidden font-sans transition-colors duration-300">
      {/* Overlay para fechar sidebar no mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
      />

      <div className={`flex-1 flex flex-col h-full transition-[margin] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'} w-full`}>

        <header className="bg-white/80 dark:bg-[#111a2e]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700/50 px-4 md:px-8 py-4 safe-padding-top flex items-center justify-between z-20 shrink-0 sticky top-0 transition-colors duration-300">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight truncate">
              {getHeaderTitle(activeTab)}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">João Silva (CFO)</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">TechCorp Brasil Ltda.</p>
            </div>
            <div className="h-10 w-10 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-200 shrink-0 cursor-pointer hover:shadow-indigo-300 transition-shadow ring-2 ring-white dark:ring-slate-700">
              JS
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 pb-20 scroll-smooth bg-slate-50/50 dark:bg-[#0c1222] transition-colors duration-300">
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
                    onResetDatabase={handleResetDatabase}
                    newTaxName={newTaxName}
                    setNewTaxName={setNewTaxName}
                    newTaxPercent={newTaxPercent}
                    setNewTaxPercent={setNewTaxPercent}
                  />
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