import { GradientEquirectTexture } from "three-gpu-pathtracer";

// Soft white studio environment shared by the live realistic modes and the
// photoreal export. GradientEquirectTexture is a plain equirect DataTexture
// (EquirectangularReflectionMapping), so the SAME texture works both as the
// raster `scene.environment` (three converts equirect → cubeUV internally)
// and as the path tracer's environment — keeping the two renders consistent.
export default function buildWhiteEnvironment() {
  const env = new GradientEquirectTexture(16);
  env.topColor.set(0xffffff);
  env.bottomColor.set(0xc0c0c0);
  env.update();
  return env;
}
