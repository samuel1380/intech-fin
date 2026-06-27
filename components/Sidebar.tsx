import React from 'react';
import { LayoutDashboard, Receipt, BarChart3, Bot, Settings, LogOut, Wallet, X, FileText, Database, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

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
      className={`fixed inset-y-0 left-0 z-40 bg-gradient-to-b from-[#0F172A] via-[#111B2E] to-[#0F172A] text-white transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col h-full border-r border-white/[0.06] overflow-x-hidden
            ${isOpen ? 'w-64 translate-x-0' : 'w-20 -translate-x-full lg:translate-x-0'}
            `}
    >
      {/* Header / Brand */}
      <div className="py-6 flex items-center px-6 border-b border-white/[0.06] shrink-0 safe-padding-top">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-[14px] overflow-hidden flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0 bg-white ring-1 ring-white/20">
            <img src="/logo.png" alt="FinNexus Logo" className="w-full h-full object-cover" />
          </div>
          <div className={`transition-all duration-300 ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 lg:hidden pointer-events-none'}`}>
            <span className="font-semibold text-[17px] tracking-[-0.01em] block leading-none text-white">FinNexus</span>
            <span className="text-[10px] text-indigo-400/80 font-medium uppercase tracking-[0.12em] mt-1 block">Enterprise</span>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-[12px] font-medium transition-all duration-200 group relative
                        ${activeTab === item.id
                ? 'bg-white/[0.08] text-white'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'}
                        `}
          >
            {/* Active indicator bar */}
            {activeTab === item.id && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-indigo-400 rounded-r-full" />
            )}
            <item.icon className={`h-[18px] w-[18px] shrink-0 transition-colors duration-200 ${activeTab === item.id ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} strokeWidth={1.75} />
            <span className={`whitespace-nowrap transition-all duration-300 text-[13.5px] ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 lg:hidden pointer-events-none'}`}>{item.label}</span>

            {!isOpen && (
              <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg shadow-black/20 border border-white/[0.06]">
                {item.label}
              </div>
            )}

            {activeTab === item.id && isOpen && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400" />
            )}
          </button>
        ))}
      </nav>

      {/* Bottom Section - Logout */}
      <div className="p-4 border-t border-white/[0.06] safe-padding-bottom shrink-0">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3.5 py-3 rounded-[12px] font-medium text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-all duration-200 group text-[13.5px]"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0 group-hover:-translate-x-0.5 transition-transform duration-200" strokeWidth={1.75} />
          <span className={`whitespace-nowrap transition-all duration-300 ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 lg:hidden pointer-events-none'}`}>Desconectar</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;