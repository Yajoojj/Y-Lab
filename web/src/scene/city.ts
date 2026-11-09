import * as THREE from "three";

/** Anel de prédios procedurais com janelas emissivas calculadas no shader (um draw call). */
export function createCity(scene: THREE.Scene, count = 140): THREE.InstancedMesh {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const seeds = new Float32Array(count);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      fogColor: { value: new THREE.Color("#060507") },
      fogDensity: { value: 0.0022 },
      time: { value: 0 },
      c1: { value: new THREE.Color("#EDE6DC") },
      c2: { value: new THREE.Color("#FF8A3D") },
      c3: { value: new THREE.Color("#FF1F33") },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      varying vec3 vWorld; varying vec3 vN; varying float vSeed; varying float vTop;
      void main(){
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorld = w.xyz; vSeed = aSeed;
        vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vTop = position.y;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 fogColor; uniform float fogDensity; uniform float time;
      uniform vec3 c1; uniform vec3 c2; uniform vec3 c3;
      varying vec3 vWorld; varying vec3 vN; varying float vSeed; varying float vTop;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + vSeed * 17.0) * 43758.5453); }
      void main(){
        vec3 base = vec3(0.03, 0.022, 0.026) + vec3(0.03, 0.0, 0.006) * (1.0 - vTop);
        vec3 col = base;
        if (abs(vN.y) < 0.5) {
          float u = abs(vN.x) > 0.5 ? vWorld.z : vWorld.x;
          vec2 g = vec2(u / 1.3, vWorld.y / 1.7);
          vec2 cell = floor(g); vec2 f = fract(g);
          float win = step(0.22, f.x) * step(f.x, 0.78) * step(0.28, f.y) * step(f.y, 0.78);
          float r = hash(cell);
          float lit = step(0.8, r) * (0.75 + 0.25 * sin(time * 0.5 + r * 40.0));
          vec3 wc = r > 0.93 ? c3 : (r > 0.86 ? c2 : mix(c1, vec3(1.0, 0.78, 0.6), 0.5));
          col += wc * win * lit * 0.9;
          // faixa neon no topo de alguns prédios
          col += (vSeed > 0.7 ? c3 : c2) * step(0.985, vTop) * step(0.55, vSeed) * 1.6;
        }
        float d = length(vWorld - cameraPosition);
        float fog = 1.0 - exp(-fogDensity * fogDensity * d * d);
        gl_FragColor = vec4(mix(col, fogColor, clamp(fog, 0.0, 1.0)), 1.0);
      }`,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const rnd = mulberry32(7);
  for (let i = 0; i < count; i++) {
    const ang = rnd() * Math.PI * 2;
    const r = 48 + rnd() * 130;
    const w = 6 + rnd() * 12;
    const d = 6 + rnd() * 12;
    // setor entre a câmera isométrica (+x,+z) e a torre fica baixo para não tapar a vista
    const facing = Math.cos(ang - Math.PI / 4);
    const maxH = facing > 0.35 ? 6 + (1 - facing) * 18 : 110;
    const h = 8 + Math.pow(rnd(), 1.6) * maxH;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.round(rnd() * 4) * (Math.PI / 2));
    m.compose(new THREE.Vector3(Math.cos(ang) * r, -2, Math.sin(ang) * r), q, new THREE.Vector3(w, h, d));
    mesh.setMatrixAt(i, m);
    seeds[i] = rnd();
  }
  geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
  mesh.frustumCulled = false;
  scene.add(mesh);

  // chão: asfalto escuro com grade magenta
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshStandardMaterial({ color: "#080506", roughness: 0.35, metalness: 0.6 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2;
  scene.add(ground);
  const grid = new THREE.GridHelper(260, 52, "#ff1f33", "#2a0a0e");
  grid.position.y = -1.98;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.35;
  scene.add(grid);

  return mesh;
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
