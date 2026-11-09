import * as THREE from "three";
import { mulberry32 } from "./city";

/** Chuva animada inteiramente no shader: a CPU só atualiza o tempo. */
export function createRain(scene: THREE.Scene, count = 6000): { mesh: THREE.LineSegments; update(t: number): void } {
  const rnd = mulberry32(42);
  const pos = new Float32Array(count * 2 * 3);
  const end = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = (rnd() - 0.5) * 220;
    const y = rnd() * 160;
    const z = (rnd() - 0.5) * 220;
    pos.set([x, y, z, x, y, z], i * 6);
    end[i * 2] = 0;
    end[i * 2 + 1] = 1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, color: { value: new THREE.Color("#e8c8c8") } },
    vertexShader: /* glsl */ `
      attribute float aEnd; uniform float time; varying float vA;
      void main(){
        vec3 p = position;
        float speed = 55.0 + fract(p.x * 13.1) * 25.0;
        p.y = mod(p.y - time * speed, 160.0) - 4.0;
        p.y -= aEnd * 1.6; p.x -= aEnd * 0.35;
        vA = 1.0 - aEnd * 0.8;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `uniform vec3 color; varying float vA; void main(){ gl_FragColor = vec4(color, 0.16 * vA); }`,
  });
  const mesh = new THREE.LineSegments(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { mesh, update: (t) => { mat.uniforms.time.value = t; } };
}
