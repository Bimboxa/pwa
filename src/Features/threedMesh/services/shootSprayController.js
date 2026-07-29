import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  MathUtils,
  Points,
  ShaderMaterial,
  Vector2,
  Vector3,
} from "three";

import { getOrCreateSplatLayer } from "./shootSplatsLayer";
import {
  SPRAY_VERTEX_SHADER,
  SPRAY_FRAGMENT_SHADER,
  PARKED_Y,
  makeDropletTexture,
} from "./sprayRendering";

// Ephemeral resin jet of the walk mode (Space held): startStream(getAim)
// emits droplets continuously — `getAim` is re-read every frame so the
// stream follows the live camera aim — and stopStream() ceases emission
// immediately, letting the in-flight droplets finish their run. Simulated
// CPU-side in a private rAF loop (the editor has no continuous render
// loop); everything is disposed when the stream ends.
//
// `options` tunes the jet; `particleCount` is the stream rate (droplets/s).
// The nozzle is live-tunable while streaming: cycleJetMode() switches the
// shape (JET_MODES) and scaleSpread() the aperture — see getJetState().

const MAX_FLIGHT_S = 0.6;

// Nozzle shapes, in the order the B key cycles through them: isotropic cone,
// flat fan spread along the camera-right axis, flat fan in the vertical
// plane of the aim.
export const JET_MODES = ["CONE", "FLAT_H", "FLAT_V"];
const SPREAD_MIN_DEG = 0.3; // half-angle clamp (P/M tuning)
const SPREAD_MAX_DEG = 25; // half-angle clamp -> 50 deg full aperture
const FLAT_THICKNESS = 0.1; // flat-jet ribbon thickness, fraction of fan half-width
const SPLAT_SCALE_MAX = 3; // coverage-compensation cap for landed splats

const DEFAULT_OPTIONS = {
  particleCount: 350,
  gravityY: -6, // softened gravity, stylized arc
  spreadDeg: 6, // initial nozzle half-angle, runtime-mutable via scaleSpread
  jetMode: "CONE", // initial nozzle shape, runtime-mutable via cycleJetMode
  particleSize: 0.07,
  // Droplet size along the flight: needle-thin at the nozzle, blooming
  // toward the impact. Both default to particleSize (constant size).
  particleSizeStart: null,
  particleSizeEnd: null,
  crossingTimeS: 0.4, // time to cross the gap regardless of range
  color: 0x8d8d8d, // concrete grey
  opacity: 0.95,
  // Stream droplets landing on a real face leave a permanent (in-memory)
  // dot in the scene's splat layer — spray-paint traces on the walls.
  leaveSplats: false,
  splatSize: null, // default: particleSizeEnd
  // Pull each dot slightly back toward the shooter (along the droplet's
  // flight direction) so the screen-facing sprite doesn't z-fight with, or
  // sink into, the face it landed on.
  splatOffsetM: 0.03,
};

