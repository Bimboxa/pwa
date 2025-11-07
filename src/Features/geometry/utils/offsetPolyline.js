import { Vector2 } from "three";

function centerPoint(point, P1, inverse = false) {
  if (inverse) {
    return { x: point.x + P1.x, y: point.y + P1.y };
  } else {
    return { x: point.x - P1.x, y: point.y - P1.y };
  }
}

function rotatePoint(point, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: cos * point.x + sin * point.y,
    y: -sin * point.x + cos * point.y,
  };
}

function mainToP1(point, P1, P0) {
  const centered = centerPoint(point, P1);
  const angle = angleP0P1(P0, P1);
  return rotatePoint(centered, angle);
}

function p1ToMain(point, P1, P0) {
  const angle = -angleP0P1(P0, P1);
  const rotated = rotatePoint(point, angle);
  return centerPoint(rotated, P1, true);
}

function angleP0P1(point0, point1) {
  const P0P1 = new Vector2(point1.x - point0.x, point1.y - point0.y);
  return P0P1.angle();
}

function exteriorCoordStart(P0, P1, width) {
  const p0 = mainToP1(P0, P1, P0);
  const p0Ext = { x: p0.x, y: p0.y + width };
  const coords = p1ToMain(p0Ext, P1, P0);
  return coords;
}

function exteriorCoordEnd(P0, P1, width) {
  const p1Ext = { x: 0, y: width };
  return p1ToMain(p1Ext, P1, P0);
}

function exteriorCoordMiddle(P0, P1, P2, width) {
  const p2 = mainToP1(P2, P1, P0);
  const angle = new Vector2(p2.x, p2.y).angle();
  const deltaX = -Math.tan(angle / 2) * width;
  const p1Ext = { x: deltaX, y: width };
  return p1ToMain(p1Ext, P1, P0);
}

/**
 * Offset (parallel) polyline by a signed `delta`.
 * - Positive = shift to the left of drawing direction.
 * - Works with open or closed paths.
 */
export default function offsetPolyline(path, width, { isClosed = false } = {}) {
  const n = path.length;
  if (n < 2) return [...path];

  let length = path.length;
  let exteriorPath = [];
  for (let i = 0; i < length; i++) {
    if (i === 0) {
      const Pend = path[length - 2];
      const P0 = path[i + 0];
      const P1 = path[i + 1];
      if (!isClosed) {
        exteriorPath.push(exteriorCoordStart(P0, P1, width));
      } else {
        exteriorPath.push(exteriorCoordMiddle(Pend, P0, P1, width));
      }
    } else if (i === length - 1) {
      const P0 = path[i - 1];
      const P1 = path[i];
      if (!isClosed) {
        exteriorPath.push(exteriorCoordEnd(P0, P1, width));
      } else {
        exteriorPath.push(exteriorPath[0]);
      }
    } else {
      const P0 = path[i - 1];
      const P1 = path[i];
      const P2 = path[i + 1];
      exteriorPath.push(exteriorCoordMiddle(P0, P1, P2, width));
    }
  }
  return exteriorPath;
}
