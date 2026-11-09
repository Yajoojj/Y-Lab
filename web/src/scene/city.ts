import * as THREE from "three";
import type { WeatherState } from "./weather";

/**
 * Arasaka-inspired procedural city: instanced buildings with holographic windows,
 * neon signage bands, atmospheric fog, and weather-reactive lighting.
 * Single draw call for all buildings via InstancedMesh + custom shader.
 */
export function createCity(scene: THREE.Scene, count = 160): {
  mesh: THREE.InstancedMesh;
  ground: THREE.Mesh;
  grid: THREE.GridHelper;
  updateWeather(w: WeatherState, t: number): void;
} {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const seeds = new Float32Array(count);
  const heights = new Float32Array(count);

  // Arasaka palette: deep crimson, bone white, steel blue, ember orange
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      fogColor: { value: new THREE.Color("#060507") },
      fogDensity: { value: 0.0022 },
      time: { value: 0 },
      rainIntensity: { value: 0 },
      dayFactor: { value: 1 },
      cloudFactor: { value: 0.2 },
      // Arasaka corp colors
      cBone: { value: new THREE.Color("#EDE6DC") },
      cCrimson: { value: new THREE.Color("#FF1F33") },
      cEmber: { value: new THREE.Color("#FF8A3D") },
      cSteel: { value: new THREE.Color("#4DE8FF") },
      cDark: { value: new THREE.Color("#0a0608") },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      attribute float aHeight;
      varying vec3 vWorld;
      varying vec3 vN;
      varying float vSeed;
      varying float vTop;
      varying float vHeight;
      void main(){
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vSeed = aSeed;
        vHeight = aHeight;
        vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vTop = position.y;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 fogColor;
      uniform float fogDensity;
      uniform float time;
      uniform float rainIntensity;
      uniform float dayFactor;
      uniform float cloudFactor;
      uniform vec3 cBone;
      uniform vec3 cCrimson;
      uniform vec3 cEmber;
      uniform vec3 cSteel;
      uniform vec3 cDark;

      varying vec3 vWorld;
      varying vec3 vN;
      varying float vSeed;
      varying float vTop;
      varying float vHeight;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + vSeed * 17.0) * 43758.5453); }
      float hash2(vec2 p){ return fract(sin(dot(p, vec2(269.5, 183.3)) + vSeed * 31.0) * 43758.5453); }

      void main(){
        // Base building color: dark concrete with subtle variation
        vec3 base = cDark + vec3(0.02, 0.01, 0.015) * (1.0 - vTop);
        // Wetness from rain: darker, more reflective base
        base *= 1.0 - rainIntensity * 0.3;

        vec3 col = base;

        // Side faces: windows and architectural details
        if (abs(vN.y) < 0.5) {
          float u = abs(vN.x) > 0.5 ? vWorld.z : vWorld.x;

          // Window grid - Arasaka style: tall narrow windows
          vec2 g = vec2(u / 1.1, vWorld.y / 1.4);
          vec2 cell = floor(g);
          vec2 f = fract(g);
          float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.22, f.y) * step(f.y, 0.88);

          float r = hash(cell);
          float r2 = hash2(cell);

          // Window lighting: more lit at night, flickering some
          float nightBoost = 1.0 - dayFactor * 0.6;
          float lit = step(0.65 - nightBoost * 0.2, r) * (0.7 + 0.3 * sin(time * 0.3 + r * 30.0));

          // Window color variety: bone white, crimson accent, steel blue tech
          vec3 wc;
          if (r > 0.94) wc = cCrimson * 1.4;       // Arasaka red accent
          else if (r > 0.88) wc = cSteel * 1.2;    // Tech blue
          else if (r > 0.82) wc = cEmber;           // Warm amber
          else wc = mix(cBone, vec3(1.0, 0.92, 0.85), 0.3); // Warm white

          // Rain makes windows glow more (reflections)
          float rainGlow = rainIntensity * 0.4;
          col += wc * win * lit * (0.8 + rainGlow);

          // Horizontal neon band every ~15 floors on taller buildings
          float bandY = mod(vWorld.y, 15.0);
          float band = step(14.6, bandY) * step(20.0, vHeight);
          float bandColor = vSeed > 0.6 ? cCrimson.r : cSteel.r;
          vec3 bandCol = vSeed > 0.6 ? cCrimson : cSteel;
          col += bandCol * band * (1.2 + 0.4 * sin(time * 1.5 + vSeed * 10.0));

          // Vertical edge strips on corners (Arasaka corporate aesthetic)
          float edgeX = step(0.96, abs(f.x));
          float edgeStrip = edgeX * step(0.5, vSeed) * step(30.0, vHeight);
          col += cCrimson * edgeStrip * 0.6 * (0.8 + 0.2 * sin(time * 2.0 + vWorld.y * 0.1));

          // Holographic advertisement panels on some tall buildings
          float adPanel = step(0.92, vSeed) * step(40.0, vHeight) *
                          step(0.3, vTop) * step(vTop, 0.7) *
                          step(0.3, f.x) * step(f.x, 0.7);
          float adFlicker = 0.6 + 0.4 * sin(time * 3.0 + vSeed * 50.0);
          vec3 adCol = mix(cCrimson, cSteel, sin(time * 0.5 + vSeed * 20.0) * 0.5 + 0.5);
          col += adCol * adPanel * adFlicker * 1.5;
        }

        // Rooftop details
        if (vTop > 0.98) {
          // Antenna lights on tall buildings
          float antenna = step(50.0, vHeight) * step(0.99, vTop);
          float blink = step(0.5, sin(time * 4.0 + vSeed * 20.0));
          col += cCrimson * antenna * blink * 2.0;

          // Helipad markers on very tall buildings
          float helipad = step(80.0, vHeight) * step(0.995, vTop);
          float ring = smoothstep(0.3, 0.35, length(fract(vWorld.xz * 0.15) - 0.5));
          col += cSteel * helipad * ring * 0.8;
        }

        // Atmospheric fog - weather reactive
        float d = length(vWorld - cameraPosition);
        float effectiveFog = fogDensity * (1.0 + rainIntensity * 2.0 + cloudFactor * 0.5);
        float fog = 1.0 - exp(-effectiveFog * effectiveFog * d * d);

        // Fog color shifts with weather/time
        vec3 weatherFog = mix(fogColor, cDark * 1.5, cloudFactor * 0.3);
        weatherFog = mix(weatherFog, vec3(0.08, 0.04, 0.06), rainIntensity * 0.4);

        gl_FragColor = vec4(mix(col, weatherFog, clamp(fog, 0.0, 1.0)), 1.0);
      }`,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const rnd = mulberry32(7);

  for (let i = 0; i < count; i++) {
    const ang = rnd() * Math.PI * 2;
    const r = 42 + rnd() * 140;
    const w = 5 + rnd() * 14;
    const d = 5 + rnd() * 14;

    // Keep corridor toward camera clear for tower visibility
    const facing = Math.cos(ang - Math.PI / 4);
    const maxH = facing > 0.35 ? 8 + (1 - facing) * 20 : 130;
    const h = 10 + Math.pow(rnd(), 1.5) * maxH;

    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.round(rnd() * 4) * (Math.PI / 2));
    m.compose(
      new THREE.Vector3(Math.cos(ang) * r, -2, Math.sin(ang) * r),
      q,
      new THREE.Vector3(w, h, d),
    );
    mesh.setMatrixAt(i, m);
    seeds[i] = rnd();
    heights[i] = h;
  }

  geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
  geo.setAttribute("aHeight", new THREE.InstancedBufferAttribute(heights, 1));
  mesh.frustumCulled = false;
  scene.add(mesh);

  // Ground: wet asphalt with Arasaka-red grid lines
  const groundMat = new THREE.MeshStandardMaterial({
    color: "#080506",
    roughness: 0.25,
    metalness: 0.7,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2;
  scene.add(ground);

  // Grid: crimson primary, dark secondary
  const grid = new THREE.GridHelper(280, 56, "#ff1f33", "#1a0810");
  grid.position.y = -1.98;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.3;
  scene.add(grid);

  function updateWeather(w: WeatherState, t: number): void {
    mat.uniforms.time.value = t;
    mat.uniforms.rainIntensity.value = w.rainIntensity;
    mat.uniforms.dayFactor.value = w.dayFactor;
    mat.uniforms.cloudFactor.value = w.cloudFactor;

    // Wet ground when raining
    groundMat.roughness = 0.25 - w.rainIntensity * 0.15;
    groundMat.metalness = 0.7 + w.rainIntensity * 0.2;

    // Grid fades in rain (water washes out markings)
    (grid.material as THREE.Material).opacity = 0.3 - w.rainIntensity * 0.15;
  }

  return { mesh, ground, grid, updateWeather };
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