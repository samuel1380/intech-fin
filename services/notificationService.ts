import { isSupabaseConfigured, requireUserId, supabase } from './supabase';

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
  // Resumo diário de faturamento (agora periódico)
  dailySummary: boolean;
  dailySummaryIntervalValue: number;
  dailySummaryIntervalUnit: 'seconds' | 'minutes' | 'hours' | 'days';
  // Frequência de verificação no frontend
  checkIntervalValue: number;
  checkIntervalUnit: 'seconds' | 'minutes' | 'hours';
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
  dailySummary: true,
  dailySummaryIntervalValue: 1,
  dailySummaryIntervalUnit: 'hours',
  checkIntervalValue: 15,
  checkIntervalUnit: 'minutes',
};

// ============================================================
// VAPID PUBLIC KEY (gerada com web-push, salva como env var)
// Esta chave é PÚBLICA - pode ficar no frontend
// A chave privada fica APENAS no backend (Supabase Edge Function)
// ============================================================
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

export function supportsPush(): boolean {
  return (
    window.isSecureContext &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!window.isSecureContext || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
  } catch {
    console.warn('[PWA] Não foi possível registrar o Service Worker.');
    return null;
  }
}
async function readyWorker(): Promise<ServiceWorkerRegistration> {
  const reg = await registerServiceWorker();
  if (!reg) throw new Error('Service Worker indisponível.');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error('Service Worker não ativou. Recarregue o aplicativo.'),
            ),
          8000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window) || !window.isSecureContext) return 'denied';
  return Notification.permission === 'default'
    ? Notification.requestPermission()
    : Notification.permission;
}
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (
    !supportsPush() ||
    !VAPID_PUBLIC_KEY ||
    Notification.permission !== 'granted'
  )
    return null;
  const raw = atob(VAPID_PUBLIC_KEY.replace(/-/g, '+').replace(/_/g, '/'));
  const key = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  if (key.length !== 65 || key[0] !== 4)
    throw new Error('Chave pública VAPID inválida.');
  const reg = await readyWorker();
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    const old = sub.options.applicationServerKey;
    const rotated =
      old &&
      (old.byteLength !== key.length ||
        new Uint8Array(old).some((v, i) => v !== key[i]));
    if (rotated || (sub.expirationTime && sub.expirationTime <= Date.now())) {
      await removeSubscription(sub);
      await sub.unsubscribe();
      sub = null;
    }
  }
  return (
    sub ||
    reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    })
  );
}
async function removeSubscription(sub: PushSubscription) {
  const user_id = await requireUserId();
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user_id)
    .eq('endpoint', sub.endpoint);
  if (error) throw error;
}
export async function unsubscribeFromPush(): Promise<void> {
  if (!supportsPush()) return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    let serverError: unknown;
    try {
      await removeSubscription(sub);
    } catch (error) {
      serverError = error;
    }
    if (!(await sub.unsubscribe()))
      throw new Error('Não foi possível cancelar a inscrição.', {
        cause: serverError,
      });
    if (serverError) throw serverError;
  }
}
export function normalizePrefs(
  input: Partial<NotificationPreferences> = {},
): NotificationPreferences {
  const result = { ...DEFAULT_NOTIFICATION_PREFS };
  for (const key of Object.keys(result) as (keyof NotificationPreferences)[]) {
    const value = input[key];
    if (typeof value === typeof result[key])
      (result as unknown as Record<string, unknown>)[key] = value;
  }
  for (const key of Object.keys(result) as (keyof NotificationPreferences)[]) {
    if (typeof result[key] === 'number') {
      const value = result[key] as number;
      (result as unknown as Record<string, unknown>)[key] = Number.isFinite(
        value,
      )
        ? Math.max(
            1,
            Math.min(value, key === 'lowBalanceThreshold' ? 1e9 : 365),
          )
        : DEFAULT_NOTIFICATION_PREFS[key];
    }
  }
  if (!['seconds', 'minutes', 'hours'].includes(result.checkIntervalUnit))
    result.checkIntervalUnit = 'minutes';
  if (
    !['seconds', 'minutes', 'hours', 'days'].includes(
      result.dailySummaryIntervalUnit,
    )
  )
    result.dailySummaryIntervalUnit = 'hours';
  result.monthlyCloseDay = Math.min(31, result.monthlyCloseDay);
  return result;
}
export async function saveNotificationPrefs(
  prefs: NotificationPreferences,
  subscription: PushSubscription | null,
): Promise<void> {
  const user_id = await requireUserId();
  const { error } = await supabase.from('notification_preferences').upsert(
    {
      user_id,
      preferences: normalizePrefs(prefs),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
  if (subscription && prefs.enabled) {
    const { error: subError } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id,
          endpoint: subscription.endpoint,
          subscription: subscription.toJSON(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,endpoint' },
      );
    if (subError) throw subError;
  }
}
export async function loadNotificationPrefs(): Promise<NotificationPreferences> {
  if (!isSupabaseConfigured) return { ...DEFAULT_NOTIFICATION_PREFS };
  const user_id = await requireUserId();
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('preferences')
    .eq('user_id', user_id)
    .maybeSingle();
  if (error) throw error;
  return normalizePrefs(data?.preferences || {});
}
export async function syncPushSubscription(): Promise<void> {
  if (!supportsPush() || Notification.permission !== 'granted') return;
  const prefs = await loadNotificationPrefs();
  if (prefs.enabled) {
    const sub = await subscribeToPush();
    if (sub) {
      const user_id = await requireUserId();
      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id,
          endpoint: sub.endpoint,
          subscription: sub.toJSON(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,endpoint' },
      );
      if (error) throw error;
    }
  }
}
const delivered = new Map<string, number>();
export async function sendLocalNotification(
  title: string,
  body: string,
  url = '/',
): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted')
    return;
  const tag = title + '|' + body;
  if (Date.now() - (delivered.get(tag) || 0) < 3600000) return;
  const target = new URL(url, location.origin);
  const options: NotificationOptions = {
    body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: title,
    data: { url: target.origin === location.origin ? target.href : '/' },
  };
  try {
    const reg = await readyWorker();
    await reg.showNotification(title, options);
  } catch {
    window.dispatchEvent(
      new CustomEvent('app:feedback', {
        detail: { message: title + ': ' + body, type: 'info' },
      }),
    );
  }
  if (delivered.size > 100) delivered.clear();
  delivered.set(tag, Date.now());
}

function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================================
// VERIFICAR NOTIFICAÇÕES LOCAIS (executa ao inicializar o app)
// Simula o que o cron job faria no backend
// ============================================================
export async function checkAndTriggerLocalNotifications(
  transactions: any[],
  prefs: NotificationPreferences,
): Promise<void> {
  if (
    !prefs.enabled ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  )
    return;

  const today = new Date();
  const todayStr = getLocalDateString(today);

  // === CONTAS PRESTES A VENCER (DESPESAS PENDENTES) ===
  if (prefs.billsDueSoon) {
    const dueSoonDays = prefs.billsDueSoonDays || 3;
    const dueSoonDate = new Date(today);
    dueSoonDate.setDate(dueSoonDate.getDate() + dueSoonDays);
    const dueSoonStr = getLocalDateString(dueSoonDate);

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
        '/index.html#accounts',
      );
    }
  }

  // === COMISSÕES A PAGAR ===
  if (prefs.commissionPaymentDay) {
    const commissionsToday = transactions.filter((t) => {
      return t.commissionAmount && t.commissionPaymentDate === todayStr;
    });

    if (commissionsToday.length > 0) {
      const total = commissionsToday.reduce(
        (s: number, t: any) => s + (t.commissionAmount || 0),
        0,
      );
      await sendLocalNotification(
        '💳 Dia de Pagamento de Comissão',
        `${commissionsToday.length} comissão(ões) para pagar hoje. Total: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        '/index.html#transactions',
      );
    }
  }

  // === RECEBÍVEIS A VENCER ===
  if (prefs.debtReceivable) {
    const receivableDays = prefs.debtReceivableDays || 2;
    const receivableDate = new Date(today);
    receivableDate.setDate(receivableDate.getDate() + receivableDays);
    const receivableStr = getLocalDateString(receivableDate);

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
        '/index.html#accounts',
      );
    }
  }

  // === CONTAS RECORRENTES ===
  if (prefs.recurringBills) {
    const recurringDays = prefs.recurringBillsDays || 3;
    const recurringDate = new Date(today);
    recurringDate.setDate(recurringDate.getDate() + recurringDays);
    const recurringStr = getLocalDateString(recurringDate);

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
        '/index.html#transactions',
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
        '/index.html#reports',
      );
    }
  }

  // === RESUMO DIÁRIO DE FATURAMENTO (PERIÓDICO) ===
  if (prefs.dailySummary) {
    const val = prefs.dailySummaryIntervalValue || 1;
    const unit = prefs.dailySummaryIntervalUnit || 'hours';

    let msInterval = 1 * 60 * 60 * 1000;
    if (unit === 'seconds') msInterval = val * 1000;
    else if (unit === 'minutes') msInterval = val * 60 * 1000;
    else if (unit === 'hours') msInterval = val * 60 * 60 * 1000;
    else if (unit === 'days') msInterval = val * 24 * 60 * 60 * 1000;

    const now = Date.now();
    const lastDailySentStr =
      localStorage.getItem('finnexus_last_daily_summary_sent_time') || '0';
    const lastDailySent = parseInt(lastDailySentStr, 10);

    if (now - lastDailySent >= msInterval) {
      const todayRevenue = transactions.filter((t) => {
        return (
          t.type === 'RECEITA' &&
          (t.status === 'CONCLUÍDO' || t.status === 'PAGTO PARCIAL') &&
          t.date === todayStr
        );
      });

      const totalFaturado = todayRevenue.reduce(
        (s: number, t: any) => s + t.amount,
        0,
      );

      const frases = [
        'Ótimo trabalho hoje! Continue firme rumo ao sucesso financeiro! 🚀',
        'Cada passo conta. O faturamento de hoje é o fruto do seu esforço! 💪',
        'Mais um dia produtivo! Sua dedicação está transformando o negócio. 📈',
        'Parabéns pelos resultados de hoje! O sucesso é a soma de pequenos esforços diários. ✨',
        'O sucesso não é por acaso, é trabalho duro, perseverança e amor pelo que faz! 🏆',
      ];
      const fraseMotivadora = frases[Math.floor(Math.random() * frases.length)];

      await sendLocalNotification(
        '💰 Resumo de Faturamento',
        `Hoje você faturou R$ ${totalFaturado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. ${fraseMotivadora}`,
        '/index.html#dashboard',
      );

      localStorage.setItem(
        'finnexus_last_daily_summary_sent_time',
        String(now),
      );
    }
  }
}
