// scripts/send-background-push.js
// Script para envio de notificações Push em Segundo Plano (PWA Background Push)
// Executado via GitHub Actions Cron ou disparado por backend/Edge Function.

const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Chaves VAPID do FinNexus Enterprise
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || 'BAodVudiIhUOYKSHtxtt__f2gT5bVb3N3ITLNwgGAnSTMo4zxmUWnJPbmmfhm8La4QPiJCP2VSF46kKaLFN8Ago';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || 'zbz-l7HOEc-psjSYa6NGA5viNC7C9COffSsPTXT922A';
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:suporte@intechfin.com.br';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERRO: SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórias.');
  process.exit(1);
}

webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function getLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function runBackgroundPush() {
  console.log(`🔔 Verificando pendências para Notificações Push em ${new Date().toLocaleString('pt-BR')}...`);

  try {
    // 1. Carregar preferências e subscrição de push registradas
    const { data: prefData, error: prefError } = await supabase
      .from('notification_preferences')
      .select('preferences, push_subscription')
      .eq('user_id', 'intechfin_default')
      .maybeSingle();

    if (prefError) {
      throw new Error(`Erro ao carregar preferências: ${prefError.message}`);
    }

    if (!prefData || !prefData.push_subscription) {
      console.log('ℹ️ Nenhuma subscrição de push registrada no momento (o usuário precisa ativar notificações no PWA ao menos uma vez).');
      process.exit(0);
    }

    const prefs = prefData.preferences || {};
    const subscription = prefData.push_subscription;

    if (!prefs.enabled) {
      console.log('ℹ️ Notificações desativadas nas preferências do usuário.');
      process.exit(0);
    }

    // 2. Carregar transações ativas
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*');

    if (txError) {
      throw new Error(`Erro ao buscar transações: ${txError.message}`);
    }

    const today = new Date();
    const todayStr = getLocalDateString(today);
    const notificationsToSend = [];

    // === CONTAS PRESTES A VENCER ===
    if (prefs.billsDueSoon) {
      const dueDays = prefs.billsDueSoonDays || 3;
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + dueDays);
      const targetStr = getLocalDateString(targetDate);

      const overdueBills = (transactions || []).filter((t) => {
        return (
          t.type === 'DESPESA' &&
          t.status === 'PENDENTE' &&
          t.date >= todayStr &&
          t.date <= targetStr
        );
      });

      if (overdueBills.length > 0) {
        const total = overdueBills.reduce((s, t) => s + (Number(t.amount) || 0), 0);
        notificationsToSend.push({
          title: '⚠️ Contas Prestes a Vencer',
          body: `${overdueBills.length} despesa(s) vencem nos próximos ${dueDays} dias. Total: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          url: '/#payables',
          tag: 'push-bills-due',
        });
      }
    }

    // === COMISSÕES DO DIA ===
    if (prefs.commissionPaymentDay) {
      const commissionsToday = (transactions || []).filter((t) => {
        return t.commissionAmount && t.commissionPaymentDate === todayStr;
      });

      if (commissionsToday.length > 0) {
        const total = commissionsToday.reduce((s, t) => s + (Number(t.commissionAmount) || 0), 0);
        notificationsToSend.push({
          title: '💳 Dia de Pagamento de Comissão',
          body: `${commissionsToday.length} comissão(ões) para pagar hoje. Total: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          url: '/#transactions',
          tag: 'push-commissions',
        });
      }
    }

    // === RECEBÍVEIS PRÓXIMOS ===
    if (prefs.debtReceivable) {
      const recDays = prefs.debtReceivableDays || 2;
      const recDate = new Date(today);
      recDate.setDate(recDate.getDate() + recDays);
      const recStr = getLocalDateString(recDate);

      const receivables = (transactions || []).filter((t) => {
        return (
          t.type === 'RECEITA' &&
          t.status === 'PENDENTE' &&
          t.date >= todayStr &&
          t.date <= recStr
        );
      });

      if (receivables.length > 0) {
        const total = receivables.reduce((s, t) => s + (Number(t.amount) || 0), 0);
        notificationsToSend.push({
          title: '💰 Recebimento Próximo',
          body: `${receivables.length} receita(s) a receber nos próximos ${recDays} dias. Total: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          url: '/#receivables',
          tag: 'push-receivables',
        });
      }
    }

    if (notificationsToSend.length === 0) {
      console.log('✅ Nenhuma pendência urgente para notificar hoje.');
      process.exit(0);
    }

    // 3. Disparar notificações via Web Push
    for (const notif of notificationsToSend) {
      const payload = JSON.stringify({
        title: notif.title,
        body: notif.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: notif.tag,
        url: notif.url,
      });

      console.log(`🚀 Enviando Web Push: "${notif.title}"...`);
      try {
        await webpush.sendNotification(subscription, payload);
        console.log(`✅ Push enviado com sucesso: "${notif.title}"`);
      } catch (pushErr) {
        console.error(`❌ Falha ao enviar notificação para o endpoint:`, pushErr.message || pushErr);
        // Se a inscrição expirou (410 Gone ou 404 Not Found), limpa do banco
        if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
          console.warn('⚠️ Inscrição de push expirada no dispositivo. Limpando registro...');
          await supabase
            .from('notification_preferences')
            .update({ push_subscription: null })
            .eq('user_id', 'intechfin_default');
        }
      }
    }

    console.log('🎉 Ciclo de Notificações em Segundo Plano concluído!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro inesperado no worker de push:', err.message || err);
    process.exit(1);
  }
}

runBackgroundPush();
