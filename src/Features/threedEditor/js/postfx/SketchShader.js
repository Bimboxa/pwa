import { Vector2 } from "three";

import simplexNoiseGlsl from "./simplexNoiseGlsl";

// Full-screen "watercolor sketch" pass for the AQUARELLE render mode:
// 1. UV wobble (hand-drawn line tremble) via two simplex noise fields,
// 2. low-frequency uneven-wash ("lavis") modulation on the color areas,
// 3. pencil grain (darken-only) confined to the dark areas,
// 4. paper texture multiply — sampled on the UNDISTORTED uv, after the
//    wobble, so the paper itself never trembles.
// Runs AFTER the OutputPass (see SketchPostFxManager), so tDiffuse is in
// display sRGB — the luminance weighting relies on that.
// uTime is a constant seed (static wobble — the app renders on demand, no
// animation loop); kept as a uniform so a "boil" could be added later by
// just ticking it.
const SketchShader = {
  name: "SketchShader",

  uniforms: {
    tDiffuse: { value: null },
    tPaper: { value: null },
    uResolution: { value: new Vector2(1, 1) },
    // Screen-space wobble is OFF: the ink lines must stay perfectly straight
    // (the hand-drawn waviness lives in the pencil line GEOMETRY instead, see
    // aquarelleMaterials.jitterSegments). Kept as a uniform for tuning.
    uWobbleAmp: { value: 0.0 },
    uWobbleFreq: { value: 30.0 },
    uGrainScale: { value: 220.0 },
    uGrainStrength: { value: 0.08 },
    uPaperStrength: { value: 0.35 },
    // Low-frequency "lavis" modulation: uneven pigment density across the
    // wash, the way a real watercolor never dries perfectly flat.
    uWashFreq: { value: 5.0 },
    uWashStrength: { value: 0.05 },
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
    uniform float uWashFreq;
    uniform float uWashStrength;
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

      // (2) uneven wash: low-frequency ±few % pigment density on the color
      // areas only (weighted by 1-lum so the paper background stays flat).
      float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      float wash = snoise(p * uWashFreq + vec2(3.7, 1.3));
      color.rgb *= 1.0 + uWashStrength * wash * (1.0 - lum);

      // (3) pencil grain: darken-only (a signed grain reads as salt-and-pepper
      // pointillism) and confined to the truly dark areas via the squared
      // weight — pale washes and the paper stay clean.
      float grain = snoise(p * uGrainScale + vec2(uTime * 3.1, uTime * 5.7));
      float shadow = (1.0 - lum) * (1.0 - lum);
      color.rgb -= uGrainStrength * max(grain, 0.0) * shadow;

      // (4) paper multiply on the undistorted uv (paper must not tremble).
      vec3 paper = texture2D(tPaper, vUv).rgb;
      color.rgb = mix(color.rgb, color.rgb * paper, uPaperStrength);

      gl_FragColor = vec4(color.rgb, 1.0);
    }
  `,
};

export default SketchShader;
