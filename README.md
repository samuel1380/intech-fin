# FinIntech

Aplicação React + TypeScript para gestão financeira, com Supabase Auth/RLS, PWA e relatórios.

## Desenvolvimento

Use Node.js 22. Copie os valores públicos de `.env.example` para `.env.local`, execute `npm ci` e `npm run dev`.
Nunca coloque chaves de serviço, credenciais de IA ou a chave privada VAPID em variáveis `VITE_*`.

## Validação

- `npm run check`: lint, testes de unidade/integração PostgreSQL local, TypeScript estrito e build.
- `npx playwright install chromium` e `npm run test:e2e`: navegação em 1440, 768 e 390 pixels, usando APIs simuladas.
- `npm audit`: auditoria de dependências.
- `npx deno check supabase/functions/finance-ai/index.ts`: checagem da Edge Function.

## Publicação

A publicação exige as migrações em `supabase/migrations`, configuração da Edge Function, dos secrets do GitHub e das variáveis públicas do Render. Siga a ordem e os testes manuais em [docs/AUDIT.md](docs/AUDIT.md).

O site estático usa `render.yaml` para headers, CSP e roteamento. O servidor de desenvolvimento/preview não é o servidor de produção.
