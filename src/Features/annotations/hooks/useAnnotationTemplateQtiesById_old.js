import { useMemo } from "react";
import { useSelector } from "react-redux";

import useAnnotations from "./useAnnotations";
import useAnnotationTemplates from "./useAnnotationTemplates";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import getPointsLength from "Features/geometry/utils/getPointsLength";
import getPointsSurface from "Features/geometry/utils/getPointsSurface";
import getAnnotationTemplateMainQtyLabel from "Features/annotations/utils/getAnnotationTemplateMainQtyLabel";
import useAnnotationsV2 from "./useAnnotationsV2";

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
      if (!annotation || !Array.isArray(annotation.points)) {
        return { length: 0, surface: 0 };
      }

      const validPoints = annotation.points.filter(
        (point) =>
          point && typeof point.x === "number" && typeof point.y === "number"
      );

      if (validPoints.length < 2) {
        return { length: 0, surface: 0 };
      }

      const baseMap = annotation.baseMapId
        ? baseMapById?.[annotation.baseMapId]
        : null;

      const imageSize =
        baseMap?.imageEnhanced?.imageSize ?? baseMap?.image?.imageSize;

      let points = validPoints;
      const hasRelativeCoords = validPoints.every(
        (p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1
      );

      if (hasRelativeCoords && imageSize?.width && imageSize?.height) {
        const { width, height } = imageSize;
        points = validPoints.map((p) => ({
          x: p.x * width,
          y: p.y * height,
        }));
      }

      const closeLine =
        annotation.type === "POLYGON" ||
        annotation.closeLine ||
        annotation?.polyline?.closeLine ||
        annotation?.annotationTemplate?.closeLine ||
        false;

      const lengthPx = getPointsLength(points, closeLine);
      let surfacePx = 0;

      if (points.length >= 3 && closeLine) {
        // Get cuts from annotation if available and convert their points to pixels if needed
        const cutsRaw = annotation.cuts || annotation?.polyline?.cuts || [];
        const cuts = cutsRaw.map((cut) => {
          if (!cut || !Array.isArray(cut.points)) return cut;

          // Convert cut points to pixels if needed (points are already converted above)
          // But cuts might still be in relative coordinates
          let cutPointsInPx = cut.points;
          const hasRelativeCoords = cut.points.every(
            (p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1
          );

          if (hasRelativeCoords && imageSize?.width && imageSize?.height) {
            cutPointsInPx = cut.points.map((p) => ({
              x: p.x * imageSize.width,
              y: p.y * imageSize.height,
            }));
          }

          return {
            ...cut,
            points: cutPointsInPx,
          };
        });

        surfacePx = getPointsSurface(points, closeLine, cuts);
      }

      const meterByPx = baseMap?.getMeterByPx();
      let length = lengthPx;
      let surface = surfacePx;

      if (meterByPx && Number.isFinite(meterByPx) && meterByPx > 0) {
        length = lengthPx * meterByPx;
        surface = surfacePx * meterByPx * meterByPx;
      }

      return { length, surface };
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
        const { length, surface } = computePolylineMetrics(annotation);

        stats.length += length;

        if (template?.type === "POLYLINE" && template?.closeLine || annotation?.type === "POLYGON") {
          stats.surface += surface;
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
