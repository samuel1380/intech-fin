import { it, expect } from 'vitest';
import {
  notificationEvents,
  isAllowedPushEndpoint,
} from '../shared/notificationRules.js';
it('does not generate notifications for disabled preferences', () =>
  expect(notificationEvents([], { enabled: false })).toEqual([]));
it('uses Sao Paulo dates and pending amount for partial receivables', () => {
  const rows = [
    {
      type: 'RECEITA',
      status: 'PAGTO PARCIAL',
      date: '2026-09-07',
      amount: 100,
      pendingAmount: 25,
    },
  ];
  const events = notificationEvents(
    rows,
    { enabled: true, debtReceivable: true, debtReceivableDays: 2 },
    new Date('2026-09-08T01:00:00Z'),
  );
  expect(events[0].key).toBe('2026-09-07:receivable');
  expect(events[0].body).toContain('25,00');
});
it('gives stable keys within a summary window and counts only money received', () => {
  const prefs = {
    enabled: true,
    dailySummary: true,
    dailySummaryIntervalUnit: 'seconds',
    dailySummaryIntervalValue: 1,
  };
  const rows = [
    {
      date: '2026-09-08',
      type: 'RECEITA',
      status: 'PAGTO PARCIAL',
      amount: 100,
      pendingAmount: 30,
    },
  ];
  const first = notificationEvents(
    rows,
    prefs,
    new Date('2026-09-08T15:00:00Z'),
  )[0];
  const second = notificationEvents(
    rows,
    prefs,
    new Date('2026-09-08T15:30:00Z'),
  )[0];
  expect(first.key).toBe(second.key);
  expect(first.body).toContain('70,00');
});
it.each([
  'http://fcm.googleapis.com/x',
  'https://127.0.0.1/x',
  'https://fcm.googleapis.com.evil.test/x',
  'https://user@fcm.googleapis.com/x',
  'https://fcm.googleapis.com:444/x',
  'javascript:alert(1)',
])('rejects SSRF target %s', (url) =>
  expect(isAllowedPushEndpoint(url)).toBe(false),
);
it.each([
  'https://fcm.googleapis.com/fcm/send/a',
  'https://updates.push.services.mozilla.com/wpush/v2/a',
  'https://web.push.apple.com/Qa',
  'https://wns2-bl2p.notify.windows.com/w/',
])('accepts known push provider %s', (url) =>
  expect(isAllowedPushEndpoint(url)).toBe(true),
);