export function createShootSprayController({ editor, sceneManager, options }) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Live nozzle state (B / P / M in walk mode): shape + half-angle, mutable
  // while a stream runs — read at emission time, so in-flight droplets keep
  // their velocities and the jet morphs from the nozzle out.
  const baseSpreadDeg = opts.spreadDeg; // splat-scale reference
  let jetMode = opts.jetMode;
  let spreadDeg = opts.spreadDeg;
  let spreadTan = Math.tan(MathUtils.degToRad(spreadDeg));
  let splatSizeScale = 1;

  function recomputeDerived() {
    spreadTan = Math.tan(MathUtils.degToRad(spreadDeg));
    // Constant droplet rate over a growing footprint thins the paint: grow
    // the landed dots to keep coverage readable (footprint area ~ angle^2
    // for the cone, ~ angle for a fan), capped so they stay dot-like. The
    // rate itself must NOT change: the ring capacity is frozen at
    // startStream.
    const ratio = spreadDeg / baseSpreadDeg;
    splatSizeScale = MathUtils.clamp(
      jetMode === "CONE" ? ratio : Math.sqrt(ratio),
      1,
      SPLAT_SCALE_MAX
    );
  }

  const sizeStart = opts.particleSizeStart ?? opts.particleSize;
  const sizeEnd = opts.particleSizeEnd ?? opts.particleSize;
  const sizeGrows = sizeStart !== sizeEnd;
  const splatLayer = opts.leaveSplats
    ? getOrCreateSplatLayer(sceneManager, { color: opts.color })
    : null;
  const splatSize = opts.splatSize ?? sizeEnd;
  const dropletTexture = makeDropletTexture();
  const group = new Group();
  group.name = "ShootSpray";
  sceneManager.scene.add(group);

  // Continuous stream (walk mode Space): a ring buffer of droplets emitted
  // at opts.particleCount per second from the live aim. Single stream at a
  // time — startStream while running just swaps the aim callback.
  let stream = null;
  let rafId = null;
  let disposed = false;

  // Direction frame of a shot: normalized dir, spread perpendiculars and
  // speed to cross the gap in ~crossingTimeS.
  function computeAimFrame(origin, target) {
    const dir = new Vector3().subVectors(target, origin);
    const dist = Math.max(dir.length(), 0.1);
    dir.normalize();
    const baseSpeed = MathUtils.clamp(dist / opts.crossingTimeS, 8, 40);
    // Basis anchored on the camera, not on world up: perpA is the
    // camera-right axis projected off dir (exactly horizontal in walk mode,
    // which has zero roll and a ±89° pitch clamp), so the flat-horizontal
    // fan stays screen-left/right even when spraying the floor at the
    // player's feet, with no discontinuity when the aim sweeps down a wall.
    // dir deviates from camera-forward only by the muzzle offset, so the
    // projection never collapses.
    const perpA = new Vector3().setFromMatrixColumn(
      sceneManager.camera.matrixWorld,
      0
    );
    perpA.addScaledVector(dir, -perpA.dot(dir)).normalize();
    const perpB = new Vector3().crossVectors(dir, perpA).normalize();
    return { dir, dist, baseSpeed, perpA, perpB };
  }

  // Random velocity inside the nozzle aperture + matching flight time: disc
  // scatter for the cone, a thin ribbon along one basis axis for the flat
  // fans. Max deviation from the aim axis is spreadDeg in every mode.
  function fillVelocity(velocities, flightTimes, i, frame) {
    const i3 = i * 3;
    const speed = frame.baseSpeed * (0.85 + 0.3 * Math.random());
    const spread = spreadTan * speed;
    let a; // offset along perpA (camera-right)
    let b; // offset along perpB (vertical plane of the aim)
    if (jetMode === "CONE") {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * spread;
      a = Math.cos(angle) * radius;
      b = Math.sin(angle) * radius;
    } else {
      const main = (2 * Math.random() - 1) * spread;
      const thick = (2 * Math.random() - 1) * spread * FLAT_THICKNESS;
      if (jetMode === "FLAT_H") {
        a = main;
        b = thick;
      } else {
        a = thick;
        b = main;
      }
    }
    velocities[i3] =
      frame.dir.x * speed + frame.perpA.x * a + frame.perpB.x * b;
    velocities[i3 + 1] =
      frame.dir.y * speed + frame.perpA.y * a + frame.perpB.y * b;
    velocities[i3 + 2] =
      frame.dir.z * speed + frame.perpA.z * a + frame.perpB.z * b;
    flightTimes[i] = Math.min(frame.dist / speed, MAX_FLIGHT_S);
  }

  function makeSprayGeometryAndMaterial(count) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) positions[i * 3 + 1] = PARKED_Y;
    const sizes = new Float32Array(count);
    sizes.fill(sizeStart);

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));

    // Same depth attenuation as PointsMaterial's sizeAttenuation: uScale is
    // half the drawing buffer height (px). Read once per stream — a resize
    // mid-life is negligible.
    const bufferSize = sceneManager.renderer.getDrawingBufferSize(
      new Vector2()
    );
    const material = new ShaderMaterial({
      uniforms: {
        uMap: { value: dropletTexture },
        uColor: { value: new Color(opts.color) },
        uOpacity: { value: opts.opacity },
        uScale: { value: bufferSize.y * 0.5 },
      },
      vertexShader: SPRAY_VERTEX_SHADER,
      fragmentShader: SPRAY_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
    });

    const points = new Points(geometry, material);
    // Positions churn every frame — skip bounding-sphere culling logic.
    points.frustumCulled = false;
    return { positions, sizes, geometry, material, points };
  }

  function tick() {
    rafId = null;
    if (disposed) return;
    const now = performance.now();

    if (stream) {
      const s = stream;

      // Emit the droplets due since the last frame, all along the CURRENT
      // aim (the stream follows the camera while the key is held).
      if (!s.stopping) {
        if (s.nextEmitAt == null) s.nextEmitAt = now;
        const interval = 1000 / opts.particleCount;
        const aim = s.getAim?.();
        if (aim) {
          const frame = computeAimFrame(aim.origin, aim.target);
          // Cap per-frame emission so a long tab-switch gap can't burst.
          let budget = Math.ceil(opts.particleCount / 10);
          while (s.nextEmitAt <= now && budget-- > 0) {
            const i = s.cursor;
            s.cursor = (s.cursor + 1) % s.capacity;
            const i3 = i * 3;
            s.origins[i3] = aim.origin.x;
            s.origins[i3 + 1] = aim.origin.y;
            s.origins[i3 + 2] = aim.origin.z;
            fillVelocity(s.velocities, s.flightTimes, i, frame);
            s.spawnTimes[i] = s.nextEmitAt;
            // Droplets aimed at the void (ray fallback target) must not
            // paint a floating dot in mid-air.
            s.eligible[i] = aim.targetIsSurface === false ? 0 : 1;
            s.landed[i] = 0;
            s.nextEmitAt += interval;
          }
          if (s.nextEmitAt <= now) s.nextEmitAt = now; // budget hit: drop late ones
        } else {
          s.nextEmitAt = now; // nothing to aim at this frame, don't backlog
        }
      }

      // Integrate — each droplet flies from its own (per-emission) origin.
      let anyAlive = false;
      for (let i = 0; i < s.capacity; i++) {
        const t = (now - s.spawnTimes[i]) / 1000;
        const i3 = i * 3;
        if (t < 0 || t > s.flightTimes[i]) {
          // First frame past the flight end: the droplet just landed —
          // stamp a permanent dot on the splat layer at its end position.
          if (t > s.flightTimes[i] && !s.landed[i]) {
            s.landed[i] = 1;
            if (splatLayer && s.eligible[i]) {
              const T = s.flightTimes[i];
              const vx = s.velocities[i3];
              const vy = s.velocities[i3 + 1];
              const vz = s.velocities[i3 + 2];
              const vLen = Math.hypot(vx, vy, vz) || 1;
              const back = opts.splatOffsetM / vLen;
              splatLayer.addSplat(
                s.origins[i3] + vx * T - vx * back,
                s.origins[i3 + 1] +
                  vy * T +
                  0.5 * opts.gravityY * T * T -
                  vy * back,
                s.origins[i3 + 2] + vz * T - vz * back,
                splatSize * splatSizeScale * (0.75 + 0.5 * Math.random())
              );
            }
          }
          s.positions[i3] = 0;
          s.positions[i3 + 1] = PARKED_Y;
          s.positions[i3 + 2] = 0;
        } else {
          anyAlive = true;
          s.positions[i3] = s.origins[i3] + s.velocities[i3] * t;
          s.positions[i3 + 1] =
            s.origins[i3 + 1] +
            s.velocities[i3 + 1] * t +
            0.5 * opts.gravityY * t * t;
          s.positions[i3 + 2] = s.origins[i3 + 2] + s.velocities[i3 + 2] * t;
          if (sizeGrows) {
            s.sizes[i] =
              sizeStart + (sizeEnd - sizeStart) * (t / s.flightTimes[i]);
          }
        }
      }
      s.points.geometry.attributes.position.needsUpdate = true;
      if (sizeGrows) s.points.geometry.attributes.aSize.needsUpdate = true;

      // Key released and every in-flight droplet landed: clean up.
      if (s.stopping && !anyAlive) {
        group.remove(s.points);
        s.points.geometry.dispose();
        s.points.material.dispose();
        stream = null;
      }
    }

    editor.renderScene?.();
    if (stream) rafId = requestAnimationFrame(tick);
  }

  // Continuous jet while a key is held. `getAim` returns the live
  // {origin, target} (or null to pause emission); it is re-read every frame.
  function startStream(getAim) {
    if (disposed) return;
    if (stream) {
      // Already streaming (e.g. re-press before the tail landed): keep the
      // ring, just resume emission with the fresh aim callback.
      stream.getAim = getAim;
      stream.stopping = false;
      return;
    }
    // Ring sized to hold every droplet alive at once at the emission rate.
    const capacity = Math.ceil(opts.particleCount * (MAX_FLIGHT_S + 0.15));
    const { positions, sizes, points } = makeSprayGeometryAndMaterial(capacity);
    group.add(points);
    const spawnTimes = new Float32Array(capacity);
    spawnTimes.fill(Number.POSITIVE_INFINITY); // never spawned yet
    stream = {
      points,
      positions,
      sizes,
      velocities: new Float32Array(capacity * 3),
      origins: new Float32Array(capacity * 3),
      spawnTimes,
      flightTimes: new Float32Array(capacity),
      // Per-droplet splat bookkeeping: eligible = aimed at a real face,
      // landed = end-of-flight already stamped.
      eligible: new Uint8Array(capacity),
      landed: new Uint8Array(capacity),
      capacity,
      cursor: 0,
      nextEmitAt: null,
      getAim,
      stopping: false,
    };
    if (rafId == null) rafId = requestAnimationFrame(tick);
  }

  function stopStream() {
    // Emission stops now; the tick keeps running until the in-flight
    // droplets land, then disposes the ring.
    if (stream) stream.stopping = true;
  }

  function dispose() {
    disposed = true;
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (stream) {
      group.remove(stream.points);
      stream.points.geometry.dispose();
      stream.points.material.dispose();
      stream = null;
    }
    sceneManager.scene.remove(group);
    dropletTexture.dispose();
    editor.renderScene?.();
  }

  // ----- nozzle tuning (B / P / M) -----------------------------------------

  function getJetState() {
    return { jetMode, spreadDeg };
  }

  function cycleJetMode() {
    jetMode = JET_MODES[(JET_MODES.indexOf(jetMode) + 1) % JET_MODES.length];
    recomputeDerived();
    return getJetState();
  }

  function scaleSpread(factor) {
    spreadDeg = MathUtils.clamp(
      spreadDeg * factor,
      SPREAD_MIN_DEG,
      SPREAD_MAX_DEG
    );
    recomputeDerived();
    return getJetState();
  }

  return {
    startStream,
    stopStream,
    dispose,
    getJetState,
    cycleJetMode,
    scaleSpread,
  };
}
