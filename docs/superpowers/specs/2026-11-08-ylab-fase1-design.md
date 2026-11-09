# Y-Lab — Fase 1: hub local + torre 3D (design)

Data: 2026-11-08 · Status: aprovado em conversa, aguardando revisão da spec escrita

## 1. Objetivo

O Y-Lab é o laboratório de IA pessoal do usuário: um painel 3D, ao vivo, que mostra todos os agentes (sessões do Claude Code, subagentes, trilhas do orquestrador K9 e qualquer bot que reporte por HTTP) dentro de uma megatorre neon-noir. A Fase 1 entrega **observação**; a Fase 2 (fora deste documento) entrega o **motor** que dispara e controla sessões.

**Sucesso na Fase 1:**
- `npm run dev` sobe hub + front; abrir `http://127.0.0.1:5173` mostra a torre com os agentes reais detectados automaticamente, sem configuração.
- Um `curl` para `127.0.0.1:7077/api/events` faz um bot aparecer/mudar de estado na cena em menos de 2 s.
- 60 fps em desktop com até 60 agentes visíveis; nada sai da máquina (nenhuma requisição para fora de `127.0.0.1`, exceto fontes do Google Fonts no front).

**Fora de escopo (Fase 1):** iniciar/pausar sessões, editar trilhas, autenticação multiusuário, deploy público, mobile além de "não quebrar".

## 2. Princípios

1. **Local primeiro.** O hub escuta só em `127.0.0.1`. Nada de ntfy, webhooks públicos ou páginas de terceiros.
2. **Somente leitura sobre o que já existe.** Os coletores leem arquivos do K9 e do Claude Code; nunca escrevem neles.
3. **Visual original.** Estética cyberpunk neon-noir inspirada no clima de cidade noturna (referência: Nocturne). Nenhum logo, fonte, personagem ou asset de Cyberpunk 2077.
4. **Leve.** Three.js puro + TypeScript, sem React. Geometria procedural, sem modelos externos pesados.

## 3. Arquitetura

```
Y-Lab/
├─ package.json            # workspaces: hub, web; script "dev" sobe os dois
├─ ylab.config.json        # caminhos dos coletores, porta, token opcional
├─ hub/                    # Node 20+, TypeScript, sem framework (node:http)
│  └─ src/
│     ├─ server.ts         # HTTP: /api/events, /api/state, /api/stream (SSE)
│     ├─ store.ts          # estado em memória + persistência em data/state.json
│     ├─ schema.ts         # validação dos eventos (zod)
│     ├─ collectors/
│     │  ├─ claudeSessions.ts  # ~/.claude/projects/*.jsonl + subagents/
│     │  └─ k9Lanes.ts         # trilhas.json + trilhas/*/estado.json
│     └─ describe.ts       # tool_use → frase curta ("editando app.ts")
├─ web/                    # Vite + TypeScript + three + postprocessing
│  └─ src/
│     ├─ main.ts           # bootstrap, conexão SSE, loop
│     ├─ net/stream.ts     # EventSource + reconexão; aplica snapshots/deltas
│     ├─ scene/            # tower.ts, floor.ts, agent.ts, city.ts, rain.ts, post.ts
│     └─ hud/              # topbar, floors, waiting, finished, routines, activity, usage, inspector
└─ data/                   # state.json (gitignored)
```

Unidades e fronteiras:
- **Coletores** produzem `AgentPatch[]` e não sabem nada de HTTP nem de 3D.
- **Store** é a única fonte de verdade; recebe patches (de coletores ou de `/api/events`) e emite deltas.
- **Server** só traduz HTTP ↔ store.
- **Web** só consome `/api/state` + `/api/stream`; a cena e o HUD leem o mesmo modelo no cliente.

## 4. Modelo de dados

