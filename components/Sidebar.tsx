import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Receipt, BarChart3, Bot, Settings, LogOut, Wallet, X, FileText, Database, ArrowDownCircle, ArrowUpCircle, Sun, Moon } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  isOpen: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onLogout, isOpen }) => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
      setIsDark(true);
    }
  };

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
      className="fixed left-4 top-1/2 -translate-y-1/2 z-40 w-16 bg-white dark:bg-slate-900 border border-[#EEF2F7] dark:border-white/[0.06] rounded-[24px] py-6 flex flex-col items-center justify-between h-[90vh] shadow-premium select-none transition-colors duration-300"
    >
      {/* Brand Icon */}
      <div className="flex flex-col items-center gap-1 shrink-0">
        <div className="w-10 h-10 rounded-full bg-finexyOrange flex items-center justify-center shadow-md shadow-finexyOrange/20">
          <span className="font-extrabold text-white text-[18px]">F</span>
        </div>
      </div>

      {/* Theme Toggles (Sun & Moon Stack) */}
      <div className="flex flex-col items-center bg-[#F3F4F6] dark:bg-slate-800 p-1 rounded-full gap-1 my-4">
        <button 
          onClick={() => { if (isDark) toggleTheme(); }}
          className={`p-2 rounded-full transition-all duration-200 ${!isDark ? 'bg-white text-amber-500 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <Sun className="h-4 w-4" />
        </button>
        <button 
          onClick={() => { if (!isDark) toggleTheme(); }}
          className={`p-2 rounded-full transition-all duration-200 ${isDark ? 'bg-slate-700 text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Moon className="h-4 w-4" />
        </button>
      </div>

      {/* Navigation Icons Menu */}
      <nav className="flex-1 flex flex-col justify-center items-center gap-4 py-4 w-full">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            title={item.label}
            className={`w-11 h-11 flex items-center justify-center rounded-full transition-all duration-200 group relative
                        ${activeTab === item.id
                ? 'bg-finexyBlack text-white dark:bg-white dark:text-slate-900 shadow-md'
                : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'}
                        `}
          >
            <item.icon className="h-5 w-5 shrink-0" strokeWidth={2} />
            <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg border border-white/[0.06]">
              {item.label}
            </div>
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div className="shrink-0 pt-4 w-full flex justify-center">
        <button
          onClick={onLogout}
          title="Desconectar"
          className="w-11 h-11 flex items-center justify-center rounded-full text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 transition-all duration-200 group"
        >
          <LogOut className="h-5 w-5 group-hover:-translate-x-0.5 transition-transform" strokeWidth={2} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;