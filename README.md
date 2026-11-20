<p align="center">
    <img width="16" height="16" alt="sem criptografia" src="https://github.com/user-attachments/assets/6ff88473-0dd2-4bbc-b1ea-c683d5d7a134" /> unshackle-ui
    <br/>
    <sup><em>Interface web para a API REST do unshackle</em></sup>
</p>

<p align="center">
  <a href="#instalação">Instalação</a> &nbsp;·&nbsp;
  <a href="#configuração">Configuração</a> &nbsp;·&nbsp;
  <a href="https://github.com/unshackle-dl/unshackle">unshackle</a>
</p>

---

Cliente web para o [unshackle](https://github.com/unshackle-dl/unshackle). Pesquise
um serviço ou abra um título por ID/URL, escolha faixas e opções e inicie e
acompanhe downloads. Desenvolvido com TanStack Start e Tailwind.

<img width="1258" height="1006" alt="Captura de tela do unshackle-ui" src="https://github.com/user-attachments/assets/28d71fdd-e8dc-4786-a114-b76e268e1129" />

## Instalação

```shell
npm install
npm run dev      # http://localhost:5173
```

Na página **Configurações**, informe o endereço de uma API unshackle em execução.
Para testes locais, o unshackle pode ser iniciado com `unshackle serve --no-key`.

> [!NOTE]
> O projeto informa que precisa do `main` do unshackle, posterior à versão
> v5.3.0. Versões mais antigas funcionam para pesquisa e downloads, mas Histórico,
> ações de fila, perfis e manutenção podem falhar. Essa afirmação é preexistente e
> não foi verificada contra uma instalação upstream nesta análise.

## Executar a versão compilada

```shell
npm run build
npm start        # http://localhost:3000; use PORT para alterar a porta
```

O rastreamento automático é executado no servidor Node. Portanto, a aplicação
precisa de um runtime Node, não de hospedagem estática, e `data/` precisa permitir
escrita e persistir entre reinicializações. Ao adicionar uma série, informe o dia
e o horário esperados de lançamento no fuso local. O rastreador verifica nessa
janela semanal, envia episódios recém-listados para download e tenta novamente um
lançamento atrasado a cada cinco minutos, por até cinco tentativas.

## Configuração

O navegador obtém o endereço e a chave da API pela página **Configurações**.
Valores padrão opcionais podem ser fornecidos em `.env` (consulte `.env.example`).

O servidor mantém configurações próprias, pois o processo de rastreamento não
consegue ler as configurações do navegador:

```shell
UNSHACKLE_API_URL=http://localhost:8786
UNSHACKLE_API_KEY=           # enviada como X-Secret-Key pelo rastreador
TRACKING_DB_PATH=./data/tracking.db
TRACKING_STAGGER_MS=30000    # intervalo entre verificações de uma varredura
TRACKING_WEBHOOK_URL=        # POST de resumo opcional por ciclo de verificação
```

O endereço e a chave da API, o intervalo e o webhook podem ser editados em tempo
real na janela de configurações da página **Rastreamento**; esses valores têm
precedência sobre as variáveis de ambiente. Os títulos rastreados ficam associados
à chave `X-Secret-Key` usada na criação.

`TRACKING_WEBHOOK_URL` recebe um único POST JSON por ciclo que encontrou novidades:
o lançamento de doze episódios gera uma notificação, não doze.

## Licença

[GPL-3.0](LICENSE).

O checkout analisado não contém o arquivo `LICENSE`, embora a referência acima
exista. A afirmação original foi preservada, mas não foi possível confirmá-la.

## Guia do projeto

Este guia complementa a apresentação original. O repositório contém um cliente web
React/TypeScript e um servidor Node para a API REST do unshackle. Também oferece um
proxy de consulta ao JustWatch no servidor e rastreamento agendado e persistente de
lançamentos de séries. Consulte [Arquitetura](ARCHITECTURE.md), [Instruções para
agentes](AGENTS.md), [Regras do projeto](RULES.md), [Estado atual](TASKS.md),
[Contexto consolidado](CONTEXT.md), [Rotas da API](docs/API.md) e
[Implantação](docs/DEPLOYMENT.md) para os detalhes.

### Funcionalidades

- Pesquisar serviços do unshackle, abrir títulos por identificador ou URL,
  inspecionar faixas e legendas, configurar opções e iniciar e acompanhar jobs.
- Consultar e gerenciar downloads, histórico, perfis de serviço, configurações e
  operações de manutenção expostas pelo servidor unshackle configurado.
- Pesquisar títulos, consultar populares e ver ofertas por provedor no JustWatch.
- Rastrear listagens de séries em SQLite, detectar códigos de episódios novos,
  retornados ou removidos, opcionalmente baixá-los, correlacionar downloads
  concluídos como vistos e enviar um resumo de webhook por varredura com novidades.
- Persistir preferências do navegador no armazenamento local e o estado do
  rastreamento do servidor no banco SQLite configurado.

Os tipos de rastreamento para filmes e buscas existem nos tipos compartilhados,
mas a API atualmente os rejeita; somente o rastreamento de séries está implementado.

### Tecnologias e pré-requisitos

- React 19, TypeScript 6, TanStack Start/Router/Query, Vite 8 e Tailwind CSS 4.
- Node.js é necessário para compilar e executar o servidor. A imagem Docker usa
  Node 22; a persistência do servidor usa o módulo nativo `node:sqlite`.
- npm e acesso à API REST do unshackle são necessários para o uso normal. As
  páginas de descoberta também precisam de acesso de saída ao JustWatch.
- As faixas declaradas das dependências e os scripts estão em `package.json`; o
  `package-lock.json` registra a resolução. `package.json` não declara `engines`.

### Instalar e executar

```sh
cp .env.example .env  # padrões opcionais; mantenha os segredos privados
npm ci
npm run dev
```

Acesse `http://localhost:5173`. Configure o endereço e a chave da API unshackle
em **Configurações** ou use os padrões de build `PUBLIC_UNSHACKLE_API_URL` e
`PUBLIC_UNSHACKLE_API_KEY`. `npm run build && npm start` serve a versão de produção
na porta 3000 por padrão; defina `PORT` para alterá-la. O rastreamento exige um
caminho de banco persistente e gravável, definido por `TRACKING_DB_PATH`. Também
há uma configuração Docker Compose; consulte [Implantação](docs/DEPLOYMENT.md).

### Verificações

```sh
npm test
npm run check
npm run lint
```

`npm run lint` verifica a formatação com Prettier. Não execute `npm run format`
apenas para validar, pois esse comando reescreve arquivos.

### Estrutura do repositório

| Caminho                  | Responsabilidade                                                         |
| ------------------------ | ------------------------------------------------------------------------ |
| `src/routes/`            | Páginas com rotas por arquivo e handlers HTTP da API.                    |
| `src/lib/api/`           | Cliente REST do navegador, tipos de resposta e eventos de jobs.          |
| `src/lib/browse/`        | Modelos de descoberta, correspondência de ofertas e clientes proxy.      |
| `src/lib/tracking/`      | Cliente, tipos e conversão de predefinições de download do rastreamento. |
| `src/lib/components/`    | Componentes compartilhados da interface.                                 |
| `src/lib/stores/`        | Preferências do navegador, como tema, destaque, fontes e privacidade.    |
| `src/server/`            | Configurações Node, SQLite, clientes upstream, varreduras e integrações. |
| `static/`, `src/styles/` | Recursos estáticos públicos e estilos globais.                           |
| `docs/`                  | Referências específicas da API e da implantação.                         |
