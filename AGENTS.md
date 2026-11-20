# Guia para agentes

## Contexto do projeto

`unshackle-ui` é um cliente web React/TypeScript e um servidor Node.js para a API
REST do unshackle. Também consulta dados do JustWatch e executa rastreamento
persistente de lançamentos de séries em SQLite. Comece por [README.md](README.md)
e consulte [ARCHITECTURE.md](ARCHITECTURE.md), [RULES.md](RULES.md),
[TASKS.md](TASKS.md), [CONTEXT.md](CONTEXT.md) e as referências pertinentes em
`docs/`.

## Como navegar pelo código

- Siga o comportamento da interface em `src/routes/`; as rotas por arquivo do
  TanStack definem páginas e handlers da API no mesmo diretório.
- As chamadas do navegador ao unshackle passam por `src/lib/api/client.ts`; as
  configurações do navegador ficam em `src/lib/config.ts` e são persistidas por
  `src/lib/store.ts`.
- As chamadas de rastreamento passam por `src/lib/tracking/client.ts`; o servidor
  está em `src/server/` e nos módulos `api.tracking.*`.
- Antes de alterar inicialização, SSR, arquivos estáticos ou ciclo de vida do
  rastreador em segundo plano, leia `src/server.ts` e `server-runner.mjs`.
- Antes de alterar persistência, configurações de rastreamento ou precedência de
  ambiente, leia `src/server/db.ts`, `src/server/settings.ts` e
  `src/server/config.ts`.
- Antes de alterar interpretação de episódios/faixas ou correspondência de
  downloads, leia `src/lib/download.ts`, `src/lib/tracks.ts` e os testes associados.
- Antes de alterar descoberta, URLs de provedores ou correspondência de serviços,
  leia `src/server/justwatch.ts` e `src/lib/browse/match.ts`.
- Os detalhes das rotas e variáveis de implantação estão em
  [docs/API.md](docs/API.md) e [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Padrões existentes a preservar

- Mantenha separados os clientes unshackle do navegador e do servidor: o primeiro
  depende das preferências locais do navegador; o segundo usa configuração de
  runtime e não deve importar estado de React/localStorage.
- Use `src/server.ts` como ponto de inicialização de recursos de longa duração. A
  inicialização do rastreador é idempotente para tolerar HMR em desenvolvimento.
- Mantenha as varreduras serializadas e use o orquestrador `runScan` para
  verificações agendadas, manuais e acionadas por atraso.
- Mantenha mutações de rastreamento na camada SQLite e preserve nos handlers o
  filtro de proprietário via `callerKey`; registros com proprietário `NULL` são
  compartilhados intencionalmente.
- O esquema SQLite é inicializado e atualizado em `src/server/db.ts`; ao adicionar
  campos persistidos, amplie a lógica de compatibilidade existente.
- Siga as convenções de rotas por arquivo e os padrões existentes de consultas e
  mutações do React Query.

## Regras para alterações e testes

- Faça a menor alteração que resolva a solicitação; evite refatorações alheias.
- Não conclua que uma funcionalidade existe apenas porque há um tipo ou rótulo na
  interface. Verifique rotas, implementação no servidor e testes; atualmente o
  rastreamento só funciona para séries.
- Ao alterar lógica com padrão de testes existente, inclua ou atualize testes
  Vitest específicos. Quando adequado, execute `npm test`, `npm run check` e
  `npm run lint`.
- Mantenha a documentação alinhada ao código e diferencie fatos confirmados,
  inferências e desconhecidos. Atualize a referência relacionada à alteração.
- Nunca inclua credenciais, chaves de API, segredos de webhook, URLs privadas com
  credenciais ou dados reais de usuários no controle de versão ou na documentação.

## Restrições operacionais

- Não exponha a interface diretamente à internet pública sem autenticação e
  controles em proxy reverso. O Compose alerta explicitamente para esse risco.
- Não registre nem retorne segredos. Os padrões do navegador são valores
  `PUBLIC_*` incorporados no build; o rastreamento do servidor usa configurações
  `UNSHACKLE_*` de runtime e pode substituí-las pela interface de configurações.
- Mantenha `TRACKING_DB_PATH` gravável e persistente. Não exclua nem substitua o
  banco em tarefas normais de desenvolvimento ou teste.
- Não instale dependências nem execute comandos de formatação que reescrevam
  arquivos, a menos que a tarefa solicite isso.
