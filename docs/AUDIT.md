# Auditoria e implantação — setembro de 2026

## Achados e correções

| Área            | Problema encontrado                                                                                              | Correção                                                                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep-alive      | CommonJS require em projeto ES Modules; pings sem proprietário inseriam e removiam dinheiro fictício             | Script ESM sem dependências, tabela exclusiva de saúde, timeout de 10 s, até três tentativas com backoff e logs JSON sem secrets                                     |
| Disponibilidade | Timer de navegador não executa com app fechado; workflow usa chave anônima incompatível com RLS                  | GitHub Actions diário às 09:17 UTC, credencial somente no servidor, controle de concorrência e limite de duração                                                     |
| Push            | Nenhum emissor backend versionado; preferências gravadas com intechfin_default                                   | Emissor web-push horário, usuário validado, inscrições por dispositivo, VAPID público no cliente e privado no job                                                    |
| Push lifecycle  | Espera infinita por worker, falta de feature detection e renovação                                               | Timeout de ativação, detecção de capacidades, sincronização ao entrar/retornar, rotação da chave pública, limpeza de endpoints 404/410, cancelamento por dispositivo |
| Service Worker  | Cache genérico de respostas, redirecionamento aberto em notificações                                             | Offline público dedicado, nenhuma API/HTML autenticado em cache, URL limitada à mesma origem, limpeza apenas dos caches do aplicativo                                |
| RLS             | Políticas USING(true), conversão de texto inválido para UUID, uniqueness global de configurações                 | Migrações transacionais e reaplicáveis, remoção de políticas antigas das tabelas conhecidas, auth.uid por proprietário, WITH CHECK, índices por usuário              |
| Migração legada | Dados sem user_id poderiam desaparecer do painel                                                                 | Atribuição apenas quando há exatamente um usuário; proprietários ambíguos abortam a transação para correção explícita; nenhuma exclusão de transações                |
| IA              | Chaves pessoais no localStorage e chamadas diretas a provedores                                                  | Edge Function autenticada, CORS por origem, limite de 20 solicitações/hora/usuário, tamanho de entrada e timeout, chave do provedor somente no servidor              |
| XSS             | DOMPurify importado mas ausente do manifesto                                                                     | Dependência instalada e atualizada, HTML de IA limitado a tags textuais sem atributos, texto React escapado, avatar limitado a formatos raster                       |
| Injeção         | Payloads financeiros sem validação; CSV com fórmulas e aspas não tratadas                                        | Zod e allowlist de campos, constraints no PostgreSQL, escape de fórmulas/aspas na exportação                                                                         |
| Recorrências    | Criação dentro de leitura React, duplicação por concorrência e datas inválidas no fim do mês                     | RPC com lock por usuário, índice único de recorrência e ajuste para último dia do mês; limite de processamento                                                       |
| Parcelamento    | Inserções sequenciais podiam deixar parcelas parcialmente salvas                                                 | Uma inserção em lote atômica, limite de parcelas e distribuição de centavos sem saldo negativo                                                                       |
| Bugs funcionais | Campos ausentes de parcelamento, enum inexistente, relatório sem comissão pendente, botão de imposto inexistente | Tipos e handlers corrigidos; comissão proporcional quando nada foi recebido; pendências incluem recebimentos parciais; impostos exigem configuração explícita        |
| Interface       | CDN Tailwind e scripts inline, botões/filtro decorativos, estado de erro confundido com saldo zero               | CSS compilado, identidade de login própria, paleta padronizada, skeletons, toasts, Error Boundary, estados de erro recuperáveis, ações funcionais e telas lazy       |
| Qualidade       | Sem lint/typecheck/testes no build                                                                               | TypeScript estrito, ESLint e hooks, Vitest/PostgreSQL local, Playwright, CI e remoção de módulos abandonados                                                         |

## Evidências do ambiente remoto

