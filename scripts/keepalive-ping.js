import { pathToFileURL } from 'node:url';
export async function runPing({
  env = process.env,
  fetcher = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = console.log,
} = {}) {
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = env;
  if (!url || !key)
    throw new Error(
      'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no servidor.',
    );
  const target = new URL('/rest/v1/maintenance_health?id=eq.1', url);
  if (target.protocol !== 'https:')
    throw new Error('SUPABASE_URL deve usar HTTPS.');
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetcher(target, {
        method: 'PATCH',
        headers: {
          apikey: key,
          Authorization: 'Bearer ' + key,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ checked_at: new Date().toISOString() }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        const error = new Error('Ping HTTP ' + response.status);
        error.retryable = response.status === 429 || response.status >= 500;
        throw error;
      }
      const rows = await response.json();
      if (!Array.isArray(rows) || rows.length !== 1)
        throw new Error(
          'Tabela de saúde não inicializada. Execute a migração.',
        );
      log(
        JSON.stringify({
          event: 'keepalive',
          status: 'ok',
          attempt,
          at: new Date().toISOString(),
        }),
      );
      return;
    } catch (error) {
      log(
        JSON.stringify({
          event: 'keepalive',
          status: 'failed',
          attempt,
          at: new Date().toISOString(),
        }),
      );
      if (attempt === 3 || error.retryable === false) throw error;
      await sleep(1000 * 2 ** (attempt - 1));
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  runPing().catch(() => {
    console.error(
      'Keep-alive falhou. Verifique os secrets, a migração e o estado do projeto.',
    );
    process.exitCode = 1;
  });
