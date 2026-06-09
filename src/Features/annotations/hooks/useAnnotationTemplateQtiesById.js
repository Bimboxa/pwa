import { useMemo } from "react";
import { useSelector } from "react-redux";

import useAnnotationTemplates from "./useAnnotationTemplates";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useAnnotationsV2 from "./useAnnotationsV2";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import getAnnotationTemplateMainQtyLabel from "Features/annotations/utils/getAnnotationTemplateMainQtyLabel";

// Assurez-vous que le chemin est correct vers votre nouveau fichier utilitaire
import getAnnotationQties from "Features/annotations/utils/getAnnotationQties";

export default function useAnnotationTemplateQtiesById({ filterByBaseMapId } = {}) {
  // --- DATA ---
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const annotations = useAnnotationsV2({ caller: "useAnnotationTemplateQtiesById", filterByProjectId: projectId, withQties: true });
  const annotationTemplates = useAnnotationTemplates();
  const { value: baseMaps } = useBaseMaps({ filterByProjectId: projectId }) ?? {};

  // --- HELPERS (Lookups) ---
  const baseMapById = useMemo(
    () => getItemsByKey(baseMaps ?? [], "id"),
    [baseMaps]
  );

  const annotationTemplateById = useMemo(
    () => getItemsByKey(annotationTemplates ?? [], "id"),
    [annotationTemplates]
  );

  // --- MAIN CALCULATION ---
  return useMemo(() => {
    if (!annotations) return {};

    const qtiesById = annotations.reduce((acc, annotation) => {
      if (filterByBaseMapId && annotation.baseMapId !== filterByBaseMapId) return acc;
      const templateId = annotation?.annotationTemplateId;
      if (!templateId) return acc;
      // Mesh cells are children already represented by their parent — skip.
      if (annotation?.isMeshCell) return acc;

      // 1. Initialisation de l'accumulateur pour ce template
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

      // 2. Incrément du nombre d'unités
      stats.count += 1;
      stats.unit = stats.count;

      // 3. Récupération du ratio Métrique/Pixel
      const baseMap = annotation.baseMapId ? baseMapById?.[annotation.baseMapId] : null;
      const meterByPx = baseMap?.getMeterByPx();

      // 4. Calcul des Quantités. Prefer the precomputed `annotation.qties`
      // (subtraction-aware, EXTRUSION_PROFILE-resolved) from useAnnotationsV2;
      // fall back to a direct computation otherwise.
      const qty = annotation.qties ?? getAnnotationQties({ annotation, meterByPx });

      if (qty && qty.enabled) {
        const length = qty.lengthDeveloped != null ? qty.lengthDeveloped : qty.length;
        const surface = qty.surfaceDeveloped != null ? qty.surfaceDeveloped : qty.surface;
        if (Number.isFinite(length)) {
          stats.length += length;
        }
        if (Number.isFinite(surface)) {
          stats.surface += surface;
        }
      }

      return acc;
    }, {});

    // --- FORMATTING LABELS ---
    Object.entries(qtiesById).forEach(([templateId, stats]) => {
      const template = annotationTemplateById?.[templateId];
      if (!template) {
        stats.mainQtyLabel = `${stats.unit ?? "-"} u`;
        return;
      }
      stats.mainQtyLabel = getAnnotationTemplateMainQtyLabel(template, stats);
    });

    return qtiesById;
  }, [annotations, baseMapById, annotationTemplateById, filterByBaseMapId]);
}