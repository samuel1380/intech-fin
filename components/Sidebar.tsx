import React from 'react';
import { LayoutDashboard, Receipt, BarChart3, Bot, Settings, LogOut, Wallet, X } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  isOpen: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onLogout, isOpen }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transações', icon: Receipt },
    { id: 'reports', label: 'Relatórios', icon: BarChart3 },
    { id: 'ai-advisor', label: 'Consultor IA', icon: Bot },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 bg-slate-900 dark:bg-slate-950 text-white transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col h-full border-r border-slate-800 dark:border-white/5
            ${isOpen ? 'w-64 translate-x-0' : 'w-20 -translate-x-full lg:translate-x-0'}
            `}
    >
      {/* Header / Brand */}
      <div className="h-20 flex items-center px-6 border-b border-slate-800/50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <div className={`transition-opacity duration-300 ${!isOpen && 'lg:hidden'}`}>
            <span className="font-bold text-lg tracking-tight block leading-none">FinNexus</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Enterprise</span>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold transition-all group relative
                        ${activeTab === item.id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}
                        `}
          >
            <item.icon className={`h-5 w-5 shrink-0 transition-colors ${activeTab === item.id ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}`} />
            <span className={`whitespace-nowrap transition-opacity duration-300 ${!isOpen && 'lg:hidden'}`}>{item.label}</span>

            {!isOpen && (
              <div className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                {item.label}
              </div>
            )}

            {activeTab === item.id && isOpen && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></div>
            )}
          </button>
        ))}
      </nav>

      {/* Bottom Section - Logout */}
      <div className="p-4 border-t border-slate-800 dark:border-white/5 safe-padding-bottom shrink-0 bg-slate-900 dark:bg-slate-950">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all group"
        >
          <LogOut className="h-5 w-5 shrink-0 group-hover:-translate-x-1 transition-transform" />
          <span className={`whitespace-nowrap duration-300 ${!isOpen && 'lg:hidden'}`}>Desconectar</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;