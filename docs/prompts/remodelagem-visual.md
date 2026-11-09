# Prompt: remodelagem visual completa do Y-Lab

> Cole este prompt inteiro numa sessão nova, aberta na pasta `D:\Programação\Y-Lab`.

---

## Papel

Você é diretor de arte e engenheiro gráfico sênior de Three.js. Seu trabalho é **remodelar 100% a cena 3D do Y-Lab**: o prédio, a cidade e os agentes (hoje drones e robôs). O resultado precisa parecer um produto profissional, ter identidade própria e ser **confortável de olhar por horas**, porque é um painel que fica aberto o dia todo.

Hoje a cena tem cara de protótipo:
- **Prédio:** caixas empilhadas e linhas neon.
- **Agentes:** primitivas soltas (cones, estrelas, cápsulas) sem uma linguagem visual comum.
- **Cidade:** blocos com janelas de shader.
- **Conforto:** contraste duro, ruído e scanlines cansam a vista.

Jogue isso fora e redesenhe. Os **contratos** listados abaixo continuam valendo.

## Antes de começar

1. Leia `README.md`, `docs/superpowers/specs/2026-11-08-ylab-fase1-design.md` e todo o `web/src/scene/` para entender os contratos.
2. Rode `npm install` e `npm run dev`, abra `http://127.0.0.1:5173` e tire screenshots do estado atual. Você vai comparar o antes e o depois.
3. Use as skills disponíveis de Three.js e design: `threejs-webgl`, `frontend-design` e `superpowers:brainstorming` para a fase de conceito.

## Direção de arte: "Y-LAB SPIRE"

Uma torre de pesquisa corporativa numa megacidade noturna. O clima é de **luxo frio e tecnológico**, não de neon de fliperama. Pense em arquitetura brutalista-futurista, materiais nobres, luz controlada, e no vermelho como cor de assinatura usada com parcimônia.

**Paleta (obrigatória, já está no projeto):**

| Uso | Cor |
|---|---|
| Fundo e preto profundo | `#060507` |
| Vermelho de assinatura | `#FF1F33` |
| Carmesim | `#C3001B` |
| Branco osso (luz neutra, superfícies claras) | `#EDE6DC` |
| Aço | `#9AA0AB` |
| Âmbar ("esperando você") | `#FFB547` |
| Azul-gelo (erro / intrusão) | `#4DE8FF` |

Regras de uso:
- O vermelho cobre **no máximo ~10% da tela**.
- A luz dominante é o branco osso quente sobre materiais escuros.
- O vermelho marca hierarquia: a assinatura da torre, os agentes ativos e os alertas.

**Princípios de conforto visual:**
- Contraste alto só onde há informação (agentes, alertas). O fundo fica calmo, com valores médios e baixos.
- Nada pisca mais rápido que ~1 Hz, exceto o estado de erro, e só em pulsos curtos.
- Ruído de filme e scanlines ficam quase imperceptíveis (opacidade ≤ 0.03) ou são removidos. Aberração cromática só nas bordas e bem sutil.
- Bloom seletivo: só materiais emissivos marcados brilham. Nada de bloom global estourando o vidro.
- Respeite `prefers-reduced-motion`: chuva mais lenta, câmera sem animação, agentes sem bob.
- Profundidade em camadas legíveis: plano da frente (praça), meio (torre), fundo (skyline). Cada camada com valor e saturação próprios, na lógica da perspectiva atmosférica.

## 1. O prédio (Y-LAB SPIRE)

Desenhe uma torre com **silhueta única e reconhecível**, não um paralelepípedo:

- **Estrutura:**
  - Núcleo de concreto escuro e polido.
  - **Exoesqueleto** de aço com diagonais (diagrid) que se afinam para o topo.
  - Lajes que se projetam em balanço alternado, criando ritmo.
  - Coroa em degraus.
