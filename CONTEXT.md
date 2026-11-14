# Contexto consolidado

## O que é este projeto

`unshackle-ui` é uma interface de navegador e um servidor Node para a API REST do
unshackle. Permite descobrir títulos de serviços, inspecionar faixas/opções de
mídia, iniciar downloads e gerenciar jobs/histórico. Também oferece descoberta de
conteúdo com dados do JustWatch e rastreamento persistente de novos episódios de
séries.

## Como funciona

O TanStack Start fornece rotas React por arquivo, SSR e handlers HTTP no servidor.
O cliente de API do navegador chama o unshackle usando configurações armazenadas
no local storage (ou padrões de build `PUBLIC_*`). As rotas de descoberta fazem
proxy para o JustWatch no servidor. As rotas e o rastreador em segundo plano
compartilham um banco SQLite Node; o rastreador usa configurações de servidor
independentes das configurações de cada navegador.

Em produção, o Vite gera recursos de cliente e um handler fetch. `server-runner.mjs`
envolve esse handler em um servidor HTTP Node, serve os arquivos estáticos e dá
suporte a SSR em rotas acessadas diretamente. A inicialização do servidor prepara
o banco de rastreamento, carrega substituições de configuração armazenadas no
SQLite e inicia o rastreador idempotente.

## Fatos técnicos

- Stack de interface/runtime: React 19, TypeScript 6, TanStack Start/Router/Query,
  Vite 8 e Tailwind CSS 4; os testes usam Vitest 4.
- O rastreamento em segundo plano usa `node:sqlite`; o Docker usa Node 22.
- Módulos principais: `src/routes/` (páginas e API), `src/lib/api/` (cliente
  unshackle do navegador), `src/lib/browse/` (correspondência/proxy JustWatch),
  `src/lib/tracking/` (contrato/predefinições) e `src/server/` (SQLite, varreduras
  e integrações).
- Somente o rastreamento de séries está implementado; outros tipos falham na
  validação da API.
- Uma varredura de série lista títulos, calcula diferenças de códigos de episódio,
  pode enviar episódios novos para download, correlaciona arquivos de histórico
  concluídos e pode enviar um resumo de webhook com novidades.
- Os registros pertencem à chave usada na criação; sem chave, o proprietário é
  `anonymous`. Registros legados com proprietário `NULL` são compartilhados.

## Distinções importantes

- **Configuração do navegador:** `PUBLIC_UNSHACKLE_API_URL` e
  `PUBLIC_UNSHACKLE_API_KEY` são padrões incorporados no build pelo Vite; cada
  navegador pode substituí-los em Configurações/local storage.
- **Configuração do servidor:** `UNSHACKLE_API_URL`, `UNSHACKLE_API_KEY`,
  `TRACKING_DB_PATH`, `TRACKING_STAGGER_MS` e `TRACKING_WEBHOOK_URL` são variáveis
  de runtime. As configurações de rastreamento podem substituir todas, exceto o
  caminho do banco, por valores persistidos no SQLite.
- O navegador e o rastreador podem usar URLs ou credenciais diferentes de propósito.
- `npm run dev` executa o Vite; em produção, use `npm run build` e depois
  `npm start` ou a configuração Docker fornecida. Hospedagem estática não executa
  o rastreador em segundo plano.

## Limitações e desconhecidos

- Nenhuma integração ao vivo com unshackle ou JustWatch foi exercitada durante a
  documentação.
- Os esquemas/compatibilidade upstream completos não estão incluídos; o README
  existente afirma que alguns recursos precisam de um `main` mais recente do
  unshackle que a v5.3.0, mas essa afirmação não foi verificada.
- O repositório não configura proteção de acesso para exposição pública nem proxy
  reverso.
- O README referencia `LICENSE`, mas esse arquivo não existe neste checkout.
- Não foi encontrado roadmap ou lista explícita de tarefas planejadas além dos
  tipos de rastreamento não suportados; as melhorias em [TASKS.md](TASKS.md) são
  sugestões.

Para caminhos e fluxos de implementação, consulte
[ARCHITECTURE.md](ARCHITECTURE.md). Para alterações futuras, leia
[AGENTS.md](AGENTS.md) e [RULES.md](RULES.md) primeiro.
