import { useMemo } from "react";
import { useSelector } from "react-redux";

import useAnnotationTemplates from "./useAnnotationTemplates";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import getAnnotationTemplateMainQtyLabel from "Features/annotations/utils/getAnnotationTemplateMainQtyLabel";
import useAnnotationsV2 from "./useAnnotationsV2";

// Helper pour calculer la distance entre deux points
const getDistance = (p1, p2) => Math.hypot(p2.x - p1.x, p2.y - p1.y);

// Helper pour calculer la surface d'un contour (Shoelace formula)
// Fonctionne pour le contour principal et les trous
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

export default function useAnnotationTemplateQtiesById() {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const annotations = useAnnotationsV2({ filterByProjectId: projectId });
  const annotationTemplates = useAnnotationTemplates();
  const { value: baseMaps } =
    useBaseMaps({ filterByProjectId: projectId }) ?? {};

  // helpers

  const baseMapById = useMemo(
    () => getItemsByKey(baseMaps ?? [], "id"),
    [baseMaps]
  );

  const annotationTemplateById = useMemo(
    () => getItemsByKey(annotationTemplates ?? [], "id"),
    [annotationTemplates]
  );

  const computePolylineMetrics = useMemo(() => {
    return (annotation) => {
      // 1. Validation de base
      if (!annotation || !Array.isArray(annotation.points)) {
        return { length: 0, surface: 0 };
      }

      // Note: On suppose ici que les points sont DÉJÀ en pixels (pas de conversion imageSize)
      const points = annotation.points.filter(
        (point) =>
          point && typeof point.x === "number" && typeof point.y === "number"
      );

      if (points.length < 2) {
        return { length: 0, surface: 0 };
      }

      const baseMap = annotation.baseMapId
        ? baseMapById?.[annotation.baseMapId]
        : null;

      // Déterminer si la forme est fermée
      const closeLine =
        annotation.type === "POLYGON" ||
        annotation.closeLine ||
        //annotation?.polyline?.closeLine ||
        // annotation?.annotationTemplate?.closeLine ||
        false;

      // --- CALCUL LONGUEUR (Intégrant hiddenSegmentsIdx) ---
      let lengthPx = 0;
      const hiddenSegments = annotation.hiddenSegmentsIdx || [];

      for (let i = 0; i < points.length; i++) {
        // Si on n'est pas en mode fermé, on s'arrête avant le dernier point
        // car il n'y a pas de segment retour vers le début
        if (!closeLine && i === points.length - 1) break;

        // L'index du segment correspond à l'index du point de départ du segment
        // Segment 0 = P0 -> P1
        if (hiddenSegments.includes(i)) {
          continue; // On saute ce segment s'il est masqué
        }

        const p1 = points[i];
        const p2 = points[(i + 1) % points.length]; // Boucle sur le premier point si closeLine

        lengthPx += getDistance(p1, p2);
      }

      // --- CALCUL SURFACE (Intégrant Cuts) ---
      let surfacePx = 0;

      // On ne calcule la surface que si c'est fermé et qu'on a au moins 3 points
      if (closeLine && points.length >= 3) {
        // 1. Surface du contour principal
        surfacePx = getPolygonArea(points);

        // 2. Soustraire la surface des trous (Cuts)
        const cuts = annotation.cuts || [];
        if (Array.isArray(cuts)) {
          cuts.forEach(cut => {
            if (cut.points && cut.points.length >= 3) {
              // On suppose que cut.points est aussi déjà en pixels
              const cutArea = getPolygonArea(cut.points);
              surfacePx -= cutArea;
            }
          });
        }

        // Sécurité pour éviter les surfaces négatives (si erreur de dessin)
        surfacePx = Math.max(0, surfacePx);
      }

      // --- CONVERSION EN UNITÉS RÉELLES (Mètres) ---
      const meterByPx = baseMap?.getMeterByPx();
      let length;
      let surface;
      let enabled = false;

      const meterByPxIsValid = meterByPx && Number.isFinite(meterByPx) && meterByPx > 0;

      if (meterByPxIsValid) {
        length = lengthPx * meterByPx;
        // Surface = pixel² * (m/pixel)²
        surface = surfacePx * (meterByPx * meterByPx);
        enabled = true;
      }

      return { length, surface, enabled };
    };
  }, [baseMapById]);

  // main

  return useMemo(() => {
    if (!annotations) return {};

    const qtiesById = annotations.reduce((acc, annotation) => {
      const templateId = annotation?.annotationTemplateId;
      if (!templateId) return acc;

      if (!acc[templateId]) {
        acc[templateId] = {
          count: 0,
          length: 0,
          surface: 0,
          unit: 0,
          mainQtyLabel: "-",
        };
      }

      const stats = acc[templateId];

      stats.count += 1;
      stats.unit = stats.count;

      if (annotation?.type === "POLYLINE" || annotation?.type === "POLYGON") {
        const template = annotationTemplateById?.[templateId];

        // Appel de la nouvelle fonction de calcul
        const { length, surface, enabled } = computePolylineMetrics(annotation);

        if (enabled) stats.length += length;

        // On ajoute la surface si le template le demande ou si c'est explicitement un polygone
        if ((template?.type === "POLYLINE" && template?.closeLine) || annotation?.type === "POLYGON") {
          if (enabled) stats.surface += surface;
        }
      }

      return acc;
    }, {});

    Object.entries(qtiesById).forEach(([templateId, stats]) => {
      const template = annotationTemplateById?.[templateId];
      if (!template) {
        stats.mainQtyLabel = `${stats.unit ?? "-"} u`;
        return;
      }
      stats.mainQtyLabel = getAnnotationTemplateMainQtyLabel(template, stats);
    });

    return qtiesById;
  }, [annotations, computePolylineMetrics, annotationTemplateById]);
}