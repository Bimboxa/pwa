import {
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  EquirectangularReflectionMapping,
  FloatType,
  LinearFilter,
  RepeatWrapping,
  RGBAFormat,
} from "three";

const RESOLUTION = 16;
const TOP_COLOR = 0xffffff;
const BOTTOM_COLOR = 0xc0c0c0;
const EXPONENT = 2;

// Soft white studio environment shared by the live realistic modes.
// Hand-built vertical-gradient equirect DataTexture (formerly
// three-gpu-pathtracer's GradientEquirectTexture(16), replicated here so the
// REALISTIC look survives the removal of that dependency).
export default function buildWhiteEnvironment() {
  const width = RESOLUTION;
  const height = RESOLUTION;
  const data = new Float32Array(width * height * 4);

  const topColor = new Color(TOP_COLOR);
  const bottomColor = new Color(BOTTOM_COLOR);
  const color = new Color();

  for (let y = 0; y < height; y++) {
    // phi is the polar angle: 0 at the zenith (last row), PI at the nadir.
    const phi = (1.0 - y / height) * Math.PI;
    const directionY = Math.cos(phi);
    const t = (directionY * 0.5 + 0.5) ** EXPONENT;
    color.lerpColors(bottomColor, topColor, t);

    for (let x = 0; x < width; x++) {
      const i4 = 4 * (y * width + x);
      data[i4 + 0] = color.r;
      data[i4 + 1] = color.g;
      data[i4 + 2] = color.b;
      data[i4 + 3] = 1.0;
    }
  }

  const env = new DataTexture(
    data,
    width,
    height,
    RGBAFormat,
    FloatType,
    EquirectangularReflectionMapping,
    RepeatWrapping,
    ClampToEdgeWrapping,
    LinearFilter,
    LinearFilter
  );
  env.needsUpdate = true;
  return env;
}
