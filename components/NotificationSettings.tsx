import React from 'react';
import { NotificationPreferences } from '../hooks/useNotifications';
import { NotificationToggle } from './NotificationToggle';
import { 
  Bell, 
  CalendarClock, 
  CreditCard, 
  DollarSign, 
  TrendingUp,
  AlertTriangle,
  FileText,
  RefreshCw
} from 'lucide-react';

interface NotificationSettingsProps {
  preferences: NotificationPreferences;
  permission: NotificationPermission;
  isSupported: boolean;
  onToggleMain: () => void;
  onPreferenceChange: (key: keyof NotificationPreferences, value: boolean) => void;
  className?: string;
}

interface NotificationOption {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const NOTIFICATION_OPTIONS: NotificationOption[] = [
  {
    key: 'billsDueToday',
    label: 'Contas a Pagar Hoje',
    description: 'Receba um aviso quando tiver contas para pagar no dia',
    icon: <CreditCard className="w-5 h-5" />,
    color: 'text-danger-500',
  },
  {
    key: 'billsDueTomorrow',
    label: 'Contas para Amanhã',
    description: 'Seja avisado sobre contas vencendo no dia seguinte',
    icon: <CalendarClock className="w-5 h-5" />,
    color: 'text-warning-500',
  },
  {
    key: 'billsDueThisWeek',
    label: 'Contas da Semana',
    description: 'Resumo semanal das contas a pagar',
    icon: <FileText className="w-5 h-5" />,
    color: 'text-warning-500',
  },
  {
    key: 'commissionDay',
    label: 'Dia de Comissão',
    description: 'Aviso quando for dia de receber comissões',
    icon: <TrendingUp className="w-5 h-5" />,
    color: 'text-success-500',
  },
  {
    key: 'debtCollection',
    label: 'Aviso de Cobrança',
    description: 'Notificações sobre dívidas e recebíveis',
    icon: <DollarSign className="w-5 h-5" />,
    color: 'text-brand-500',
  },
  {
    key: 'weeklyReport',
    label: 'Relatório Semanal',
    description: 'Resumo do desempenho financeiro semanal',
    icon: <AlertTriangle className="w-5 h-5" />,
    color: 'text-brand-500',
  },
];

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  preferences,
  permission,
  isSupported,
  onToggleMain,
  onPreferenceChange,
  className = '',
}) => {
  const getPermissionStatus = () => {
    if (!isSupported) {
      return { text: 'Não Suportado', color: 'text-slate-400', bg: 'bg-surface-100 dark:bg-surface-800' };
    }
    switch (permission) {
      case 'granted':
        return { text: 'Ativo', color: 'text-success-600 dark:text-success-400', bg: 'bg-success-50 dark:bg-success-900/20' };
      case 'denied':
        return { text: 'Bloqueado', color: 'text-danger-600 dark:text-danger-400', bg: 'bg-danger-50 dark:bg-danger-900/20' };
      default:
        return { text: 'Pendente', color: 'text-warning-600 dark:text-warning-400', bg: 'bg-warning-50 dark:bg-warning-900/20' };
    }
  };

  const status = getPermissionStatus();

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="bg-white dark:bg-surface-900/60 border border-surface-200/60 dark:border-surface-800/60 p-6 rounded-xl shadow-card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-50 dark:bg-brand-900/30 rounded-xl">
              <Bell className="w-6 h-6 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Notificações</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isSupported ? `Permissão: ` : 'Navegador não suporta'}
                <span className={`font-semibold ml-1 px-2 py-0.5 rounded-full text-xs ${status.bg} ${status.color}`}>
                  {status.text}
                </span>
              </p>
            </div>
          </div>
          <NotificationToggle
            isEnabled={preferences.enabled}
            onToggle={onToggleMain}
            disabled={!isSupported || permission === 'denied'}
          />
        </div>

        {permission === 'denied' && (
          <div className="mb-6 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800/30 rounded-xl">
            <p className="text-sm text-danger-700 dark:text-danger-400 text-center">
              As notificações foram bloqueadas. Para ativar, vá às configurações do seu navegador e permita notificações para este site.
            </p>
          </div>
        )}

        {permission === 'default' && preferences.enabled && (
          <div className="mb-6 p-4 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800/30 rounded-xl">
            <p className="text-sm text-warning-700 dark:text-warning-400 text-center">
              Clique no botão acima para permitir notificações quando solicitado pelo navegador.
            </p>
          </div>
        )}
      </div>

      <div className={`space-y-3 transition-opacity duration-300 ${preferences.enabled && permission === 'granted' ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
        {NOTIFICATION_OPTIONS.map((option) => (
          <div
            key={option.key}
            className="bg-white dark:bg-surface-900/60 border border-surface-200/60 dark:border-surface-800/60 p-4 rounded-xl flex items-center justify-between gap-4 transition-all hover:border-brand-200 dark:hover:border-brand-700/50"
          >
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className={`p-2.5 rounded-xl bg-surface-50 dark:bg-surface-800/60 ${option.color}`}>
                {option.icon}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-slate-800 dark:text-white text-sm md:text-base">
                  {option.label}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                  {option.description}
                </p>
              </div>
            </div>
            <NotificationToggle
              isEnabled={preferences[option.key] as boolean}
              onToggle={() => onPreferenceChange(option.key, !preferences[option.key])}
              className="scale-90"
            />
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-surface-900/60 border border-surface-200/60 dark:border-surface-800/60 p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-surface-50 dark:bg-surface-800/60 text-slate-500 dark:text-slate-400">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-slate-800 dark:text-white text-sm">
              Verificação Automática
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              As notificações são verificadas automaticamente a cada 1 minuto quando o app está aberto.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;