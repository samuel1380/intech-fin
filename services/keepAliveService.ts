import { supabase, isSupabaseConfigured } from './supabase';

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

export const getKeepAliveConfig = async (): Promise<KeepAliveConfig> => {
  try {
    const localData = localStorage.getItem(STORAGE_KEY);
    const localConfig = localData ? JSON.parse(localData) : DEFAULT_CONFIG;

    if (!isSupabaseConfigured) {
      return localConfig;
    }

    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'keepalive')
      .maybeSingle();

    if (error) {
      console.warn('[Keep-Alive] Não foi possível carregar do Supabase:', error.message);
      if (error.code === '42P01') {
        console.error('[Keep-Alive] A tabela "system_settings" não existe. Você precisa executar as novas instruções do arquivo "supabase_migrations.sql" no SQL Editor do Supabase.');
      }
    }

    if (!error && data?.value) {
      const dbConfig = { ...DEFAULT_CONFIG, ...data.value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dbConfig));
      return dbConfig;
    }
    
    return localConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
};

export const saveKeepAliveConfig = async (config: KeepAliveConfig): Promise<void> => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));

  if (!isSupabaseConfigured) return;

  try {
    await supabase
      .from('system_settings')
      .upsert(
        { key: 'keepalive', value: config, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
  } catch (err) {
    console.error('Erro de conexão ao salvar keep-alive:', err);
  }
};

// Realiza o ping seguro no Supabase sem poluir transações e sem erro de RLS
export const pingSupabase = async (): Promise<boolean> => {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase não configurado.');
  }

  const nowIso = new Date().toISOString();

  // 1. Tentar upsert na tabela de configurações 'system_settings'
  // Esta tabela possui política RLS aberta (Allow all for system_settings)
  try {
    const { error: settingsError } = await supabase
      .from('system_settings')
      .upsert(
        {
          key: 'keepalive_heartbeat',
          value: {
            pinged_at: nowIso,
            source: 'web_client',
            timestamp: Date.now(),
          },
          updated_at: nowIso,
        },
        { onConflict: 'key' }
      );

    if (!settingsError) {
      return true;
    }

    console.warn('[Keep-Alive] Falha ao registrar em system_settings, acionando consulta de fallback:', settingsError.message);
  } catch (err) {
    console.warn('[Keep-Alive] Erro ao tentar upsert em system_settings:', err);
  }

  // 2. Fallback: Consulta leve para manter o banco ativo no Supabase sem criar dados fictícios
  const { error: selectError } = await supabase
    .from('transactions')
    .select('id')
    .limit(1);

  if (selectError) {
    console.error('Erro na consulta de keep-alive:', selectError);
    throw new Error(`Falha no keep-alive: ${selectError.message}`);
  }

  return true;
};

// Executa o ping e registra no log local/Supabase
export const runKeepAlivePing = async (): Promise<KeepAliveConfig> => {
  const config = await getKeepAliveConfig();
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
    
    await saveKeepAliveConfig(updatedConfig);
    return updatedConfig;
  } catch (err: any) {
    const errorMsg = err.message || 'Erro desconhecido';
    const newLog = `[${dateStr}] Erro - ${errorMsg}`;
    const updatedLogs = [newLog, ...config.pingLogs.slice(0, 19)];
    
    const updatedConfig = {
      ...config,
      pingLogs: updatedLogs,
    };
    
    await saveKeepAliveConfig(updatedConfig);
    throw err;
  }
};

// Verifica se é necessário rodar o ping (baseado no tempo decorrido)
export const checkAndTriggerKeepAlive = async (): Promise<KeepAliveConfig | null> => {
  const config = await getKeepAliveConfig();
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
