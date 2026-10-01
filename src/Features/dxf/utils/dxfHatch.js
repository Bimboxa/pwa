import {
  commonEntity,
  groupValue,
  groupPoint,
  readEntityGroups,
} from "./dxfEntityGroups.js";
import { polylinePoints, sampleArc } from "./dxfGeometry.js";

const TAU = Math.PI * 2;
const radians = (degrees) => (degrees * Math.PI) / 180;

function edgePoints(groups) {
  const type = groupValue(groups, 72);
  const center = groupPoint(groups, 10);
  if (type === 1) return [center, groupPoint(groups, 11)];
  if (type !== 2 && type !== 3)
    throw new Error("HATCH : contours spline non pris en charge");
  const start = radians(groupValue(groups, 50, 0)),
    end = radians(groupValue(groups, 51, 360));
  const ccw = groupValue(groups, 73, 1) !== 0;
  let sweep = (((end - start) % TAU) + TAU) % TAU;
  if (Math.abs(end - start) >= TAU - 1e-8) sweep = TAU;
  if (!ccw) sweep = sweep === TAU ? -TAU : sweep - TAU;
  if (type === 2)
    return sampleArc(center, groupValue(groups, 40, 0), start, sweep);
  const major = groupPoint(groups, 11),
    ratio = groupValue(groups, 40, 1);
  return sampleArc({ x: 0, y: 0 }, 1, start, sweep).map((p) => ({
    x: center.x + major.x * p.x - major.y * ratio * p.y,
    y: center.y + major.y * p.x + major.x * ratio * p.y,
  }));
}

function boundaryPoints(groups) {
  if (groupValue(groups, 92, 0) & 2) {
    const vertices = [];
    let point;
    for (const group of groups) {
      if (group.code === 97) break;
      if (group.code === 10) {
        point = { x: group.value, y: 0 };
        vertices.push(point);
      }
      if (group.code === 20 && point) point.y = group.value;
      if (group.code === 42 && point) point.bulge = group.value;
    }
    if (vertices.length !== groupValue(groups, 93, 0))
      throw new Error("HATCH : contour incomplet");
    return polylinePoints(vertices, true);
  }
  const edges = [];
  let edge;
  for (const group of groups) {
    if (group.code === 97 && groupValue(edge ?? [], 72) !== 4) break;
    if (group.code === 72) {
      edge = [];
      edges.push(edge);
    }
    if (edge) edge.push(group);
  }
  if (edges.length !== groupValue(groups, 93, 0))
    throw new Error("HATCH : contour incomplet");
  const segments = edges.map(edgePoints);
  // Boundary segments must connect. Never bridge a missing spline with a
  // made-up straight edge, which would produce a wrong measurable surface.
  const points = [];
  const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) <= 1e-5;
  for (let segment of segments) {
    if (points.length) {
      const last = points[points.length - 1];
      if (!near(last, segment[0]) && near(last, segment[segment.length - 1]))
        segment = [...segment].reverse();
      if (!near(last, segment[0]))
        throw new Error("HATCH : contour discontinu");
    }
    points.push(...(points.length ? segment.slice(1) : segment));
  }
  if (points.length && !near(points[0], points[points.length - 1]))
    throw new Error("HATCH : contour ouvert");
  if (points.length) points.pop();
  return points;
}

export class DxfHatchHandler {
  ForEntityName = "HATCH";
  parseEntity(scanner) {
    const groups = readEntityGroups(scanner);
    const boundaryStart = groups.findIndex((group) => group.code === 91);
    const header = boundaryStart < 0 ? groups : groups.slice(0, boundaryStart);
    const entity = {
      ...commonEntity(header, "HATCH"),
      patternName: groupValue(header, 2, ""),
      solid: groupValue(header, 70, 0) === 1,
    };
    try {
      if (boundaryStart < 0) throw new Error("HATCH : contours absents");
      const boundaryEnd = groups.findIndex(
        (group, i) => i > boundaryStart && group.code === 75
      );
      const paths = [];
      let path;
      for (const group of groups.slice(
        boundaryStart + 1,
        boundaryEnd < 0 ? undefined : boundaryEnd
      )) {
        if (group.code === 92) {
          path = [];
          paths.push(path);
        }
        if (path) path.push(group);
      }
      if (!paths.length || paths.length !== groups[boundaryStart].value)
        throw new Error("HATCH : contours incomplets");
      entity.rings = paths.map(boundaryPoints);
      if (
        entity.rings.some(
          (ring) =>
            ring.length < 3 ||
            ring.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
        )
      )
        throw new Error("HATCH : contour invalide");
      entity.hatchStyle = groupValue(
        groups.slice(boundaryEnd < 0 ? groups.length : boundaryEnd),
        75,
        0
      );
    } catch (error) {
      entity.hatchError = error.message;
    }
    return entity;
  }
}

function area(ring) {
  // Subtract the local origin to retain precision on georeferenced plans.
  const o = ring[0];
  return (
    Math.abs(
      ring.reduce((sum, p, i) => {
        const q = ring[(i + 1) % ring.length];
        return sum + (p.x - o.x) * (q.y - o.y) - (q.x - o.x) * (p.y - o.y);
      }, 0)
    ) / 2
  );
}

function contains(ring, point) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}

export function hatchPolygons(rings, style = 0) {
  const sorted = rings
    .map((points) => ({ points, area: area(points), parent: null, depth: 0 }))
    .sort((a, b) => b.area - a.area);
  sorted.forEach((ring, index) => {
    for (let i = index - 1; i >= 0; i--) {
      if (contains(sorted[i].points, ring.points[0])) {
        ring.parent = sorted[i];
        ring.depth = sorted[i].depth + 1;
        break;
      }
    }
  });
  return sorted
    .filter((ring) => (style === 0 ? ring.depth % 2 === 0 : ring.depth === 0))
    .map((ring) => ({
      points: ring.points,
      holes:
        style === 2
          ? []
          : sorted
              .filter((child) => child.parent === ring)
              .map((child) => child.points),
    }));
}
