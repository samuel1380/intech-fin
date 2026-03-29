import { supabase, isSupabaseConfigured } from './supabase';

// ============================================================
// TIPOS
// ============================================================
export interface NotificationPreferences {
  enabled: boolean;
  // Contas a Pagar / Vencer
  billsDueSoon: boolean;
  billsDueSoonDays: number; // quantos dias antes
  // Comissões
  commissionPaymentDay: boolean;
  // Dívidas / Recebíveis
  debtReceivable: boolean;
  debtReceivableDays: number;
  // Saldo baixo
  lowBalance: boolean;
  lowBalanceThreshold: number;
  // Nova movimentação
  newTransaction: boolean;
  // Meta atingida
  goalReached: boolean;
  // Fechamento mensal
  monthlyClose: boolean;
  monthlyCloseDay: number; // dia do mês para lembrar
  // Contas recorrentes
  recurringBills: boolean;
  recurringBillsDays: number;
  // Resumo semanal
  weeklySummary: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  enabled: false,
  billsDueSoon: true,
  billsDueSoonDays: 3,
  commissionPaymentDay: true,
  debtReceivable: true,
  debtReceivableDays: 2,
  lowBalance: false,
  lowBalanceThreshold: 500,
  newTransaction: false,
  goalReached: true,
  monthlyClose: true,
  monthlyCloseDay: 28,
  recurringBills: true,
  recurringBillsDays: 3,
  weeklySummary: false,
};

// ============================================================
// VAPID PUBLIC KEY (gerada com web-push, salva como env var)
// Esta chave é PÚBLICA - pode ficar no frontend
// A chave privada fica APENAS no backend (Supabase Edge Function)
// ============================================================
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ============================================================
// REGISTRO DO SERVICE WORKER
// ============================================================
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service Worker não suportado neste browser.');
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[PWA] Service Worker registrado:', registration.scope);
    return registration;
  } catch (err) {
    console.error('[PWA] Erro ao registrar Service Worker:', err);
    return null;
  }
}

// ============================================================
// SOLICITAR PERMISSÃO DE NOTIFICAÇÃO
// ============================================================
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('[PWA] Notificações não suportadas.');
    return 'denied';
  }

  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';

  // iOS Safari requer user gesture — já estamos dentro de um click handler
  const permission = await Notification.requestPermission();
  return permission;
}

// ============================================================
// SUBSCREVER PARA PUSH
// ============================================================
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[PWA] VAPID_PUBLIC_KEY não configurada. Push desativado.');
    return null;
  }

  const registration = await navigator.serviceWorker.ready;

  try {
    const existing = await registration.pushManager.getSubscription();
    if (existing) return existing;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    console.log('[PWA] Push subscription criada:', subscription.endpoint);
    return subscription;
  } catch (err) {
    console.error('[PWA] Erro ao subscrever push:', err);
    return null;
  }
}

// ============================================================
// CANCELAR SUBSCRIÇÃO
// ============================================================
export async function unsubscribeFromPush(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
    console.log('[PWA] Push subscription cancelada.');
  }
}

