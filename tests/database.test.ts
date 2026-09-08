import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import { beforeAll, afterAll, it, expect } from 'vitest';
let db: PGlite;
const alice = '00000000-0000-4000-8000-000000000001',
  bob = '00000000-0000-4000-8000-000000000002';
const files = fs
  .readdirSync('supabase/migrations')
  .sort()
  .map((f) => fs.readFileSync('supabase/migrations/' + f, 'utf8'));
const setup = `CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role; GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;`;
async function asUser(id: string) {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec('SET ROLE authenticated');
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(setup);
  await db.query('INSERT INTO auth.users VALUES($1),($2)', [alice, bob]);
  for (const sql of files) await db.exec(sql);
});
afterAll(async () => {
  await db.close();
});
it('reapplies migrations safely', async () => {
  for (const sql of files) await db.exec(sql);
});
it('isolates rows and blocks ownership reassignment and anonymous reads', async () => {
  await asUser(alice);
  await db.exec(
    "INSERT INTO public.transactions(description,amount,date,type,category,status) VALUES('A',100,'2026-09-08','RECEITA','Vendas','PENDENTE')",
  );
  await asUser(bob);
  expect(
    (await db.query('SELECT * FROM public.transactions')).rows,
  ).toHaveLength(0);
  await expect(
    db.query(
      "INSERT INTO public.transactions(user_id,description,amount,date,type,category,status) VALUES($1,'attack',1,'2026-09-08','RECEITA','Vendas','PENDENTE')",
      [alice],
    ),
  ).rejects.toThrow();
  await asUser(alice);
  await expect(
    db.query('UPDATE public.transactions SET user_id=$1', [bob]),
  ).rejects.toThrow();
  await db.exec('RESET ROLE; SET ROLE anon');
  await expect(db.query('SELECT * FROM public.transactions')).rejects.toThrow();
  await db.exec('RESET ROLE');
});
it('supports per-user settings and denies access to server-only tables', async () => {
  for (const id of [alice, bob]) {
    await asUser(id);
    await db.exec(
      "INSERT INTO public.system_settings(key,value) VALUES('profile','{}')",
    );
    expect(
      (await db.query('SELECT * FROM public.system_settings')).rows,
    ).toHaveLength(1);
    await expect(
      db.query('SELECT * FROM public.push_deliveries'),
    ).rejects.toThrow();
    await expect(
      db.query('SELECT * FROM public.maintenance_health'),
    ).rejects.toThrow();
  }
  await db.exec('RESET ROLE');
});
it('limits AI requests atomically per account', async () => {
  await asUser(alice);
  for (let i = 0; i < 20; i++)
    expect(
      (
        await db.query<{ ok: boolean }>(
          'SELECT public.claim_ai_request() AS ok',
        )
      ).rows[0].ok,
    ).toBe(true);
  expect(
    (await db.query<{ ok: boolean }>('SELECT public.claim_ai_request() AS ok'))
      .rows[0].ok,
  ).toBe(false);
  await asUser(bob);
  expect(
    (await db.query<{ ok: boolean }>('SELECT public.claim_ai_request() AS ok'))
      .rows[0].ok,
  ).toBe(true);
  await db.exec('RESET ROLE');
});
it('generates month-end recurrences once and scopes them to the caller', async () => {
  await asUser(alice);
  await db.exec(
    "INSERT INTO public.transactions(description,amount,date,type,category,status,\"isRecurring\",\"recurringIntervalMonths\",\"recurringDay\") VALUES('Aluguel',100,'2026-01-31','DESPESA','Operacional','PENDENTE',true,1,31)",
  );
  await db.query('SELECT public.generate_recurrences()');
  const first = await db.query(
    'SELECT date::text FROM public.transactions WHERE recurring_parent_id IS NOT NULL ORDER BY date',
  );
  expect(first.rows.some((r: any) => r.date === '2026-02-28')).toBe(true);
  expect(
    (
      await db.query<{ count: number }>(
        'SELECT public.generate_recurrences() AS count',
      )
    ).rows[0].count,
  ).toBe(0);
  await asUser(bob);
  expect(
    (
      await db.query<{ count: number }>(
        'SELECT public.generate_recurrences() AS count',
      )
    ).rows[0].count,
  ).toBe(0);
  await db.exec('RESET ROLE');
});
it('converts a single-user legacy identifier and rejects ambiguous owners', async () => {
  for (const count of [1, 2]) {
    const legacy = new PGlite();
    try {
      await legacy.exec(setup);
      await legacy.query('INSERT INTO auth.users VALUES($1)', [alice]);
      if (count === 2)
        await legacy.query('INSERT INTO auth.users VALUES($1)', [bob]);
      await legacy.exec(
        "CREATE TABLE public.notification_preferences(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text UNIQUE,preferences jsonb DEFAULT '{}',push_subscription jsonb,updated_at timestamptz DEFAULT now()); INSERT INTO public.notification_preferences(user_id) VALUES('intechfin_default');",
      );
      if (count === 1) {
        await legacy.exec(files[0]);
        expect(
          (
            await legacy.query(
              'SELECT user_id FROM public.notification_preferences',
            )
          ).rows[0].user_id,
        ).toBe(alice);
      } else await expect(legacy.exec(files[0])).rejects.toThrow('Ambiguous');
    } finally {
      await legacy.close();
    }
  }
});

it('protects device subscriptions and atomically claims delivery', async () => {
  await asUser(alice);
  const inserted = await db.query<{ id: string }>(
    "INSERT INTO public.push_subscriptions(endpoint,subscription) VALUES('https://fcm.googleapis.com/first','{}') RETURNING id",
  );
  await asUser(bob);
  expect(
    (await db.query('SELECT * FROM public.push_subscriptions')).rows,
  ).toHaveLength(0);
  await expect(
    db.query('SELECT public.claim_push($1,$2)', [inserted.rows[0].id, 'test']),
  ).rejects.toThrow();
  await db.exec('RESET ROLE; SET ROLE service_role');
  await db.query('SELECT * FROM public.notification_preferences');
  expect(
    (
      await db.query<{ ok: boolean }>('SELECT public.claim_push($1,$2) AS ok', [
        inserted.rows[0].id,
        'test',
      ])
    ).rows[0].ok,
  ).toBe(true);
  expect(
    (
      await db.query<{ ok: boolean }>('SELECT public.claim_push($1,$2) AS ok', [
        inserted.rows[0].id,
        'test',
      ])
    ).rows[0].ok,
  ).toBe(false);
  await db.exec('RESET ROLE');
});