```ts
type Status = "working" | "idle" | "waiting_user" | "error" | "done";

interface Agent {
  id: string;            // estável: "claude:<sessionId>", "claude:<sessionId>/<subagentId>", "k9:<trilha>", "bot:<nome>"
  name: string;
  team: string;          // andar
  source: "claude" | "k9" | "http";
  role?: string;         // lider, implementador, revisor, planejador, relator, ajudante
  status: Status;
  step: string;          // ≤ 80 chars
  look: { shape: Shape; color: string; accessory: Accessory };
  parentId?: string;     // subagente → sessão
  link?: string;         // pasta, PR ou chat
  updatedAt: string;     // ISO
  history: { at: string; text: string }[];  // últimas 10 ações
}
type Shape = "sphere"|"rounded_cube"|"pill"|"triangle"|"cone"|"pentagon"|"hexagon"|"star4"|"star6"|"clover"|"rounded_square"|"trio";
type Accessory = "none"|"glasses"|"stem"|"antenna"|"bow";

interface LabState {
  agents: Record<string, Agent>;
  teams: { name: string; color: string; order: number }[];
  routines: { bot: string; name: string; schedule: string; next_run?: string }[];
  usage?: { total_used_pct: number; resets_at?: string; bots: Record<string, number>; at: string };
  activity: { at: string; agentId: string; text: string }[];  // últimas 200
}
```

Regras:
- `look` ausente → derivado de forma determinística do hash do `id` (forma pelo `role` quando houver, cor pela paleta neon).
- `team` ausente → `source === "claude"` usa o nome da pasta do projeto; `k9` usa o nome da trilha; `http` usa `"Ops"`.
- Estado do agente `done` some do andar após 30 min e fica só no painel "Concluídos" (até 20 itens).

## 5. API do hub (porta padrão 7077, só 127.0.0.1)

| Método | Rota | Função |
|---|---|---|
| GET | `/api/state` | snapshot `LabState` completo |
| GET | `/api/stream` | SSE: `event: snapshot` na conexão, depois `event: delta` `{agents?: Record<id, Agent|null>, activity?: [...], usage?, routines?, teams?}` ; `: ping` a cada 15 s |
| POST | `/api/events` | aceita um dos formatos abaixo (compatível com o JSON do vídeo) |
| GET | `/api/health` | `{ok:true, collectors:{name, lastRunAt, error?}[]}` |

Formatos aceitos em `POST /api/events` (corpo JSON, ≤ 64 KB):
- `{"bot","status","step"}` → status
- `{"roster":[nomes]}` → garante agentes `bot:<nome>`
- `{"looks":{nome:{shape,color,accessory}}}`
- `{"groups":{nome:time}}`
- `{"chat":{nome:link}}`
- `{"routines":{"bot","items":[{name,schedule,next_run}]}}`
- `{"type":"usage","total_used_pct","resets_at","bots":{}}`

Segurança:
- Bind fixo em `127.0.0.1`; recusa `Host` diferente de `127.0.0.1:<porta>`/`localhost:<porta>` (proteção contra DNS rebinding).
- CORS só para a origem do front (`http://127.0.0.1:5173` e `http://localhost:5173`).
- Token opcional (`ylab.config.json → token`); quando definido, `POST` exige `Authorization: Bearer <token>`.
- Validação com zod; campos extras descartados; `step` truncado em 80 chars; cor validada `^#[0-9A-Fa-f]{6}$`.
- Erro de validação → `400 {error}`; nunca derruba o processo.

## 6. Coletores

Rodam a cada 3 s, cada um isolado em `try/catch`; falha vira `error` em `/api/health` e não afeta os outros.

**claudeSessions**
- Varre `~/.claude/projects/*/*.jsonl` modificados nas últimas 6 h (configurável).
- Lê só os últimos 250 KB de cada arquivo (mesma técnica do `escritorio_k9`).
- Agente por sessão: `name` = nome da pasta do projeto (último segmento legível) + `#` 4 primeiros chars do id; `team` = projeto.
- Subagentes: `<sessão>/subagents/*.meta.json` + `.jsonl`; `role` por palavras-chave da `description` (mesmas regras de `papel_de`).
- Status: escreveu há < 150 s → `working`; último bloco do assistente sem `tool_use` pendente e há > 150 s → `idle`; resultado de ferramenta com erro como última entrada → `error`; sessão sem escrita há > 30 min → `done`.
- `step` = descrição da última ferramenta (`describe.ts`, portado de `descrever_ferramenta`) ou início do último texto.
- Nunca copia conteúdo de arquivos, comandos completos ou segredos: só a frase curta de `describe.ts`.

