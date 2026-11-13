import {
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
} from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

import { getAnnotationOwnLabel } from "Features/annotations/utils/getAnnotationLabelDisplay";

import pixelToWorld from "./pixelToWorld";
import attachFatLineRaycast from "./attachFatLineRaycast";

// 3D twin of NodeBaseMapLinkStatic: the BASE_MAP_LINK section mark ("trait de
// coupe"), flat in its base map plane.
//
// - the cut line: a screen-space fat line between the 2 stored points,
//   pickable (attachFatLineRaycast), snappable at both ends (isSnapLine) and
//   exported as a plain line (exportLine);
// - decorations (`userData.isSectionMarkDecoration`: never exported, snapped
//   on, drawn on, collided with or restyled): a perpendicular tick at each
//   end, two view-direction triangles on the OBSERVER side (screen-right of
//   p1 → p2 in the y-down image frame) and the label beyond each end.
//
// The 2D node sizes its decorations in screen px; here they are sized in
// metres from the mark length, clamped.
//
// Everything is built in basemap-LOCAL metres (x right, y up, z out of the
// plane) and parented to the base map group by the caller. The stored points
// are never offset: the coplanar image is beaten in depth with polygonOffset.

const DEFAULT_COLOR = "#9c27b0";
const LINEWIDTH_PX = 2;
const GLYPH_RATIO = 0.04;
const GLYPH_MIN_M = 0.08;
const GLYPH_MAX_M = 0.5;
const LABEL_FONT_PX = 96;

function createLabelSprite(text, color) {
  const font = `600 ${LABEL_FONT_PX}px sans-serif`;
  const measureCtx = document.createElement("canvas").getContext("2d");
  measureCtx.font = font;
  const pad = LABEL_FONT_PX * 0.2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(
    2,
    Math.ceil(measureCtx.measureText(text).width + pad * 2)
  );
  canvas.height = Math.max(2, Math.ceil(LABEL_FONT_PX * 1.3));
  const ctx = canvas.getContext("2d");
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;

  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: true,
    toneMapped: false,
  });
  const sprite = new Sprite(material);
  // No picking: clicking the label must not select through the sprite quad.
  sprite.raycast = () => {};
  sprite.userData.isSectionMarkDecoration = true;
  // AnnotationsManager cleanup hook (the texture is not reachable otherwise).
  sprite.userData.dispose = () => texture.dispose();
  return { sprite, aspect: canvas.width / canvas.height };
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
  const ux = (b.x - a.x) / length;
  const uy = (b.y - a.y) / length;
  const nx = uy;
  const ny = -ux;
  const glyph = Math.min(
    GLYPH_MAX_M,
    Math.max(GLYPH_MIN_M, length * GLYPH_RATIO)
  );

  const group = new Group();

  const addLine = (positions, { decoration }) => {
    const geom = new LineGeometry();
    geom.setPositions(positions);
    const mat = new LineMaterial({
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
    });
    const line = new Line2(geom, mat);
    line.computeLineDistances();
    if (decoration) {
      line.raycast = () => {};
      line.userData.isSectionMarkDecoration = true;
    } else {
      attachFatLineRaycast(line, [
        new Vector3(positions[0], positions[1], positions[2]),
        new Vector3(positions[3], positions[4], positions[5]),
      ]);
      line.userData.exportLine = { positions };
      line.userData.isSnapLine = true;
    }
    group.add(line);
  };

  // cut line
  addLine([a.x, a.y, z, b.x, b.y, z], { decoration: false });

  // end ticks
  const tick = glyph * 0.7;
  [a, b].forEach((p) =>
    addLine(
      [
        p.x - nx * tick,
        p.y - ny * tick,
        z,
        p.x + nx * tick,
        p.y + ny * tick,
        z,
      ],
      { decoration: true }
    )
  );

  // view-direction triangles: tip towards the line, base on the observer side
  const gap = glyph * 0.5;
  const triangleVertices = [];
  [0.15, 0.85].forEach((t) => {
    const cx = a.x + (b.x - a.x) * t;
    const cy = a.y + (b.y - a.y) * t;
    const tipX = cx + nx * gap;
    const tipY = cy + ny * gap;
    const baseX = cx + nx * (gap + glyph * 1.4);
    const baseY = cy + ny * (gap + glyph * 1.4);
    triangleVertices.push(
      tipX,
      tipY,
      z,
      baseX + ux * glyph * 0.7,
      baseY + uy * glyph * 0.7,
      z,
      baseX - ux * glyph * 0.7,
      baseY - uy * glyph * 0.7,
      z
    );
  });
  const triangleGeom = new BufferGeometry();
  triangleGeom.setAttribute(
    "position",
    new Float32BufferAttribute(triangleVertices, 3)
  );
  const triangles = new Mesh(
    triangleGeom,
    new MeshBasicMaterial({
      color,
      side: DoubleSide,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  triangles.raycast = () => {};
  triangles.userData.isSectionMarkDecoration = true;
  group.add(triangles);

  // labels beyond each end (a clone shows its source's label)
  const label = annotation.sourceLinkLabel ?? getAnnotationOwnLabel(annotation);
  if (label && typeof document !== "undefined") {
    const labelHeight = glyph * 2;
    [
      { p: a, sign: -1 },
      { p: b, sign: 1 },
    ].forEach(({ p, sign }) => {
      const { sprite, aspect } = createLabelSprite(String(label), color);
      sprite.scale.set(labelHeight * aspect, labelHeight, 1);
      const offset = glyph * 1.2 + (labelHeight * aspect) / 2;
      sprite.position.set(
        p.x + sign * ux * offset,
        p.y + sign * uy * offset,
        z
      );
      group.add(sprite);
    });
  }

  return group;
}
