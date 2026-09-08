import { isSupabaseConfigured, requireUserId, supabase } from './supabase';

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

export const getKeepAliveConfig = async (): Promise<KeepAliveConfig> => {
  try {
    const localConfig = DEFAULT_CONFIG;

    if (!isSupabaseConfigured) {
      return localConfig;
    }

    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('user_id', await requireUserId())
      .eq('key', 'keepalive')
      .maybeSingle();

    if (error) {
      console.warn(
        '[Keep-Alive] Não foi possível carregar do Supabase:',
        error.message,
      );
      if (error.code === '42P01') {
        console.error(
          '[Keep-Alive] A tabela "system_settings" não existe. Você precisa executar as novas instruções do arquivo "supabase_migrations.sql" no SQL Editor do Supabase.',
        );
      }
    }

    if (!error && data?.value) {
      const dbConfig = { ...DEFAULT_CONFIG, ...data.value };
      return dbConfig;
    }

    return localConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
};

export const saveKeepAliveConfig = async (
  config: KeepAliveConfig,
): Promise<void> => {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase
    .from('system_settings')
    .upsert(
      {
        user_id: await requireUserId(),
        key: 'keepalive',
        value: config,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,key' },
    );
  if (error) throw error;
};

// Realiza o ping no Supabase (insere e deleta)
export const pingSupabase = async (): Promise<boolean> => {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase não configurado.');
  }

  const { error } = await supabase.rpc('health_check');
  if (error) throw new Error('Falha ao consultar a saúde do banco de dados.');

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
export const checkAndTriggerKeepAlive =
  async (): Promise<KeepAliveConfig | null> => {
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
