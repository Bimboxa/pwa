import getStripePolygons from "Features/geometry/utils/getStripePolygons";

// Helper pour calculer la distance entre deux points
const getDistance = (p1, p2) => Math.hypot(p2.x - p1.x, p2.y - p1.y);

// Helper pour calculer la surface d'un contour (Shoelace formula)
const getPolygonArea = (points) => {
  if (!points || points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
};

export default function getAnnotationQties({ annotation, meterByPx }) {

  // edge case

  if (!annotation) return null;

  if (!meterByPx) return { enabled: false };

  // stripe annotation => polyline annotation


  if (annotation.type === "STRIP") {
    const polygons = getStripePolygons(annotation, meterByPx);
    const qties = polygons.reduce((acc, polygon) => {
      const annotation = { ...polygon, type: "POLYGON" };
      const qty = getAnnotationQties({ annotation, meterByPx });
      acc.length += qty.length;
      acc.surface += qty.surface;
      return acc;
    }, { enabled: true, length: 0, surface: 0 });
    console.log("qties", qties);
    return qties;
  }

  // 1. Validation de base
  if (!Array.isArray(annotation.points)) {
    return { enabled: true, count: 1 };
  }

  if (!Number.isFinite(meterByPx) || meterByPx <= 0) {
    return { enabled: false };
  }

  // 2. Validation des points (doivent avoir x, y)
  const points = annotation.points.filter(
    (point) =>
      point && typeof point.x === "number" && typeof point.y === "number"
  );

  if (points.length < 2) {
    return null;
  }

  // 3. Déterminer si la forme est fermée
  const closeLine =
    annotation.type === "POLYGON" ||
    annotation.closeLine ||
    annotation?.polyline?.closeLine ||
    annotation?.annotationTemplate?.closeLine ||
    false;

  // --- CALCUL LONGUEUR (Intégrant hiddenSegmentsIdx) ---
  let lengthPx = 0;
  const hiddenSegments = annotation.hiddenSegmentsIdx || [];

  for (let i = 0; i < points.length; i++) {
    // Si on n'est pas en mode fermé, on s'arrête avant le dernier point
    if (!closeLine && i === points.length - 1) break;

    // Si le segment est masqué, on ne le compte pas
    if (hiddenSegments.includes(i)) {
      continue;
    }

    const p1 = points[i];
    const p2 = points[(i + 1) % points.length]; // Boucle si closeLine

    lengthPx += getDistance(p1, p2);
  }

  // --- CALCUL SURFACE (Intégrant Cuts) ---
  let surfacePx = 0;

  if (closeLine && points.length >= 3) {
    // 1. Surface du contour principal
    surfacePx = getPolygonArea(points);

    // 2. Soustraire la surface des trous (Cuts)
    const cuts = annotation.cuts || [];
    if (Array.isArray(cuts)) {
      cuts.forEach(cut => {
        if (cut.points && cut.points.length >= 3) {
          // On filtre aussi les points du cut pour être sûr
          const cutPoints = cut.points.filter(p => p && typeof p.x === "number" && typeof p.y === "number");
          if (cutPoints.length >= 3) {
            const cutArea = getPolygonArea(cutPoints);
            surfacePx -= cutArea;
          }
        }
      });
    }

    surfacePx = Math.max(0, surfacePx);
  }

  // --- CONVERSION EN UNITÉS RÉELLES (Mètres) ---
  const length = lengthPx * meterByPx;
  // Surface = pixel² * (m/pixel)²
  const surface = surfacePx * (meterByPx * meterByPx);

  return { enabled: true, length, surface };
}