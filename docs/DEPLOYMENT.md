# Implantação e configuração

## Desenvolvimento local

```sh
npm ci
npm run dev
```

Por padrão, o Vite serve a aplicação em `http://localhost:5173`. Configure o
endereço e a chave do unshackle nas Configurações do navegador ou forneça valores
padrão opcionais de build em `.env`, conforme `.env.example`.

## Servidor Node de produção

```sh
npm ci
npm run build
npm start
```

`npm start` executa `node server-runner.mjs`. A porta padrão é `3000`; `PORT` a
substitui. O processo de produção precisa executar em Node e ter permissão de
escrita no diretório-pai do SQLite. Mantenha o arquivo do banco persistente entre
implantações/reinicializações; perdê-lo significa perder registros e estado de
itens rastreados, além de substituições das configurações do servidor.

## Docker Compose

O `Dockerfile` raiz é um build em múltiplos estágios baseado em
`node:22-bookworm-slim`. `docker-compose.yaml` publica a porta `3000`, persiste
`/data` no volume nomeado `unshackle-ui-data` e define
`TRACKING_DB_PATH=/data/tracking.db`. Configure no ambiente as variáveis usadas
pelo Compose: `UNSHACKLE_API_URL`, `UNSHACKLE_API_KEY`,
`TRACKING_STAGGER_MS` e `TRACKING_WEBHOOK_URL`.

Ao executar o unshackle em outro contêiner, conecte os serviços à rede apropriada
e use um endereço alcançável pelo contêiner da interface. O padrão Compose
`http://localhost:8786` aponta para o próprio contêiner da interface, não para
outro contêiner.

## Referência de configuração

| Variável                   | Consumidor                    | Padrão / comportamento                                                                                                       |
| -------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_UNSHACKLE_API_URL` | Build do navegador            | Padrão `http://localhost:8786`; o Vite expõe/incorpora o valor no build.                                                     |
| `PUBLIC_UNSHACKLE_API_KEY` | Build do navegador            | Vazia; somente valor padrão do build.                                                                                        |
| `UNSHACKLE_API_URL`        | Servidor Node de rastreamento | Padrão `http://localhost:8786`; o rastreador fica inerte até configurar explicitamente a URL por ambiente ou pela interface. |
| `UNSHACKLE_API_KEY`        | Servidor Node de rastreamento | Vazia; enviada ao upstream como `X-Secret-Key` quando definida.                                                              |
| `TRACKING_DB_PATH`         | Servidor Node de rastreamento | `./data/tracking.db`; no contêiner é `/data/tracking.db`.                                                                    |
| `TRACKING_STAGGER_MS`      | Servidor Node de rastreamento | `30000`; intervalo entre verificações de títulos numa varredura.                                                             |
| `TRACKING_WEBHOOK_URL`     | Servidor Node de rastreamento | Vazia desativa resumos de saída.                                                                                             |
| `PORT`                     | `server-runner.mjs`           | `3000`.                                                                                                                      |

Os valores do navegador são padrões de build e cada navegador pode alterá-los em
Configurações/local storage. Os valores do servidor são lidos no início do
processo; a página Rastreamento pode persistir substituições para URL, chave,
intervalo e webhook no banco. Essas substituições têm precedência sobre as
variáveis de ambiente. O caminho do banco só pode ser configurado pelo ambiente.
As configurações do navegador e do servidor podem divergir.

## Segurança e operação

- Não publique a interface diretamente na internet sem autenticação e controles
  em proxy reverso. Este repositório não fornece proxy de controle de acesso, e os
  handlers de configurações de rastreamento não têm autenticação no código das rotas.
- Mantenha chaves de API e URLs de webhook com credenciais em um gerenciador de
  segredos/ambiente; não inclua `.env` nem valores reais em commits, issues, docs ou logs.
- Persista e faça backup do volume SQLite. Não há automação de backup/restauração.
- A entrega de webhook é não bloqueante, tem timeout de 10 segundos e não possui
  fila de retries.
- Hospedagem estática não executa handlers SSR, SQLite nem o rastreador em segundo plano.
