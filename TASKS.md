# Estado do projeto

O estado abaixo foi identificado no código e nos testes deste checkout; não foi
inferido a partir de uma implantação em execução ou de serviços upstream.

## Implementado e comprovado

- Fluxos no navegador para pesquisar serviços, inspecionar títulos/faixas, enviar
  downloads, acompanhar e gerenciar jobs e consultar histórico de downloads.
- Configurações, perfis de serviço e chamadas de manutenção delegadas à API
  unshackle configurada.
- Páginas de descoberta via JustWatch para pesquisa, populares e ofertas, com
  testes para correspondência de ofertas e normalização de URLs.
- Persistência de rastreamento em SQLite, filtragem por proprietário, comparação
  de episódios de séries, varreduras agendadas/manuais, retries por janela de
  lançamento, download automático opcional, correlação do histórico como visto e
  resumos opcionais via webhook.
- Há testes unitários para parsing de downloads, jobs, opções, faixas,
  correspondência JustWatch, predefinições do rastreamento, horários de lançamento,
  downloads automáticos e detecção de séries.

## Incompleto confirmado

- `src/routes/api.tracking.ts` rejeita explicitamente tipos de rastreamento
  diferentes de `series`. Filmes e buscas constam nos tipos e no armazenamento
  compartilhados, mas não têm fluxo funcional de endpoint/detector.

## Restrições operacionais e débitos confirmados

- O rastreamento depende de um servidor Node de longa duração, caminho SQLite
  gravável e persistente e URL do unshackle configurada no servidor. Hospedagem
  estática, sozinha, não executa esses recursos.
- As configurações do unshackle no navegador e no rastreador em segundo plano são
  independentes e podem apontar para APIs/credenciais diferentes.
- As verificações são serializadas e espaçadas deliberadamente; varreduras de uma
  coleção grande podem levar vários minutos.
- O código usa `node:sqlite` e registra seu status experimental no Node 22; o
  runtime Docker atual usa Node 22.
- O README existente aponta para um `LICENSE` ausente neste checkout.
- Os handlers das configurações de rastreamento não têm autenticação no código da
  rota. Os comentários do Compose alertam contra exposição pública sem controles
  externos de acesso.
- A nota de compatibilidade do README com unshackle e o comportamento de
  integrações ao vivo não foram verificados contra um servidor upstream.

## Sugestões (não são bugs confirmados nem tarefas já assumidas)

- Adicionar autenticação/controle de acesso explícito ou documentar implantação
  obrigatória em rede confiável para configurações e endpoints de rastreamento.
- Considerar testes de integração para rotas HTTP, migrações SQLite, precedência
  de configurações de runtime e ciclo de vida do rastreador.
- Decidir se o rastreamento de filmes/buscas é desejado; se for, implementar
  detectores e fluxo completo antes de anunciar esses tipos como disponíveis.
- Confirmar com os responsáveis a licença pretendida e a nota de compatibilidade
  antes de alterar qualquer afirmação existente.
- Considerar documentar procedimentos de backup e restauração do volume SQLite.
