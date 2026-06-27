import React from 'react';
import { LayoutDashboard, Receipt, BarChart3, Bot, Settings, LogOut, Database, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

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
    { id: 'receivables', label: 'A Receber', icon: ArrowDownCircle },
    { id: 'payables', label: 'A Pagar', icon: ArrowUpCircle },
    { id: 'reports', label: 'Relatórios', icon: BarChart3 },
    { id: 'ai-advisor', label: 'Consultor IA', icon: Bot },
    { id: 'settings', label: 'Configurações', icon: Settings },
    { id: 'database', label: 'Banco de Dados', icon: Database },
  ];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col h-full overflow-x-hidden
        ${isOpen ? 'w-[260px] translate-x-0' : 'w-[72px] -translate-x-full lg:translate-x-0'}
      `}
      style={{
        background: 'linear-gradient(180deg, #0F172A 0%, #0B1120 100%)',
      }}
    >
      {/* Brand */}
      <div className="h-16 flex items-center px-5 border-b border-white/[0.06] shrink-0 safe-padding-top">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-white shrink-0 shadow-sm">
            <img src="/logo.png" alt="FinNexus Logo" className="w-full h-full object-cover" />
          </div>
          <div className={`transition-all duration-300 ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 lg:hidden pointer-events-none'}`}>
            <span className="font-bold text-[15px] text-white tracking-tight block leading-none">FinNexus</span>
            <span className="text-[9px] text-surface-400 font-semibold uppercase tracking-[0.2em] mt-0.5 block">Enterprise</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all duration-200 group relative
                ${isActive
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                  : 'text-surface-400 hover:text-white hover:bg-white/[0.06]'
                }
              `}
            >
              <item.icon
                className={`h-[18px] w-[18px] shrink-0 transition-colors duration-200
                  ${isActive ? 'text-white' : 'text-surface-500 group-hover:text-brand-400'}
                `}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              <span className={`whitespace-nowrap text-[13px] transition-all duration-300 ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 lg:hidden pointer-events-none'}`}>
                {item.label}
              </span>

              {/* Tooltip for collapsed state */}
              {!isOpen && (
                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-surface-800 text-white text-xs font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-all whitespace-nowrap z-50 shadow-lg border border-surface-700">
                  {item.label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-white/[0.06] safe-padding-bottom shrink-0">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-surface-400 hover:text-danger-500 hover:bg-danger-500/[0.08] transition-all duration-200 group"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0 group-hover:-translate-x-0.5 transition-transform duration-200" strokeWidth={1.8} />
          <span className={`whitespace-nowrap text-[13px] transition-all duration-300 ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 lg:hidden pointer-events-none'}`}>
            Desconectar
          </span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
