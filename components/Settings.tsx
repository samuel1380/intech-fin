import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, BellOff, AlertTriangle, CreditCard, Calendar, DollarSign,
  BarChart2, Wallet, ArrowDownCircle, Target, BookOpen, RefreshCw,
  CheckCircle, XCircle, Loader2, Info, Database, Trash2, Cloud, Percent, Plus, Play,
  Settings as SettingsIcon, ShieldAlert, Cpu
} from 'lucide-react';
import {
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFS,
  registerServiceWorker,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  saveNotificationPrefs,
  loadNotificationPrefs,
  sendLocalNotification,
  checkAndTriggerLocalNotifications,
} from '../services/notificationService';
import { isSupabaseConfigured } from '../services/supabase';
import { TaxSetting } from '../types';
import { getKeepAliveConfig, saveKeepAliveConfig, runKeepAlivePing, KeepAliveConfig } from '../services/keepAliveService';

// ============================================================
// COMPONENTE: Toggle Switch (Premium Glassmorphism)
// ============================================================
interface ToggleSwitchProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, disabled = false, size = 'md' }) => {
  const isSmall = size === 'sm';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative flex items-center rounded-full transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 shrink-0
        ${isSmall ? 'w-[44px] h-[24px] p-[2px]' : 'w-[56px] h-[30px] p-[3px]'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.05] active:scale-[0.95]'}
        ${checked
          ? 'bg-gradient-to-r from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/20'
          : 'bg-slate-200 dark:bg-slate-700'
        }`}
    >
      <div
        className={`rounded-full bg-white shadow-sm transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)]
          ${isSmall ? 'w-[20px] h-[20px]' : 'w-[24px] h-[24px]'}
          ${checked
            ? isSmall ? 'translate-x-[20px]' : 'translate-x-[26px]'
            : 'translate-x-0'
          }`}
      />
    </button>
  );
};

// ============================================================
// COMPONENTE: Toast de feedback
// ============================================================
interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: 'bg-emerald-50/90 border-emerald-200/50 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800/30 dark:text-emerald-300',
    error: 'bg-rose-50/90 border-rose-200/50 text-rose-800 dark:bg-rose-950/30 dark:border-rose-800/30 dark:text-rose-300',
    info: 'bg-indigo-50/90 border-indigo-200/50 text-indigo-800 dark:bg-indigo-950/30 dark:border-indigo-800/30 dark:text-indigo-300',
  };

  const icons = {
    success: <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />,
    error: <XCircle className="h-4 w-4 text-rose-500 shrink-0" />,
    info: <Info className="h-4 w-4 text-indigo-500 shrink-0" />,
  };

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-2xl border text-sm font-semibold shadow-2xl animate-fade-in-up backdrop-blur-md ${colors[type]}`}
      style={{ maxWidth: 'calc(100vw - 2rem)' }}
    >
      {icons[type]}
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 opacity-50 hover:opacity-100 transition-opacity">
        <XCircle className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

// ============================================================
// SEÇÃO: Item de notificação com toggle e configuração
// ============================================================
interface NotifItemProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (val: boolean) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