- **Fachada:**
  - Vidro fumê com reflexo do céu e da cidade: use PMREM gerado de um ambiente procedural próprio, não um HDRI baixado.
  - Montantes finos.
  - Faixas de luz embutidas só nas bordas das lajes, em branco osso. O vermelho fica na assinatura.
- **Andares (cada um é um time):**
  - Precisam continuar legíveis como "bandejas de trabalho". Quando um andar está em foco, a fachada daquele nível fica translúcida ou abre em corte, revelando o interior.
  - Interior com estações de trabalho reais: mesa com tampo claro, base metálica, monitor com tela emissiva suave, cadeira.
  - Um lounge com sofá e luminária de piso.
  - Divisórias de vidro, iluminação de teto em linhas e piso com reflexo sutil.
  - A placa do andar fica numa parede de destaque, com tipografia limpa (número grande + nome do time).
- **Térreo e entorno:**
  - Praça de entrada com escadaria larga, marquise em balanço e totem com o nome "Y-LAB".
  - Espelho d'água ou piso molhado refletindo a torre.
  - Árvores ou jardineiras com iluminação de baixo para cima.
- **Coroa:**
  - Assinatura "Y-LAB" em letreiro vertical ou em lâmina de luz.
  - Antena ou mastro com luz de aviação vermelha pulsando devagar (~0.5 Hz).
  - Holofotes varrendo o céu bem devagar.
- **Escala:** a torre cresce e encolhe com o número de andares visíveis (só os times ativos aparecem; a tecla `T` mostra todos). A coroa e o embasamento se adaptam sem quebrar a composição.

## 2. A ambientação (megacidade noturna)

- **Skyline em 3 camadas de profundidade:**
  - Torres próximas com detalhe (recuos, antenas, letreiros).
  - Médias simplificadas.
  - Fundo em silhueta com janelas pontuais e neblina vertical.
- **Movimento ambiente discreto:**
  - Tráfego aéreo: luzes de veículos em rotas curvas, instanciadas.
  - Elevados com rastros de faróis vermelhos e brancos.
  - Vapor saindo de dutos (partículas leves).
  - Vez ou outra um holofote varrendo.
- **Letreiros holográficos:** só com glifos abstratos, ideogramas inventados ou a marca Y-LAB. **Proibido** usar nomes de marcas reais ou de ficção.
- **Atmosfera:**
  - Neblina com gradiente de altura.
  - Céu com nuvens baixas iluminadas de baixo pela cidade, num tom quente.
  - Chuva fina integrada ao clima real que já existe (`weather.ts`: intensidade, dia/noite, nuvens).
  - Volumes de luz falsos (cones aditivos) sob os postes e os holofotes.
- **Chão:** asfalto e pedra molhados, com reflexo das luzes. Use um refletor planar barato ou um truque de roughness com environment map.
- **Dia e noite:** use o `dayFactor` do clima. De dia o céu fica cinza-azulado de cidade densa e as luzes perdem força. A identidade continua noturna, então o "dia" é mais um entardecer nublado do que um dia claro.

## 3. Os agentes ("SYNTHS"): design único e coeso

Substitua as primitivas aleatórias por **uma família de personagens com a mesma linguagem visual**. São pequenas unidades sintéticas flutuantes, elegantes e amigáveis, com cara de produto premium. Não devem parecer brinquedo nem robô genérico.

- **Anatomia base:**
  - **Núcleo:** esfera de luz interna.
  - **Casco:** carapaça de 2–3 placas que deixam frestas, por onde a luz do núcleo vaza.
  - **Visor:** faixa horizontal, onde ficam os "olhos" como um traço de luz que pisca devagar.
  - **Anel de levitação:** halo fino embaixo, projetando uma sombra suave no chão.
- **Variação pelos dados existentes** (o contrato `look.shape` / `look.accessory` continua). Mapeie os 12 valores de `Shape` para **12 variações de casco** dentro da mesma família: arredondado, facetado, alongado, triplo, em pétalas etc. Os mapeamentos de acessório:
  - `antenna` → mastro de sensor;
  - `glasses` → visor duplo;
  - `stem` → braço de ferramenta;
  - `bow` → aletas laterais;
  - `none` → casco limpo.
