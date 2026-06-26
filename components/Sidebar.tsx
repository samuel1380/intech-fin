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
      className={`fixed inset-y-0 left-0 z-40 bg-[#0e122b] text-white transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col h-full border-r border-[#1a1f3d] overflow-x-hidden
            ${isOpen ? 'w-64 translate-x-0' : 'w-20 -translate-x-full lg:translate-x-0'}
            `}
    >
      {/* Header / Brand */}
      <div className="py-6 flex items-center px-6 border-b border-[#1a1f3d]/60 shrink-0 safe-padding-top">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shadow-lg bg-gradient-to-tr from-indigo-600 to-purple-600 border border-white/10 shrink-0 font-extrabold text-white text-base">
            FN
          </div>
          <div className={`transition-all duration-300 ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 lg:hidden pointer-events-none'}`}>
            <span className="font-extrabold text-base tracking-tight block leading-none">FinNexus</span>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1 block">Enterprise</span>
          </div>
        </div>
      </div>
 
      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3.5 px-4.5 py-3 rounded-xl font-semibold text-sm transition-all group relative
                        ${activeTab === item.id
                ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/20 text-white border border-indigo-500/30 shadow-lg shadow-indigo-950/20'
                : 'text-slate-400 border border-transparent hover:bg-white/5 hover:text-white'}
                        `}
          >
            <item.icon className={`h-5 w-5 shrink-0 transition-colors ${activeTab === item.id ? 'text-indigo-400' : 'text-slate-400 group-hover:text-indigo-400'}`} />
            <span className={`whitespace-nowrap transition-all duration-300 ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 lg:hidden pointer-events-none'}`}>{item.label}</span>
 
            {!isOpen && (
              <div className="absolute left-full ml-4 px-2 py-1 bg-[#161a36] text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md border border-white/5">
                {item.label}
              </div>
            )}
 
            {activeTab === item.id && isOpen && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/80"></div>
            )}
          </button>
        ))}
      </nav>
 
      {/* Bottom Section - Logout */}
      <div className="p-4 border-t border-[#1a1f3d]/60 safe-padding-bottom shrink-0 bg-[#0e122b]">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-bold text-sm text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all group"
        >
          <LogOut className="h-5 w-5 shrink-0 group-hover:-translate-x-0.5 transition-transform" />
          <span className={`whitespace-nowrap transition-all duration-300 ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 lg:hidden pointer-events-none'}`}>Desconectar</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;