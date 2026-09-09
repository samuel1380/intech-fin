const { createClient } = require('@supabase/supabase-js');

// Pega as variáveis de ambiente (injetadas pelo GitHub Actions)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERRO: As variáveis SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórias.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runPing() {
  const now = new Date();
  const nowIso = now.toISOString();

  console.log(`📡 Iniciando ping anti-inatividade em ${now.toLocaleString('pt-BR')}...`);

  try {
    // 1. Tenta upsert na tabela system_settings (RLS configurado com política aberta)
    console.log('Gravando heartbeat na tabela system_settings...');
    const { error: settingsError } = await supabase
      .from('system_settings')
      .upsert(
        {
          key: 'keepalive_heartbeat',
          value: {
            pinged_at: nowIso,
            source: 'github_actions',
            timestamp: Date.now(),
          },
          updated_at: nowIso,
        },
        { onConflict: 'key' }
      );

    if (!settingsError) {
      console.log('✅ Heartbeat registrado com sucesso em system_settings!');
      console.log('🎉 Banco de dados Supabase mantido ativo com segurança!');
      process.exit(0);
    }

    console.warn('⚠️ Falha ao registrar em system_settings:', settingsError.message);
    console.log('Acionando consulta de leitura segura como fallback...');

    // 2. Fallback: consulta simples em transactions (mantém o pool/projeto acordado sem poluir nem violar RLS)
    const { error: selectError } = await supabase
      .from('transactions')
      .select('id')
      .limit(1);

    if (selectError) {
      throw new Error(`Falha na consulta de fallback: ${selectError.message}`);
    }

    console.log('✅ Consulta de fallback executada com sucesso!');
    console.log('🎉 Banco de dados Supabase mantido ativo!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Ocorreu um erro no ping:', error.message || error);
    process.exit(1);
  }
}

runPing();
