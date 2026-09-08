import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
const sampleTransactions = [
  {
    id: '00000000-0000-4000-8000-000000000010',
    description: 'Contrato de manutenção',
    amount: 12800,
    type: 'RECEITA',
    status: 'CONCLUÍDO',
    category: 'Vendas',
    date: new Date().toISOString().slice(0, 7) + '-01',
    employeeName: 'Equipe operacional',
    commissionAmount: 1280,
    commissionRate: 10,
  },
  {
    id: '00000000-0000-4000-8000-000000000011',
    description: 'Serviços do mês',
    amount: 8400,
    type: 'RECEITA',
    status: 'PAGTO PARCIAL',
    pendingAmount: 2400,
    category: 'Serviço: Outros',
    date: new Date().toISOString().slice(0, 7) + '-05',
  },
  {
    id: '00000000-0000-4000-8000-000000000012',
    description: 'Custos operacionais',
    amount: 4100,
    type: 'DESPESA',
    status: 'CONCLUÍDO',
    category: 'Operacional',
    date: new Date().toISOString().slice(0, 7) + '-03',
  },
];
const user = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'audit@example.test',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: { provider: 'email' },
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
};
const token =
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
    'base64url',
  ) +
  '.' +
  Buffer.from(
    JSON.stringify({
      sub: user.id,
      exp: Math.floor(Date.now() / 1000) + 3600,
      aud: 'authenticated',
      role: 'authenticated',
    }),
  ).toString('base64url') +
  '.test';
const session = {
  access_token: token,
  refresh_token: 'test-refresh',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user,
};
async function mockApi(page: Page, authenticated = false) {
  await page.route('https://audit.supabase.co/**', async (route) => {
    const url = new URL(route.request().url());
    let data: unknown = [];
    if (url.pathname.includes('/rest/v1/transactions'))
      data = sampleTransactions.slice(Number(url.searchParams.get('offset') || 0), Number(url.searchParams.get('offset') || 0) + Number(url.searchParams.get('limit') || 500));
    if (url.pathname.includes('/auth/v1/user')) data = user;
    else if (url.pathname.includes('/auth/v1/token')) data = session;
    else if (url.pathname.includes('/rpc/generate_recurrences')) data = 0;
    else if (url.pathname.includes('/notification_preferences'))
      data = { preferences: { enabled: false } };
    else if (url.pathname.includes('/system_settings'))
      data =
        url.searchParams.get('key') === 'eq.profile'
          ? {
              value: {
                name: 'Conta de teste',
                companyName: 'Empresa de teste',
                email: user.email,
                role: 'Gestão',
                avatarUrl: '',
              },
            }
          : null;
    else if (url.pathname.includes('/functions/v1/finance-ai'))
      data = {
        text: '<p>Fluxo de caixa disponível para análise.</p><img src=x onerror="window.xss=true"><script>window.xss=true</script>',
      };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  if (authenticated)
    await page.addInitScript(
      (value) =>
        localStorage.setItem('sb-audit-auth-token', JSON.stringify(value)),
      session,
    );
}
test('login is responsive, accessible and shows authentication failure', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await mockApi(page);
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Bem-vindo de volta.' }),
  ).toBeVisible();
  await expect(page.locator('body')).not.toHaveJSProperty('scrollWidth', 0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('login-clean.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByLabel('E-mail', { exact: true }).fill('audit@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('invalid-password');
  await page.getByRole('button', { name: 'Mostrar senha' }).click();
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute(
    'type',
    'text',
  );
  await page.route('**/auth/v1/token?**', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        error_code: 'invalid_credentials',
        msg: 'Invalid login credentials',
      }),
    }),
  );
  await page.getByRole('button', { name: 'Acessar meu painel' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'E-mail ou senha incorretos.',
  );
  await page.screenshot({
    path: testInfo.outputPath('login.png'),
    fullPage: true,
    animations: 'disabled',
  });
  expect(errors).toEqual([]);
});
test('authenticated dashboard and key routes render without exceptions', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await mockApi(page, true);
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Dashboard', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('status', { name: 'Carregando dados' }),
  ).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('dashboard.png'),
    fullPage: true,
    animations: 'disabled',
  });
  for (const [hash, text] of [
    ['transactions', 'Atividades Recentes'],
    ['receivables', 'Contas'],
    ['payables', 'Contas'],
    ['reports', 'Relatórios'],
    ['settings', 'Perfil da Conta'],
    ['database', 'Gerenciamento de Dados'],
    ['ai-advisor', 'Consultor'],
  ]) {
    await page.evaluate((hash) => {
      location.hash = hash;
    }, hash);
    await expect(page.locator('main')).toContainText(text);
    await expect(
      page.getByRole('status', { name: 'Carregando dados' }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(
    await page.evaluate(() =>
      Boolean((window as unknown as { xss?: boolean }).xss),
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});
test('unsupported notifications do not crash settings', async ({ page }) => {
  await mockApi(page, true);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'Notification', {
      value: undefined,
      configurable: true,
    });
    delete (window as unknown as { Notification?: unknown }).Notification;
  });
  await page.goto('/#settings');
  await expect(
    page.getByText('Perfil da Conta', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Vamos retomar de onde você parou.')).toHaveCount(
    0,
  );
});

test('loads existing Supabase transactions when optional migrations are missing', async ({
  page,
}) => {
  await mockApi(page, true);
  await page.route('**/rest/v1/rpc/generate_recurrences', (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'PGRST202', message: 'Function not found' }),
    }),
  );
  await page.route('**/rest/v1/system_settings?**', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        code: '42703',
        message: 'user_id column not found',
      }),
    }),
  );
  await page.goto('/#transactions');
  await expect(
    page.getByText('Contrato de manutenção', { exact: true }).filter({visible:true}).first(),
  ).toBeVisible();
  await expect(
    page.getByText('Seus dados estão indisponíveis', { exact: true }),
  ).toHaveCount(0);
});

test('does not hide a denied financial query behind empty balances', async ({
  page,
}) => {
  await mockApi(page, true);
  await page.route('**/rest/v1/transactions?**', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ code: '42501', message: 'permission denied' }),
    }),
  );
  await page.goto('/');
  await expect(
    page.getByText('Seus dados estão indisponíveis', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('main')).toContainText('42501');
});
