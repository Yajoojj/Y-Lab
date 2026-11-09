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

export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): Post {
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new BloomEffect({ intensity: 1.2, luminanceThreshold: 0.2, luminanceSmoothing: 0.3, mipmapBlur: true });
  const chroma = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0008, 0.0008), radialModulation: true, modulationOffset: 0.3 });
  const scan = new ScanlineEffect({ density: 1.2, blendFunction: BlendFunction.OVERLAY });
  scan.blendMode.opacity.value = 0.08;
  const vignette = new VignetteEffect({ darkness: 0.62, offset: 0.3 });
  const noise = new NoiseEffect({ premultiply: true, blendFunction: BlendFunction.SCREEN });
  noise.blendMode.opacity.value = 0.05;
  composer.addPass(new EffectPass(camera, bloom, vignette, noise, scan));
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
