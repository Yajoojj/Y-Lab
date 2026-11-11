# Dinâmica dos agentes — plano de remodelagem

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a torre mostrar um time trabalhando junto: o papel de cada agente, o que ele está fazendo agora, e o fio do trabalho entre líder e subagentes.

**Architecture:** O hub continua a única fonte de verdade e só lê Claude Code e K9. Ele passa a publicar relações curtas derivadas de `parentId` e do último passo. A cena agrupa os filhos em volta do líder e desenha o fio com um único lote de instâncias, atualizado quando a relação muda, não a cada quadro. O HUD nomeia o papel com um rótulo fixo.

**Tech Stack:** Node 20, TypeScript, hub sem framework, Vite, Three.js, testes Vitest. Sem dependência nova.

## Global Constraints

- Hub escuta só em `127.0.0.1`. Coletores só leem `~/.claude/projects` e a pasta do K9. Não escrevem nesses arquivos.
- `step` continua cortado em 80 caracteres. A relação não carrega comando, caminho completo, prompt nem segredo.
- Papéis canônicos, e só estes: `lider`, `implementador`, `revisor`, `planejador`, `relator`, `ajudante`.
- Contratos públicos de `Tower` e `AgentView` permanecem. Tipos novos entram em `hub/src/types.ts` e descem pelo SSE que já existe.
- Orçamento com 60 agentes e 8 andares: no máximo 2 draw calls a mais (fio + placa de papel), no máximo 48 fios visíveis, no máximo 12 pacotes em trânsito. Agente fora do corte continua parado. Nada de `new Vector3` dentro de `tick`.
- Identidade visual continua Y-LAB. Sem logo, fonte ou asset de marca de jogo.

---

## Diagnóstico

Hoje o dado de equipe já existe e a cena o ignora.

- A sessão Claude vira `role: "lider"`. Cada subagente recebe `parentId` da sessão e um papel vindo de `roleOf` em `hub/src/describe.ts`.
- A trilha K9 também é `lider` do andar dela. Os agentes Claude do mesmo projeto sentam nesse andar, sem vínculo com a trilha.
- `web/src/scene/index.ts` coloca todo mundo no próximo assento livre. `parentId` só muda a escala (`0.95` se tiver pai, `1.4` se for líder) em `web/src/scene/agent.ts`.
- `describeTool` já traduz `Task`/`Agent` para `delegou: …` e `SendMessage` para `conversando com um colega`, mas isso vira uma frase no histórico. Não nasce uma aresta.
- `roleOf` só reconhece revisão, plano, implementação e relatório. "Dev Back-end", "Engenheiro de Dados" e "Revisor de Segurança" caem em `ajudante` ou ficam só no nome longo. No HUD o papel é um subtítulo de 11 px.
- O andar com dez agentes parece uma multidão fazendo a mesma coisa. O passo curto ("rodando os testes", "lendo app.ts") não diz para quem aquele trabalho serve.

Eficiência aqui é as duas coisas ao mesmo tempo: menos assentos ocupados à toa, porque o filho não consome uma mesa inteira, e menos leitura para descobrir quem entrega o quê.

## Decisões

1. **A relação é derivada, não digitada.** O store monta a lista a partir de `parentId` e do passo. HTTP não ganha um evento solto de "ligar A em B". Isso evita teia falsa e mantém o schema pequeno.
2. **Três fios, com vida curta.** `delega` (pai trabalhando e filho existe), `devolve` (filho passou a `done` nos últimos 20 s e o pai segue), `consulta` (passo do pai é "conversando com um colega" e há exatamente um filho `working`). Fora isso, não há linha. Conversa sem destinatário certo não vira fio.
3. **O papel é uma placa, não uma cor.** Seis glifos compartilhados. A cor continua sendo a do `look` e a do status. Dá para distinguir o papel em miniatura sem depender de cor.
4. **O agrupamento é a dinâmica.** Filho trabalhando ou em erro fica num anel em volta da mesa do pai, olhando para o pai. Filho ocioso vai para o lounge, como hoje. Líder sem filhos continua na mesa.
5. **O texto longo fica no HUD.** A cena mostra papel + um verbo. A frase de 80 caracteres aparece no hover, na linha do andar e no cartão. Não há balão de chat no mundo.
6. **Andar K9 e sessão Claude do mesmo projeto formam um grupo.** A trilha `k9:<nome>` é o líder do andar quando existir. Sessões cujo `team` é essa trilha apontam `parentId` para ela só se ainda não tiverem pai. Subagentes continuam filhos da sessão, não da trilha. Dois níveis, nunca mais.

