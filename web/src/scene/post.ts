import * as THREE from "three";
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  HueSaturationEffect,
  NoiseEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
  BlendFunction,
} from "postprocessing";

export interface Post {
  render(dt: number): void;
  setEnabled(on: boolean): void;
  resize(w: number, h: number): void;
}

/**
 * Pós-processamento pensado para conforto:
 * - bloom só no que passa de ~1.0 em HDR (materiais emissivos marcados), sem estourar vidro e céu;
 * - tone mapping AgX, saturação levemente contida, vinheta suave e SMAA;
 * - grão quase imperceptível; sem scanlines nem aberração cromática.
 * No modo leve o renderer faz o tone mapping direto, sem composer.
 */
export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): Post {
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
  composer.addPass(new RenderPass(scene, camera));

  // bloom em meia resolução e com menos níveis: quase igual visualmente, bem mais barato
  const bloom = new BloomEffect({ intensity: 0.7, luminanceThreshold: 0.95, luminanceSmoothing: 0.25, mipmapBlur: true, radius: 0.6, levels: 4, resolutionScale: 0.35 });
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
  const grade = new HueSaturationEffect({ saturation: -0.08 });
  const vignette = new VignetteEffect({ darkness: 0.42, offset: 0.38 });
  const noise = new NoiseEffect({ premultiply: true, blendFunction: BlendFunction.SCREEN });
  noise.blendMode.opacity.value = 0.018;

  composer.addPass(new EffectPass(camera, bloom, tone, grade, vignette, noise));

  let enabled = true;
  renderer.toneMappingExposure = 1.5;
  const apply = () => {
    renderer.toneMapping = enabled ? THREE.NoToneMapping : THREE.AgXToneMapping;
  };
  apply();

  return {
    render(dt) {
      if (enabled) composer.render(dt);
      else renderer.render(scene, camera);
    },
    setEnabled(on) {
      enabled = on;
      apply();
    },
    resize(w, h) { composer.setSize(w, h); },
  };
}