- **Cor:** `look.color` tinge a luz do núcleo e um detalhe do casco. O casco em si é sempre material nobre (cerâmica clara, osso, ou grafite acetinado), para a cena não virar carnaval.
- **Hierarquia:** líder (`role: "lider"`) é ~20% maior e tem uma coroa de luz no halo. Subagentes são menores e orbitam ou ficam ao lado do líder (`parentId`).
- **Estados** (comunicados por luz e movimento, nunca só por cor):
  - `working`: núcleo pulsa devagar e o casco se abre um pouco. Fica de frente para o monitor, com partículas de "dados" subindo da mesa.
  - `waiting_user`: anel âmbar girando e o visor voltado para a câmera, com um ícone holográfico de interrogação discreto acima.
  - `error`: casco fecha, núcleo azul-gelo com glitch curto a cada ~2 s e faísca no anel.
  - `idle`: núcleo fraco, pousado no lounge, flutuando bem pouco.
  - `done`: brilho osso, sobe e dissolve em partículas.
- **Transições** suaves entre estados (0.3–0.6 s), com posição animada (lerp) entre mesa e lounge.
- **Originalidade:** não copie personagens de jogos, filmes ou marcas existentes. A família SYNTH é do Y-Lab.

## 4. Câmera, luz e pós-processamento

- Câmera ortográfica isométrica como hoje (ou perspectiva com FOV baixo, ~20°, se ficar claramente melhor; justifique). Foco por andar com transição suave e enquadramento que mostre o interior inteiro.
- **Luz:**
  - Uma luz-chave fria (lua/cidade) e um preenchimento quente vindo de baixo (a cidade).
  - Luz de borda vermelha bem baixa.
  - Interiores iluminados por luzes "falsas" (emissivos + environment), sem dezenas de PointLights.
- **Sombras:** use uma sombra direcional só no andar em foco, ou AO baked e procedural nas lajes. Sombras em tempo real na cidade inteira estão proibidas.
- **Pós:**
  - Bloom seletivo (camada ou `SelectiveBloomEffect`).
  - Tone mapping AgX ou ACES com exposição calibrada.
  - Color grading suave (LUT gerada no código, sombras levemente frias e altas quentes).
  - Vinheta leve.
  - SMAA.
  - O modo leve desliga tudo menos o tone mapping.

## 5. Contratos que NÃO podem quebrar

Os testes e o HUD dependem disto:
- **`Tower`:** mantenha a API pública: `sync(teams)`, `height()`, `floorY(team)`, `slots(team) → { desk, lounge }`, `floorMeshes()`, `teamOf(obj)`, `setCut(team?)`, `isVisible(team)`, `tick(t)`, `root`.
- **`AgentView`:** mantenha `constructor(agent)`, `object`, `pickTarget`, `id`, `hidden`, `update(agent, target)`, `tick(dt, t)`, `dispose()`.
- **`createLabScene(canvas, model, light)`** continua retornando `{ stage, tower, views, setLight, isLight }`. O picking (`picking.ts`), o foco por andar, o `Esc`, a tecla `T` e o modo leve continuam funcionando.
- **Tipos:** não mude `hub/` nem os tipos em `hub/src/types.ts`. A cena é só consumidora.
- **Clima:** `weather.ts` continua sendo a fonte de clima e mantém a localização arredondada para 1 casa decimal.

## 6. Restrições

