import { Vector2 } from "three";

import simplexNoiseGlsl from "./simplexNoiseGlsl";

// Full-screen "watercolor sketch" pass for the AQUARELLE render mode:
// 1. UV wobble (hand-drawn line tremble) via two simplex noise fields,
// 2. pencil grain that only darkens the already-dark areas,
// 3. paper texture multiply — sampled on the UNDISTORTED uv, after the
//    wobble, so the paper itself never trembles.
// uTime is a constant seed (static wobble — the app renders on demand, no
// animation loop); kept as a uniform so a "boil" could be added later by
// just ticking it.
const SketchShader = {
  name: "SketchShader",

  uniforms: {
    tDiffuse: { value: null },
    tPaper: { value: null },
    uResolution: { value: new Vector2(1, 1) },
    uWobbleAmp: { value: 0.0015 },
    uWobbleFreq: { value: 40.0 },
    uGrainScale: { value: 300.0 },
    uGrainStrength: { value: 0.15 },
    uPaperStrength: { value: 0.35 },
    uTime: { value: 0.0 },
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tPaper;
    uniform vec2 uResolution;
    uniform float uWobbleAmp;
    uniform float uWobbleFreq;
    uniform float uGrainScale;
    uniform float uGrainStrength;
    uniform float uPaperStrength;
    uniform float uTime;
    varying vec2 vUv;

    ${simplexNoiseGlsl}

    void main() {
      // Aspect-corrected coords so the wobble/grain are isotropic on screen.
      float aspect = uResolution.x / max(uResolution.y, 1.0);
      vec2 p = vec2(vUv.x * aspect, vUv.y);

      // (1) hand-tremble: two independent noise fields offset the sample uv.
      vec2 wobble = uWobbleAmp * vec2(
        snoise(p * uWobbleFreq + vec2(uTime * 13.7, 0.0)),
        snoise(p * uWobbleFreq + vec2(7.3, uTime * 11.1))
      );
      vec4 color = texture2D(tDiffuse, vUv + wobble);

      // (2) pencil grain: dark areas receive grain, highlights stay clean.
      float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      float grain = snoise(p * uGrainScale + vec2(uTime * 3.1, uTime * 5.7));
      color.rgb -= uGrainStrength * grain * (1.0 - lum);

      // (3) paper multiply on the undistorted uv (paper must not tremble).
      vec3 paper = texture2D(tPaper, vUv).rgb;
      color.rgb = mix(color.rgb, color.rgb * paper, uPaperStrength);

      gl_FragColor = vec4(color.rgb, 1.0);
    }
  `,
};

export default SketchShader;