## Arquivos

- Modificar: `hub/src/describe.ts` — papéis canônicos e rótulo curto.
- Modificar: `hub/src/types.ts` — `Relation` no estado e no delta.
- Modificar: `hub/src/store.ts` — derivar e expirar relações quando agentes mudam.
- Modificar: `hub/src/collectors/claudeSessions.ts` — nome curto separado da descrição; pai K9.
- Modificar: `hub/src/collectors/k9Lanes.ts` — nenhuma API nova; o id `k9:<nome>` já é o líder.
- Modificar: `web/src/model.ts` — guardar `relations` e avisar a cena.
- Modificar: `web/src/scene/index.ts` — cluster em volta do pai.
- Modificar: `web/src/scene/relations.ts` — **criar**. Lote do fio e dos pacotes.
- Modificar: `web/src/scene/agent.ts` — placa de papel; API pública intacta.
- Modificar: `web/src/hud/left.ts`, `web/src/hud/right.ts`, `web/src/hud/dom.ts` — rótulo de papel e "entrega para".
- Testar: `hub/test/describe.test.ts`, `hub/test/store.test.ts`, `web/test/model.test.ts`.

---

### Task 1: Papel canônico e rótulo

**Files:**
- Modify: `hub/src/describe.ts`
- Test: `hub/test/describe.test.ts`

**Interfaces:**
- Consumes: a string de descrição do `.meta.json` do subagente.
- Produces: `roleOf(description: string): Role` e `roleLabel(role: string): string`. `Role` é a união dos seis papéis. Rótulos: Líder, Implementador, Revisor, Planejador, Relator, Ajudante. Papel desconhecido vira Ajudante.

- [ ] **Step 1: Escrever o teste que falha.** Casos novos: "Revisor de Segurança e LGPD" → `revisor`; "Dev Back-end" e "implement the handler" → `implementador`; "Engenheiro de Dados" → `implementador`; "planejar a etapa" → `planejador`; "relatório final" → `relator`; "Explore the repo" → `ajudante`. Ordem das regras: revisor antes de implementador, para "re-review the implementation" continuar `revisor`.
- [ ] **Step 2: Rodar** `npm -w hub test -- test/describe.test.ts` **e ver a falha.**
- [ ] **Step 3: Alargar `roleOf` só com essas famílias de palavra, em português e inglês.** Não classificar pelo nome do arquivo nem pelo passo.
- [ ] **Step 4: Teste verde.**

**Acceptance:** um subagente de revisão de segurança não aparece mais como ajudante. O rótulo cabe numa placa de uma palavra.

### Task 2: Nome curto, descrição no passo

**Files:**
- Modify: `hub/src/collectors/claudeSessions.ts`
- Test: `hub/test/claudeSessions.test.ts` (estender o helper de projeto falso que já existe)

**Interfaces:**
- Consumes: `roleOf`.
- Produces: o mesmo `AgentPatch`. `name` passa a ser `Papel · #id` com no máximo 40 caracteres (exemplo: `Revisor · #4cef`). A descrição crua, cortada em 80, só entra em `step` quando o jsonl ainda não tem um passo de ferramenta.

- [ ] **Step 1: Teste com um `.meta.json` cuja description é "Dev Back-end · Squad Dados · A1 Task 5".** O nome do patch não contém "Squad" nem "Task". O `role` é `implementador`. O `parentId` continua `claude:<sid>`.
- [ ] **Step 2: Implementar o corte.** Se já houver `step` vindo da ferramenta, ele ganha do texto da description.
- [ ] **Step 3: Teste verde.** Confirmar no HUD, com o dev server já de pé, que a lista do andar cabe sem reticências no meio do papel.