- **Nada de** nome, logo, fonte ou asset de Cyberpunk 2077, CD Projekt, Arasaka ou outra marca. A identidade é **Y-LAB**.
- **Geometria procedural no código** é o caminho preferido. Se usar modelos `.glb`, eles devem ser criados por você (no código ou exportados de um script no repo), nunca baixados de fonte desconhecida. Coloque-os em `web/public/models/` com nota de origem.
- **Fontes locais** (sem Google Fonts nova). Se precisar de fonte, use uma de licença aberta (OFL) copiada para `web/public/fonts/`, com a licença junto.
- **Sem dependências pesadas novas.** Pode usar o que já está (`three`, `postprocessing`) e os addons de `three/examples/jsm`.
- **Commits** em português, no imperativo, **sem nenhuma menção a Claude/IA** (nada de `Co-Authored-By`, nada de "Generated with"), e sem branch com prefixo `claude/`.

## 7. Orçamento de desempenho (obrigatório medir)

- **Tempo de quadro:**
  - 1440×900, GPU média, efeitos ligados: **≤ 8 ms por quadro** com 60 agentes e 8 andares.
  - **Modo leve: ≤ 4 ms.**
- **Draw calls e triângulos:** ≤ 250 draw calls e ≤ 1,5 M triângulos na visão geral. Use `InstancedMesh` em tudo que repete: mesas, cadeiras, janelas, carros, prédios, partículas.
- **Memória:** geometrias e materiais compartilhados em cache. Todo `dispose()` libera o que criou (corrija o vazamento atual das geometrias de acessório). Zero alocação por quadro dentro de `tick` (nada de `new Vector3`/`new Color` no loop).
- **Pixel ratio:** limitado a 2. Pause a animação pesada quando a aba estiver oculta.
- **Como medir:** chame `lab.stage.render()` 60 vezes e use `gl.finish()`, mais `renderer.info.render.calls`/`triangles`. O handle de dev é `window.__ylab`.

## 8. Processo (siga em ordem)

1. **Conceito:**
   - Proponha **3 direções** curtas para a torre e para os SYNTHS. Para cada uma: um parágrafo, a paleta aplicada e um protótipo rápido na cena, com screenshot.
   - Recomende uma e **pare para o usuário escolher** antes de construir.
2. **Plano:** escreva um plano de implementação em `docs/superpowers/plans/` com arquivos, contratos e critérios de cada etapa.
3. **Construção por camadas, com screenshot e medição de desempenho ao fim de cada uma:**
   1. Iluminação, environment e pós.
   2. Torre: estrutura, fachada e coroa.
   3. Interiores dos andares.
   4. SYNTHS (casco, estados, transições).
   5. Cidade e atmosfera.
   6. Movimento ambiente.
4. **Polimento de conforto:**
   - Revise contraste, flicker e legibilidade dos agentes a 1× e a 2× de zoom.
   - Teste com `prefers-reduced-motion`.
   - Teste no modo leve e em 1280×720.
5. **Verificação final:**
   - `npm test` verde, `npx tsc --noEmit` no `web/` e no `hub/`, e `npm run e2e` verde.
   - Console sem erros.
   - Screenshots de antes e depois: visão geral, andar em foco, agente selecionado, chuva e "dia".

## 9. Critérios de aceite

- [ ] A torre tem silhueta reconhecível mesmo em miniatura (teste: thumbnail de 200 px ainda "lê" como Y-LAB SPIRE).
- [ ] Os SYNTHS formam uma família coesa: os 12 cascos e 5 acessórios funcionam, e os 5 estados são distinguíveis **sem depender só de cor**.
- [ ] O andar em foco mostra o interior com clareza: mesas, lounge, placa, agentes.
- [ ] A cena é confortável: sem flicker rápido, vermelho usado com parcimônia, fundo calmo.
- [ ] O orçamento de desempenho é cumprido e os números estão documentados no relatório final.
- [ ] Contratos, picking, foco, `Esc`, `T`, modo leve e clima continuam funcionando.
- [ ] Nada de marcas de terceiros, nada de menção a IA nos commits, fontes e modelos de origem conhecida.
- [ ] O relatório final lista as decisões tomadas, o que ficou de fora e os screenshots de antes e depois.
