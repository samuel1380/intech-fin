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
import { getProfileConfig, saveProfileConfig, DEFAULT_PROFILE } from './services/profileService';
import { Transaction, FinancialSummary, TaxSetting, UserProfile } from './types';
import { Menu, Lock, User } from 'lucide-react';
import { checkAndTriggerKeepAlive } from './services/keepAliveService';

const LoginScreen = ({ onLogin }: { onLogin: (email: string, pass: string) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070B14] relative overflow-hidden">
      {/* Background Effects */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-40 transition-opacity duration-1000"
        style={{
          backgroundImage: `url('/login-background/background.jpg'), url('/login-background/background.png'), url('/login-background/background.webp'), url('https://images.unsplash.com/photo-1639322537228-f710d846310a?auto=format&fit=crop&q=80')`
        }}
      ></div>
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/30 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-violet-600/30 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2"></div>

      <div className="relative z-10 w-full max-w-sm sm:max-w-md p-8 sm:p-10 bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] rounded-[28px] shadow-2xl animate-fade-in-up md:m-4 mx-auto">
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-[20px] overflow-hidden shadow-2xl shadow-indigo-500/20 mb-5 bg-white">
            <img src="/logo.png" alt="FinNexus Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl sm:text-[34px] font-semibold text-white tracking-[-0.02em] mb-2">FinNexus</h1>
          <p className="text-slate-400/80 font-medium text-sm">Acesso Restrito Enterprise</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onLogin(email, password); }} className="space-y-5 mt-8">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Credencial</label>
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-[14px] pl-12 pr-4 py-3.5 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/30 outline-none placeholder-slate-500 transition-all duration-200 font-medium text-[15px]"
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
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-[14px] pl-12 pr-4 py-3.5 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/30 outline-none placeholder-slate-500 transition-all duration-200 font-medium text-[15px]"
                placeholder="Digite sua senha"
                required
              />
            </div>
          </div>
          <button type="submit" className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold py-4 rounded-[14px] shadow-lg shadow-indigo-500/20 transition-all duration-300 transform hover:scale-[1.01] hover:shadow-xl hover:shadow-indigo-500/25 flex justify-center items-center gap-2 mt-6 text-[15px]">
            Acessar Dashboard
          </button>
        </form>
        <div className="mt-10 pt-6 border-t border-white/[0.04] text-center">
          <p className="text-[10px] text-slate-500/60 font-mono tracking-[0.15em] uppercase">Segurança de Nível Bancário • Criptografia AES-256</p>
        </div>
      </div>
    </div>
  );
};