**Acceptance:** a coluna da esquerda distingue "Revisor" de "Implementador" sem ler a frase inteira da tarefa.

### Task 3: Trilha K9 como líder do andar

**Files:**
- Modify: `hub/src/collectors/claudeSessions.ts`
- Modify: `hub/src/main.ts` (o `teamFor` já existe; passar também o id do líder)
- Test: `hub/test/claudeSessions.test.ts`, `hub/test/k9Lanes.test.ts`

**Interfaces:**
- Consumes: `teamFor(dir) => string | undefined` já devolvido por `collectK9Lanes`.
- Produces: `leaderFor(team: string): string | undefined`, com id `k9:<nome da trilha>`. Sessão cujo `team` bate com uma trilha e que não tem `parentId` recebe `parentId: leaderFor(team)`. Subagente não é reparentado: o pai dele continua a sessão.

- [ ] **Step 1: Teste.** Uma sessão no diretório mapeado para a trilha "analytics" sai com `parentId: "k9:analytics"`. O subagente dessa sessão continua com `parentId` da sessão.
- [ ] **Step 2: Implementar sem ler `estado.json` de novo.** `collectK9Lanes` já conhece o nome. Encadear no `main.ts`, onde os dois coletores já se encontram.
- [ ] **Step 3: Testes do hub verdes:** `npm -w hub test`.

**Acceptance:** no andar de uma trilha há um líder K9 e as sessões daquele projeto são filhas dele. Sessão de projeto sem trilha continua líder de si mesma.

### Task 4: Relações derivadas no store

**Files:**
- Modify: `hub/src/types.ts`
- Modify: `hub/src/store.ts`
- Test: `hub/test/store.test.ts`

**Interfaces:**
- Consumes: `Agent.parentId`, `Agent.status`, `Agent.step`, `Agent.updatedAt`.
- Produces:

```ts
interface Relation {
  id: string;            // "<kind>:<from>:<to>"
  kind: "delega" | "devolve" | "consulta";
  from: string;          // agent id
  to: string;
  until: string;         // ISO, no máximo now+20s
}
```

`LabState.relations: Relation[]` e `Delta.relations?: Relation[]`. O store recalcula no mesmo ponto em que já emite delta de agentes. Manda a lista inteira só quando o conjunto de ids mudou. Teto de 48 relações; a sobra descartada é a mais antiga.

Regras, todas exigindo que `to` exista e esteja no mesmo `team`:

- `delega`: pai com status `working` e filho com status `working` ou `waiting_user`.
- `devolve`: filho `done` com `updatedAt` nos últimos 20 s e pai diferente de `done`.
- `consulta`: no máximo uma, se o `step` do pai começa com "conversando" e há exatamente um filho `working`.

- [ ] **Step 1: Testes de store para as três regras, para pai e filho em andares diferentes (não cria fio) e para o teto de 48.**
- [ ] **Step 2: Implementar a derivação pura num função `deriveRelations(agents, now): Relation[]` testável sem HTTP.**
- [ ] **Step 3: Incluir `relations` no snapshot e no delta. Não persistir em `data/state.json` além do que o store já grava dos agentes; a lista se reconstrói na carga.**
- [ ] **Step 4: `npm -w hub test` verde.**

**Acceptance:** criar um subagente `working` sob um líder `working` faz o próximo snapshot conter uma relação `delega`. Não existe rota nova.

### Task 5: Modelo do cliente

**Files:**
- Modify: `web/src/model.ts`
- Test: `web/test/model.test.ts`

**Interfaces:**
- Consumes: `Delta.relations` e o snapshot.
- Produces: `model.state.relations`. `Change` ganha `"relations"`. `applySnapshot` e `applyDelta` substituem a lista inteira quando o campo vem.