Consulta somente de leitura ao GitHub: as três últimas execuções do keep-alive estavam com falha, incluindo [execução 33936442116](https://github.com/samuel1380/intech-fin/actions/runs/33936442116). Os nomes de secrets existentes eram somente SUPABASE_URL e SUPABASE_ANON_KEY. Valores secretos não foram consultados nem copiados.

Não houve acesso administrativo ao projeto Supabase ou ao Render. Portanto, esta entrega não declara RLS, cron, headers nem push já aplicados/validados em produção. As migrações e a configuração estão versionadas e os testes locais usam banco isolado e APIs simuladas.

## Ordem de implantação

1. Faça backup do banco e teste em staging. Desative cadastro público no Supabase Auth se a conta deve continuar restrita ao administrador. As policies isolam cada usuário, mas o cadastro é configuração do Auth, não uma permissão de interface.
2. Inspecione o schema real. A migração cria tabelas completas para instalações novas e assume que a tabela transactions existente contém os campos do modelo TypeScript. Se uma antiga migração criou apenas id/created_at, restaure o schema antes de continuar. Nunca execute novamente os SQL antigos da raiz, agora marcados como obsoletos.
3. Aplique, em ordem, as três migrações de supabase/migrations. Para dados legados: em uma base com exatamente um usuário auth, os registros sem dono e intechfin_default passam para esse UUID. Com zero/múltiplos usuários e dados órfãos, atribua explicitamente os proprietários antes de executar. Valores UUID inválidos ou donos inexistentes interrompem a migração, preservando a transação.
4. Configure os secrets da Edge Function: AI_API_KEY, AI_MODEL e ALLOWED_ORIGINS (lista de origens HTTPS exatas, separadas por vírgula). SUPABASE_URL e SUPABASE_ANON_KEY são os valores de ambiente padrão da plataforma. Publique finance-ai. O gateway valida JWT e o handler confirma o usuário via auth.getUser. O provedor é OpenRouter; o modelo deve ser configurado pelo administrador.
5. Gere um par VAPID com `npx web-push generate-vapid-keys` em ambiente privado. No GitHub Actions configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT (mailto de contato). Não cole esses valores em issues, PRs ou no chat. A mesma chave pública deve ser usada na build do frontend.
6. No Render configure VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e VITE_VAPID_PUBLIC_KEY. Publique com o Blueprint ou replique seus headers e rewrite no painel. Remova credenciais de IA do ambiente de build estático. Se usar domínio customizado do Supabase, ajuste connect-src para a origem exata; o padrão permite os projetos supabase.co e pode ser restringido ao projeto específico.
7. Após o merge, habilite os workflows na branch padrão. Execute manualmente Keep-Alive e Scheduled financial push e confira o resultado. Os cron da branch de auditoria não são automaticamente ativados enquanto ela não for a branch padrão.
8. Confirme no deploy os headers CSP, HSTS, nosniff, Referrer-Policy e Cache-Control de sw.js; recarregue o PWA para substituir o worker antigo. Faça os testes de dispositivo abaixo.

## Testes de aceitação em produção

- Anônimo não consegue consultar/alterar tabelas privadas. Usuário A não lê, altera ou apaga registros do usuário B. Alterar user_id deve falhar. As tabelas internas de saúde, entregas e limites de IA não são acessíveis diretamente pelo cliente.
- Audite todas as tabelas do schema public, inclusive tabelas fora deste repositório, usando supabase/verify-security.sql. Não habilite policies permissivas para fazer erros desaparecerem.
- Com HTTPS, ativar notificações deve pedir permissão somente ao clicar; negar não quebra a tela. No iOS/iPadOS, instale o PWA na tela inicial antes de permitir. Navegadores sem suporte mantêm acesso ao painel e exibem orientação.
- Após ativar, confirme uma linha em push_subscriptions com o UUID do usuário e uma por dispositivo. Edite preferências, feche o PWA, execute o job de push com uma conta a vencer e confirme a entrega real. O botão de teste local testa apenas a exibição do dispositivo, não o emissor remoto.
- Clique na notificação e confirme a rota. Teste rotação VAPID abrindo o app novamente, cancelamento, sessão expirada, segundo dispositivo, logout e endpoints 410. Não compartilhe endpoint/keys das inscrições em logs públicos.
- Execute keep-alive: deve atualizar exclusivamente maintenance_health.checked_at, nunca transactions. Remova uma configuração em staging e confirme que o job falha explicitamente; simule 503 para observar tentativas limitadas.
- Em 390, 768 e 1440 pixels teste cadastro/edição, parcelamento, mudança de período, relatórios, tema escuro, navegação por teclado e redução de movimento. Requisições de IA devem conter JWT do usuário, nunca a chave do provedor.

## Limites e decisões

- Supabase Free pode pausar projetos com pouca atividade. Ping periódico não garante prevenção de pausa e não reativa um projeto já pausado; nesse caso restaure-o no painel. Para disponibilidade contratual, use plano adequado.
- GitHub cron pode atrasar, roda a partir da branch padrão e pode ser desabilitado após 60 dias sem atividade em repositórios públicos. O job registra falhas, mas não se auto-reabilita. Para operação contínua independente do repositório, execute o mesmo script ESM em um agendador externo monitorado com os mesmos secrets.
- Push agendado tem granularidade de uma hora, fuso America/Sao_Paulo. Intervalos locais menores não significam entrega remota em segundos. Inscrições sem cliente aberto são reconciliadas na próxima abertura após expiração; um worker não armazena credenciais para renová-las em background.
- Entrega externa é, no melhor caso, ao menos uma vez: uma interrupção entre envio e confirmação no banco pode reenviar. Claims expiram em dez minutos; histórico é limpo após 35 dias; mensagens têm TTL de uma hora. Cada push usa tag estável.
- Campos sem fonte de dados implementada, como meta atingida, não geram eventos fictícios. Alertas de saldo são calculados pelas movimentações; notificações não constituem um extrato bancário conciliado. Nova movimentação considera registros criados na última hora.
- Auth de SPA mantém a sessão do SDK no navegador em tempo de execução; ela não é incorporada à build. Credenciais de provedor, service role e VAPID privado permanecem no servidor. Cookies HttpOnly exigiriam uma arquitetura BFF separada. A CSP permite estilos inline necessários a gráficos e componentes, mas não scripts inline/eval.
- Chaves de IA legadas são removidas do localStorage ao carregar o app. Considere revogá-las no provedor, pois sua exposição anterior não pode ser revertida apenas removendo o armazenamento.
- Não foram alteradas configurações remotas, feito merge nem aplicado SQL em produção nesta auditoria. O PR pode ser revisado antes da implantação coordenada.

## Referências

- [Supabase Production Checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase — RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase — autenticação de Edge Functions](https://supabase.com/docs/guides/functions/auth)
- [WebKit — Web Push no iOS/iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [GitHub — workflows desabilitados por inatividade](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)
- [Render — headers de sites estáticos](https://render.com/docs/static-site-headers)

## Validação local executada

49 testes Vitest passaram, incluindo PostgreSQL/PGlite, RLS, migrações, recorrências, rate limit, regras push, service worker, Edge Function, CSV e entradas financeiras. Nove cenários Playwright passaram em Chromium a 1440×1000, 768×1024 e 390×844, com dados sintéticos e APIs simuladas. TypeScript estrito e ESLint passaram; deno check da Edge Function passou; npm audit não reportou vulnerabilidades. O build tem avisos de anotações de terceiros (Zod) e tamanho de chunk; não são erros de compilação.

A pasta dist deixou de ser versionada: continha múltiplas builds antigas. O Render gera os artefatos a partir do fonte e do lockfile.
