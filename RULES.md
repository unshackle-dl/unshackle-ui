# Regras e restrições do projeto

Este documento registra convenções e restrições confirmadas no repositório. Os
itens identificados como **Recomendação** são orientações, não regras já impostas.

## Convenções de código

- O TypeScript está configurado com `strict: true`, alvo ES2022 e resolução de
  módulos `bundler`. Preserve verificações estritas e tipos explícitos nas
  fronteiras entre módulos.
- A interface React usa arquivos `.tsx`; o servidor e a lógica compartilhada usam
  `.ts`. Os nomes das rotas seguem a convenção do TanStack para rotas por arquivo,
  incluindo segmentos `$param`.
- A formatação é verificada pelo Prettier (`npm run lint`); `npm run format`
  reescreve arquivos. `.prettierrc` define tabulações e aspas simples.
- Os tipos de API e rastreamento ficam em `src/lib/api/types.ts` e
  `src/lib/tracking/types.ts`; um tipo compartilhado não comprova que a rota
  correspondente implemente o comportamento.
- **Recomendação:** faça alterações focadas e siga os padrões próximos de
  nomenclatura, formatação, validação e tratamento de erros.

## Restrições arquiteturais

- O cliente de API do navegador depende de configurações em `localStorage`.
  Mantenha-o fora de módulos exclusivos do servidor e considere SSR quando um
  loader o chamar.
- As configurações exclusivas do servidor vêm de `process.env` em runtime e de
  substituições no SQLite; não use valores incorporados pelo Vite no lugar delas.
- A inicialização e compatibilidade do esquema SQLite são centralizadas em
  `src/server/db.ts`; preserve dados existentes e o comportamento de chaves
  estrangeiras.
- As varreduras são serializadas e de execução única. Alterações no agendamento ou
  detecção devem preservar esse comportamento, salvo redesenho deliberado.
- O build depende de Node: `server-runner.mjs` serve os arquivos estáticos e o
  handler fetch do Start. A implantação não é somente estática.

## Segurança e privacidade

- Chaves da API são enviadas ao unshackle no cabeçalho `X-Secret-Key`; nunca
  registre valores reais. `.env.example` contém apenas espaços reservados.
- Não retorne chaves de API do servidor nas respostas de configurações de
  rastreamento; a visualização atual informa se existe uma chave, não o valor.
- Registros de rastreamento são filtrados pela chave do chamador, com semântica
  compartilhada explícita para proprietário armazenado `NULL`. Preserve as
  verificações nos endpoints de rastreamento.
- URLs de webhook e API podem conter credenciais; valores de URL provenientes do
  ambiente são reduzidos ao host na visualização de configurações.
- O Compose alerta contra exposição pública direta sem autenticação ou controles
  em proxy reverso. Este repositório não configura esses controles.
- **Recomendação:** trate as configurações do servidor e a interface de
  rastreamento como superfícies de rede confiável até que haja controles de acesso
  externos; os handlers de configurações não autenticam as solicitações.

## Erros e logs

- Falhas da API usam JSON `{ "error": ... }` por meio do helper compartilhado,
  compatível com o parser de erros do cliente do navegador.
- O servidor registra falhas individuais de rastreamento em `last_error`; falhas
  opcionais de webhook são registradas e descartadas, sem retry.
- Os logs usam prefixos por componente, como `[poller]`, `[config]` e `[webhook]`.
- **Recomendação:** não inclua segredos nos logs e retorne erros úteis sem expor
  credenciais ou cabeçalhos internos.

## Testes e compatibilidade

- Os testes usam Vitest e ficam junto à implementação como `*.test.ts`.
- Os scripts são `npm test`, `npm run check` e `npm run lint`. Não há script
  separado declarado para testes de integração ou cobertura.
- O Docker compila e executa em `node:22-bookworm-slim`; `package.json` não
  especifica versão mínima local do Node. O código usa `node:sqlite` diretamente.
- O README informa que alguns recursos precisam do `main` do unshackle posterior
  à versão v5.3.0; essa nota existente não foi verificada com upstream.
- **Recomendação:** teste o comportamento de servidor na mesma versão principal
  do Node usada pelo Docker e evite depender de APIs posteriores à imagem declarada.
