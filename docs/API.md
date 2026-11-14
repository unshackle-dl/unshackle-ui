# Referência da API

Este documento cataloga as rotas do próprio servidor da interface e os endpoints
unshackle chamados pelos clientes do navegador e servidor. Não é uma especificação
completa da API upstream do unshackle.

## Rotas do servidor da interface

### Proxy de descoberta

| Método e caminho                            | Comportamento                                                    |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `GET /api/browse/search?q=...&country=US`   | Pesquisa no JustWatch; `q` é obrigatório e o país padrão é `US`. |
| `GET /api/browse/popular?country=US`        | Títulos populares de filmes e séries.                            |
| `GET /api/browse/popular/movies?country=US` | Filmes populares.                                                |
| `GET /api/browse/popular/tv?country=US`     | Séries populares.                                                |
| `GET /api/browse/title/{id}?country=US`     | Detalhes do título e ofertas de provedores.                      |

O país deve ser um código de duas letras. As rotas consultam o JustWatch no
servidor e não usam a chave da API unshackle.

### API de rastreamento

| Método e caminho               | Comportamento                                                                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/tracking`            | Lista os registros visíveis ao chamador.                                                                                                                                             |
| `POST /api/tracking`           | Cria um título rastreado; atualmente só aceita `series`.                                                                                                                             |
| `GET /api/tracking/{id}`       | Obtém um registro e seus itens, se forem próprios/compartilhados.                                                                                                                    |
| `PATCH /api/tracking/{id}`     | Atualiza campos aceitos, como rótulo, predefinição ou estado.                                                                                                                        |
| `DELETE /api/tracking/{id}`    | Exclui o registro visível e os itens associados em cascata.                                                                                                                          |
| `POST /api/tracking/{id}/seen` | Marca códigos selecionados ou todos os códigos não vistos do registro.                                                                                                               |
| `POST /api/tracking/seen`      | Marca todos os códigos não vistos dos registros do chamador.                                                                                                                         |
| `POST /api/tracking/check`     | Inicia varredura manual, opcionalmente de um registro; `trigger: stale-kick` indica verificação atrasada. Retorna `202` se iniciou; caso contrário, informa que já há uma varredura. |
| `GET /api/tracking/status`     | Retorna estado do rastreador/varredura e totais visíveis ao chamador.                                                                                                                |
| `GET /api/tracking/settings`   | Retorna metadados das configurações; não retorna o valor da chave.                                                                                                                   |
| `PUT /api/tracking/settings`   | Valida, persiste e aplica substituições das configurações do servidor.                                                                                                               |

A API de rastreamento usa `X-Secret-Key` como identidade/proprietário do chamador,
seguindo a convenção da chave upstream. Sem chave, o chamador literal é
`anonymous`. Os handlers de configurações de rastreamento não exigem autenticação
no código das rotas; proteja o acesso ao servidor na fronteira da implantação.

## Chamadas à API unshackle

O cliente do navegador em `src/lib/api/client.ts` chama diretamente estas famílias
no endereço-base unshackle configurado. As requisições incluem `X-Secret-Key`
quando a chave do navegador não está vazia. Opções de download específicas de cada
serviço podem ser encaminhadas no corpo da requisição.

| Família de endpoints                                      | Uso nesta interface                                                          |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `/api/health`, `/api/config`, `/api/env-check`            | Teste de conexão, configuração do servidor e verificações de ambiente.       |
| `/api/services`, `/api/profiles`, `/api/refresh-services` | Catálogo de serviços, perfis e ação de atualização.                          |
| `/api/search`, `/api/list-titles`, `/api/list-tracks`     | Resolver resultados de serviço, metadados do título e faixas de mídia.       |
| `/api/download`                                           | Enviar um download e receber referência do job.                              |
| `/api/download/jobs` e `/api/download/jobs/{id}...`       | Listar jobs, obter detalhes, alterar fila/estado e consumir eventos de jobs. |
| `/api/history` e `/api/history/{id}`                      | Listar e excluir itens do histórico de downloads.                            |
| `/api/clear-finished`, `/api/clear-temp`                  | Ações de manutenção disponíveis em Configurações.                            |

O cliente do rastreador no servidor, `src/server/upstream.ts`, usa
`POST /api/list-titles` para detecção, `GET /api/history` para correlação de
downloads e `POST /api/download` para downloads automáticos. Chamadas em segundo
plano usam configurações de runtime do servidor, não o local storage do navegador.

## Erros e acesso

Em geral, os handlers da interface respondem com JSON contendo o campo `error`
quando há entrada inválida ou falha upstream. O acesso aos registros de
rastreamento é filtrado pela chave do chamador; registros com proprietário `NULL`
são compartilhados. O proxy de descoberta e os handlers de configurações não
implementam autenticação nas rotas. Não exponha o servidor publicamente sem
controles externos de acesso adequados.
