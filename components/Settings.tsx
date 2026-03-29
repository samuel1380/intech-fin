import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, BellOff, AlertTriangle, CreditCard, Calendar, DollarSign,
  BarChart2, Wallet, ArrowDownCircle, Target, BookOpen, RefreshCw,
  CheckCircle, XCircle, Loader2, Info, Database, Trash2, Cloud, Percent, Plus
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
} from '../services/notificationService';
import { isSupabaseConfigured } from '../services/supabase';
import { TaxSetting } from '../types';

// ============================================================
// COMPONENTE: Toggle Switch (igual ao ThemeToggle)
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
      className={`relative flex items-center rounded-full transition-all duration-400 ease-[cubic-bezier(0.68,-0.15,0.265,1.35)] focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 shrink-0
        ${isSmall ? 'w-[44px] h-[24px] p-[3px]' : 'w-[56px] h-[30px] p-[3px]'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        ${checked
          ? 'bg-gradient-to-r from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25'
          : 'bg-slate-200 dark:bg-slate-700'
        }`}
    >
      <div
        className={`rounded-full bg-white shadow-md transition-all duration-400 ease-[cubic-bezier(0.68,-0.15,0.265,1.35)]
          ${isSmall ? 'w-[18px] h-[18px]' : 'w-[24px] h-[24px]'}
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
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800/50 dark:text-emerald-300',
    error: 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-900/30 dark:border-rose-800/50 dark:text-rose-300',
    info: 'bg-indigo-50 border-indigo-200 text-indigo-800 dark:bg-indigo-900/30 dark:border-indigo-800/50 dark:text-indigo-300',
  };

  const icons = {
    success: <CheckCircle className="h-4 w-4 shrink-0" />,
    error: <XCircle className="h-4 w-4 shrink-0" />,
    info: <Info className="h-4 w-4 shrink-0" />,
  };

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold shadow-xl animate-fade-in-up backdrop-blur-sm ${colors[type]}`}
      style={{ maxWidth: 'calc(100vw - 2rem)' }}
    >
      {icons[type]}
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100 transition-opacity">
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
  <div className={`rounded-xl border transition-all duration-300 overflow-hidden
    ${enabled && !disabled
      ? 'border-indigo-200 bg-indigo-50/50 dark:border-indigo-800/40 dark:bg-indigo-900/10'
      : 'border-slate-100 bg-slate-50/50 dark:border-slate-800/40 dark:bg-slate-800/10'
    }`}
  >
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white text-base ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className={`font-semibold text-sm truncate ${enabled && !disabled ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
            {title}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 leading-snug">{description}</p>
        </div>
      </div>
      <ToggleSwitch checked={enabled} onChange={onToggle} disabled={disabled} size="sm" />
    </div>
    {enabled && !disabled && children && (
      <div className="px-4 pb-4 pt-0 border-t border-indigo-100 dark:border-indigo-800/30">
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
    };
    init();
  }, []);

  // Salvar prefs com debounce quando mudam
  const savePrefs = useCallback(async (newPrefs: NotificationPreferences, sub?: PushSubscription | null) => {
    setIsSaving(true);
    try {
      await saveNotificationPrefs(newPrefs, sub !== undefined ? sub : pushSubscription);
    } catch (err) {
      console.error('Erro ao salvar prefs:', err);
    } finally {
      setIsSaving(false);
    }
  }, [pushSubscription]);

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
        '🎉 FinNexus Notificações Ativadas!',
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
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* ===== SEÇÃO: NOTIFICAÇÕES ===== */}
      <div className="bg-white dark:bg-[#111a2e]/80 border border-slate-200 dark:border-slate-700/40 p-6 md:p-8 rounded-2xl shadow-xl dark:shadow-none">
        {/* Header da seção */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Bell className="h-5 w-5 text-white" />
              </div>
              Notificações
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 ml-[52px]">
              Receba alertas financeiros importantes mesmo com o app fechado.
            </p>
          </div>
          {isSaving && (
            <div className="flex items-center gap-1.5 text-xs text-indigo-500 shrink-0">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Salvando...</span>
            </div>
          )}
        </div>

        {/* Aviso iOS */}
        {typeof navigator !== 'undefined' && /iPhone|iPad/i.test(navigator.userAgent) && (
          <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl flex items-start gap-3">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">iOS Safari</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                No iPhone, as notificações push funcionam apenas quando o app está instalado na tela inicial via "Adicionar à Tela de Início".
              </p>
            </div>
          </div>
        )}

        {/* Sistema não suportado */}
        {!isNotifSupported && (
          <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl flex items-start gap-3">
            <BellOff className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Notificações push não são suportadas neste browser. Use Chrome ou Safari no iOS 16.4+.
            </p>
          </div>
        )}

        {/* Permissão negada */}
        {isNotifBlocked && (
          <div className="mb-4 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 rounded-xl flex items-start gap-3">
            <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">Permissão Bloqueada</p>
              <p className="text-xs text-rose-700 dark:text-rose-400 mt-0.5">
                Você bloqueou as notificações. Para reativar: vá em <strong>Configurações do celular → Notificações → FinNexus</strong> e permita.
              </p>
            </div>
          </div>
        )}

        {/* Toggle Principal */}
        <div className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all duration-300 mb-6
          ${prefs.enabled
            ? 'border-indigo-300 bg-gradient-to-r from-indigo-50 to-violet-50 dark:border-indigo-700/60 dark:from-indigo-900/20 dark:to-violet-900/20'
            : 'border-slate-200 bg-slate-50 dark:border-slate-700/40 dark:bg-slate-800/20'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-sm transition-colors duration-300
              ${prefs.enabled ? 'bg-indigo-600 shadow-indigo-500/30' : 'bg-slate-200 dark:bg-slate-700'}`}>
              {prefs.enabled
                ? <Bell className="h-5 w-5 text-white" />
                : <BellOff className="h-5 w-5 text-slate-500 dark:text-slate-400" />
              }
            </div>
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-100">
                {prefs.enabled ? 'Notificações Ativas' : 'Notificações Desativadas'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {prefs.enabled ? 'Você receberá alertas financeiros.' : 'Ative para receber alertas importantes.'}
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
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">
              Tipos de Notificação
            </p>

            {/* Contas prestes a vencer */}
            <NotifItem
              icon="⚠️"
              iconBg="bg-amber-500"
              title="Contas Prestes a Vencer"
              description="Despesas pendentes próximas do vencimento"
              enabled={prefs.billsDueSoon}
              onToggle={(v) => updatePref('billsDueSoon', v)}
            >
              <div className="pt-3 flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  Avisar com
                </label>
                <input
                  type="number"
                  min={1} max={30}
                  value={prefs.billsDueSoonDays}
                  onChange={(e) => updatePref('billsDueSoonDays', Number(e.target.value))}
                  className="w-16 px-2 py-1.5 text-sm font-bold text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">dia(s) de antecedência</span>
              </div>
            </NotifItem>

            {/* Comissões */}
            <NotifItem
              icon="💳"
              iconBg="bg-blue-500"
              title="Dia de Pagamento de Comissão"
              description="Aviso no dia em que comissões devem ser pagas"
              enabled={prefs.commissionPaymentDay}
              onToggle={(v) => updatePref('commissionPaymentDay', v)}
            />

            {/* Recebíveis */}
            <NotifItem
              icon="💰"
              iconBg="bg-emerald-500"
              title="Recebíveis Próximos"
              description="Receitas pendentes prestes a vencer"
              enabled={prefs.debtReceivable}
              onToggle={(v) => updatePref('debtReceivable', v)}
            >
              <div className="pt-3 flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  Avisar com
                </label>
                <input
                  type="number"
                  min={1} max={14}
                  value={prefs.debtReceivableDays}
                  onChange={(e) => updatePref('debtReceivableDays', Number(e.target.value))}
                  className="w-16 px-2 py-1.5 text-sm font-bold text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">dia(s) de antecedência</span>
              </div>
            </NotifItem>

            {/* Contas Recorrentes */}
            <NotifItem
              icon="🔁"
              iconBg="bg-violet-500"
              title="Despesas Recorrentes"
              description="Lembrete antes de despesas recorrentes vencerem"
              enabled={prefs.recurringBills}
              onToggle={(v) => updatePref('recurringBills', v)}
            >
              <div className="pt-3 flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  Avisar com
                </label>
                <input
                  type="number"
                  min={1} max={14}
                  value={prefs.recurringBillsDays}
                  onChange={(e) => updatePref('recurringBillsDays', Number(e.target.value))}
                  className="w-16 px-2 py-1.5 text-sm font-bold text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">dia(s) de antecedência</span>
              </div>
            </NotifItem>

            {/* Fechamento Mensal */}
            <NotifItem
              icon="📆"
              iconBg="bg-indigo-500"
              title="Lembrete de Fechamento Mensal"
              description="Alerta para revisar o mês financeiro"
              enabled={prefs.monthlyClose}
              onToggle={(v) => updatePref('monthlyClose', v)}
            >
              <div className="pt-3 flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  Lembrar no dia
                </label>
                <input
                  type="number"
                  min={1} max={31}
                  value={prefs.monthlyCloseDay}
                  onChange={(e) => updatePref('monthlyCloseDay', Number(e.target.value))}
                  className="w-16 px-2 py-1.5 text-sm font-bold text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">de cada mês</span>
              </div>
            </NotifItem>

            {/* Botão de teste */}
            <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={async () => {
                  try {
                    await sendLocalNotification(
                      '🧪 Teste de Notificação',
                      'Notificações do FinNexus estão funcionando corretamente!',
                      '/'
                    );
                    showToast('Notificação de teste enviada!', 'success');
                  } catch (err) {
                    showToast('Erro ao enviar teste. Verifique as permissões.', 'error');
                  }
                }}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/40 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-all"
              >
                <Bell className="h-4 w-4" />
                Enviar Notificação de Teste
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== SEÇÃO: IMPOSTOS ===== */}
      <div className="bg-white dark:bg-[#111a2e]/80 border border-slate-200 dark:border-slate-700/40 p-6 md:p-8 rounded-2xl shadow-xl dark:shadow-none">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
          <Percent className="h-6 w-6 text-indigo-600" />
          Configuração de Impostos
        </h2>
        <p className="text-slate-600 dark:text-slate-300 mb-6">
          Configure os impostos incidentes sobre o faturamento. O sistema somará as porcentagens para calcular a provisão fiscal.
        </p>

        <div className="space-y-3 mb-8">
          {taxSettings.map((tax) => (
            <div key={tax.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 transition-all hover:border-indigo-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs ring-1 ring-indigo-100 dark:ring-indigo-800/50">
                  %
                </div>
                <div>
                  <h5 className="font-bold text-slate-800 dark:text-slate-200">{tax.name}</h5>
                  <p className="text-xs text-slate-500 font-medium">{tax.percentage}% do lucro</p>
                </div>
              </div>
              <button
                onClick={() => onDeleteTax(tax.id)}
                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {taxSettings.length === 0 && (
            <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              <p className="text-sm text-slate-500">Nenhum imposto configurado. Usando padrão de 15%.</p>
            </div>
          )}
        </div>

        <form onSubmit={onAddTax} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <input
              required
              placeholder="Nome (Ex: ISS)"
              value={newTaxName}
              onChange={(e) => setNewTaxName(e.target.value)}
              className="w-full h-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium dark:text-white"
            />
          </div>
          <div className="md:col-span-2 relative">
            <input
              required
              type="number"
              step="0.01"
              placeholder="Porcentagem (%)"
              value={newTaxPercent}
              onChange={(e) => setNewTaxPercent(e.target.value)}
              className="w-full h-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium dark:text-white pr-10"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
          </div>
          <button
            type="submit"
            className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Adicionar</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default Settings;