const getInitials = (name: string) => {
  if (!name) return 'JS';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
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
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);

  const handleUpdateProfile = async (updatedProfile: UserProfile) => {
    try {
      await saveProfileConfig(updatedProfile);
      setProfile(updatedProfile);
    } catch (err) {
      console.error('Erro ao atualizar perfil:', err);
    }
  };

  // Check login persistence and handle hash-based tab navigation
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
  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [data, taxes, profileData] = await Promise.all([
        getAllTransactionsFromDb(),
        getTaxSettingsFromDb(),
        getProfileConfig()
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
      setProfile(profileData);
      setSummary(calculateSummary(finalData, taxes));

      // Check and trigger local notifications based on user preferences
      try {
        const notifPrefs = await loadNotificationPrefs();
        await checkAndTriggerLocalNotifications(finalData, notifPrefs);
      } catch (notifError) {
        console.warn('Notification check failed:', notifError);
      }

      // Evitar inatividade do Supabase (Keep-Alive)
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

  // Verificar notificações quando o app volta ao foco ou periodicamente
  useEffect(() => {
    if (!isAuthenticated || transactions.length === 0) return;

    let intervalId: any;

    const triggerCheck = async () => {
      try {
        const notifPrefs = await loadNotificationPrefs();
        await checkAndTriggerLocalNotifications(transactions, notifPrefs);

        // Recriar o timer de acordo com o valor configurado
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

    // Verificar ao mudar visibilidade (quando o usuário abre/volta para o PWA)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerCheck();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Disparar verificação imediata na montagem
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

  const menuItems = [
    { id: 'dashboard', label: 'Overview' },
    { id: 'transactions', label: 'Activity' },
    { id: 'receivables', label: 'Manage' },
    { id: 'payables', label: 'Program' },
    { id: 'reports', label: 'Reports' },
    { id: 'ai-advisor', label: 'AI advisor' },
    { id: 'settings', label: 'Account' },
    { id: 'database', label: 'Database' }
  ];

  return (
    <div className="flex h-screen supports-[height:100dvh]:h-[100dvh] bg-[#F3F4F6] dark:bg-[#070b14] overflow-hidden font-sans transition-colors duration-300 p-4 pl-24">
      {/* Sidebar Compacta Flutuante */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onLogout={handleLogout}
        isOpen={false}
      />

      {/* Main Container com borda ultra arredondada, estilo tablet/dashboard Finexy */}
      <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-900 border border-[#EEF2F7] dark:border-white/[0.06] rounded-[32px] overflow-hidden shadow-premium-lg w-full relative">
        
        {/* Top Header - Navegação por pílulas + Perfil + Search */}
        <header className="px-8 py-5 border-b border-[#EEF2F7] dark:border-white/[0.06] flex items-center justify-between z-20 shrink-0 bg-white dark:bg-slate-900 gap-3">
          
          {/* Lado Esquerdo: Logo Finexy minimalista e texto */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-finexyOrange flex items-center justify-center shadow-md shadow-finexyOrange/20 shrink-0">
              <span className="font-extrabold text-white text-sm">F</span>
            </div>
            <span className="font-bold text-slate-800 dark:text-white text-[16px] tracking-tight">Finexy</span>
          </div>

          {/* Centro: Barra de Pílulas de Navegação */}
          <div className="hidden lg:flex items-center bg-[#F3F4F6] dark:bg-slate-800 p-1 rounded-full border border-slate-200/40 dark:border-slate-700/30">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`px-5 py-2 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 ${
                  activeTab === item.id
                    ? 'bg-finexyBlack text-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Lado Direito: Ações rápidas & Info Perfil */}
          <div className="flex items-center gap-4 shrink-0">
            {/* Ícones de Ações Minimalistas */}
            <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-full border border-slate-200/50 dark:border-slate-700/30">
              <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </button>
              <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 transition-colors relative">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-finexyOrange rounded-full"></span>
              </button>
              <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </button>
            </div>

            {/* Informações do Usuário com avatar */}
            <div className="flex items-center gap-3 pl-3 border-l border-slate-200 dark:border-slate-800">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt="Avatar"
                  className="h-9 w-9 rounded-full object-cover shadow-sm ring-2 ring-slate-100 dark:ring-slate-800"
                />
              ) : (
                <div className="h-9 w-9 bg-finexyOrange text-white rounded-full flex items-center justify-center font-bold text-xs shadow-md shadow-finexyOrange/15">
                  {getInitials(profile.name)}
                </div>
              )}
              <div className="text-left hidden md:block">
                <p className="text-xs font-bold text-slate-800 dark:text-white leading-tight">{profile.name}</p>
                <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{profile.companyName}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Conteúdo Principal com scroll e fundo cinza claro para isolar os cards internos */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-8 pb-20 scroll-smooth bg-[#FAFAFC] dark:bg-slate-900 transition-colors duration-300">
          <div className="max-w-[1600px] mx-auto min-w-0">
            {isLoading ? (
              <div className="flex flex-col justify-center items-center h-[50vh] text-slate-500 gap-5">
                <div className="relative">
                  <div className="w-12 h-12 border-[3px] border-[#EEF2F7] dark:border-slate-800 rounded-full"></div>
                  <div className="w-12 h-12 border-[3px] border-finexyOrange rounded-full border-t-transparent animate-spin absolute inset-0"></div>
                </div>
                <p className="font-semibold text-slate-500 text-xs tracking-wider">Sincronizando dados seguros...</p>
              </div>
            ) : (
              <>
                {activeTab === 'dashboard' && (
                  <Dashboard
                    transactions={transactions}
                    summary={summary}
                    taxSettings={taxSettings}
                    userName={profile.name}
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
                    profile={profile}
                    onUpdateProfile={handleUpdateProfile}
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