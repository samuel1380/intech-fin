import { it, expect, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function edge({ authenticated = true, admitted = true } = {}) {
  let handler: (req: Request) => Promise<Response>;
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'Análise' } }] }),
      ),
    );
  const auth = vi
    .fn()
    .mockResolvedValue({
      data: { user: authenticated ? { id: 'user' } : null },
      error: authenticated ? null : { message: 'invalid' },
    });
  const env: Record<string, string> = {
    ALLOWED_ORIGINS: 'https://finance.example',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'public',
    AI_API_KEY: 'server-only-secret',
    AI_MODEL: 'test-model',
  };
  const source = fs
    .readFileSync('supabase/functions/finance-ai/index.ts', 'utf8')
    .replace(/^import .*;\r?\n/, '');
  const script = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
    },
  }).outputText;
  vm.runInNewContext(script, {
    Deno: {
      env: { get: (key: string) => env[key] },
      serve: (fn: typeof handler) => {
        handler = fn;
      },
    },
    createClient: () => ({
      auth: { getUser: auth },
      rpc: async () => ({ data: admitted, error: null }),
    }),
    fetch: fetcher,
    Response,
    Request,
    TextDecoder,
    Uint8Array,
    AbortSignal,
    console,
    JSON,
  });
  return { invoke: (request: Request) => handler(request), fetcher, auth };
}
const request = (
  options: { origin?: string; token?: string; body?: string } = {},
) =>
  new Request('https://edge.example/functions/v1/finance-ai', {
    method: 'POST',
    headers: {
      Origin: options.origin || 'https://finance.example',
      Authorization: options.token ?? 'Bearer valid-token',
    },
    body:
      options.body ??
      JSON.stringify({ messages: [{ role: 'user', content: 'Olá' }] }),
  });
it('rejects unknown origins before consulting auth', async () => {
  const e = edge();
  expect(
    (await e.invoke(request({ origin: 'https://evil.example' }))).status,
  ).toBe(403);
  expect(e.auth).not.toHaveBeenCalled();
});
it('rejects missing and invalid JWTs before calling AI', async () => {
  const e = edge({ authenticated: false });
  expect((await e.invoke(request({ token: '' }))).status).toBe(401);
  expect((await e.invoke(request())).status).toBe(401);
  expect(e.fetcher).not.toHaveBeenCalled();
});
it('limits cost and request sizes', async () => {
  const limited = edge({ admitted: false });
  expect((await limited.invoke(request())).status).toBe(429);
  const big = edge();
  expect((await big.invoke(request({ body: 'x'.repeat(41000) }))).status).toBe(
    413,
  );
  expect(big.fetcher).not.toHaveBeenCalled();
});
it('returns only generated text with restrictive CORS', async () => {
  const e = edge();
  const response = await e.invoke(request());
  expect(response.status).toBe(200);
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
    'https://finance.example',
  );
  expect(await response.text()).toBe(JSON.stringify({ text: 'Análise' }));
  expect(e.fetcher.mock.calls[0][1].headers.Authorization).toBe(
    'Bearer server-only-secret',
  );
});
it('rejects invalid message structure', async () => {
  const e = edge();
  expect(
    (
      await e.invoke(
        request({
          body: JSON.stringify({
            messages: [{ role: 'tool', content: 'invalid' }],
          }),
        }),
      )
    ).status,
  ).toBe(400);
  expect(e.fetcher).not.toHaveBeenCalled();
});
