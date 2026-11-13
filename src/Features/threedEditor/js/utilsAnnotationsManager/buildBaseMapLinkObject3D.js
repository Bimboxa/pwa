import {
  CanvasTexture,
  Group,
  LinearFilter,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
} from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

import { getAnnotationOwnLabel } from "Features/annotations/utils/getAnnotationLabelDisplay";
import sizeSpriteInCssPx from "Features/threedAnnotationLabels/services/sizeSpriteInCssPx";

import { BASE_MAP_LINK_CLONE_LABEL } from "Features/baseMapLinks/utils/baseMapLinkCloneLabel";

import pixelToWorld from "./pixelToWorld";
import attachFatLineRaycast, {
  PICK_ANGULAR,
  PICK_MIN_M,
} from "./attachFatLineRaycast";

// 3D twin of NodeBaseMapLinkStatic: the BASE_MAP_LINK section mark ("trait de
// coupe"), on its base map plane.
//
// - the cut line: a thin screen-space fat line between the 2 stored points,
//   pickable (attachFatLineRaycast), snappable at both ends (isSnapLine) and
//   exported as a plain line (exportLine);
// - decorations, all SPRITES of a constant on-screen size (CSS px, like the
//   2D node — sizeSpriteInCssPx, perspective and orthographic cameras): a
//   perpendicular tick at each end, two view-direction arrows on the
//   OBSERVER side (screen-right of p1 → p2 in the y-down image frame) and
//   the label beyond each end. A billboard cannot lie in the plan: before
//   each render the ticks / arrows are turned to the ON-SCREEN direction of
//   the observer normal, and the labels are pushed along the on-screen
//   direction of the mark, beyond its ends.
//
// The sprites are tagged `isSectionMarkDecoration` (never exported, snapped
// on, drawn on, collided with or restyled) and `isSectionMarkSprite`
// (pickable: hovering / clicking one addresses the mark, like its line).
//
// Everything is built in basemap-LOCAL metres (x right, y up, z out of the
// plane) and parented to the base map group by the caller. The stored points
// are never offset: the coplanar image is beaten in depth with polygonOffset
// (line) or ignored (sprites, no depth test).

const DEFAULT_COLOR = "#9c27b0";
const LINEWIDTH_PX = 1;
// On-screen sizes (CSS px), same values as NodeBaseMapLinkStatic.
const TICK_LENGTH_PX = 16;
const TICK_THICKNESS_PX = 1.5;
const ARROW_PX = 10;
const ARROW_GAP_PX = 5;
const LABEL_HEIGHT_PX = 14;
const LABEL_GAP_PX = 6;
// Canvas resolution of the label text (px), downscaled on screen.
const LABEL_FONT_PX = 64;
const SPRITE_RENDER_ORDER = 1000;
// Picking radius around a sprite anchor, in fat-line tolerances (a sprite
// sits up to ~20 px away from its anchor).
const PICK_TOLERANCES = 2.5;

const textureCache = new Map();

function makeTexture(canvas) {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

// Shared textures (per colour): a plain bar, and a triangle whose TIP is on
// the left edge of the canvas (it points at -x, towards the line).
function getGlyphTexture(kind, color) {
  const key = `${kind}|${color}`;
  if (textureCache.has(key)) return textureCache.get(key);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (kind === "TICK") {
    canvas.width = 64;
    canvas.height = 8;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    canvas.width = 64;
    canvas.height = 64;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 32);
    ctx.lineTo(64, 6);
    ctx.lineTo(64, 58);
    ctx.closePath();
    ctx.fill();
  }
  const texture = makeTexture(canvas);
  textureCache.set(key, texture);
  return texture;
}

function makeLabelTexture(text, color) {
  const font = `400 ${LABEL_FONT_PX}px sans-serif`;
  const measureCtx = document.createElement("canvas").getContext("2d");
  measureCtx.font = font;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.ceil(measureCtx.measureText(text).width));
  canvas.height = Math.max(2, Math.ceil(LABEL_FONT_PX * 1.2));
  const ctx = canvas.getContext("2d");
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  return makeTexture(canvas);
}

const _anchor = new Vector3();
const _onRay = new Vector3();
const _p = new Vector3();
const _q = new Vector3();

