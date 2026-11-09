import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export const BG = new THREE.Color("#060507");
const VIEW = 70; // altura do frustum ortográfico em unidades do mundo
/** direção isométrica clássica (1,1,1): elevação de ~35° */
const ISO_OFFSET = new THREE.Vector3(1, 1, 1).multiplyScalar(140);

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  controls: OrbitControls;
  canvas: HTMLCanvasElement;
  onFrame(fn: (dt: number, t: number) => void): void;
  onResize(fn: (w: number, h: number) => void): void;
  zoomBy(step: number): void;
  /** anima alvo e zoom da câmera */
  flyTo(target: THREE.Vector3, zoom: number, seconds?: number): void;
  /** posiciona a câmera na vista isométrica padrão, sem animação */
  frame(target: THREE.Vector3, zoom: number): void;
  render: (dt: number) => void;
  setRender(fn: (dt: number) => void): void;
}

function hasWebGL(canvas: HTMLCanvasElement): boolean {
  try {
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export function createStage(canvas: HTMLCanvasElement): Stage {
  if (!hasWebGL(canvas)) throw new Error("webgl");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", stencil: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // o tone mapping fica no pós-processamento (ou é ligado no modo leve)
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(BG);

  const scene = new THREE.Scene();

  const aspect = window.innerWidth / window.innerHeight;
  const camera = new THREE.OrthographicCamera((-VIEW * aspect) / 2, (VIEW * aspect) / 2, VIEW / 2, -VIEW / 2, -500, 1500);
  camera.position.set(0, 20, 0).add(ISO_OFFSET);
  camera.zoom = 1;

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minPolarAngle = 0.6;
  controls.maxPolarAngle = 1.2;
  controls.minZoom = 0.35;
  controls.maxZoom = 4;
  controls.screenSpacePanning = true;
  controls.target.set(0, 20, 0);
  controls.update();

  const frameFns: ((dt: number, t: number) => void)[] = [];
  const resizeFns: ((w: number, h: number) => void)[] = [];
  let renderFn = (_dt: number) => renderer.render(scene, camera);

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    const a = w / h;
    camera.left = (-VIEW * a) / 2;
    camera.right = (VIEW * a) / 2;
    camera.top = VIEW / 2;
    camera.bottom = -VIEW / 2;
    camera.updateProjectionMatrix();
    for (const fn of resizeFns) fn(w, h);
  };
  window.addEventListener("resize", resize);
  resize();

  let fly: { from: THREE.Vector3; to: THREE.Vector3; z0: number; z1: number; t: number; dur: number } | undefined;

  const prevTarget = new THREE.Vector3();
  const delta = new THREE.Vector3();
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;
    if (fly) {
      fly.t += dt;
      const k = easeInOutCubic(Math.min(1, fly.t / fly.dur));
      // a câmera acompanha o alvo, mantendo o ângulo atual
      prevTarget.copy(controls.target);
      controls.target.lerpVectors(fly.from, fly.to, k);
      camera.position.add(delta.subVectors(controls.target, prevTarget));
      camera.zoom = fly.z0 + (fly.z1 - fly.z0) * k;
      camera.updateProjectionMatrix();
      if (k >= 1) fly = undefined;
    }
    controls.update();
    for (const fn of frameFns) fn(dt, t);
    renderFn(dt);
  });

  return {
    renderer,
    scene,
    camera,
    controls,
    canvas,
    onFrame: (fn) => frameFns.push(fn),
    onResize: (fn) => resizeFns.push(fn),
    zoomBy(step) {
      const z = THREE.MathUtils.clamp(camera.zoom * (step > 0 ? 1.25 : 0.8), controls.minZoom, controls.maxZoom);
      fly = { from: controls.target.clone(), to: controls.target.clone(), z0: camera.zoom, z1: z, t: 0, dur: 0.25 };
    },
    flyTo(target, zoom, seconds = 0.6) {
      fly = { from: controls.target.clone(), to: target.clone(), z0: camera.zoom, z1: THREE.MathUtils.clamp(zoom, controls.minZoom, controls.maxZoom), t: 0, dur: seconds };
    },
    frame(target, zoom) {
      fly = undefined;
      camera.position.copy(target).add(ISO_OFFSET);
      controls.target.copy(target);
      camera.zoom = THREE.MathUtils.clamp(zoom, controls.minZoom, controls.maxZoom);
      camera.updateProjectionMatrix();
      controls.update();
    },
    get render() { return renderFn; },
    setRender(fn) { renderFn = fn; },
  };
}
