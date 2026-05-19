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
  const pingId = '00000000-0000-0000-0000-000000000000'; // ID fixo ou random para o ping do GitHub
  const today = new Date().toISOString().split('T')[0];

  console.log(`📡 Iniciando ping anti-inatividade em ${new Date().toLocaleString('pt-BR')}...`);

  const dummyTransaction = {
    id: pingId,
    description: '⚡ PING AUTOMATICO GITHUB ACTIONS',
    amount: 0.01,
    type: 'RECEITA',
    category: 'Outros',
    status: 'CONCLUÍDO',
    date: today,
    notes: 'Registro de teste gerado automaticamente via GitHub Actions para evitar congelamento do banco de dados no Supabase.',
  };

  try {
    // 1. Limpa qualquer ping residual antes de inserir
    await supabase
      .from('transactions')
      .delete()
      .eq('id', pingId);

    // 2. Insere o registro de teste
    console.log('Inserting dummy row...');
    const { error: insertError } = await supabase
      .from('transactions')
      .insert([dummyTransaction]);

    if (insertError) {
      throw new Error(`Falha ao inserir ping: ${insertError.message}`);
    }

    console.log('✅ Registro inserido com sucesso!');

    // 3. Deleta o registro de teste imediatamente
    console.log('Deleting dummy row...');
    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('id', pingId);

    if (deleteError) {
      throw new Error(`Falha ao deletar ping: ${deleteError.message}`);
    }

    console.log('✅ Registro deletado com sucesso!');
    console.log('🎉 Banco de dados Supabase mantido ativo com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Ocorreu um erro no ping:', error.message || error);
    process.exit(1);
  }
}

runPing();