// Hover / click picking of a decoration sprite: distance from the ray to the
// sprite anchor, within a distance-scaled tolerance (same model as the fat
// lines and the POINT sprites — three's own sprite raycast is quad-exact and
// throws when raycaster.camera is unset).
//
// A sprite is drawn AWAY from its anchor (a label sits beyond the end of the
// mark, an arrow beside the line): the pick targets the disc last rendered —
// `userData.pick = { center (world), radius (m) }`, refreshed before each
// render by updateSpritePick — and falls back on the anchor before the first
// render.
function attachSpriteRaycast(sprite) {
  sprite.raycast = function (raycaster, intersects) {
    const pick = this.userData.pick;
    if (pick) _anchor.copy(pick.center);
    else this.getWorldPosition(_anchor);
    const ray = raycaster.ray;
    ray.closestPointToPoint(_anchor, _onRay);
    const distance = ray.origin.distanceTo(_onRay);
    const tolerance = Math.max(PICK_MIN_M, PICK_ANGULAR * distance);
    const threshold = pick
      ? Math.max(pick.radius, tolerance)
      : PICK_TOLERANCES * tolerance;
    if (_onRay.distanceToSquared(_anchor) > threshold * threshold) return;
    intersects.push({ distance, point: _anchor.clone(), object: this });
  };
}

// World-space pick disc of a sprite drawn `offsetPx` (screen px, y up) away
// from its anchor, over `radiusPx`: the on-screen disc is unprojected at the
// anchor's depth.
function updateSpritePick(sprite, renderer, camera, offsetPx, radiusPx) {
  const dom = renderer?.domElement;
  const w = dom?.clientWidth;
  const h = dom?.clientHeight;
  if (!w || !h) return;
  sprite.getWorldPosition(_p).project(camera);
  if (!Number.isFinite(_p.x) || !Number.isFinite(_p.y)) return;
  const cx = _p.x + (2 * offsetPx.x) / w;
  const cy = _p.y + (2 * offsetPx.y) / h;
  const pick = (sprite.userData.pick ??= { center: new Vector3(), radius: 0 });
  pick.center.set(cx, cy, _p.z).unproject(camera);
  _q.set(cx + (2 * radiusPx) / w, cy, _p.z).unproject(camera);
  pick.radius = pick.center.distanceTo(_q);
}

// On-screen direction (unit, y up) of a LOCAL direction of the parent group
// at the sprite anchor, or null when it degenerates (seen end-on).
function getScreenDirection(sprite, direction, probeM, renderer, camera) {
  const parent = sprite.parent;
  const dom = renderer?.domElement;
  if (!parent || !dom) return null;
  _p.copy(sprite.position);
  _q.set(
    sprite.position.x + direction.x * probeM,
    sprite.position.y + direction.y * probeM,
    sprite.position.z
  );
  parent.localToWorld(_p).project(camera);
  parent.localToWorld(_q).project(camera);
  const dx = (_q.x - _p.x) * (dom.clientWidth || 1);
  const dy = (_q.y - _p.y) * (dom.clientHeight || 1);
  const norm = Math.hypot(dx, dy);
  if (!(norm > 1e-6) || !Number.isFinite(norm)) return null;
  return { x: dx / norm, y: dy / norm };
}

