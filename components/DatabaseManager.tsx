import React, { useState } from 'react';
import { Database, AlertTriangle, Trash2, Cloud } from 'lucide-react';
import { isSupabaseConfigured } from '../services/supabase';

interface DatabaseManagerProps {
  onResetDatabase: () => Promise<void>;
}

const DatabaseManager: React.FC<DatabaseManagerProps> = ({ onResetDatabase }) => {
  // Estados do Modal de Resetar DB
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStep, setResetStep] = useState(1);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* ===== SEÇÃO: DADOS ===== */}
      <div className="bg-white dark:bg-surface-900/60 border border-surface-200/60 dark:border-surface-800/60 p-5 md:p-6 rounded-xl shadow-card">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
          <Database className="h-6 w-6 text-brand-600" />
          Gerenciamento de Dados
        </h2>
        <p className="text-slate-600 dark:text-slate-300 mb-8 leading-relaxed">
          Os dados são armazenados de forma {isSupabaseConfigured ? 'segura na nuvem (Supabase)' : 'local no seu navegador (IndexedDB)'}.
          Isso garante total privacidade e controle sobre suas informações financeiras.
        </p>

        <div className="space-y-4">
          {isSupabaseConfigured ? (
            <div className="p-6 bg-success-50 dark:bg-success-900/20 border border-success-100 dark:border-success-800/30 rounded-xl flex items-center gap-4">
              <div className="p-3 bg-white dark:bg-surface-800 rounded-full text-success-600 dark:text-success-400 shadow-sm ring-1 ring-success-100 dark:ring-success-800/50">
                <Cloud className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-success-800 dark:text-success-400">Banco de Dados em Nuvem Ativo</h4>
                <p className="text-sm text-success-700 dark:text-success-500">Sincronização em tempo real ativada via Supabase.</p>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-danger-50 dark:bg-danger-900/20 border border-danger-100 dark:border-danger-800/30 rounded-xl flex items-center gap-4">
              <div className="p-3 bg-white dark:bg-surface-800 rounded-full text-danger-600 dark:text-danger-400 shadow-sm ring-1 ring-danger-100 dark:ring-danger-800/50">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-danger-800 dark:text-danger-400">Sistema Desconectado</h4>
                <p className="text-sm text-danger-700 dark:text-danger-500 font-medium">O banco de dados da nuvem não está configurado.</p>
              </div>
            </div>
          )}

          <div className="p-6 bg-danger-50 dark:bg-danger-900/20 border border-danger-100 dark:border-danger-800/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-danger-800 dark:text-danger-400 flex items-center gap-2">
                <Trash2 className="h-4 w-4" /> Zona de Perigo
              </h4>
              <p className="text-sm text-danger-700 dark:text-danger-500 mt-1">A exclusão do banco de dados remove todo o histórico na nuvem.</p>
            </div>
            <button
              onClick={() => { setShowResetModal(true); setResetStep(1); }}
              className="px-6 py-3 bg-white dark:bg-surface-800 border border-danger-200 dark:border-danger-700 text-danger-600 dark:text-danger-400 font-semibold rounded-lg hover:bg-danger-600 hover:text-white transition-all shadow-sm w-full sm:w-auto shrink-0"
            >
              Resetar Banco de Dados
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Confirmação de Reset Duplo */}
      {showResetModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-surface-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowResetModal(false)} />
          <div className="relative bg-white dark:bg-surface-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-danger-100 dark:border-danger-900/30 animate-fade-in-up">
            <div className="w-12 h-12 rounded-xl bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center mb-5 border border-danger-200 dark:border-danger-800/50">
              <AlertTriangle className="h-6 w-6 text-danger-600 dark:text-danger-400 animate-pulse" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              {resetStep === 1 ? 'Você tem certeza?' : 'Você tem certeza mesmo?'}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 font-medium">
              {resetStep === 1 
                ? 'Esta ação iniciará a exclusão de TODOS os seus dados financeiros.' 
                : 'Esta é sua última chance. Todos os dados serão perdidos permanentemente e não poderão ser recuperados.'}
            </p>
            <div className="flex gap-3 justify-end mt-2">
              <button 
                onClick={() => { setShowResetModal(false); setResetStep(1); }}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  if (resetStep === 1) {
                    setResetStep(2);
                  } else {
                    onResetDatabase();
                    setShowResetModal(false);
                    setResetStep(1);
                  }
                }}
                className={`px-4 py-2 font-bold rounded-lg shadow-sm transition-all text-white ${resetStep === 1 ? 'bg-danger-600 hover:bg-danger-700 shadow-danger-200 dark:shadow-danger-900/20' : 'bg-red-700 hover:bg-red-800 scale-105 shadow-red-500/30'}`}
              >
                {resetStep === 1 ? 'Sim, continuar' : 'Sim, Resetar Agora'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseManager;