- [ ] **Step 1: Teste.** Um delta `{ relations: [...] }` notifica `"relations"` e não mexe em agentes. Delta sem o campo mantém a lista anterior.
- [ ] **Step 2: Implementar.**
- [ ] **Step 3: `npm -w web test` verde.**

### Task 6: Cluster em volta do líder

**Files:**
- Modify: `web/src/scene/index.ts`

**Interfaces:**
- Consumes: `tower.slots(team)`, `Agent.parentId`, `Agent.status`.
- Produces: a mesma chamada `view.update(agent, target)`. Nada na API de `Tower` ou `AgentView`.

Posição:

- Líderes e agentes sem pai: mesa, como hoje. Ocioso vai ao lounge.
- Filho não ocioso: anel de raio 1.35 em volta da mesa do pai, até 6 lugares. O sétimo filho empilha 1.4 para cima, como o overflow atual. O alvo olha para o pai só na orientação: `object.lookAt` no plano, sem inclinar. Guardar o yaw num campo que `tick` não sobrescreva enquanto o status não for `idle`.
- Filho ocioso: lounge, como hoje.
- Pai invisível por causa do corte: o filho também fica `hidden`, mesmo que o andar do filho fosse visível. Os dois estão no mesmo andar, então isso já coincide com `tower.isVisible`.

- [ ] **Step 1: Extrair a escolha do alvo para uma função pura `targetFor(agent, parent, slots, index)` no próprio arquivo, e testar os seis ângulos com um teste de node em `web/test/placement.test.ts`.** Sem subir o WebGL.
- [ ] **Step 2: Trocar o laço de `place()` para agrupar por pai antes de numerar mesas.** Líder ocupa uma mesa; filhos não avançam o contador de mesas.
- [ ] **Step 3: Subir o dev server e focar um andar com líder e dois filhos.** Os dois ficam ao lado do líder, não em mesas distantes. `Esc` volta à vista geral. `T` continua mostrando andares parados.

**Acceptance:** um andar com 1 líder e 4 filhos usa 1 mesa, não 5. O lounge segue só para ocioso.

### Task 7: Placa de papel no synth

**Files:**
- Modify: `web/src/scene/agent.ts`

**Interfaces:**
- Consumes: `Agent.role`, `roleLabel` copiado para um mapa constante no front (o front não importa o hub em runtime além dos types; duplicar o mapa de 6 strings num `web/src/roles.ts` e testar que as chaves batem com o teste do hub).
- Produces: nenhum método novo em `AgentView`. A placa é filha de `object` e entra no descarte que `dispose` já faz do material próprio.

A placa é um plano pequeno, geometria compartilhada, textura de um atlas gerado uma vez com as seis palavras. `MeshBasicMaterial` com `toneMapped: false` só no recorte da palavra. Trocar de papel muda o `uv`, não a geometria. Líder usa a palavra "Líder" além da coroa que já existe.

- [ ] **Step 1: Teste do mapa.** As seis chaves de `web/src/roles.ts` são exatamente as de `roleOf`.
- [ ] **Step 2: Montar o atlas e o mesh.** Agente `hidden` não atualiza uv.
- [ ] **Step 3: Na vista do andar focado, cada synth mostra uma palavra legível a zoom 2.1.** Papel desconhecido mostra "Ajudante".

**Acceptance:** dá para separar revisor de implementador olhando só a torre, com a cor do núcleo ainda sendo a do status.

### Task 8: Fio e pacote

**Files:**
- Create: `web/src/scene/relations.ts`
- Modify: `web/src/scene/index.ts`

**Interfaces:**
- Consumes: `model.state.relations`, a posição mundial já escrita por `AgentView`.
- Produces: `createRelations(scene): { sync(relations, views): void; tick(dt: number): void; dispose(): void }`.

Desenho:

