import getStripePolygons from "Features/geometry/utils/getStripePolygons";

/**
 * --- HELPERS GÉOMÉTRIQUES ---
 */

const getDistance = (p1, p2) => {
  if (!p1 || !p2) return 0;
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
};

function getPointToLineDistance(p, a, b) {
  try {
    const numerator = Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y));
    const denominator = Math.hypot(b.x - a.x, b.y - a.y);
    return denominator === 0 ? 0 : numerator / denominator;
  } catch (e) {
    return 0;
  }
}

function circleFromThreePoints(p0, p1, p2) {
  try {
    const x1 = p0.x, y1 = p0.y;
    const x2 = p1.x, y2 = p1.y;
    const x3 = p2.x, y3 = p2.y;
    const d = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
    if (Math.abs(d) < 1e-9) return null;
    const ux = (x1 * x1 + y1 * y1) * (y2 - y3) + (x2 * x2 + y2 * y2) * (y3 - y1) + (x3 * x3 + y3 * y3) * (y1 - y2);
    const uy = (x1 * x1 + y1 * y1) * (x3 - x2) + (x2 * x2 + y2 * y2) * (x1 - x3) + (x3 * x3 + y3 * y3) * (x2 - x1);
    return { x: ux / d, y: uy / d, r: Math.hypot(x1 - (ux / d), y1 - (uy / d)) };
  } catch (e) {
    return null;
  }
}

function getArcMetrics(p0, p1, p2) {
  try {
    const sagitta = getPointToLineDistance(p1, p0, p2);
    const chordLength = getDistance(p0, p2);

    if (sagitta < chordLength * 0.001 || chordLength < 1e-9) {
      return { length: getDistance(p0, p1) + getDistance(p1, p2), chordArea: 0, isFlat: true };
    }

    const circ = circleFromThreePoints(p0, p1, p2);
    if (!circ || !Number.isFinite(circ.r)) {
      return { length: getDistance(p0, p1) + getDistance(p1, p2), chordArea: 0, isFlat: true };
    }

    const { x: cx, y: cy, r } = circ;
    const a0 = Math.atan2(p0.y - cy, p0.x - cx);
    const a1 = Math.atan2(p1.y - cy, p1.x - cx);
    const a2 = Math.atan2(p2.y - cy, p2.x - cx);

    const normalize = (a) => {
      while (a <= -Math.PI) a += 2 * Math.PI;
      while (a > Math.PI) a -= 2 * Math.PI;
      return a;
    };

    const totalTheta = Math.abs(normalize(a1 - a0)) + Math.abs(normalize(a2 - a1));
    const arcLength = r * totalTheta;
    const chordArea = 0.5 * r * r * (totalTheta - Math.sin(totalTheta));

    const cross = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
    return { length: arcLength, chordArea: cross > 0 ? chordArea : -chordArea, isFlat: false };
  } catch (e) {
    return { length: getDistance(p0, p1) + getDistance(p1, p2), chordArea: 0, isFlat: true };
  }
}

/**
 * --- FONCTION PRINCIPALE ---
 */

export default function getAnnotationQties({ annotation, meterByPx }) {
  try {
    if (!annotation) return null;
    if (!meterByPx || !Number.isFinite(meterByPx) || meterByPx <= 0) return { enabled: false };

    if (annotation.type === "STRIP") {
      const polygons = getStripePolygons(annotation, meterByPx);
      return polygons.reduce((acc, polygon) => {
        const qty = getAnnotationQties({ annotation: { ...polygon, type: "POLYGON" }, meterByPx });
        acc.length += qty.length;
        acc.surface += qty.surface;
        return acc;
      }, { enabled: true, length: 0, surface: 0 });
    }

    const points = (annotation.points || []).filter(p => p && typeof p.x === "number");
    if (points.length < 2) return null;

    const closeLine = annotation.type === "POLYGON" || annotation.closeLine || false;
    const hiddenSegments = annotation.hiddenSegmentsIdx || [];

    const calculatePathMetrics = (pts, isClosed) => {
      try {
        let lengthPx = 0;
        let areaPx = 0;
        const n = pts.length;
        const limit = isClosed ? n : n - 1;

        let i = 0;
        // Sécurité contre boucle infinie : max d'itérations
        let iterations = 0;
        const MAX_ITER = n * 2;

        while (i < limit && iterations < MAX_ITER) {
          iterations++;
          const i0 = i % n;
          const i1 = (i + 1) % n;
          const i2 = (i + 2) % n;

          const p0 = pts[i0];
          const p1 = pts[i1];
          const p2 = pts[i2];

          if (!p0 || !p1) { i++; continue; }

          // Vérification SCS avec sécurité sur l'existence de p2
          const isArc = (p0.type !== "circle") &&
            (p1.type === "circle") &&
            (isClosed || i + 2 < n) &&
            (p2 && p2.type !== "circle");

          if (isArc) {
            const metrics = getArcMetrics(p0, p1, p2);
            if (metrics.isFlat) {
              if (!hiddenSegments.includes(i0)) lengthPx += getDistance(p0, p1);
              if (!hiddenSegments.includes(i1)) lengthPx += getDistance(p1, p2);
              if (isClosed) {
                areaPx += (p0.x * p1.y - p1.x * p0.y);
                areaPx += (p1.x * p2.y - p2.x * p1.y);
              }
            } else {
              if (!hiddenSegments.includes(i0) && !hiddenSegments.includes(i1)) {
                lengthPx += metrics.length;
              }
              if (isClosed) {
                areaPx += (p0.x * p2.y - p2.x * p0.y);
                areaPx += metrics.chordArea * 2;
              }
            }
            i += 2;
          } else {
            if (!hiddenSegments.includes(i0)) {
              lengthPx += getDistance(p0, p1);
            }
            if (isClosed) {
              areaPx += (p0.x * p1.y - p1.x * p0.y);
            }
            i += 1;
          }
        }
        return { lengthPx, areaPx: Math.abs(areaPx) / 2 };
      } catch (e) {
        console.log("error", e)
      }
    };

    const mainMetrics = calculatePathMetrics(points, closeLine);
    let totalSurfacePx = mainMetrics.areaPx;

    if (closeLine && Array.isArray(annotation.cuts)) {
      annotation.cuts.forEach(cut => {
        const cutPoints = (cut.points || []).filter(p => p && typeof p.x === "number");
        if (cutPoints.length >= 3) {
          const cutMetrics = calculatePathMetrics(cutPoints, true);
          totalSurfacePx -= cutMetrics.areaPx;
        }
      });
    }

    if (annotation.type === "POLYLINE" && annotation.height) {
      totalSurfacePx = mainMetrics.lengthPx * (parseFloat(annotation.height) / meterByPx);
    }

    return {
      enabled: true,
      length: mainMetrics.lengthPx * meterByPx,
      surface: Math.max(0, totalSurfacePx) * (meterByPx * meterByPx)
    };

  } catch (globalError) {
    console.error("Critical error in getAnnotationQties:", globalError);
    return { enabled: false, error: true };
  }
}