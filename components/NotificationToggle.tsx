import React from 'react';
import { Bell, BellOff } from 'lucide-react';

interface NotificationToggleProps {
    isEnabled: boolean;
    onToggle: () => void;
    className?: string;
    disabled?: boolean;
}

export const NotificationToggle: React.FC<NotificationToggleProps> = ({ 
    isEnabled, 
    onToggle, 
    className = '',
    disabled = false 
}) => {
    return (
        <button
            onClick={onToggle}
            disabled={disabled}
            className={`group relative flex items-center w-[68px] h-[34px] rounded-full p-[3px] transition-all duration-500 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 ${className} ${
                isEnabled
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25'
                    : 'bg-gradient-to-r from-slate-300 to-slate-400 shadow-lg shadow-slate-400/25'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label={isEnabled ? 'Desativar notificações' : 'Ativar notificações'}
            title={isEnabled ? 'Notificações Ativas' : 'Notificações Desativadas'}
        >
            <div className={`absolute inset-0 rounded-full overflow-hidden transition-opacity duration-500 ${isEnabled ? 'opacity-100' : 'opacity-0'}`}>
                <div className="absolute top-[7px] left-[12px] w-[3px] h-[3px] bg-white/60 rounded-full animate-pulse" style={{ animationDuration: '2s' }}></div>
                <div className="absolute top-[15px] left-[22px] w-[2px] h-[2px] bg-white/40 rounded-full animate-pulse" style={{ animationDuration: '3s', animationDelay: '0.5s' }}></div>
                <div className="absolute bottom-[8px] left-[8px] w-[2px] h-[2px] bg-white/50 rounded-full animate-pulse" style={{ animationDuration: '2.5s', animationDelay: '1s' }}></div>
            </div>

            <div
                className={`relative z-10 flex items-center justify-center w-[28px] h-[28px] rounded-full bg-white shadow-md transition-all duration-500 ease-[cubic-bezier(0.68,-0.15,0.265,1.35)] ${
                    isEnabled ? 'translate-x-[34px]' : 'translate-x-0'
                } group-hover:shadow-lg group-active:scale-90`}
            >
                {isEnabled ? (
                    <Bell className="w-[16px] h-[16px] text-emerald-500 transition-all duration-400" />
                ) : (
                    <BellOff className="w-[16px] h-[16px] text-slate-400 transition-all duration-400" />
                )}
            </div>
        </button>
    );
};

export default NotificationToggle;