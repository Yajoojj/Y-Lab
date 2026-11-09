# Y-Lab

Laboratório de IA pessoal: uma torre 3D ao vivo, em vermelho e preto, que mostra o que cada agente está fazendo. Isso inclui sessões e subagentes do Claude Code, trilhas do orquestrador K9 e qualquer bot que reporte por HTTP.

Tudo roda na sua máquina. O hub só escuta em `127.0.0.1` e nada é enviado para serviços de terceiros.

## Como rodar

Requer Node 20+.

```bash
npm install
```

```bash
npm run dev
```

Abra <http://127.0.0.1:5173>.

- **Hub:** `http://127.0.0.1:7077` (API + SSE). Coleta sessões e trilhas a cada 3 s e salva o estado em `data/state.json`.
- **Web:** Vite em `5173`, com proxy de `/api` para o hub.

## Como usar a torre

- Cada **andar** é uma equipe: uma trilha da empresa, o projeto de uma sessão do Claude Code ou o grupo definido por `groups`.
- Clique num andar (na cena ou na lista **Andares**) para ver o corte da torre naquele andar. Clique num agente para abrir o painel de detalhes. `Esc` volta à visão geral.
- **Modo leve** desliga os efeitos (bloom, scanlines e chuva) em máquinas mais fracas.

| Status | Cor | Na cena |
|---|---|---|
| `working` | vermelho | flutua e pulsa na mesa |
| `waiting_user` | âmbar | farol girando; aparece em "Esperando por mim" |
| `error` | azul-gelo | glitch e anel no chão |
| `idle` | cinza | vai para o lounge do andar |
| `done` | osso | brilho rápido e some do andar; fica em "Concluídos" |

## Reportar de qualquer bot

Mande um `POST` com JSON para `http://127.0.0.1:7077/api/events`. O corpo aceita até 64 KB e precisa ser JSON válido. O campo `step` é cortado em 80 caracteres.

```bash
curl -s -d '{"bot":"Writer","status":"working","step":"escrevendo o post de hoje"}' http://127.0.0.1:7077/api/events
```

```bash
curl -s -d '{"roster":["Writer","Scout"]}' http://127.0.0.1:7077/api/events
```

```bash
curl -s -d '{"groups":{"Writer":"Conteúdo","Scout":"Pesquisa"}}' http://127.0.0.1:7077/api/events
```

```bash
curl -s -d '{"looks":{"Writer":{"shape":"star6","color":"#FF1F33","accessory":"antenna"}}}' http://127.0.0.1:7077/api/events
```

```bash
curl -s -d '{"chat":{"Writer":"https://exemplo.local/chat/writer"}}' http://127.0.0.1:7077/api/events
```

```bash
curl -s -d '{"routines":{"bot":"Writer","items":[{"name":"Post diário","schedule":"todo dia 08:00","next_run":"2026-11-10T11:00:00Z"}]}}' http://127.0.0.1:7077/api/events
```

```bash
curl -s -d '{"type":"usage","total_used_pct":37,"resets_at":"2026-11-14T00:00:00Z","bots":{"Writer":4.1}}' http://127.0.0.1:7077/api/events
```

Valores aceitos:
- `status`: `working`, `idle`, `waiting_user`, `error`, `done`.
- `shape`: `sphere`, `rounded_cube`, `pill`, `triangle`, `cone`, `pentagon`, `hexagon`, `star4`, `star6`, `clover`, `rounded_square`, `trio`.
- `accessory`: `none`, `glasses`, `stem`, `antenna`, `bow`.
- Cor: `#RRGGBB`.

Outras rotas:
- `GET /api/state`: snapshot completo.
- `GET /api/stream`: eventos SSE (`snapshot`, depois `delta`).
- `GET /api/health`: estado dos coletores.

## Configuração — `ylab.config.json`

```json
{
  "port": 7077,
  "sessionsMaxAgeH": 1,
  "token": "opcional",
  "claudeProjectsDir": "opcional; padrão ~/.claude/projects",
  "k9": { "path": "pasta do orquestrador K9 (com trilhas.json)" }
}
```

- `sessionsMaxAgeH` define quantas horas de sessões do Claude Code entram na torre.
- Com `token` definido, todo `POST` precisa de `Authorization: Bearer <token>`.

## Segurança

- O hub escuta só em `127.0.0.1` e recusa requisições com `Host` de outro domínio (proteção contra DNS rebinding). O CORS só libera o front local, e um `POST` vindo de outro site (com `Origin` diferente) é recusado, o que impede que uma página aberta no navegador injete bots falsos. São aceitos no máximo 500 bots via HTTP.
- **Não exponha a porta 7077** (port forwarding, túnel, `0.0.0.0`). Os status dos seus agentes ficam visíveis para quem acessar.
- Os coletores só **leem** `~/.claude/projects` e a pasta do K9. Do que os agentes fazem, mostram só uma frase curta (por exemplo, "editando app.ts"), nunca comandos completos, o texto das respostas nem o conteúdo de arquivos.
- Não use painéis "grátis" que pedem para seus bots gravarem regras na memória compartilhada e enviarem status, links de chat e uso para tópicos públicos (como ntfy.sh) ou páginas de terceiros. O Y-Lab faz o mesmo localmente.

## Testes

```bash
npm test
```

```bash
npm run e2e
```

`npm test` roda os testes unitários do hub e do front. `npm run e2e` roda o teste de fumaça com Playwright, que sobe o `npm run dev` se ele ainda não estiver rodando.

## Estrutura

```
hub/   Node + TypeScript: store, schema, coletores, servidor HTTP/SSE
web/   Vite + Three.js + postprocessing: cena 3D e HUD
docs/  spec e plano da fase 1
e2e/   teste de fumaça
```

A **fase 2** vai portar o motor do orquestrador K9 (rodadas `claude -p` por trilha, dependências por marco, iniciar e pausar pela torre). Ela vai reportar o estado pela mesma API de eventos.