**k9Lanes**
- Caminho do orquestrador vem de `ylab.config.json → k9.path` (padrão: a pasta do orquestrador K9 atual).
- Um agente `k9:<trilha>` por trilha; mapeamento: `trabalhando`→`working`, `em_andamento`/`aguardando`→`idle`, `bloqueada`→`waiting_user`, `concluida`→`done`. `step` = `nota`; `link` = primeiro PR.
- As sessões Claude cujo projeto corresponde à `pasta` da trilha ficam no andar da trilha.

## 7. Cena 3D

- **Torre:** um andar por time, empilhados (ordem: alfabética, `Ops` no térreo). Laje escura, bordas com neon na cor do time, vidro com reflexo, letreiro holográfico "Y-LAB" no topo, painel lateral com o nome do andar.
- **Cidade:** prédios procedurais em silhueta ao redor com janelas emissivas, neblina exponencial, chuva por partículas (instanciada), céu gradiente magenta→azul profundo.
- **Agentes:** avatar holográfico (forma do `look`, material emissivo + fresnel, olhos), em estações (mesa + monitor holográfico). Animações por status:
  - `working`: flutua e pulsa; monitor com linhas rolando.
  - `waiting_user`: farol amarelo girando acima e rótulo; aparece no painel "Esperando por mim".
  - `error`: glitch (deslocamento RGB) vermelho.
  - `idle`: escurece e vai para o lounge do andar.
  - `done`: brilho verde breve, depois some.
- **Pós:** bloom, aberração cromática leve, scanlines + vinheta, ruído de filme. Toggle "modo leve" desliga pós e chuva.
- **Câmera:** isométrica ortográfica com OrbitControls limitados; clicar num andar faz zoom nele (corte da torre); clicar num agente abre o inspetor; `+`/`−` de zoom.
- **Desempenho:** geometrias e materiais compartilhados, `InstancedMesh` para mesas, cadeiras, chuva e janelas; cap de pixel ratio em 2.

## 8. HUD

Painéis em vidro escuro com borda neon e tipografia condensada mono (Google Fonts: "Rajdhani" + "JetBrains Mono"):
- **Topo:** marca Y-Lab, indicador "Live" + hora, contadores working / waiting / errors / idle.
- **Esquerda:** Andares (lista, clique foca), Esperando por mim, Concluídos, Rotinas.
- **Direita:** cartão do andar focado (contagem + lista de agentes com `step`) ou inspetor do agente (status, tempo no estado, últimas ações, link).
- **Rodapé:** Atividade (últimas 6 entradas), medidor de uso (`usage`) quando houver.
- Reconexão: se o SSE cair, faixa "SINAL PERDIDO — reconectando" com glitch; ao voltar, recarrega o snapshot.

## 9. Tratamento de erros

- JSONL corrompido/linha parcial → linha ignorada.
- Pasta inexistente (K9 ausente) → coletor reporta `error` no health e a cena segue com o que tiver.
- `data/state.json` ilegível → começa vazio e renomeia o arquivo para `state.corrupt-<ts>.json`.
- WebGL indisponível → HUD funciona sozinho com mensagem no lugar da cena.

## 10. Testes

- **Hub (vitest):** schema (formatos válidos/ inválidos), store (patches → deltas, expiração de `done`), `describe.ts`, coletores com fixtures de JSONL e `estado.json` em pasta temporária, server (Host inválido → 403, token, 400 em JSON ruim, SSE envia snapshot).
- **Web (vitest):** reducer de snapshot/delta do cliente, derivação de `look`.
- **Fumaça (Playwright):** sobe tudo, posta um evento por `curl`, verifica o agente no HUD e ausência de erros no console; screenshot da cena.

## 11. Fase 2 (registro, não implementar agora)

Porta do `orquestrar.py` para o hub: trilhas com dependências por marco, rodadas `claude -p` com limites de paralelismo e tempo, botões iniciar/pausar por andar, e o protocolo do líder como template. A API de eventos da Fase 1 já é o canal pelo qual essas rodadas reportarão estado.
