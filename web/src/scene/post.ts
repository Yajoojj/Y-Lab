import * as THREE from "three";
import {
  BloomEffect,
  ChromaticAberrationEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  ScanlineEffect,
  VignetteEffect,
  BlendFunction,
} from "postprocessing";

export interface Post {
  render(dt: number): void;
  setEnabled(on: boolean): void;
  resize(w: number, h: number): void;
}

/** Optimized post-processing pipeline targeting 60fps on mid-range GPUs.
 *  - Half-float framebuffers for bloom quality/perf balance
 *  - Single combined EffectPass for bloom+vignette+noise+scanlines (reduces GPU passes)
 *  - Chromatic aberration in separate pass (needs its own sampling)
 *  - Reduced effect intensities to avoid overdraw cost */
export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): Post {
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));

  // Bloom: lower threshold catches more neon; mipmapBlur is cheaper at high res
  const bloom = new BloomEffect({
    intensity: 1.0,
    luminanceThreshold: 0.25,
    luminanceSmoothing: 0.3,
    mipmapBlur: true,
  });

  // Combine lightweight effects into ONE pass to minimize fullscreen draws
  const vignette = new VignetteEffect({ darkness: 0.5, offset: 0.35 });
  const noise = new NoiseEffect({ premultiply: true, blendFunction: BlendFunction.SCREEN });
  noise.blendMode.opacity.value = 0.04;
  const scan = new ScanlineEffect({ density: 1.0, blendFunction: BlendFunction.OVERLAY });
  scan.blendMode.opacity.value = 0.06;

  composer.addPass(new EffectPass(camera, bloom, vignette, noise, scan));

  // Chromatic aberration: subtle, single-sample offset
  const chroma = new ChromaticAberrationEffect({
    offset: new THREE.Vector2(0.0006, 0.0006),
    radialModulation: true,
    modulationOffset: 0.2,
  });
  composer.addPass(new EffectPass(camera, chroma));

  let enabled = true;
  return {
    render(dt) {
      if (enabled) composer.render(dt);
      else renderer.render(scene, camera);
    },
    setEnabled(on) { enabled = on; },
    resize(w, h) { composer.setSize(w, h); },
  };
}