const NotifItem: React.FC<NotifItemProps> = ({
  icon, iconBg, title, description, enabled, onToggle, disabled = false, children
}) => (
  <div className={`rounded-2xl border transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md
    ${enabled && !disabled
      ? 'border-indigo-500/30 bg-gradient-to-br from-indigo-50/60 to-violet-50/60 dark:from-indigo-950/20 dark:to-violet-950/20 backdrop-blur-md'
      : 'border-slate-200/60 bg-white/40 dark:border-slate-800/40 dark:bg-slate-900/10 backdrop-blur-md'
    }`}
  >
    <div className="flex items-center justify-between p-5">
      <div className="flex items-center gap-4 min-w-0">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white text-base shadow-sm ring-4 ring-white/10 dark:ring-black/10 ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className={`font-bold text-sm md:text-base tracking-tight ${enabled && !disabled ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
            {title}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug font-medium">{description}</p>
        </div>
      </div>
      <ToggleSwitch checked={enabled} onChange={onToggle} disabled={disabled} size="sm" />
    </div>
    {enabled && !disabled && children && (
      <div className="px-5 pb-5 pt-0 border-t border-indigo-500/10 dark:border-indigo-800/10">
        {children}
      </div>
    )}
  </div>
);

// ============================================================
// COMPONENTE PRINCIPAL: Settings
// ============================================================
interface SettingsProps {
  transactions: any[];
  taxSettings: TaxSetting[];
  onAddTax: (e: React.FormEvent) => Promise<void>;
  onDeleteTax: (id: string) => Promise<void>;
  newTaxName: string;
  setNewTaxName: (v: string) => void;
  newTaxPercent: string;
  setNewTaxPercent: (v: string) => void;
}

const Settings: React.FC<SettingsProps> = ({
  transactions,
  taxSettings,
  onAddTax,
  onDeleteTax,
  newTaxName,
  setNewTaxName,
  newTaxPercent,
  setNewTaxPercent,
}) => {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFS);
  const [permStatus, setPermStatus] = useState<NotificationPermission>('default');
  const [isLoadingNotif, setIsLoadingNotif] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [swRegistered, setSwRegistered] = useState(false);
  const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(null);
  const [keepAliveConfig, setKeepAliveConfig] = useState<KeepAliveConfig>({
    enabled: false,
    intervalDays: 4,
    lastPing: 0,
    pingLogs: []
  });
  const [isPingInProgress, setIsPingInProgress] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  }, []);

  // Carregar estado inicial
  useEffect(() => {
    const init = async () => {
      // Verificar permissão atual
      if ('Notification' in window) {
        setPermStatus(Notification.permission);
      }

      // Registrar SW
      const reg = await registerServiceWorker();
      if (reg) {
        setSwRegistered(true);
        // Verificar subscrição existente
        const sub = await reg.pushManager.getSubscription().catch(() => null);
        setPushSubscription(sub);
      }

      // Carregar preferências
      const savedPrefs = await loadNotificationPrefs();
      setPrefs(savedPrefs);

      // Carregar preferências de keep-alive
      const config = await getKeepAliveConfig();
      setKeepAliveConfig(config);
    };
    init();
  }, []);

  const handleToggleKeepAlive = async (enabled: boolean) => {
    const updated = { ...keepAliveConfig, enabled };
    setKeepAliveConfig(updated);
    await saveKeepAliveConfig(updated);
    showToast(enabled ? 'Anti-inatividade ativado!' : 'Anti-inatividade desativado.', 'info');
  };

  const handleIntervalChange = async (val: number) => {
    const cleanVal = Math.max(1, Math.min(6, val)); // entre 1 e 6 dias
    const updated = { ...keepAliveConfig, intervalDays: cleanVal };
    setKeepAliveConfig(updated);
    await saveKeepAliveConfig(updated);
  };

  const handleManualPing = async () => {
    setIsPingInProgress(true);
    try {
      const updated = await runKeepAlivePing();
      setKeepAliveConfig(updated);
      showToast('Ping realizado com sucesso! Banco ativo.', 'success');
    } catch (err: any) {
      showToast('Falha no ping: ' + (err.message || 'Verifique sua conexão.'), 'error');
      setKeepAliveConfig(await getKeepAliveConfig());
    } finally {
      setIsPingInProgress(false);
    }
  };

  // Salvar prefs com debounce quando mudam
  const savePrefs = useCallback(async (newPrefs: NotificationPreferences, sub?: PushSubscription | null) => {
    setIsSaving(true);
    try {
      await saveNotificationPrefs(newPrefs, sub !== undefined ? sub : pushSubscription);
      if (newPrefs.enabled) {
        await checkAndTriggerLocalNotifications(transactions, newPrefs);
      }
    } catch (err) {
      console.error('Erro ao salvar prefs:', err);
    } finally {
      setIsSaving(false);
    }
  }, [pushSubscription, transactions]);

  const updatePref = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);
    savePrefs(newPrefs);
  };

  // Ativar notificações principal
  const handleToggleNotifications = async (enabled: boolean) => {
    if (!enabled) {
      // Desativar
      await unsubscribeFromPush().catch(() => {});
      setPushSubscription(null);
      const newPrefs = { ...prefs, enabled: false };
      setPrefs(newPrefs);
      await savePrefs(newPrefs, null);
      showToast('Notificações desativadas.', 'info');
      return;
    }

    // Ativar — solicitar permissão
    setIsLoadingNotif(true);
    try {
      const permission = await requestNotificationPermission();
      setPermStatus(permission);

      if (permission !== 'granted') {
        showToast(
          permission === 'denied'
            ? 'Permissão negada. Reative nas configurações do seu celular/browser.'
            : 'Permissão não concedida.',
          'error'
        );
        setIsLoadingNotif(false);
        return;
      }

      // Tentar subscrever push
      let sub: PushSubscription | null = null;
      if (swRegistered) {
        sub = await subscribeToPush().catch((err) => {
          console.warn('[PWA] Push subscription falhou (VAPID não configurado?):', err);
          return null;
        });
        setPushSubscription(sub);
      }

      const newPrefs = { ...prefs, enabled: true };
      setPrefs(newPrefs);
      await savePrefs(newPrefs, sub);

      // Enviar notificação de boas-vindas
      await sendLocalNotification(
        'FinNexus Notificações Ativadas!',
        'Você receberá alertas financeiros importantes diretamente aqui.',
        '/'
      );

      showToast('Notificações ativadas com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao ativar notificações:', err);
      showToast('Erro ao ativar notificações. Tente novamente.', 'error');
    } finally {
      setIsLoadingNotif(false);
    }
  };

  const isNotifSupported = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
  const isNotifBlocked = permStatus === 'denied';

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto pb-10">

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* ===== SEÇÃO: NOTIFICAÇÕES ===== */}
      <div className="bg-white dark:bg-[#0F172A]/60 backdrop-blur-md border border-[#EEF2F7] dark:border-white/[0.06] p-6 md:p-8 rounded-[20px] shadow-premium dark:shadow-none transition-all duration-300">
        {/* Header da seção */}
        <div className="flex items-start justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Bell className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#0F172A] dark:text-white tracking-tight">
                Notificações Inteligentes
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                Receba alertas importantes e prazos diretamente no seu dispositivo.
              </p>
            </div>
          </div>
          {isSaving && (
            <div className="flex items-center gap-1.5 text-xs text-indigo-500 shrink-0 font-semibold bg-indigo-50 dark:bg-indigo-950/20 px-3 py-1.5 rounded-full border border-indigo-100/50 dark:border-indigo-900/30">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Sincronizando...</span>
            </div>
          )}
        </div>

        {/* Aviso iOS */}
        {typeof navigator !== 'undefined' && /iPhone|iPad/i.test(navigator.userAgent) && (
          <div className="mb-6 p-4 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 rounded-2xl flex items-start gap-3">
            <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Compatibilidade com iOS Safari</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 font-medium leading-relaxed">
                No iPhone, as notificações funcionam apenas quando o app está instalado na tela inicial através do botão "Adicionar à Tela de Início".
              </p>
            </div>
          </div>
        )}

        {/* Sistema não suportado */}
        {!isNotifSupported && (
          <div className="mb-6 p-4 bg-slate-100/70 dark:bg-slate-900/20 border border-slate-200/50 dark:border-slate-800/30 rounded-2xl flex items-start gap-3">
            <BellOff className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
              Notificações de sistema não são suportadas neste navegador. Recomendamos usar o Google Chrome ou o Safari no iOS 16.4+.
            </p>
          </div>
        )}

        {/* Permissão negada */}
        {isNotifBlocked && (
          <div className="mb-6 p-4 bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/30 rounded-2xl flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-rose-800 dark:text-rose-300">Permissão Bloqueada</p>
              <p className="text-xs text-rose-700 dark:text-rose-400 mt-1 font-medium leading-relaxed">
                As notificações estão desativadas nas configurações do navegador. Acesse as permissões do site na barra de endereços para liberar o acesso.
              </p>
            </div>
          </div>
        )}

        {/* Toggle Principal */}
        <div className={`flex items-center justify-between p-6 rounded-3xl border-2 transition-all duration-300 mb-8
          ${prefs.enabled
            ? 'border-indigo-300 bg-gradient-to-r from-indigo-50/60 to-violet-50/60 dark:border-indigo-500/20 dark:from-indigo-950/10 dark:to-violet-950/10 shadow-sm'
            : 'border-slate-200/60 bg-slate-50/60 dark:border-slate-800/40 dark:bg-slate-900/10'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm
              ${prefs.enabled ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
              {prefs.enabled
                ? <Bell className="h-5 w-5" />
                : <BellOff className="h-5 w-5" />
              }
            </div>
            <div>
              <p className="font-semibold text-[#0F172A] dark:text-slate-100 tracking-tight">
                {prefs.enabled ? 'Notificações Ativadas' : 'Notificações Desativadas'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                {prefs.enabled ? 'Você receberá alertas em tempo real.' : 'Ative para habilitar os lembretes do sistema.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isLoadingNotif && <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />}
            <ToggleSwitch
              checked={prefs.enabled}
              onChange={handleToggleNotifications}
              disabled={!isNotifSupported || isLoadingNotif || isNotifBlocked}
            />
          </div>
        </div>

        {/* Sub-toggles — só mostra se enabled */}
        {prefs.enabled && (
          <div className="space-y-4">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">
              Tipos de Lembrete
            </p>

            {/* Contas prestes a vencer */}
            <NotifItem
              icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
              iconBg="bg-amber-500/10 border border-amber-500/20"
              title="Contas Prestes a Vencer"
              description="Avisos sobre despesas pendentes próximas do vencimento"
              enabled={prefs.billsDueSoon}
              onToggle={(v) => updatePref('billsDueSoon', v)}
            >
              <div className="pt-4 flex items-center gap-3">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  Avisar com
                </label>
                <input
                  type="number"
                  min={1} max={30}
                  value={prefs.billsDueSoonDays}
                  onChange={(e) => updatePref('billsDueSoonDays', Number(e.target.value))}
                  className="w-16 px-2.5 py-1.5 text-sm font-bold text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all dark:text-white"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">dia(s) de antecedência</span>
              </div>
            </NotifItem>

            {/* Comissões */}
            <NotifItem
              icon={<CreditCard className="h-5 w-5 text-blue-500" />}
              iconBg="bg-blue-500/10 border border-blue-500/20"
              title="Dia de Pagamento de Comissão"
              description="Aviso no dia em que as comissões dos funcionários devem ser pagas"
              enabled={prefs.commissionPaymentDay}
              onToggle={(v) => updatePref('commissionPaymentDay', v)}
            />

            {/* Recebíveis */}
            <NotifItem
              icon={<DollarSign className="h-5 w-5 text-emerald-500" />}
              iconBg="bg-emerald-500/10 border border-emerald-500/20"
              title="Recebíveis Próximos"
              description="Avisos sobre receitas pendentes prestes a vencer"
              enabled={prefs.debtReceivable}
              onToggle={(v) => updatePref('debtReceivable', v)}
            >
              <div className="pt-4 flex items-center gap-3">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  Avisar com
                </label>
                <input
                  type="number"
                  min={1} max={14}
                  value={prefs.debtReceivableDays}
                  onChange={(e) => updatePref('debtReceivableDays', Number(e.target.value))}
                  className="w-16 px-2.5 py-1.5 text-sm font-bold text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all dark:text-white"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">dia(s) de antecedência</span>
              </div>
            </NotifItem>

            {/* Contas Recorrentes */}
            <NotifItem
              icon={<RefreshCw className="h-5 w-5 text-purple-500" />}
              iconBg="bg-purple-500/10 border border-purple-500/20"
              title="Despesas Recorrentes"
              description="Alerta preventivo antes do vencimento de contas de recorrência fixa"
              enabled={prefs.recurringBills}
              onToggle={(v) => updatePref('recurringBills', v)}
            >
              <div className="pt-4 flex items-center gap-3">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  Avisar com
                </label>
                <input
                  type="number"
                  min={1} max={14}
                  value={prefs.recurringBillsDays}
                  onChange={(e) => updatePref('recurringBillsDays', Number(e.target.value))}
                  className="w-16 px-2.5 py-1.5 text-sm font-bold text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all dark:text-white"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">dia(s) de antecedência</span>
              </div>
            </NotifItem>

            {/* Fechamento Mensal */}
            <NotifItem
              icon={<Calendar className="h-5 w-5 text-indigo-500" />}
              iconBg="bg-indigo-500/10 border border-indigo-500/20"
              title="Lembrete de Fechamento Mensal"
              description="Alerta mensal para revisar e auditar os relatórios financeiros"
              enabled={prefs.monthlyClose}
              onToggle={(v) => updatePref('monthlyClose', v)}
            >
              <div className="pt-4 flex items-center gap-3">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  Lembrar no dia
                </label>
                <input
                  type="number"
                  min={1} max={31}
                  value={prefs.monthlyCloseDay}
                  onChange={(e) => updatePref('monthlyCloseDay', Number(e.target.value))}
                  className="w-16 px-2.5 py-1.5 text-sm font-bold text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all dark:text-white"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">de cada mês</span>
              </div>
            </NotifItem>

            {/* Resumo Diário de Faturamento */}
            <NotifItem
              icon={<BarChart2 className="h-5 w-5 text-emerald-500" />}
              iconBg="bg-emerald-500/10 border border-emerald-500/20"
              title="Resumo de Faturamento Diário"
              description="Notificação periódica do total faturado no dia com uma frase motivacional"
              enabled={prefs.dailySummary}
              onToggle={(v) => updatePref('dailySummary', v)}
            >
              <div className="pt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    Enviar a cada
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={prefs.dailySummaryIntervalValue || 1}
                    onChange={(e) => updatePref('dailySummaryIntervalValue', Number(e.target.value))}
                    className="w-16 px-2.5 py-1.5 text-sm font-bold text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all dark:text-white"
                  />
                  <select
                    value={prefs.dailySummaryIntervalUnit || 'hours'}
                    onChange={(e) => updatePref('dailySummaryIntervalUnit', e.target.value as any)}
                    className="px-3 py-1.5 text-sm font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all dark:text-white cursor-pointer"
                  >
                    <option value="seconds">segundo(s)</option>
                    <option value="minutes">minuto(s)</option>
                    <option value="hours">hora(s)</option>
                    <option value="days">dia(s)</option>
                  </select>
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50/50 dark:bg-emerald-950/20 px-2.5 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  🌍 Esta configuração é global e sincroniza em todos os seus celulares/computadores.
                </div>
              </div>
            </NotifItem>

            {/* Frequência de Verificação */}
            <div className="bg-slate-50/40 dark:bg-slate-900/10 border border-slate-200/50 dark:border-slate-800/40 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-[#0F172A] dark:text-slate-100 text-sm md:text-base">
                    Frequência de Verificação
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug font-medium">
                    Intervalo de varredura automática das notificações locais
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center">
                <input
                  type="number"
                  min={1}
                  value={prefs.checkIntervalValue || 15}
                  onChange={(e) => updatePref('checkIntervalValue', Number(e.target.value))}
                  className="w-16 px-2.5 py-1.5 text-sm font-bold text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all dark:text-white"
                />
                <select
                  value={prefs.checkIntervalUnit || 'minutes'}
                  onChange={(e) => updatePref('checkIntervalUnit', e.target.value as any)}
                  className="px-3 py-1.5 text-sm font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all dark:text-white cursor-pointer"
                >
                  <option value="seconds">segundo(s)</option>
                  <option value="minutes">minuto(s)</option>
                  <option value="hours">hora(s)</option>
                </select>
              </div>
            </div>

            {/* Botão de teste */}
            <div className="mt-6 pt-6 border-t border-slate-200/50 dark:border-slate-800/40 flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await sendLocalNotification(
                      'Teste de Notificação',
                      'As notificações locais da sua conta estão ativas e funcionando!',
                      '/'
                    );
                    showToast('Notificação de teste enviada!', 'success');
                  } catch (err) {
                    showToast('Erro ao enviar teste. Verifique as permissões.', 'error');
                  }
                }}
                className="flex items-center gap-2 px-5 py-3 text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200/50 dark:border-indigo-900/30 rounded-2xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 active:scale-[0.98] transition-all"
              >
                <Cpu className="h-4 w-4" />
                <span>Enviar Notificação de Teste</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== SEÇÃO: IMPOSTOS ===== */}
      <div className="bg-white dark:bg-[#0F172A]/60 backdrop-blur-md border border-[#EEF2F7] dark:border-white/[0.06] p-6 md:p-8 rounded-[20px] shadow-premium dark:shadow-none transition-all duration-300">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Percent className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[#0F172A] dark:text-white tracking-tight">
              Configuração de Impostos
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Configure as alíquotas incidentes sobre o faturamento para calcular a provisão fiscal.
            </p>
          </div>
        </div>

        <div className="space-y-3 mb-8">
          {taxSettings.map((tax) => (
            <div key={tax.id} className="flex items-center justify-between p-5 bg-white/40 dark:bg-slate-900/10 border border-slate-200/50 dark:border-slate-800/40 rounded-2xl transition-all hover:border-indigo-500/20 hover:shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 font-bold text-sm">
                  %
                </div>
                <div>
                  <h5 className="font-semibold text-[#0F172A] dark:text-slate-100 text-sm md:text-base tracking-tight">{tax.name}</h5>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">{tax.percentage}% incidente sobre o lucro</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteTax(tax.id)}
                className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl active:scale-[0.9] transition-all"
              >
                <Trash2 className="h-4.5 w-4.5" />
              </button>
            </div>
          ))}
          {taxSettings.length === 0 && (
            <div className="text-center py-8 bg-slate-50/50 dark:bg-slate-900/5 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Nenhum imposto cadastrado. Usando a provisão padrão de 15%.</p>
            </div>
          )}
        </div>

        <form onSubmit={onAddTax} className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <input
              required
              placeholder="Nome do Imposto (Ex: ISS, PIS)"
              value={newTaxName}
              onChange={(e) => setNewTaxName(e.target.value)}
              className="w-full px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm font-semibold dark:text-white placeholder-slate-400"
            />
          </div>
          <div className="md:col-span-2 relative">
            <input
              required
              type="number"
              step="0.01"
              placeholder="Alíquota (%)"
              value={newTaxPercent}
              onChange={(e) => setNewTaxPercent(e.target.value)}
              className="w-full px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm font-semibold dark:text-white placeholder-slate-400 pr-10"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-bold text-sm">%</span>
          </div>
          <button
            type="submit"
            className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Adicionar</span>
          </button>
        </form>
      </div>

      {/* ===== SEÇÃO: ANTI-INATIVIDADE DO BANCO DE DADOS (SUPABASE KEEPALIVE) ===== */}
      <div className="bg-white dark:bg-[#0F172A]/60 backdrop-blur-md border border-[#EEF2F7] dark:border-white/[0.06] p-6 md:p-8 rounded-[20px] shadow-premium dark:shadow-none transition-all duration-300">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Database className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[#0F172A] dark:text-white tracking-tight">
              Anti-Inatividade do Supabase (Keep-Alive)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Configure pings automáticos to evitar o congelamento e suspensão da sua conta Supabase.
            </p>
          </div>
        </div>

        {/* Toggle Principal de Anti-Inatividade */}
        <div className={`flex items-center justify-between p-6 rounded-3xl border-2 transition-all duration-300 mb-8
          ${keepAliveConfig.enabled
            ? 'border-indigo-300 bg-gradient-to-r from-indigo-50/60 to-violet-50/60 dark:border-indigo-500/20 dark:from-indigo-950/10 dark:to-violet-950/10 shadow-sm'
            : 'border-slate-200/60 bg-slate-50/60 dark:border-slate-800/40 dark:bg-slate-900/10'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm
              ${keepAliveConfig.enabled ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
              <Database className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-[#0F172A] dark:text-slate-100 tracking-tight">
                {keepAliveConfig.enabled ? 'Anti-Inatividade Ativo' : 'Anti-Inatividade Inativo'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                {keepAliveConfig.enabled ? 'O navegador enviará pings periódicos quando o app estiver aberto.' : 'Habilite o ping no navegador.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ToggleSwitch
              checked={keepAliveConfig.enabled}
              onChange={handleToggleKeepAlive}
            />
          </div>
        </div>

        {/* Configurações Avançadas e Ping Manual */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
          <div className="space-y-6">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Painel Local</p>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-5 bg-white/40 dark:bg-slate-900/10 border border-slate-200/50 dark:border-slate-800/40 rounded-2xl">
                <div>
                  <p className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">Frequência do Ping</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Padrão recomendado: 4 dias</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1} max={6}
                    value={keepAliveConfig.intervalDays}
                    onChange={(e) => handleIntervalChange(Number(e.target.value))}
                    className="w-16 px-2.5 py-1.5 text-sm font-bold text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all dark:text-white"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">dias</span>
                </div>
              </div>

              {/* Botão de teste manual */}
              <div className="p-5 bg-white/40 dark:bg-slate-900/10 border border-slate-200/50 dark:border-slate-800/40 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">Testar Conexão</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Disparar um ping manual ao banco agora</p>
                </div>
                <button
                  type="button"
                  disabled={isPingInProgress}
                  onClick={handleManualPing}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 rounded-xl shadow-md shadow-indigo-500/25 active:scale-[0.98] transition-all"
                >
                  {isPingInProgress ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  <span>{isPingInProgress ? 'Enviando...' : 'Ping Manual'}</span>
                </button>
              </div>
            </div>

            {/* Logs de Pings */}
            <div className="mt-6">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 ml-1">Terminal de Logs</p>
              <div className="bg-slate-950 text-slate-200 font-mono text-[11px] p-4 rounded-2xl h-36 overflow-y-auto border border-slate-850 space-y-1.5 shadow-inner">
                {keepAliveConfig.pingLogs.length > 0 ? (
                  keepAliveConfig.pingLogs.map((log, idx) => (
                    <div key={idx} className={log.includes('Sucesso') ? 'text-emerald-400 flex items-center gap-1.5' : 'text-rose-400 flex items-center gap-1.5'}>
                      <span className={`w-1.5 h-1.5 rounded-full ${log.includes('Sucesso') ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                      <span>{log}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 text-center py-10 italic">Nenhum log registrado ainda.</div>
                )}
              </div>
            </div>
          </div>

          {/* Solução Serverless Automática */}
          <div className="space-y-6 lg:border-l border-slate-200/50 dark:border-slate-850 lg:pl-8 pt-8 lg:pt-0">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
              <Cloud className="h-4 w-4 text-sky-500 shrink-0" />
              <span>Automação em Nuvem</span>
            </p>
            
            <div className="space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
                Para que o banco não congele mesmo se você passar semanas sem abrir este site, configuramos um script automático via GitHub Actions.
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                Siga o passo a passo para ativá-lo:
              </p>
              <ol className="list-decimal list-inside text-xs text-slate-600 dark:text-slate-400 space-y-2 ml-1 leading-relaxed font-medium">
                <li>Acesse o seu repositório no seu GitHub.</li>
                <li>Vá em <strong>Settings</strong> &gt; <strong>Secrets and variables</strong> &gt; <strong>Actions</strong>.</li>
                <li>Clique em <strong>New repository secret</strong> e crie os dois Secrets:</li>
              </ol>
              
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-850 font-mono text-[11px] space-y-2.5 text-slate-300 shadow-inner">
                <div className="flex justify-between items-center bg-slate-900/40 p-2 rounded-xl border border-slate-850/50">
                  <span>Name: <strong className="text-indigo-400">SUPABASE_URL</strong></span>
                  <button type="button" onClick={() => { navigator.clipboard.writeText('SUPABASE_URL'); showToast('Copiado!', 'success'); }} className="text-[10px] text-slate-400 hover:text-white px-2 py-1 bg-slate-800/80 rounded-lg active:scale-95 transition-all">Copiar</button>
                </div>
                <div className="flex justify-between items-center bg-slate-900/40 p-2 rounded-xl border border-slate-850/50">
                  <span>Name: <strong className="text-indigo-400">SUPABASE_ANON_KEY</strong></span>
                  <button type="button" onClick={() => { navigator.clipboard.writeText('SUPABASE_ANON_KEY'); showToast('Copiado!', 'success'); }} className="text-[10px] text-slate-400 hover:text-white px-2 py-1 bg-slate-800/80 rounded-lg active:scale-95 transition-all">Copiar</button>
                </div>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 italic leading-relaxed font-medium">
                Pronto! O GitHub passará a rodar a tarefa em segundo plano a cada 4 dias na nuvem, garantindo que o seu banco permaneça ativo gratuitamente.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
