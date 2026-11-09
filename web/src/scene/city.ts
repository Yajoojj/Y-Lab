import * as THREE from "three";
import { MOTION } from "./motion";
import type { WeatherState } from "./weather";

/*
 * Megacidade noturna em três camadas de profundidade:
 * perto (torres com recuos e antenas), meio (blocos simples) e fundo (silhuetas na neblina).
 * Janelas sóbrias: poucas acesas, quase todas em branco osso quente, nada de confete colorido.
 * Movimento ambiente discreto: faróis no elevado, tráfego aéreo, postes com volume de luz.
 * O setor entre a câmera isométrica (+x,+z) e a torre fica baixo e livre.
 */

export interface City {
  updateWeather(w: WeatherState, t: number): void;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const facing = (ang: number) => Math.cos(ang - Math.PI / 4);

/*
 * Transparência de oclusão: o que fica entre a câmera e o ponto que ela olha some num pontilhado fino
 * (o centro da instância é comparado com a linha câmera→alvo no plano do chão).
 * Os uniforms são compartilhados por todos os materiais da cidade; basta atualizar uma vez por quadro.
 */
const occlusion = {
  uTarget: { value: new THREE.Vector3() },
  uFadeR: { value: 24 },
};

const OCC_VERT_PARS = /* glsl */ `
  varying vec3 vOccCenter;
  varying float vOccHalf;
`;
const OCC_VERT = /* glsl */ `
  #ifdef USE_INSTANCING
    vOccCenter = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vOccHalf = 0.5 * max(length(instanceMatrix[0].xyz), length(instanceMatrix[2].xyz));
  #else
    vOccCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vOccHalf = 1.0;
  #endif
`;
const OCC_FRAG_PARS = /* glsl */ `
  uniform vec3 uTarget;
  uniform float uFadeR;
  varying vec3 vOccCenter;
  varying float vOccHalf;
`;
const OCC_FRAG = /* glsl */ `
  {
    vec2 occDir = normalize(cameraPosition.xz - uTarget.xz);
    vec2 occV = vOccCenter.xz - uTarget.xz;
    float occAlong = dot(occV, occDir);
    float occPerp = length(occV - occAlong * occDir) - vOccHalf;
    float occ = step(0.0, occAlong) * (1.0 - smoothstep(uFadeR, uFadeR + 14.0, occPerp));
    if (occ > 0.0) {
      float occN = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      if (occN < occ * 0.9) discard;
    }
  }
`;

/** aplica a transparência de oclusão num material padrão do three (pilares, pista, antenas) */
function withOcclusion<T extends THREE.Material>(m: T): T {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTarget = occlusion.uTarget;
    shader.uniforms.uFadeR = occlusion.uFadeR;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\n" + OCC_VERT_PARS)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n" + OCC_VERT);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + OCC_FRAG_PARS)
      .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\n" + OCC_FRAG);
  };
  return m;
}

// ---------------------------------------------------------------- fachadas
function facadeMaterial(opts: { lit: number; base: string; detail: number }): THREE.ShaderMaterial {
  const m = facadeShader(opts);
  m.uniforms.uTarget = occlusion.uTarget;
  m.uniforms.uFadeR = occlusion.uFadeR;
  return m;
}

