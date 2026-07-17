import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  MathUtils,
  Points,
  ShaderMaterial,
  Vector2,
  Vector3,
} from "three";

// Ephemeral concrete jet of the meshing "shoot" sub-mode and the walk mode.
// Two firing APIs share one CPU-side rAF simulation loop (the editor has no
// continuous render loop):
// - fire({origin, target}): a 1s burst (meshing lance click);
// - startStream(getAim) / stopStream(): continuous emission while a key is
//   held (walk mode Space). `getAim` is re-read every frame so the stream
//   follows the live camera aim; on stop, emission ceases immediately and
//   the in-flight droplets finish their run.
// Everything is disposed when the last burst/stream ends.
//
// `options` tunes the jet per consumer (walk mode wants a tighter, straighter
// jet than the meshing lance); defaults keep the historical look.
// `particleCount` is both the burst total and the stream rate (droplets/s).

const EMIT_MS = 1000;
const FADE_MS = 150;
const PARKED_Y = -9999; // off-scene parking spot for unspawned/dead particles
const MAX_FLIGHT_S = 0.6;

const DEFAULT_OPTIONS = {
  particleCount: 350,
  gravityY: -6, // softened gravity, stylized arc
  spreadDeg: 6, // spray cone half-angle
  particleSize: 0.07,
  // Droplet size along the flight: needle-thin at the nozzle, blooming
  // toward the impact. Both default to particleSize (constant size).
  particleSizeStart: null,
  particleSizeEnd: null,
  crossingTimeS: 0.4, // time to cross the gap regardless of range
  color: 0x8d8d8d, // concrete grey
  opacity: 0.95,
};

// Points shader with a PER-PARTICLE size attribute (PointsMaterial only
// supports one global size): aSize is world meters, attenuated with depth
// exactly like PointsMaterial's sizeAttenuation (uScale = half the drawing
// buffer height in px).
const VERTEX_SHADER = `
  attribute float aSize;
  uniform float uScale;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform sampler2D uMap;
  void main() {
    vec4 sprite = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(uColor, uOpacity) * sprite;
  }
`;

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
  const sizeStart = opts.particleSizeStart ?? opts.particleSize;
  const sizeEnd = opts.particleSizeEnd ?? opts.particleSize;
  const sizeGrows = sizeStart !== sizeEnd;
  const dropletTexture = makeDropletTexture();
  const group = new Group();
  group.name = "ShootSpray";
  sceneManager.scene.add(group);

  const bursts = [];
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
    const up =
      Math.abs(dir.y) > 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
    const perpA = new Vector3().crossVectors(dir, up).normalize();
    const perpB = new Vector3().crossVectors(dir, perpA).normalize();
    return { dir, dist, baseSpeed, perpA, perpB };
  }

  // Random velocity inside the spread cone + matching flight time.
  function fillVelocity(velocities, flightTimes, i, frame) {
    const i3 = i * 3;
    const speed = frame.baseSpeed * (0.85 + 0.3 * Math.random());
    const spread = spreadTan * speed;
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * spread;
    velocities[i3] =
      frame.dir.x * speed +
      frame.perpA.x * Math.cos(angle) * radius +
      frame.perpB.x * Math.sin(angle) * radius;
    velocities[i3 + 1] =
      frame.dir.y * speed +
      frame.perpA.y * Math.cos(angle) * radius +
      frame.perpB.y * Math.sin(angle) * radius;
    velocities[i3 + 2] =
      frame.dir.z * speed +
      frame.perpA.z * Math.cos(angle) * radius +
      frame.perpB.z * Math.sin(angle) * radius;
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
    // half the drawing buffer height (px). Read once per burst/stream — a
    // resize mid-life is negligible.
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
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
    });

    const points = new Points(geometry, material);
    // Positions churn every frame — skip bounding-sphere culling logic.
    points.frustumCulled = false;
    return { positions, sizes, geometry, material, points };
  }

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
      const { positions, velocities, spawnTimes, flightTimes, sizes, origin } =
        burst;
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
          if (sizeGrows) {
            // Needle-thin at the nozzle, blooming toward the impact.
            sizes[i] = sizeStart + (sizeEnd - sizeStart) * (t / flightTimes[i]);
          }
        }
      }
      burst.points.geometry.attributes.position.needsUpdate = true;
      if (sizeGrows) burst.points.geometry.attributes.aSize.needsUpdate = true;

      const sinceEmitEnd = now - (burst.t0 + EMIT_MS);
      if (sinceEmitEnd > 0) {
        // Emission over: quick opacity fade, then remove + dispose.
        if (sinceEmitEnd >= FADE_MS) removeBurst(burst);
        else
          burst.points.material.uniforms.uOpacity.value =
            opts.opacity * (1 - sinceEmitEnd / FADE_MS);
      }
    }

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
            s.nextEmitAt += interval;
          }
          if (s.nextEmitAt <= now) s.nextEmitAt = now; // budget hit: drop late ones
        } else {
          s.nextEmitAt = now; // nothing to aim at this frame, don't backlog
        }
      }

      // Integrate — like bursts, but each droplet flies from its own origin.
      let anyAlive = false;
      for (let i = 0; i < s.capacity; i++) {
        const t = (now - s.spawnTimes[i]) / 1000;
        const i3 = i * 3;
        if (t < 0 || t > s.flightTimes[i]) {
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
    if (bursts.length || stream) rafId = requestAnimationFrame(tick);
  }

  function fire({ origin, target }) {
    if (disposed) return;
    const t0 = performance.now();

    const frame = computeAimFrame(origin, target);
    const velocities = new Float32Array(opts.particleCount * 3);
    const spawnTimes = new Float32Array(opts.particleCount);
    const flightTimes = new Float32Array(opts.particleCount);

    for (let i = 0; i < opts.particleCount; i++) {
      fillVelocity(velocities, flightTimes, i, frame);
      // Staggered emission: a continuous jet, not a shotgun blast.
      spawnTimes[i] = t0 + (i / opts.particleCount) * EMIT_MS;
    }

    const { positions, sizes, points } = makeSprayGeometryAndMaterial(
      opts.particleCount
    );
    group.add(points);

    bursts.push({
      t0,
      points,
      positions,
      velocities,
      spawnTimes,
      flightTimes,
      sizes,
      origin: origin.clone(),
    });

    if (rafId == null) rafId = requestAnimationFrame(tick);
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
    [...bursts].forEach(removeBurst);
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

  return { fire, startStream, stopStream, dispose };
}
