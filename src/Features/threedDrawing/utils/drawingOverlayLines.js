import { Vector2 } from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";

// Fat-line helpers of the 3D drawing overlays (DrawingOverlayThreed,
// FaceCutAxisOverlayThreed): Line2 / LineSegments2 with a screen-space pixel
// thickness, always drawn on top.

export function disposeObject(obj) {
  if (!obj) return;
  obj.traverse?.((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((m) => m.dispose?.());
    } else {
      child.material?.dispose?.();
    }
  });
}

export function getCanvasResolution(editor) {
  const dom = editor?.sceneManager?.renderer?.domElement;
  if (!dom) return new Vector2(1, 1);
  return new Vector2(dom.clientWidth, dom.clientHeight);
}

// Dash length (world metres) of a preview line seen from `distance` metres:
// 5 cm up close, growing with the distance so the dashes stay readable when
// drawing at the scale of a site (e.g. on a scan base map) — a fixed 5 cm
// dash is sub-pixel there and the line fades out.
export function getDashSize(distance) {
  return Math.max(0.05, (distance || 0) * 0.008);
}

export function makeLineMaterial({
  color,
  linewidth,
  dashed,
  resolution,
  dashSize = 0.05,
}) {
  return new LineMaterial({
    color,
    linewidth,
    resolution,
    dashed: !!dashed,
    dashSize,
    gapSize: dashSize,
    worldUnits: false,
    transparent: true,
    depthTest: false,
  });
}

export function buildConnectedPolyline(points, mat) {
  if (!points?.length || points.length < 2) return null;
  const flat = [];
  for (const p of points) flat.push(p.x, p.y, p.z);
  const geom = new LineGeometry();
  geom.setPositions(flat);
  const line = new Line2(geom, mat);
  line.computeLineDistances();
  return line;
}

export function buildSegments(segments, mat) {
  if (!segments?.length) return null;
  const flat = [];
  for (const seg of segments) {
    flat.push(seg.a.x, seg.a.y, seg.a.z, seg.b.x, seg.b.y, seg.b.z);
  }
  const geom = new LineSegmentsGeometry();
  geom.setPositions(flat);
  const line = new LineSegments2(geom, mat);
  line.computeLineDistances();
  return line;
}