function facadeShader(opts: { lit: number; base: string; detail: number }): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        lit: { value: opts.lit },
        detail: { value: opts.detail },
        dayFactor: { value: 0 },
        baseColor: { value: new THREE.Color(opts.base) },
        warm: { value: new THREE.Color("#f2d9b8") },
        cool: { value: new THREE.Color("#a9c4d6") },
        red: { value: new THREE.Color("#ff1f33") },
      },
    ]),
    vertexShader: /* glsl */ `
      attribute float aSeed;
      varying vec3 vWorld; varying vec3 vN; varying float vSeed; varying float vTop;
      #include <fog_pars_vertex>
      ${OCC_VERT_PARS}
      void main(){
        ${OCC_VERT}
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorld = w.xyz; vSeed = aSeed; vTop = position.y;
        vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float lit; uniform float detail; uniform float dayFactor;
      uniform vec3 baseColor; uniform vec3 warm; uniform vec3 cool; uniform vec3 red;
      varying vec3 vWorld; varying vec3 vN; varying float vSeed; varying float vTop;
      #include <fog_pars_fragment>
      ${OCC_FRAG_PARS}
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + vSeed * 23.17) * 43758.5453); }
      void main(){
        ${OCC_FRAG}
        // luz ambiente simples: topo mais claro, faces viradas para a cidade mais quentes
        float sky = clamp(vN.y, 0.0, 1.0);
        vec3 col = baseColor * (0.55 + 0.45 * sky) * (1.0 + dayFactor * 1.1);
        col += vec3(0.025, 0.012, 0.01) * (1.0 - vTop) * (1.0 - dayFactor);
        if (abs(vN.y) < 0.5) {
          float u = abs(vN.x) > 0.5 ? vWorld.z : vWorld.x;
          vec2 g = vec2(u / 1.1, vWorld.y / 1.45);
          vec2 cell = floor(g); vec2 f = fract(g);
          // janelas altas e estreitas, com faixas de laje
          float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.2, f.y) * step(f.y, 0.86);
          float r = hash(cell);
          float rowOn = step(0.35, hash(vec2(cell.y, vSeed * 7.0)));
          float on = step(1.0 - lit, r) * rowOn;
          vec3 wc = r > 0.985 ? cool : warm;
          float k = (0.55 + 0.45 * hash(cell + 3.1)) * (1.0 - dayFactor * 0.85);
          col = mix(col, col * 1.12, win * detail);
          col += wc * win * on * k * 0.85;
          // poucas torres ganham uma lâmina vermelha no topo (detalhe, não confete)
          col += red * 1.6 * step(0.992, vTop) * step(0.9, vSeed) * detail * (1.0 - dayFactor * 0.6);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
}

function buildingRing(scene: THREE.Scene, opts: {
  count: number; rMin: number; rMax: number; wMin: number; wMax: number; hMin: number; hMax: number;
  lit: number; base: string; detail: number; seed: number; lowSector: boolean; setbacks?: boolean;
}): { mat: THREE.ShaderMaterial[] } {
  const rnd = mulberry32(opts.seed);
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const mat = facadeMaterial({ lit: opts.lit, base: opts.base, detail: opts.detail });
  const mesh = new THREE.InstancedMesh(geo, mat, opts.count);
  const seeds = new Float32Array(opts.count);
  const extra = opts.setbacks ? new THREE.InstancedMesh(geo, mat, opts.count) : undefined;
  const extraSeeds = new Float32Array(opts.count);
  const antennas = opts.setbacks ? new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.12, 1, 5).translate(0, 0.5, 0), withOcclusion(new THREE.MeshStandardMaterial({ color: "#1d1c20", metalness: 0.8, roughness: 0.4 })), opts.count) : undefined;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  let n = 0;
  let e = 0;
  for (let i = 0; i < opts.count; i++) {
    const ang = rnd() * Math.PI * 2;
    const r = opts.rMin + rnd() * (opts.rMax - opts.rMin);
    const w = opts.wMin + rnd() * (opts.wMax - opts.wMin);
    const d = opts.wMin + rnd() * (opts.wMax - opts.wMin);
    const f = facing(ang);
    const maxH = opts.lowSector && f > 0.3 ? 4 + (1 - f) * 22 : opts.hMax;
    const h = opts.hMin + Math.pow(rnd(), 1.5) * Math.max(0, maxH - opts.hMin);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.round(rnd() * 3) * (Math.PI / 2) + (rnd() - 0.5) * 0.15);
    p.set(Math.cos(ang) * r, 0, Math.sin(ang) * r);
    mesh.setMatrixAt(n, m.compose(p, q, s.set(w, h, d)));
    seeds[n++] = rnd();
    if (extra && antennas && h > 30) {
      // recuo no topo + antena: silhueta mais rica nas torres próximas
      const k = 0.55 + rnd() * 0.2;
      const eh = h * (0.12 + rnd() * 0.18);
      extra.setMatrixAt(e, m.compose(p.clone().setY(h), q, s.set(w * k, eh, d * k)));
      antennas.setMatrixAt(e, m.compose(p.clone().setY(h + eh), q, s.set(1, 4 + rnd() * 10, 1)));
      extraSeeds[e++] = rnd();
    }
  }
  mesh.count = n;
  geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
  mesh.frustumCulled = false;
  scene.add(mesh);
  if (extra && antennas) {
    const egeo = geo.clone();
    egeo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(extraSeeds, 1));
    extra.geometry = egeo;
    extra.count = e;
    antennas.count = e;
    extra.frustumCulled = antennas.frustumCulled = false;
    scene.add(extra, antennas);
  }
  return { mat: [mat] };
}

// ---------------------------------------------------------------- luzes em movimento (pontos no shader)
function movingLights(scene: THREE.Scene, opts: {
  count: number; radius: number; spread: number; y: number; ySpread: number; speed: number; color: string; size: number;
  intensity: number; seed: number; blink?: boolean; ellipse?: number; skipSector?: boolean;
}): THREE.ShaderMaterial {
  const rnd = mulberry32(opts.seed);
  const ang = new Float32Array(opts.count);
  const rad = new Float32Array(opts.count);
  const hy = new Float32Array(opts.count);
  const spd = new Float32Array(opts.count);
  const pos = new Float32Array(opts.count * 3);
  for (let i = 0; i < opts.count; i++) {
    ang[i] = rnd() * Math.PI * 2;
    rad[i] = opts.radius + (rnd() - 0.5) * opts.spread;
    hy[i] = opts.y + (rnd() - 0.5) * opts.ySpread;
    spd[i] = opts.speed * (0.7 + rnd() * 0.6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aAng", new THREE.BufferAttribute(ang, 1));
  geo.setAttribute("aRad", new THREE.BufferAttribute(rad, 1));
  geo.setAttribute("aY", new THREE.BufferAttribute(hy, 1));
  geo.setAttribute("aSpd", new THREE.BufferAttribute(spd, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      time: { value: 0 },
      zoom: { value: 1 },
      color: { value: new THREE.Color(opts.color).multiplyScalar(opts.intensity) },
      size: { value: opts.size },
      ellipse: { value: opts.ellipse ?? 1 },
      blink: { value: opts.blink ? 1 : 0 },
      skip: { value: opts.skipSector ? 1 : 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aAng; attribute float aRad; attribute float aY; attribute float aSpd;
      uniform float time; uniform float zoom; uniform float size; uniform float ellipse; uniform float blink; uniform float skip;
      varying float vA;
      void main(){
        float a = aAng + time * aSpd;
        vec3 p = vec3(cos(a) * aRad, aY, sin(a) * aRad * ellipse);
        // some no setor entre câmera e torre
        float f = cos(a - 0.7853982);
        vA = skip > 0.5 ? (1.0 - smoothstep(0.35, 0.55, f)) : 1.0;
        if (blink > 0.5) vA *= 0.55 + 0.45 * step(0.5, fract(time * 0.5 + aAng));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = size * zoom;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color; varying float vA;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float a = smoothstep(0.5, 0.0, d) * vA;
        if (a < 0.01) discard;
        gl_FragColor = vec4(color * a, a);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  return mat;
}

// ---------------------------------------------------------------- letreiros holográficos (só glifos inventados)
function glyphTexture(seed: number, tint: string): THREE.CanvasTexture {
  const rnd = mulberry32(seed);
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(10,8,10,0.6)";
  g.fillRect(0, 0, 256, 512);
  g.strokeStyle = tint;
  g.fillStyle = tint;
  g.lineWidth = 6;
  for (let y = 40; y < 480; y += 64) {
    for (let x = 40; x < 220; x += 64) {
      if (rnd() < 0.25) continue;
      g.globalAlpha = 0.5 + rnd() * 0.5;
      g.beginPath();
      const kind = Math.floor(rnd() * 4);
      if (kind === 0) { g.moveTo(x - 16, y - 16); g.lineTo(x + 16, y - 16); g.lineTo(x, y + 16); }
      else if (kind === 1) { g.moveTo(x - 16, y); g.lineTo(x + 16, y); g.moveTo(x, y - 16); g.lineTo(x, y + 16); }
      else if (kind === 2) { g.rect(x - 14, y - 14, 28, 28); }
      else { g.arc(x, y, 14, rnd() * 3, rnd() * 3 + 3.5); }
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  g.fillRect(20, 16, 216, 4);
  g.fillRect(20, 492, 216, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createCity(scene: THREE.Scene): City {
  const mats: THREE.ShaderMaterial[] = [];
  // fundo: silhuetas altas e finas na neblina
  mats.push(...buildingRing(scene, { count: 90, rMin: 170, rMax: 300, wMin: 8, wMax: 18, hMin: 30, hMax: 170, lit: 0.06, base: "#0b0b0e", detail: 0.6, seed: 11, lowSector: false }).mat);
  // meio: blocos simples
  mats.push(...buildingRing(scene, { count: 90, rMin: 95, rMax: 170, wMin: 8, wMax: 16, hMin: 14, hMax: 95, lit: 0.1, base: "#111014", detail: 0.85, seed: 23, lowSector: true }).mat);
  // perto: torres com recuo e antena
  mats.push(...buildingRing(scene, { count: 46, rMin: 50, rMax: 95, wMin: 9, wMax: 16, hMin: 10, hMax: 110, lit: 0.13, base: "#141317", detail: 1, seed: 37, lowSector: true, setbacks: true }).mat);

  // chão: pedra e asfalto molhados (reflexo vem do environment)
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(420, 64).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: "#0d0c0f", roughness: 0.3, metalness: 0.3, envMapIntensity: 1.0 }),
  );
  ground.position.y = -0.01;
  scene.add(ground);
  // calçada/praça clara ao redor do pódio
  const plaza = new THREE.Mesh(
    new THREE.RingGeometry(26, 44, 64).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: "#18171a", roughness: 0.6, metalness: 0.1 }),
  );
  plaza.position.y = 0.005;
  scene.add(plaza);

  // postes com luz quente e volume falso
  const rnd = mulberry32(5);
  const poles = 22;
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 6, 6).translate(0, 3, 0);
  const headGeo = new THREE.BoxGeometry(0.9, 0.12, 0.3);
  const beamGeo = new THREE.ConeGeometry(2.4, 6, 20, 1, true).translate(0, -3, 0);
  const poleM = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: "#1d1c20", metalness: 0.8, roughness: 0.4 }), poles);
  const headM = new THREE.InstancedMesh(headGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd9a8").multiplyScalar(2.2), toneMapped: false }), poles);
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color("#ffd9a8") } },
    vertexShader: /* glsl */ `varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform vec3 color; varying float vY; void main(){ float a = 0.06 * (1.0 - vY) * (1.0 - vY); gl_FragColor = vec4(color * a, a); }`,
  });
  const beamM = new THREE.InstancedMesh(beamGeo, beamMat, poles);
  const m = new THREE.Matrix4();
  for (let i = 0; i < poles; i++) {
    const a = (i / poles) * Math.PI * 2 + rnd() * 0.05;
    const r = 34 + (i % 2) * 7;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    poleM.setMatrixAt(i, m.makeTranslation(x, 0, z));
    headM.setMatrixAt(i, m.makeTranslation(x, 6, z));
    beamM.setMatrixAt(i, m.makeTranslation(x, 6, z));
  }
  scene.add(poleM, headM, beamM);

  // elevado: anel de pista escura com faróis em duas mãos (some no setor da câmera)
  const deckSegs = 72;
  const deckGeo = new THREE.BoxGeometry(1, 0.5, 3.4);
  const deck = new THREE.InstancedMesh(deckGeo, withOcclusion(new THREE.MeshStandardMaterial({ color: "#121115", roughness: 0.7, metalness: 0.3 })), deckSegs);
  const pierGeo = new THREE.BoxGeometry(0.8, 9, 0.8).translate(0, 4.5, 0);
  const piers = new THREE.InstancedMesh(pierGeo, withOcclusion(new THREE.MeshStandardMaterial({ color: "#151418", roughness: 0.8 })), deckSegs);
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  let dn = 0;
  let pn = 0;
  const R = 110;
  for (let i = 0; i < deckSegs; i++) {
    const a = (i / deckSegs) * Math.PI * 2;
    if (facing(a) > 0.4) continue;
    const len = (2 * Math.PI * R) / deckSegs + 0.3;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
    deck.setMatrixAt(dn++, m.compose(new THREE.Vector3(Math.cos(a) * R, 9.2, Math.sin(a) * R), q, sc.set(len, 1, 1)));
    if (i % 3 === 0) piers.setMatrixAt(pn++, m.makeTranslation(Math.cos(a) * R, 0, Math.sin(a) * R));
  }
  deck.count = dn;
  piers.count = pn;
  scene.add(deck, piers);

  const timed: THREE.ShaderMaterial[] = [
    movingLights(scene, { count: 220, radius: R - 0.8, spread: 0.6, y: 9.6, ySpread: 0, speed: 0.05, color: "#ff2a3a", size: 2.6, intensity: 2.2, seed: 41, skipSector: true }),
    movingLights(scene, { count: 220, radius: R + 0.8, spread: 0.6, y: 9.6, ySpread: 0, speed: -0.05, color: "#fff1dc", size: 2.6, intensity: 2.0, seed: 43, skipSector: true }),
    // tráfego aéreo: poucos veículos altos, devagar, piscando lento
    movingLights(scene, { count: 40, radius: 150, spread: 90, y: 70, ySpread: 50, speed: 0.025, color: "#ede6dc", size: 3.2, intensity: 1.8, seed: 47, blink: true, ellipse: 0.7, skipSector: true }),
  ];

  // letreiros: glifos abstratos em tons contidos, presos a prédios próximos
  const boardSpots: [number, number, number, string][] = [
    [-60, 26, -40, "#ff4a55"], [-30, 34, -72, "#ede6dc"], [-78, 20, 10, "#9fd6e0"],
    [40, 30, -70, "#ede6dc"], [-72, 40, -46, "#ff4a55"], [12, 22, -88, "#9fd6e0"],
  ];
  boardSpots.forEach(([x, y, z, tint], i) => {
    const tex = glyphTexture(100 + i, tint);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 10),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, color: new THREE.Color(1.15, 1.15, 1.15), depthWrite: false }),
    );
    board.position.set(x, y, z);
    board.lookAt(x + 1, y, z + 1);
    scene.add(board);
  });

  let zoomRef = 1;
  return {
    updateWeather(w, t) {
      for (const mt of mats) mt.uniforms.dayFactor.value = w.dayFactor;
      const cam = scene.userData.camera as THREE.OrthographicCamera | undefined;
      const target = scene.userData.target as THREE.Vector3 | undefined;
      if (target) occlusion.uTarget.value.copy(target);
      zoomRef = cam ? cam.zoom : zoomRef;
      for (const mt of timed) {
        mt.uniforms.time.value = t * MOTION;
        mt.uniforms.zoom.value = zoomRef;
      }
    },
  };
}
