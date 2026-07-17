import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Group,
  MathUtils,
  Points,
  PointsMaterial,
  Vector3,
} from "three";

// Ephemeral concrete jet of the meshing "shoot" sub-mode and the walk mode.
// Each fire() spawns a 1s burst of grey particles from `origin` toward
// `target`; particles are simulated CPU-side in a private rAF loop (the
// editor has no continuous render loop) and everything is disposed when the
// burst ends. Overlapping bursts (click spam) share the same loop.
//
// `options` tunes the jet per consumer (walk mode wants a coarser, tighter,
// straighter jet than the meshing lance); defaults keep the historical look.

const EMIT_MS = 1000;
const FADE_MS = 150;
const PARKED_Y = -9999; // off-scene parking spot for unspawned/dead particles
const MAX_FLIGHT_S = 0.6;

const DEFAULT_OPTIONS = {
  particleCount: 350,
  gravityY: -6, // softened gravity, stylized arc
  spreadDeg: 6, // spray cone half-angle
  particleSize: 0.07,
  crossingTimeS: 0.4, // time to cross the gap regardless of range
  color: 0x8d8d8d, // concrete grey
  opacity: 0.95,
};

// Soft round droplet sprite (radial white gradient), so particles read as
// liquid droplets instead of the square PointsMaterial default. Tinted via
// the material color.
function makeDropletTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.45, "rgba(255,255,255,0.85)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new CanvasTexture(canvas);
}

export function createShootSprayController({ editor, sceneManager, options }) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const spreadTan = Math.tan(MathUtils.degToRad(opts.spreadDeg));
  const dropletTexture = makeDropletTexture();
  const group = new Group();
  group.name = "ShootSpray";
  sceneManager.scene.add(group);

  const bursts = [];
  let rafId = null;
  let disposed = false;

  function removeBurst(burst) {
    group.remove(burst.points);
    burst.points.geometry.dispose();
    burst.points.material.dispose();
    const index = bursts.indexOf(burst);
    if (index !== -1) bursts.splice(index, 1);
  }

  function tick() {
    rafId = null;
    if (disposed) return;
    const now = performance.now();

    for (const burst of [...bursts]) {
      const { positions, velocities, spawnTimes, flightTimes, origin } = burst;
      for (let i = 0; i < opts.particleCount; i++) {
        const t = (now - spawnTimes[i]) / 1000;
        const i3 = i * 3;
        if (t < 0 || t > flightTimes[i]) {
          // Not yet emitted, or reached the wall: parked (ephemeral, no splat).
          positions[i3] = 0;
          positions[i3 + 1] = PARKED_Y;
          positions[i3 + 2] = 0;
        } else {
          positions[i3] = origin.x + velocities[i3] * t;
          positions[i3 + 1] =
            origin.y + velocities[i3 + 1] * t + 0.5 * opts.gravityY * t * t;
          positions[i3 + 2] = origin.z + velocities[i3 + 2] * t;
        }
      }
      burst.points.geometry.attributes.position.needsUpdate = true;

      const sinceEmitEnd = now - (burst.t0 + EMIT_MS);
      if (sinceEmitEnd > 0) {
        // Emission over: quick opacity fade, then remove + dispose.
        if (sinceEmitEnd >= FADE_MS) removeBurst(burst);
        else
          burst.points.material.opacity =
            opts.opacity * (1 - sinceEmitEnd / FADE_MS);
      }
    }

    editor.renderScene?.();
    if (bursts.length) rafId = requestAnimationFrame(tick);
  }

  function fire({ origin, target }) {
    if (disposed) return;
    const t0 = performance.now();

    const dir = new Vector3().subVectors(target, origin);
    const dist = Math.max(dir.length(), 0.1);
    dir.normalize();
    const baseSpeed = MathUtils.clamp(dist / opts.crossingTimeS, 8, 40);

    // Two perpendiculars spanning the spread cone around dir.
    const up =
      Math.abs(dir.y) > 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
    const perpA = new Vector3().crossVectors(dir, up).normalize();
    const perpB = new Vector3().crossVectors(dir, perpA).normalize();

    const positions = new Float32Array(opts.particleCount * 3);
    const velocities = new Float32Array(opts.particleCount * 3);
    const spawnTimes = new Float32Array(opts.particleCount);
    const flightTimes = new Float32Array(opts.particleCount);

    for (let i = 0; i < opts.particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = 0;
      positions[i3 + 1] = PARKED_Y;
      positions[i3 + 2] = 0;

      const speed = baseSpeed * (0.85 + 0.3 * Math.random());
      const spread = spreadTan * speed;
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * spread;
      velocities[i3] =
        dir.x * speed +
        perpA.x * Math.cos(angle) * radius +
        perpB.x * Math.sin(angle) * radius;
      velocities[i3 + 1] =
        dir.y * speed +
        perpA.y * Math.cos(angle) * radius +
        perpB.y * Math.sin(angle) * radius;
      velocities[i3 + 2] =
        dir.z * speed +
        perpA.z * Math.cos(angle) * radius +
        perpB.z * Math.sin(angle) * radius;

      // Staggered emission: a continuous jet, not a shotgun blast.
      spawnTimes[i] = t0 + (i / opts.particleCount) * EMIT_MS;
      flightTimes[i] = Math.min(dist / speed, MAX_FLIGHT_S);
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));

    const material = new PointsMaterial({
      color: opts.color,
      map: dropletTexture,
      size: opts.particleSize,
      sizeAttenuation: true,
      transparent: true,
      opacity: opts.opacity,
      depthWrite: false,
    });

    const points = new Points(geometry, material);
    // Positions churn every frame — skip bounding-sphere culling logic.
    points.frustumCulled = false;
    group.add(points);

    bursts.push({
      t0,
      points,
      positions,
      velocities,
      spawnTimes,
      flightTimes,
      origin: origin.clone(),
    });

    if (rafId == null) rafId = requestAnimationFrame(tick);
  }

  function dispose() {
    disposed = true;
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    [...bursts].forEach(removeBurst);
    sceneManager.scene.remove(group);
    dropletTexture.dispose();
    editor.renderScene?.();
  }

  return { fire, dispose };
}