export default function buildBaseMapLinkObject3D({
  annotation,
  baseMap,
  verticalLift = 0,
  resolution,
}) {
  const p1 = annotation?.points?.[0];
  const p2 = annotation?.points?.[1];
  if (!p1 || !p2) return null;
  const a = pixelToWorld(p1, baseMap);
  const b = pixelToWorld(p2, baseMap);
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (!Number.isFinite(length) || length <= 0) return null;

  const z = verticalLift;
  const color = annotation.strokeColor || DEFAULT_COLOR;
  // Unit direction and observer normal, in the local frame (y up): the
  // screen-right of p1 → p2 in the y-down image frame.
  const u = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
  const n = { x: u.y, y: -u.x };
  // Probe step used to read an on-screen direction.
  const probeM = Math.max(length * 0.02, 0.01);

  const group = new Group();

  // --- cut line ---

  const positions = [a.x, a.y, z, b.x, b.y, z];
  const geom = new LineGeometry();
  geom.setPositions(positions);
  const line = new Line2(
    geom,
    new LineMaterial({
      color,
      linewidth: LINEWIDTH_PX,
      resolution,
      worldUnits: false, // screen-space px thickness
      transparent: true,
      depthTest: true,
      // Coplanar with the base map image: win the depth test without moving
      // the line off the stored points (snap parity with 2D).
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  line.computeLineDistances();
  attachFatLineRaycast(line, [
    new Vector3(a.x, a.y, z),
    new Vector3(b.x, b.y, z),
  ]);
  line.userData.exportLine = { positions };
  line.userData.isSnapLine = true;
  group.add(line);

  // --- decorations ---

  if (typeof document === "undefined") return group;

  // One material per sprite: its rotation is per sprite.
  const addSprite = ({
    texture,
    ownsTexture,
    at,
    cssHeight,
    aspect,
    orient,
    isNav = false,
  }) => {
    const material = new SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      sizeAttenuation: false,
      toneMapped: false,
    });
    const sprite = new Sprite(material);
    sprite.position.set(at.x, at.y, z);
    sprite.renderOrder = SPRITE_RENDER_ORDER;
    sprite.userData.isSectionMarkDecoration = true;
    sprite.userData.isSectionMarkSprite = true;
    // Label / arrows: a click opens the base map the mark leads to
    // (MainThreedEditor), the hover tooltip previews it.
    if (isNav) sprite.userData.isSectionMarkNav = true;
    // AnnotationsManager cleanup hook: the material is disposed by the
    // regular traverse, a label texture is owned by its sprite.
    if (ownsTexture) sprite.userData.dispose = () => texture.dispose();
    attachSpriteRaycast(sprite);
    sizeSpriteInCssPx(sprite, { cssHeight, aspect });
    const sizeHook = sprite.onBeforeRender;
    sprite.onBeforeRender = (renderer, scene, camera) => {
      sizeHook(renderer, scene, camera);
      // { x, y, radiusPx }: where the sprite is drawn from its anchor.
      const drawn = orient(sprite, renderer, camera);
      if (drawn) {
        updateSpritePick(sprite, renderer, camera, drawn, drawn.radiusPx);
      }
    };
    group.add(sprite);
    return sprite;
  };

  // end ticks: a bar along the on-screen observer normal
  const tickTexture = getGlyphTexture("TICK", color);
  [a, b].forEach((p) =>
    addSprite({
      texture: tickTexture,
      at: p,
      cssHeight: TICK_THICKNESS_PX,
      aspect: TICK_LENGTH_PX / TICK_THICKNESS_PX,
      orient: (sprite, renderer, camera) => {
        const dir = getScreenDirection(sprite, n, probeM, renderer, camera);
        if (dir) sprite.material.rotation = Math.atan2(dir.y, dir.x);
        return { x: 0, y: 0, radiusPx: TICK_LENGTH_PX / 2 };
      },
    })
  );

  // A clone (the mark located on its vertical base map) has no
  // view-direction arrow and no section name: « Vue en plan », once, at its
  // left end — a click on it goes back to the plan (2D parity).
  const isClone = Boolean(annotation.sourceLinkAnnotationId);

  // view-direction arrows: on the observer side, tip towards the line
  const arrowTexture = getGlyphTexture("ARROW", color);
  (isClone ? [] : [0.15, 0.85]).forEach((t) => {
    const sprite = addSprite({
      texture: arrowTexture,
      at: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
      cssHeight: ARROW_PX,
      isNav: true,
      aspect: 1,
      orient: (s, renderer, camera) => {
        const dir = getScreenDirection(s, n, probeM, renderer, camera);
        if (!dir) return null;
        s.material.rotation = Math.atan2(dir.y, dir.x);
        const offsetPx = ARROW_GAP_PX + ARROW_PX / 2;
        return {
          x: dir.x * offsetPx,
          y: dir.y * offsetPx,
          radiusPx: ARROW_PX,
        };
      },
    });
    // The quad starts ARROW_GAP_PX away from the anchor, along its own +x
    // (rotated with the sprite).
    sprite.center.set(-ARROW_GAP_PX / ARROW_PX, 0.5);
  });

  // labels beyond each end
  const label = isClone
    ? BASE_MAP_LINK_CLONE_LABEL
    : getAnnotationOwnLabel(annotation);
  if (label) {
    const ends = [
      { p: a, outward: { x: -u.x, y: -u.y } },
      { p: b, outward: u },
    ];
    // local x grows to the right of the elevation: its left end
    (isClone ? [a.x <= b.x ? ends[0] : ends[1]] : ends).forEach(
      ({ p, outward }) => {
        const texture = makeLabelTexture(String(label), color);
        const aspect = texture.image.width / texture.image.height;
        const widthPx = LABEL_HEIGHT_PX * aspect;
        addSprite({
          texture,
          ownsTexture: true,
          at: p,
          cssHeight: LABEL_HEIGHT_PX,
          isNav: true,
          aspect,
          // The text stays upright: the sprite is shifted (not turned) along
          // the on-screen outward direction, clear of the end tick.
          orient: (sprite, renderer, camera) => {
            const dir = getScreenDirection(
              sprite,
              outward,
              probeM,
              renderer,
              camera
            );
            if (!dir) return null;
            const offsetPx =
              LABEL_GAP_PX +
              TICK_THICKNESS_PX +
              (Math.abs(dir.x) * widthPx + Math.abs(dir.y) * LABEL_HEIGHT_PX) /
                2;
            sprite.center.set(
              0.5 - (dir.x * offsetPx) / widthPx,
              0.5 - (dir.y * offsetPx) / LABEL_HEIGHT_PX
            );
            return {
              x: dir.x * offsetPx,
              y: dir.y * offsetPx,
              radiusPx: Math.max(widthPx, LABEL_HEIGHT_PX) / 2 + 2,
            };
          },
        });
      }
    );
  }

  return group;
}
