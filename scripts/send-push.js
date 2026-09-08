import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import {
  notificationEvents,
  isAllowedPushEndpoint,
} from '../shared/notificationRules.js';
const required = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
];
if (required.some((k) => !process.env[k]))
  throw new Error('Secrets de push incompletos.');
const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (url, options) =>
        fetch(url, { ...options, signal: AbortSignal.timeout(15000) }),
    },
  },
);
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);
async function checked(query) {
  const { data, error } = await query;
  if (error) throw new Error('Falha de acesso ao banco no envio de push.');
  return data;
}
async function allRows(makeQuery) {
  let rows = [];
  for (let offset = 0; ; offset += 500) {
    const page = await checked(makeQuery().range(offset, offset + 499));
    rows.push(...page);
    if (page.length < 500) return rows;
    if (rows.length >= 100000)
      throw new Error('Volume exige processamento em lotes dedicado.');
  }
}
async function run() {
  await checked(
    db
      .from('push_deliveries')
      .delete()
      .lt('claimed_at', new Date(Date.now() - 35 * 86400000).toISOString()),
  );
  const prefs = await allRows(() =>
    db
      .from('notification_preferences')
      .select('user_id,preferences')
      .order('user_id'),
  );
  let sent = 0,
    failed = 0;
  for (const row of prefs) {
    if (!row.preferences?.enabled) continue;
    const transactions = await allRows(() =>
      db
        .from('transactions')
        .select('*')
        .eq('user_id', row.user_id)
        .order('id'),
    );
    const events = notificationEvents(transactions, row.preferences);
    const subscriptions = await allRows(() =>
      db
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', row.user_id)
        .order('id'),
    );
    for (const sub of subscriptions) {
      if (
        !isAllowedPushEndpoint(sub.endpoint) ||
        sub.subscription?.endpoint !== sub.endpoint
      ) {
        failed++;
        continue;
      }
      for (const event of events) {
        const claimed = await checked(
          db.rpc('claim_push', { p_subscription: sub.id, p_event: event.key }),
        );
        if (!claimed) continue;
        try {
          await webpush.sendNotification(
            sub.subscription,
            JSON.stringify(event),
            { TTL: 3600, timeout: 10000 },
          );
          await checked(
            db
              .from('push_deliveries')
              .update({ sent_at: new Date().toISOString() })
              .eq('subscription_id', sub.id)
              .eq('event_key', event.key),
          );
          sent++;
        } catch (error) {
          if (error.statusCode === 404 || error.statusCode === 410) {
            await checked(
              db.from('push_subscriptions').delete().eq('id', sub.id),
            );
            break;
          }
          await checked(
            db
              .from('push_deliveries')
              .delete()
              .eq('subscription_id', sub.id)
              .eq('event_key', event.key),
          );
          failed++;
        }
      }
    }
  }
  console.log(
    JSON.stringify({
      event: 'push-dispatch',
      sent,
      failed,
      at: new Date().toISOString(),
    }),
  );
  if (failed) process.exitCode = 1;
}
run().catch(() => {
  console.error('Envio de push falhou. Consulte a configuração e a migração.');
  process.exitCode = 1;
});
