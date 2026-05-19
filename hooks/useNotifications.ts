import { useState, useEffect, useCallback } from 'react';
import { Transaction, TransactionStatus } from '../types';
import { differenceInDays, format, isToday, isTomorrow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface NotificationPreferences {
  enabled: boolean;
  billsDueToday: boolean;
  billsDueTomorrow: boolean;
  billsDueThisWeek: boolean;
  commissionDay: boolean;
  debtCollection: boolean;
  weeklyReport: boolean;
  checkInterval: number;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: false,
  billsDueToday: true,
  billsDueTomorrow: true,
  billsDueThisWeek: true,
  commissionDay: true,
  debtCollection: true,
  weeklyReport: true,
  checkInterval: 60000,
};

const NOTIFICATION_PREFS_KEY = 'finnexus_notification_prefs';

export const useNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const supported = 'Notification' in window || 'serviceWorker' in navigator;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission || 'default');
    }

    const stored = localStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (stored) {
      try {
        setPreferences(JSON.parse(stored));
      } catch {
        console.log('Failed to parse notification preferences');
      }
    }
  }, []);

  const savePreferences = useCallback((newPrefs: NotificationPreferences) => {
    setPreferences(newPrefs);
    localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(newPrefs));
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported]);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!isSupported || permission !== 'granted' || !preferences.enabled) return;

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title,
        options: {
          body: options?.body || '',
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          vibrate: [100, 50, 100],
          ...options,
        },
      });
    } else if (Notification.permission === 'granted') {
      new Notification(title, {
        body: options?.body || '',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        ...options,
      });
    }
  }, [isSupported, permission, preferences.enabled]);

  const checkBillsDueToday = useCallback((transactions: Transaction[]) => {
    const today = new Date();
    const dueToday = transactions.filter(t => {
      if (t.status === TransactionStatus.COMPLETED) return false;
      const dueDate = parseISO(t.date);
      return isToday(dueDate) && t.type === 'DESPESA';
    });

    if (dueToday.length > 0) {
      const total = dueToday.reduce((sum, t) => sum + t.amount, 0);
      showNotification(
        'Contas a Pagar Hoje',
        {
          body: `Você tem ${dueToday.length} conta(s) para pagar hoje totaling R$ ${total.toLocaleString('pt-BR')}.`,
          tag: 'bills-due-today',
          requireInteraction: true,
          data: { url: '/?tab=transactions' },
        }
      );
    }
  }, [showNotification]);

  const checkBillsDueTomorrow = useCallback((transactions: Transaction[]) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dueTomorrow = transactions.filter(t => {
      if (t.status === TransactionStatus.COMPLETED) return false;
      const dueDate = parseISO(t.date);
      return isTomorrow(dueDate) && t.type === 'DESPESA';
    });

    if (dueTomorrow.length > 0) {
      const total = dueTomorrow.reduce((sum, t) => sum + t.amount, 0);
      showNotification(
        'Contas para Amanhã',
        {
          body: `Prepare-se! Você tem ${dueTomorrow.length} conta(s) para amanhã totalizando R$ ${total.toLocaleString('pt-BR')}.`,
          tag: 'bills-due-tomorrow',
          data: { url: '/?tab=transactions' },
        }
      );
    }
  }, [showNotification]);

  const checkBillsDueThisWeek = useCallback((transactions: Transaction[]) => {
    const today = new Date();
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const dueThisWeek = transactions.filter(t => {
      if (t.status === TransactionStatus.COMPLETED) return false;
      const dueDate = parseISO(t.date);
      const daysUntilDue = differenceInDays(dueDate, today);
      return daysUntilDue >= 0 && daysUntilDue <= 7 && t.type === 'DESPESA';
    });

    if (dueThisWeek.length > 0) {
      const total = dueThisWeek.reduce((sum, t) => sum + t.amount, 0);
      showNotification(
        'Contas Esta Semana',
        {
          body: `Você tem ${dueThisWeek.length} conta(s) para pagar esta semana totalizando R$ ${total.toLocaleString('pt-BR')}.`,
          tag: 'bills-due-week',
          data: { url: '/?tab=transactions' },
        }
      );
    }
  }, [showNotification]);

  const checkCommissionDay = useCallback((transactions: Transaction[]) => {
    const today = new Date();
    const dayOfMonth = today.getDate();

    const commissionsToday = transactions.filter(t => {
      if (!t.commissionPaymentDate) return false;
      const commissionDate = parseISO(t.commissionPaymentDate);
      return isToday(commissionDate);
    });

    if (commissionsToday.length > 0) {
      const total = commissionsToday.reduce((sum, t) => sum + (t.commissionAmount || 0), 0);
      showNotification(
        'Dia de Receber Comissão',
        {
          body: `Parabéns! Você tem ${commissionsToday.length} comissão(ões) para receber hoje totalizando R$ ${total.toLocaleString('pt-BR')}.`,
          tag: 'commission-day',
          requireInteraction: true,
          data: { url: '/?tab=transactions' },
        }
      );
    }

    const upcomingCommissions = transactions.filter(t => {
      if (!t.commissionPaymentDate || t.commissionAmount === undefined) return false;
      const commissionDate = parseISO(t.commissionPaymentDate);
      const daysUntil = differenceInDays(commissionDate, today);
      return daysUntil > 0 && daysUntil <= 3 && t.type === 'RECEITA';
    });

    if (upcomingCommissions.length > 0) {
      const total = upcomingCommissions.reduce((sum, t) => sum + (t.commissionAmount || 0), 0);
      showNotification(
        'Comissões Próximas',
        {
          body: `Você tem ${upcomingCommissions.length} comissão(ões) a receber nos próximos 3 dias totalizando R$ ${total.toLocaleString('pt-BR')}.`,
          tag: 'commission-upcoming',
          data: { url: '/?tab=transactions' },
        }
      );
    }
  }, [showNotification]);

  const checkDebtCollection = useCallback((transactions: Transaction[]) => {
    const today = new Date();

    const overdueDebts = transactions.filter(t => {
      if (t.status !== TransactionStatus.PENDING) return false;
      if (t.type !== 'RECEITA') return false;
      const dueDate = parseISO(t.date);
      return dueDate < today && differenceInDays(today, dueDate) > 0;
    });

    if (overdueDebts.length > 0) {
      const total = overdueDebts.reduce((sum, t) => sum + t.amount, 0);
      showNotification(
        'Dívidas Vencidas',
        {
          body: `Atenção! Você tem ${overdueDebts.length} dívida(s) vencida(s) totalizando R$ ${total.toLocaleString('pt-BR')}.`,
          tag: 'debt-overdue',
          requireInteraction: true,
          data: { url: '/?tab=transactions' },
        }
      );
    }

    const debtsDueToday = transactions.filter(t => {
      if (t.status !== TransactionStatus.PENDING) return false;
      if (t.type !== 'RECEITA') return false;
      const dueDate = parseISO(t.date);
      return isToday(dueDate);
    });

    if (debtsDueToday.length > 0) {
      const total = debtsDueToday.reduce((sum, t) => sum + t.amount, 0);
      showNotification(
        'Recebimentos Hoje',
        {
          body: `Hoje é dia de receber! Você tem ${debtsDueToday.length} pagamento(s) a receber totalizando R$ ${total.toLocaleString('pt-BR')}.`,
          tag: 'debt-due-today',
          requireInteraction: true,
          data: { url: '/?tab=transactions' },
        }
      );
    }
  }, [showNotification]);

  const runNotificationCheck = useCallback((transactions: Transaction[]) => {
    if (!preferences.enabled || permission !== 'granted') return;

    if (preferences.billsDueToday) checkBillsDueToday(transactions);
    if (preferences.billsDueTomorrow) checkBillsDueTomorrow(transactions);
    if (preferences.billsDueThisWeek) checkBillsDueThisWeek(transactions);
    if (preferences.commissionDay) checkCommissionDay(transactions);
    if (preferences.debtCollection) checkDebtCollection(transactions);
  }, [preferences, permission, checkBillsDueToday, checkBillsDueTomorrow, checkBillsDueThisWeek, checkCommissionDay, checkDebtCollection]);

  const toggleEnabled = useCallback(async () => {
    if (!preferences.enabled) {
      const granted = await requestPermission();
      if (granted) {
        savePreferences({ ...preferences, enabled: true });
        return true;
      }
      return false;
    } else {
      savePreferences({ ...preferences, enabled: false });
    }
  }, [preferences, requestPermission, savePreferences]);

  return {
    permission,
    preferences,
    isSupported,
    requestPermission,
    toggleEnabled,
    savePreferences,
    showNotification,
    runNotificationCheck,
  };
};

export default useNotifications;