// ============================================================
// SALVAR PREFERÊNCIAS NO SUPABASE
// ============================================================
export async function saveNotificationPrefs(
  prefs: NotificationPreferences,
  subscription: PushSubscription | null
): Promise<void> {
  if (!isSupabaseConfigured) {
    // Fallback: salvar no localStorage
    localStorage.setItem('finnexus_notif_prefs', JSON.stringify(prefs));
    if (subscription) {
      localStorage.setItem('finnexus_push_subscription', JSON.stringify(subscription));
    }
    return;
  }

  const userId = 'intechfin_default'; // Single-user system

  const payload = {
    user_id: userId,
    preferences: prefs,
    push_subscription: subscription ? subscription.toJSON() : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('notification_preferences')
    .upsert([payload], { onConflict: 'user_id' });

  if (error) {
    console.error('[Notifications] Erro ao salvar preferências:', error);
    // Fallback to localStorage
    localStorage.setItem('finnexus_notif_prefs', JSON.stringify(prefs));
  }
}

// ============================================================
// CARREGAR PREFERÊNCIAS DO SUPABASE
// ============================================================
export async function loadNotificationPrefs(): Promise<NotificationPreferences> {
  // Primeiro tenta localStorage (rápido e offline-friendly)
  const localPrefs = localStorage.getItem('finnexus_notif_prefs');

  if (!isSupabaseConfigured) {
    return localPrefs ? JSON.parse(localPrefs) : DEFAULT_NOTIFICATION_PREFS;
  }

  try {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('preferences')
      .eq('user_id', 'intechfin_default')
      .single();

    if (!error && data?.preferences) {
      // Merge com defaults para garantir novos campos
      const merged = { ...DEFAULT_NOTIFICATION_PREFS, ...data.preferences };
      localStorage.setItem('finnexus_notif_prefs', JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    console.warn('[Notifications] Erro ao carregar prefs do Supabase:', err);
  }

  return localPrefs ? { ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(localPrefs) } : DEFAULT_NOTIFICATION_PREFS;
}

// ============================================================
// ENVIAR NOTIFICAÇÃO LOCAL (para teste / feedback imediato)
// ============================================================
export async function sendLocalNotification(
  title: string,
  body: string,
  url: string = '/'
): Promise<void> {
  if (Notification.permission !== 'granted') return;

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(title, {
    body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: { url },
    vibrate: [200, 100, 200],
  });
}

// ============================================================
// VERIFICAR NOTIFICAÇÕES LOCAIS (executa ao inicializar o app)
// Simula o que o cron job faria no backend
// ============================================================
export async function checkAndTriggerLocalNotifications(
  transactions: any[],
  prefs: NotificationPreferences
): Promise<void> {
  if (!prefs.enabled || Notification.permission !== 'granted') return;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // === CONTAS PRESTES A VENCER (DESPESAS PENDENTES) ===
  if (prefs.billsDueSoon) {
    const dueSoonDays = prefs.billsDueSoonDays || 3;
    const dueSoonDate = new Date(today);
    dueSoonDate.setDate(dueSoonDate.getDate() + dueSoonDays);
    const dueSoonStr = dueSoonDate.toISOString().split('T')[0];

    const overdueBills = transactions.filter((t) => {
      return (
        t.type === 'DESPESA' &&
        t.status === 'PENDENTE' &&
        t.date >= todayStr &&
        t.date <= dueSoonStr
      );
    });

    if (overdueBills.length > 0) {
      const total = overdueBills.reduce((s: number, t: any) => s + t.amount, 0);
      await sendLocalNotification(
        '⚠️ Contas Prestes a Vencer',
        `${overdueBills.length} despesa(s) vencem nos próximos ${dueSoonDays} dias. Total: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        '/index.html#accounts'
      );
    }
  }

  // === COMISSÕES A PAGAR ===
  if (prefs.commissionPaymentDay) {
    const commissionsToday = transactions.filter((t) => {
      return t.commissionAmount && t.commissionPaymentDate === todayStr;
    });

    if (commissionsToday.length > 0) {
      const total = commissionsToday.reduce((s: number, t: any) => s + (t.commissionAmount || 0), 0);
      await sendLocalNotification(
        '💳 Dia de Pagamento de Comissão',
        `${commissionsToday.length} comissão(ões) para pagar hoje. Total: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        '/index.html#transactions'
      );
    }
  }

  // === RECEBÍVEIS A VENCER ===
  if (prefs.debtReceivable) {
    const receivableDays = prefs.debtReceivableDays || 2;
    const receivableDate = new Date(today);
    receivableDate.setDate(receivableDate.getDate() + receivableDays);
    const receivableStr = receivableDate.toISOString().split('T')[0];

    const receivables = transactions.filter((t) => {
      return (
        t.type === 'RECEITA' &&
        t.status === 'PENDENTE' &&
        t.date >= todayStr &&
        t.date <= receivableStr
      );
    });

    if (receivables.length > 0) {
      const total = receivables.reduce((s: number, t: any) => s + t.amount, 0);
      await sendLocalNotification(
        '💰 Recebimento Próximo',
        `${receivables.length} receita(s) para receber nos próximos ${receivableDays} dias. Total: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        '/index.html#accounts'
      );
    }
  }

  // === CONTAS RECORRENTES ===
  if (prefs.recurringBills) {
    const recurringDays = prefs.recurringBillsDays || 3;
    const recurringDate = new Date(today);
    recurringDate.setDate(recurringDate.getDate() + recurringDays);
    const recurringStr = recurringDate.toISOString().split('T')[0];

    const recurringDue = transactions.filter((t) => {
      return (
        t.isRecurring &&
        t.type === 'DESPESA' &&
        t.status === 'PENDENTE' &&
        t.date >= todayStr &&
        t.date <= recurringStr
      );
    });

    if (recurringDue.length > 0) {
      await sendLocalNotification(
        '🔁 Despesas Recorrentes',
        `${recurringDue.length} despesa(s) recorrente(s) vencem em até ${recurringDays} dias.`,
        '/index.html#transactions'
      );
    }
  }

  // === FECHAMENTO MENSAL ===
  if (prefs.monthlyClose) {
    const closeDay = prefs.monthlyCloseDay || 28;
    if (today.getDate() === closeDay) {
      await sendLocalNotification(
        '📆 Lembrete de Fechamento Mensal',
        'Hoje é o dia de fechar o mês! Revise receitas, despesas e pendências.',
        '/index.html#reports'
      );
    }
  }
}
