import LoginScreen from './components/LoginScreen';
import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
const AIAssistant = lazy(() => import('./components/AIAssistant'));
const Accounts = lazy(() => import('./components/Accounts'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const DatabaseManager = lazy(() => import('./components/DatabaseManager'));
import { LoadingSkeleton, notify } from './components/Feedback';
const Reports = lazy(() => import('./components/Reports'));
const Settings = lazy(() => import('./components/Settings'));
import Sidebar from './components/Sidebar';
const TransactionList = lazy(() => import('./components/TransactionList'));
import { checkAndTriggerKeepAlive } from './services/keepAliveService';
import {
  checkAndTriggerLocalNotifications,
  loadNotificationPrefs,
  syncPushSubscription,
  unsubscribeFromPush,
} from './services/notificationService';
import {
  DEFAULT_PROFILE,
  getProfileConfig,
  saveProfileConfig,
} from './services/profileService';
import { isSupabaseConfigured, supabase } from './services/supabase';
import {
  addTaxSettingToDb,
  deleteTaxSettingFromDb,
  getTaxSettingsFromDb,
} from './services/taxService';
import {
  addTransactionToDb,
  addTransactionsToDb,
  calculateSummary,
  clearDatabase,
  deleteTransactionFromDb,
  getAllTransactionsFromDb,
  updateTransactionInDb,
  updateTransactionStatus,
} from './services/transactionService';
import {
  FinancialSummary,
  TaxSetting,
  Transaction,
  TransactionType,
  UserProfile,
} from './types';

const getInitials = (name: string) => {
  if (!name) return 'JS';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
};

function App() {
  const loadingRef = useRef(false);
  const authEpoch = useRef(0);
  const currentUserRef = useRef<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [newTransactionType, setNewTransactionType] = useState<
    TransactionType | undefined
  >();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<FinancialSummary>({
    totalIncome: 0,
    totalExpense: 0,
    netProfit: 0,
    pendingInvoices: 0,
    taxLiabilityEstimate: 0,
    totalCommissions: 0,
    pendingCommissions: 0,
  });
  const [dataError, setDataError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [taxSettings, setTaxSettings] = useState<TaxSetting[]>([]);
  const [newTaxName, setNewTaxName] = useState('');
  const [newTaxPercent, setNewTaxPercent] = useState('');
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);

  const handleUpdateProfile = async (updatedProfile: UserProfile) => {
    await saveProfileConfig(updatedProfile);
    setProfile(updatedProfile);
  };

  // Check login persistence and handle hash-based tab navigation
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthReady(true);
      return;
    }
    let disposed = false,
      verification = 0;
    const apply = (id: string | null) => {
      if (disposed) return;
      if (currentUserRef.current !== id) {
        authEpoch.current++;
        currentUserRef.current = id;
        setUserId(id);
        setTransactions([]);
        setTaxSettings([]);
        setProfile(DEFAULT_PROFILE);
        setSummary(calculateSummary([]));
        setDataError('');
      }
      setIsAuthenticated(!!id);
      setAuthReady(true);
    };
    const verify = () => {
      const attempt = ++verification;
      void supabase.auth
        .getUser()
        .then(({ data, error }) => {
          if (attempt === verification)
            apply(error ? null : data.user?.id || null);
        })
        .catch(() => {
          if (attempt === verification) apply(null);
        });
    };
    verify();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        verification++;
        apply(null);
      } else if (
        currentUserRef.current !== session.user.id ||
        event === 'TOKEN_REFRESHED'
      )
        queueMicrotask(verify);
    });

    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash) {
        const tab = hash.replace('#', '');
        const validTabs = [
          'dashboard',
          'transactions',
          'receivables',
          'payables',
          'accounts',
          'reports',
          'ai-advisor',
          'settings',
          'database',
        ];
        if (validTabs.includes(tab)) {
          setActiveTab(tab);
        }
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      disposed = true;
      window.removeEventListener('hashchange', handleHashChange);
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pass,
    });
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('E-mail ou senha incorretos.');
      }
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      await unsubscribeFromPush();
    } catch {
      notify(
        'Não foi possível desativar o push deste dispositivo. Revogue a permissão no navegador.',
        'error',
      );
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      notify('Não foi possível encerrar a sessão.', 'error');
      return;
    }
    setIsAuthenticated(false);
  };

  // Carregar dados do Banco de Dados + Gerar Recorrências
  const loadData = async (silent = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const epoch = authEpoch.current;
    if (!silent) setIsLoading(true);
    try {
      const { error: recurrenceError } = await supabase.rpc(
        'generate_recurrences',
      );
      if (recurrenceError) {
        // Older production databases can serve transactions before optional RPCs are deployed.
        if (!['PGRST202', '42883'].includes(recurrenceError.code))
          throw recurrenceError;
        console.warn(
          '[Recurrences] Função ainda não instalada; consultando movimentações existentes.',
        );
      }
      const [data, taxes, profileData] = await Promise.all([
        getAllTransactionsFromDb(),
        getTaxSettingsFromDb(),
        getProfileConfig().catch(() => {
          console.warn(
            '[Profile] Perfil indisponível; dados financeiros continuam sendo consultados.',
          );
          return DEFAULT_PROFILE;
        }),
      ]);

      if (epoch !== authEpoch.current) return;
      const finalData = data;
      setDataError('');
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
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : '';
      console.error('[Data] Falha na consulta ao Supabase', { code });
      setDataError(
        ['42703', 'PGRST204'].includes(code)
          ? 'O esquema do Supabase conectado ainda não contém os campos exigidos por esta versão. É necessário atualizar o esquema para consultar os dados com segurança.'
          : 'Não foi possível consultar os dados do Supabase. Verifique a conexão e as permissões da sua conta.' +
              (code ? ' Código: ' + code : ''),
      );
      notify(
        'Não foi possível carregar os dados. Verifique a conexão e tente novamente.',
        'error',
      );
      if (!isSupabaseConfigured) {
        notify(
          'ERRO DE CONFIGURAÇÃO: O banco de dados Supabase não está configurado. Os dados não serão salvos localmente por segurança.',
        );
      }
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, userId]);

  // Verificar notificações quando o app volta ao foco ou periodicamente
  useEffect(() => {
    if (!isAuthenticated || transactions.length === 0) return;

    let intervalId: ReturnType<typeof setTimeout>;
    let disposed = false;
    let checking = false;

    const triggerCheck = async () => {
      if (disposed || checking) return;
      checking = true;
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

        if (!disposed) {
          clearTimeout(intervalId);
          intervalId = setTimeout(triggerCheck, Math.max(60000, ms));
        }
      } catch (err) {
        console.warn('Erro ao verificar notificações locais:', err);
      } finally {
        checking = false;
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
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, [isAuthenticated, transactions]);

  useEffect(() => {
    if (!isAuthenticated || !('serviceWorker' in navigator)) return;
    const reconcile = () => {
      void syncPushSubscription().catch(() =>
        console.warn(
          '[PWA] Sincronização pendente; nova tentativa ao retornar ao app.',
        ),
      );
    };
    const focus = () => {
      if (document.visibilityState === 'visible') reconcile();
    };
    const message = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED') reconcile();
    };
    reconcile();
    document.addEventListener('visibilitychange', focus);
    navigator.serviceWorker.addEventListener('message', message);
    return () => {
      document.removeEventListener('visibilitychange', focus);
      navigator.serviceWorker.removeEventListener('message', message);
    };
  }, [isAuthenticated]);

  const handleAddTransaction = async (newTx: Omit<Transaction, 'id'>) => {
    await addTransactionToDb(newTx);
    await loadData(true);
  };

  const handleDeleteTransaction = async (id: string) => {
    if (
      confirm(
        'Tem certeza que deseja excluir este registro? A ação é irreversível.',
      )
    ) {
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
      notify('Sistema resetado para configurações de fábrica.');
    } catch (error: any) {
      notify(error.message || 'Ocorreu um erro ao resetar os dados.');
    }
  };

  const handleAddTax = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaxName || !newTaxPercent) return;
    try {
      await addTaxSettingToDb({
        name: newTaxName,
        percentage: parseFloat(newTaxPercent),
      });
      setNewTaxName('');
      setNewTaxPercent('');
      await loadData(true);
    } catch {
      notify('Erro ao adicionar imposto.');
    }
  };

  const handleDeleteTax = async (id: string) => {
    if (confirm('Remover este imposto?')) {
      await deleteTaxSettingFromDb(id);
      await loadData(true);
    }
  };

  if (!isSupabaseConfigured)
    return (
      <main className="min-h-screen grid place-items-center p-8 bg-slate-950 text-white">
        <section className="max-w-md space-y-4">
          <p className="text-orange-300">FININTECH</p>
          <h1 className="text-3xl font-semibold">
            Conexão ainda não configurada
          </h1>
          <p>
            Configure a URL e a chave pública do Supabase para acessar seu
            painel.
          </p>
        </section>
      </main>
    );
  if (!authReady)
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <LoadingSkeleton />
      </div>
    );
  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const handleTabChange = (tab: string) => {
    setNewTransactionType(undefined);
    setActiveTab(tab);
    window.location.hash = tab;
  };

  const menuItems = [
    { id: 'dashboard', label: 'Visão Geral' },
    { id: 'transactions', label: 'Atividades' },
    { id: 'receivables', label: 'A Receber' },
    { id: 'payables', label: 'A Pagar' },
    { id: 'reports', label: 'Relatórios' },
    { id: 'ai-advisor', label: 'IA Consultor' },
    { id: 'settings', label: 'Configurações' },
    { id: 'database', label: 'Banco de Dados' },
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen supports-[height:100dvh]:h-[100dvh] bg-[#F3F4F6] dark:bg-[#070b14] overflow-hidden font-sans transition-colors duration-300 p-0 md:p-4 md:pl-24 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-4">
      {/* Sidebar Compacta Flutuante */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onLogout={handleLogout}
        isOpen={false}
        avatarUrl={profile.avatarUrl}
      />

      {/* Main Container com borda ultra arredondada, estilo tablet/dashboard Finexy */}
      <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-900 md:border md:border-[#EEF2F7] md:dark:border-white/[0.06] rounded-none md:rounded-[32px] overflow-hidden shadow-none md:shadow-premium-lg w-full relative">
        {/* Top Header - Navegação por pílulas + Perfil + Search */}
        <header className="px-8 pb-5 pt-[calc(1.25rem+env(safe-area-inset-top))] md:pt-5 border-b border-[#EEF2F7] dark:border-white/[0.06] flex items-center justify-between z-20 shrink-0 bg-white dark:bg-slate-900 gap-3">
          {/* Lado Esquerdo: Logo minimalista e texto */}
          <div className="flex items-center gap-2.5">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt="FinIntech Logo"
                className="w-8 h-8 rounded-full object-cover shadow-sm ring-2 ring-slate-100 dark:ring-slate-800 shrink-0 block md:hidden"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-finexyOrange flex items-center justify-center shadow-md shadow-finexyOrange/20 shrink-0 block md:hidden">
                <span className="font-extrabold text-white text-sm">FI</span>
              </div>
            )}
            <span className="font-bold text-slate-800 dark:text-white text-[16px] tracking-tight">
              FinIntech
            </span>
          </div>

          {/* Centro: Barra de Pílulas de Navegação */}
          <div className="hidden 2xl:flex items-center bg-[#F3F4F6] dark:bg-slate-800 p-1 rounded-full border border-slate-200/40 dark:border-slate-700/30">
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
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Ícones de Ações Minimalistas */}
            <div className="hidden sm:flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-full border border-slate-200/50 dark:border-slate-700/30">
              <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 transition-colors">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  ></path>
                </svg>
              </button>
              <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 transition-colors relative">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  ></path>
                </svg>
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-finexyOrange rounded-full"></span>
              </button>
              <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 transition-colors">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
              </button>
            </div>

            {/* Informações do Usuário com avatar */}
            <div className="flex items-center gap-3 md:pl-3 md:border-l border-slate-200 dark:border-slate-800">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt="Avatar"
                  className="h-8 w-8 md:h-9 md:w-9 rounded-full object-cover shadow-sm ring-2 ring-slate-100 dark:ring-slate-800 hidden md:block"
                />
              ) : (
                <div className="h-8 w-8 md:h-9 md:w-9 bg-finexyOrange text-white rounded-full flex items-center justify-center font-bold text-xs shadow-md shadow-finexyOrange/15 hidden md:flex">
                  {getInitials(profile.name)}
                </div>
              )}
              <div className="text-left hidden md:block">
                <p className="text-xs font-bold text-slate-800 dark:text-white leading-tight">
                  {profile.name}
                </p>
                <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                  {profile.companyName}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Conteúdo Principal com scroll e fundo cinza claro para isolar os cards internos */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 pb-20 scroll-smooth bg-[#FAFAFC] dark:bg-slate-900 transition-colors duration-300">
          <div className="max-w-[1600px] mx-auto min-w-0">
            <Suspense fallback={<LoadingSkeleton />}>
              {dataError ? (
                <section
                  role="alert"
                  className="max-w-xl mx-auto p-8 rounded-2xl border border-rose-200 bg-rose-50 text-rose-800"
                >
                  <h2 className="text-xl font-semibold mb-3">
                    Seus dados estão indisponíveis
                  </h2>
                  <p>{dataError}</p>
                  <button
                    className="mt-5 rounded-full bg-slate-900 text-white px-5 py-2.5"
                    onClick={() => {
                      setDataError('');
                      void loadData();
                    }}
                  >
                    Tentar novamente
                  </button>
                </section>
              ) : isLoading ? (
                <LoadingSkeleton />
              ) : (
                <>
                  {activeTab === 'dashboard' && (
                    <Dashboard
                      transactions={transactions}
                      summary={summary}
                      taxSettings={taxSettings}
                      userName={profile.name}
                      onNavigateToTransactions={(type) => {
                        setNewTransactionType(type);
                        setActiveTab('transactions');
                        window.location.hash = 'transactions';
                      }}
                    />
                  )}
                  {activeTab === 'transactions' && (
                    <TransactionList
                      transactions={transactions}
                      onAddTransaction={handleAddTransaction}
                      initialType={newTransactionType}
                      onAddTransactions={async (batch) => {
                        await addTransactionsToDb(batch);
                        await loadData(true);
                      }}
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
                  {activeTab === 'reports' && (
                    <Reports
                      transactions={transactions}
                      taxSettings={taxSettings}
                    />
                  )}
                  {activeTab === 'ai-advisor' && (
                    <AIAssistant
                      summary={summary}
                      transactions={transactions}
                    />
                  )}

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
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
