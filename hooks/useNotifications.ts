import { useState, useEffect, useCallback } from 'react';
import { Transaction } from '../types';
import {
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFS,
  loadNotificationPrefs,
  saveNotificationPrefs,
  requestNotificationPermission,
  sendLocalNotification,
  checkAndTriggerLocalNotifications,
  subscribeToPush,
  unsubscribeFromPush,
} from '../services/notificationService';

export type { NotificationPreferences };
export { DEFAULT_NOTIFICATION_PREFS };

/**
 * Hook React unificado para gerenciamento de notificações
 * Conectado diretamente ao notificationService (Single Source of Truth)
 */
export const useNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFS);
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Inicializar estado das notificações
  useEffect(() => {
    const supported = typeof window !== 'undefined' && ('Notification' in window || 'serviceWorker' in navigator);
    setIsSupported(supported);

    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
    }

    const initPrefs = async () => {
      try {
        const loaded = await loadNotificationPrefs();
        setPreferences(loaded);
      } catch (err) {
        console.warn('[useNotifications] Erro ao carregar preferências:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initPrefs();
  }, []);

  // Salvar preferências atualizadas
  const savePrefs = useCallback(async (newPrefs: NotificationPreferences) => {
    setPreferences(newPrefs);
    try {
      await saveNotificationPrefs(newPrefs, null);
    } catch (err) {
      console.error('[useNotifications] Erro ao salvar preferências:', err);
    }
  }, []);

  // Solicitar permissão de notificação
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      const result = await requestNotificationPermission();
      setPermission(result);
      if (result === 'granted') {
        // Tentar subscrever ao push VAPID se ativado
        await subscribeToPush();
      }
      return result === 'granted';
    } catch (error) {
      console.error('[useNotifications] Erro ao solicitar permissão:', error);
      return false;
    }
  }, [isSupported]);

  // Alternar ativação geral das notificações
  const toggleEnabled = useCallback(async () => {
    if (!preferences.enabled) {
      const granted = await requestPermission();
      if (granted) {
        const updated = { ...preferences, enabled: true };
        await savePrefs(updated);
        return true;
      }
      return false;
    } else {
      const updated = { ...preferences, enabled: false };
      await savePrefs(updated);
      await unsubscribeFromPush();
      return false;
    }
  }, [preferences, requestPermission, savePrefs]);

  // Enviar notificação local
  const showNotification = useCallback(async (title: string, body: string, url: string = '/') => {
    if (!isSupported || permission !== 'granted' || !preferences.enabled) return;
    await sendLocalNotification(title, body, url);
  }, [isSupported, permission, preferences.enabled]);

  // Executar verificação periódica de contas e recebimentos
  const runNotificationCheck = useCallback(async (transactions: Transaction[], force: boolean = false) => {
    if (!preferences.enabled || permission !== 'granted') return;
    await checkAndTriggerLocalNotifications(transactions, preferences, force);
  }, [preferences, permission]);

  return {
    permission,
    preferences,
    isSupported,
    isLoading,
    requestPermission,
    toggleEnabled,
    savePreferences: savePrefs,
    showNotification,
    runNotificationCheck,
  };
};

export default useNotifications;