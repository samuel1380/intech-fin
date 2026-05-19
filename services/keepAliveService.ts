import { supabase, isSupabaseConfigured } from './supabase';
import { TransactionType, TransactionCategory, TransactionStatus } from '../types';

export interface KeepAliveConfig {
  enabled: boolean;
  intervalDays: number;
  lastPing: number;
  pingLogs: string[];
}

const DEFAULT_CONFIG: KeepAliveConfig = {
  enabled: false,
  intervalDays: 4,
  lastPing: 0,
  pingLogs: [],
};

const STORAGE_KEY = 'finnexus_keepalive_config';

export const getKeepAliveConfig = (): KeepAliveConfig => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return DEFAULT_CONFIG;
    const parsed = JSON.parse(data);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
};

export const saveKeepAliveConfig = (config: KeepAliveConfig) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
};

// Realiza o ping no Supabase (insere e deleta)
export const pingSupabase = async (): Promise<boolean> => {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase não configurado.');
  }

  const pingId = crypto.randomUUID();
  const today = new Date().toISOString().split('T')[0];

  const dummyTransaction = {
    id: pingId,
    description: '⚡ PING ANTI-INATIVIDADE',
    amount: 0.01,
    type: TransactionType.INCOME,
    category: TransactionCategory.OTHER,
    status: TransactionStatus.COMPLETED,
    date: today,
    notes: 'Registro de teste inserido e removido automaticamente para evitar o congelamento do banco de dados no plano gratuito do Supabase.',
  };

  // 1. Inserir registro
  const { error: insertError } = await supabase
    .from('transactions')
    .insert([dummyTransaction]);

  if (insertError) {
    console.error('Erro ao inserir ping:', insertError);
    throw new Error(`Falha na inserção: ${insertError.message}`);
  }

  // 2. Deletar registro
  const { error: deleteError } = await supabase
    .from('transactions')
    .delete()
    .eq('id', pingId);

  if (deleteError) {
    console.error('Erro ao deletar ping:', deleteError);
    throw new Error(`Falha na deleção: ${deleteError.message}`);
  }

  return true;
};

// Executa o ping e registra no log local
export const runKeepAlivePing = async (): Promise<KeepAliveConfig> => {
  const config = getKeepAliveConfig();
  const timestamp = Date.now();
  const dateStr = new Date(timestamp).toLocaleString('pt-BR');

  try {
    await pingSupabase();
    
    const newLog = `[${dateStr}] Sucesso - Banco de dados ativado.`;
    const updatedLogs = [newLog, ...config.pingLogs.slice(0, 19)]; // guarda os últimos 20 logs
    
    const updatedConfig = {
      ...config,
      lastPing: timestamp,
      pingLogs: updatedLogs,
    };
    
    saveKeepAliveConfig(updatedConfig);
    return updatedConfig;
  } catch (err: any) {
    const errorMsg = err.message || 'Erro desconhecido';
    const newLog = `[${dateStr}] Erro - ${errorMsg}`;
    const updatedLogs = [newLog, ...config.pingLogs.slice(0, 19)];
    
    const updatedConfig = {
      ...config,
      pingLogs: updatedLogs,
    };
    
    saveKeepAliveConfig(updatedConfig);
    throw err;
  }
};

// Verifica se é necessário rodar o ping (baseado no tempo decorrido)
export const checkAndTriggerKeepAlive = async (): Promise<KeepAliveConfig | null> => {
  const config = getKeepAliveConfig();
  if (!config.enabled) return null;

  const msInterval = config.intervalDays * 24 * 60 * 60 * 1000;
  const now = Date.now();

  // Se nunca pingou ou se o tempo decorrido for maior que o intervalo configurado
  if (now - config.lastPing >= msInterval) {
    console.log('⏰ Executando ping anti-inatividade periódico...');
    try {
      const updated = await runKeepAlivePing();
      return updated;
    } catch (e) {
      console.error('Falha no ping periódico:', e);
      return null;
    }
  }

  return null;
};
