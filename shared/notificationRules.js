const formatMoney = (value) =>
  Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export function notificationEvents(transactions, prefs, now = new Date()) {
  if (!prefs?.enabled) return [];
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour').value);
  const weekday = parts.find((p) => p.type === 'weekday').value;
  const end = (days) => {
    const d = new Date(date + 'T12:00:00Z');
    d.setUTCDate(
      d.getUTCDate() + Math.max(1, Math.min(365, Number(days) || 3)),
    );
    return d.toISOString().slice(0, 10);
  };
  const events = [];
  const add = (key, title, body, url = '#accounts') =>
    events.push({
      key: date + ':' + key,
      title,
      body,
      url: '/' + url,
      tag: key,
    });
  const due = (type, days) =>
    transactions.filter(
      (t) =>
        t.type === type &&
        ['PENDENTE', 'PAGTO PARCIAL'].includes(t.status) &&
        t.date >= date &&
        t.date <= end(days),
    );
  const total = (rows) =>
    rows.reduce(
      (s, t) =>
        s +
        (t.status === 'PAGTO PARCIAL'
          ? Number(t.pendingAmount || 0)
          : Number(t.amount)),
      0,
    );
  if (prefs.billsDueSoon) {
    const rows = due('DESPESA', prefs.billsDueSoonDays);
    if (rows.length)
      add(
        'bills',
        'Contas a vencer',
        rows.length + ' conta(s). Total: ' + formatMoney(total(rows)),
      );
  }
  if (prefs.debtReceivable) {
    const rows = due('RECEITA', prefs.debtReceivableDays);
    if (rows.length)
      add(
        'receivable',
        'Recebimentos próximos',
        rows.length + ' recebimento(s). Total: ' + formatMoney(total(rows)),
      );
  }
  if (prefs.commissionPaymentDay) {
    const rows = transactions.filter(
      (t) => t.commissionPaymentDate === date && Number(t.commissionAmount) > 0,
    );
    if (rows.length)
      add(
        'commission',
        'Comissões do dia',
        formatMoney(rows.reduce((s, t) => s + Number(t.commissionAmount), 0)) +
          ' em comissões.',
      );
  }
  if (prefs.recurringBills) {
    const rows = due('DESPESA', prefs.recurringBillsDays).filter(
      (t) => t.isRecurring,
    );
    if (rows.length)
      add(
        'recurring',
        'Despesas recorrentes',
        rows.length + ' despesa(s) a vencer.',
      );
  }
  if (
    prefs.monthlyClose &&
    Number(date.slice(-2)) === Number(prefs.monthlyCloseDay)
  )
    add(
      'monthly',
      'Fechamento mensal',
      'Revise receitas, despesas e pendências.',
      '#reports',
    );
  const received = (t) =>
    t.status === 'PAGTO PARCIAL'
      ? Number(t.amount) - Number(t.pendingAmount || 0)
      : t.status === 'CONCLUÍDO'
        ? Number(t.amount)
        : 0;
  if (prefs.lowBalance) {
    const balance = transactions.reduce(
      (s, t) => s + (t.type === 'RECEITA' ? 1 : -1) * received(t),
      0,
    );
    if (balance < Number(prefs.lowBalanceThreshold))
      add(
        'balance',
        'Saldo abaixo do limite',
        'Saldo de movimentações: ' + formatMoney(balance),
        '#dashboard',
      );
  }
  if (prefs.dailySummary) {
    const unit =
      { seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000 }[
        prefs.dailySummaryIntervalUnit
      ] || 3600000;
    const interval = Math.max(
      3600000,
      Math.min(
        30 * 86400000,
        (Number(prefs.dailySummaryIntervalValue) || 1) * unit,
      ),
    );
    const total = transactions
      .filter((t) => t.date === date && t.type === 'RECEITA')
      .reduce((s, t) => s + received(t), 0);
    add(
      'summary:' + Math.floor(now.getTime() / interval),
      'Resumo de faturamento',
      'Recebido hoje: ' + formatMoney(total),
      '#dashboard',
    );
  }
  if (prefs.weeklySummary && weekday === 'Mon' && hour >= 9)
    add(
      'weekly',
      'Resumo semanal',
      'Seu relatório financeiro está disponível para revisão.',
      '#reports',
    );
  if (prefs.newTransaction) {
    for (const t of transactions)
      if (
        t.created_at &&
        now.getTime() - Date.parse(t.created_at) >= 0 &&
        now.getTime() - Date.parse(t.created_at) < 3600000
      )
        add(
          'transaction:' + t.id,
          'Nova movimentação',
          'Uma movimentação foi registrada no seu painel.',
          '#transactions',
        );
  }
  return events;
}
export function isAllowedPushEndpoint(endpoint) {
  try {
    const u = new URL(endpoint);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !u.port &&
      (u.hostname === 'fcm.googleapis.com' ||
        u.hostname === 'updates.push.services.mozilla.com' ||
        u.hostname === 'web.push.apple.com' ||
        u.hostname.endsWith('.notify.windows.com'))
    );
  } catch {
    return false;
  }
}
