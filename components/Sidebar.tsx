import React from 'react';
import { LayoutDashboard, PieChart, Receipt, Settings, LogOut, Wallet, Bot, ChevronRight } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  isOpen: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onLogout, isOpen }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transações', icon: Receipt },
    { id: 'reports', label: 'Relatórios', icon: PieChart },
    { id: 'ai-advisor', label: 'Consultor IA', icon: Bot },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <aside
      className={`
        fixed left-0 top-0 z-40 h-screen bg-slate-900 dark:bg-slate-950 text-white transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${isOpen ? 'w-64 translate-x-0' : 'w-20 lg:translate-x-0 -translate-x-full'} 
        flex flex-col shadow-2xl border-r border-slate-800 dark:border-white/5 overflow-hidden
      `}
    >
      {/* Brand Section */}
      <div className="flex items-center h-20 border-b border-slate-800/50 bg-slate-900 dark:bg-slate-950 px-6 shrink-0">
        <div className="flex items-center gap-3 w-full">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-lg shadow-indigo-500/20 shrink-0">
            <Wallet className="h-6 w-6 text-white" />
          </div>
          <div className={`flex flex-col transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
            <span className="text-lg font-bold tracking-tight text-white leading-tight whitespace-nowrap">FinNexus</span>
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest whitespace-nowrap">Enterprise</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto overflow-x-hidden scrollbar-hide">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`
                relative flex items-center w-full px-3 py-3.5 rounded-xl transition-all duration-200 group
                ${isActive
                  ? 'bg-indigo-600/10 text-white shadow-inner shadow-indigo-500/5'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}
              `}
              title={!isOpen ? item.label : undefined}
            >
              {/* Active Indicator Strip */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-full shadow-[0_0_12px_rgba(99,102,241,0.6)] animate-fade-in"></div>
              )}

              <Icon className={`h-5 w-5 shrink-0 transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />

              <span className={`ml-3 font-medium text-sm tracking-wide whitespace-nowrap transition-all duration-300 ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'} ${isActive ? 'text-white' : ''}`}>
                {item.label}
              </span>

              {/* Chevron for depth on active/hover - only visible when open */}
              {isOpen && isActive && (
                <ChevronRight className="ml-auto h-4 w-4 text-indigo-500 animate-fade-in" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / User Profile Snippet */}
      <div className="p-4 border-t border-slate-800 dark:border-white/5 bg-slate-900 dark:bg-slate-950 shrink-0">
        <button
          onClick={onLogout}
          className="flex items-center justify-center w-full px-4 py-3 text-rose-400/80 bg-rose-500/5 hover:bg-rose-500/10 hover:text-rose-300 border border-rose-500/10 rounded-xl transition-all duration-200 group overflow-hidden"
        >
          <LogOut className="h-5 w-5 shrink-0 group-hover:-translate-x-1 transition-transform" />
          <span className={`ml-3 font-semibold text-sm whitespace-nowrap transition-all duration-300 ${isOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>Desconectar</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;