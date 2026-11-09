import * as THREE from "three";
import type { WeatherState } from "./weather";

/**
 * Céu, luzes e environment da cena.
 * Identidade noturna: luz-chave fria, preenchimento quente vindo da cidade, borda vermelha baixa.
 * O "dia" é um entardecer nublado de cidade densa, nunca um dia claro.
 */
export interface Atmosphere {
  update(w: WeatherState, dt: number): void;
}

const NIGHT = {
  top: new THREE.Color("#050609"),
  horizon: new THREE.Color("#1b1012"),
  glow: new THREE.Color("#5a1a1c"),
  cloudLit: new THREE.Color("#3a2220"),
  fog: new THREE.Color("#0a090c"),
};
const DAY = {
  top: new THREE.Color("#2a2f38"),
  horizon: new THREE.Color("#4d4f55"),
  glow: new THREE.Color("#5c4a46"),
  cloudLit: new THREE.Color("#6a6a70"),
  fog: new THREE.Color("#2b2c31"),
};

/** Environment procedural: uma "sala" escura com painéis de luz quente, fria e um toque vermelho. */
function buildEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const env = new THREE.Scene();
  env.background = new THREE.Color("#07070a");
  const panel = (color: string, intensity: number, w: number, h: number, pos: [number, number, number], rotY = 0, rotX = 0) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }),
    );
    m.position.set(...pos);
    m.rotation.set(rotX, rotY, 0);
    env.add(m);
  };
  panel("#ede6dc", 0.8, 30, 3, [0, 18, 0], 0, Math.PI / 2); // luz de teto quente
  panel("#9fb4cc", 0.9, 14, 18, [-22, 6, 0], Math.PI / 2); // janela fria
  panel("#ede6dc", 0.7, 18, 10, [0, 4, -22]); // parede quente
  panel("#3a2a26", 0.6, 60, 60, [0, -12, 0], 0, Math.PI / 2); // cidade quente embaixo
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.04).texture;
  pmrem.dispose();
  env.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
  return tex;
}

export function createAtmosphere(scene: THREE.Scene, renderer: THREE.WebGLRenderer): Atmosphere {
  scene.environment = buildEnvironment(renderer);
  scene.environmentIntensity = 0.85;

  const fog = new THREE.FogExp2(NIGHT.fog.clone(), 0.0026);
  scene.fog = fog;
  scene.background = NIGHT.fog.clone();

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: NIGHT.top.clone() },
      horizon: { value: NIGHT.horizon.clone() },
      glow: { value: NIGHT.glow.clone() },
      cloudLit: { value: NIGHT.cloudLit.clone() },
      cloud: { value: 0.5 },
      time: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vP;
      void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 glow; uniform vec3 cloudLit;
      uniform float cloud; uniform float time;
      varying vec3 vP;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
      void main(){
        float h = clamp(vP.y, -0.1, 1.0);
        vec3 c = mix(horizon, top, smoothstep(0.0, 0.6, h));
        c += glow * 0.55 * exp(-max(h, 0.0) * 9.0);
        // nuvens baixas iluminadas de baixo pela cidade
        vec2 uv = vP.xz / max(vP.y + 0.25, 0.08) * 0.9 + vec2(time * 0.004, 0.0);
        float n = fbm(uv * 1.4);
        float band = smoothstep(0.02, 0.18, h) * (1.0 - smoothstep(0.35, 0.75, h));
        float clouds = smoothstep(0.45 - cloud * 0.2, 0.85, n) * band;
        c = mix(c, cloudLit * (0.6 + 0.6 * exp(-h * 6.0)), clouds * (0.35 + 0.5 * cloud));
        // leve grão para evitar bandas no gradiente
        c += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), skyMat);
  sky.renderOrder = -1;
  scene.add(sky);

  // luz-chave fria, preenchimento quente de baixo (a cidade), borda vermelha baixa
  // vinda do lado esquerdo da câmera e rasante: a face +z recebe mais luz que a +x (contraste entre faces)
  const key = new THREE.DirectionalLight("#b9c7da", 2.2);
  key.position.set(10, 70, 110);
  const fill = new THREE.HemisphereLight("#2a3242", "#3b2219", 1.3);
  const rim = new THREE.DirectionalLight("#ff1f33", 0.15);
  rim.position.set(-80, 20, -90);
  scene.add(key, fill, rim);

  const tmp = new THREE.Color();
  let day = 0;
  let cloud = 0.5;
  let fogK = 0;
  return {
    update(w, dt) {
      // transições suaves, nada muda de golpe
      const k = 1 - Math.exp(-dt * 0.5);
      day += (w.dayFactor - day) * k;
      cloud += (w.cloudFactor - cloud) * k;
      fogK += (w.fogDensity - fogK) * k;
      const u = skyMat.uniforms;
      u.top.value.copy(NIGHT.top).lerp(DAY.top, day);
      u.horizon.value.copy(NIGHT.horizon).lerp(DAY.horizon, day);
      u.glow.value.copy(NIGHT.glow).lerp(DAY.glow, day);
      u.cloudLit.value.copy(NIGHT.cloudLit).lerp(DAY.cloudLit, day);
      u.cloud.value = cloud;
      u.time.value += dt;
      tmp.copy(NIGHT.fog).lerp(DAY.fog, day);
      fog.color.copy(tmp);
      (scene.background as THREE.Color).copy(tmp);
      fog.density = 0.0026 + fogK * 0.004;
      key.intensity = 2.2 + day * 0.8;
      fill.intensity = 1.3 + day * 0.35;
      rim.intensity = 0.15 * (1 - day * 0.7);
      scene.environmentIntensity = 0.85 + day * 0.3;
    },
  };
}