- Um `InstancedMesh` de caixa fina (o fio) com no máximo 48 instâncias. Matriz escrita em `sync`, quando a lista muda. Instância sem uso fica com escala zero, o mesmo truque de `ZERO` que o anel do synth já usa.
- Um pacote (octaedro pequeno, outro lote, teto 12) só nasce para relação com `until - now < 4 s` no momento em que ela aparece. `tick` interpola de `from` para `to` e depois esconde. Sem alocar vetor: três `Vector3` de módulo.
- Os dois extremos invisíveis (`view.hidden` ou sem view) não desenham fio.
- Cor do fio: osso a 30% para `delega`, âmbar para `consulta`, osso pleno num flash para `devolve`. Não usar o vermelho da torre para isso.

- [ ] **Step 1: Teste puro de "quais relações viram instância".** Relação com ponta oculta sai da lista. A 49ª é ignorada porque o store já cortou em 48; o cliente também corta.
- [ ] **Step 2: Ligar `sync` no listener de `"relations"` e `tick` no `onFrame`, depois de `flushSynthBatches`, para ler matriz mundial atual.**
- [ ] **Step 3: Com dois agentes de teste via `POST /api/events` local, marcar pai e filho não é possível pelo schema atual.** Usar o coletor, ou um teste de cena que injeta `LabState` no `ClientModel`. Não abrir endpoint novo. Verificar no andar focado que o fio liga o líder ao filho e some quando o filho passa a `idle` sem ser `done` recente.
- [ ] **Step 4: Modo leve não desliga o fio.** Ele é barato. O pós continua podendo desligar.

**Acceptance:** delegar desenha um segmento entre os dois synths. Não há linha entre andares. O contador de draw calls sobe no máximo 2.

### Task 9: HUD diz quem entrega para quem

**Files:**
- Modify: `web/src/hud/dom.ts`
- Modify: `web/src/hud/left.ts`
- Modify: `web/src/hud/right.ts`
- Modify: `web/src/hud/hud.css` só se o crachá precisar de uma classe

**Interfaces:**
- Consumes: `roleLabel`, `model.state.relations`, `Agent.step`.
- Produces: nenhuma API. Na linha do agente, o subtítulo fica `Líder · rodando os testes`. No cartão, uma linha "Entrega para" lista no máximo 3 nomes ligados por `delega` saindo daquele id. Hover da cena, que já mostra `nome · step`, passa a `nome · papel · step`.

- [ ] **Step 1: Teste de uma função pura `subtitle(agent): string` em `web/test/model.test.ts` ou ao lado, sem DOM.**
- [ ] **Step 2: Usar essa função na linha, no cartão e no hover.**
- [ ] **Step 3: No browser, selecionar um líder com filho trabalhando.** O cartão mostra o papel e o nome do filho em "Entrega para". `Esc` limpa a seleção como hoje.

**Acceptance:** sem abrir a cena, a lista da esquerda responde "que papel é" e "o que está fazendo" em uma linha.

---

## Checkpoint

- [ ] `npm test` verde no hub e no web.
- [ ] `npx tsc --noEmit` em `web/` e `hub/`.
- [ ] Andar focado com líder K9, uma sessão e um subagente: três placas diferentes, filhos no anel, um fio `delega` só enquanto os dois trabalham.
- [ ] Andar com 8 agentes sem parentesco continua em mesas separadas, sem fios.
- [ ] Aba oculta não renderiza. Agente de andar cortado não anima.
- [ ] Nenhum texto de relação repete comando, caminho absoluto ou conteúdo de arquivo.

## Fora deste plano

- Disparar, pausar ou falar com um agente pela torre. Isso é a fase 2 do motor.
- Balão com o histórico, trilha de arquivos compartilhados e fio entre andares. O histórico de 10 itens já está no cartão; cruzar arquivo lido com arquivo editado por outro agente exige ler mais do jsonl do que o coletor lê hoje.
- Mais do que seis papéis. Um sétimo papel só entra quando `roleOf` tiver um teste e uma palavra na placa.
- Qualquer painel fora da máquina.

## Ordem

1 → 2 → 3 podem parar e já melhoram a lista. 4 → 5 destrava a cena. 6 é a dinâmica mesmo sem fio. 7 é o papel legível na torre. 8 e 9 fecham o fio e o texto. Não começar o fio antes do cluster: linha entre mesas distantes parece organograma, não um time na mesma bancada.
