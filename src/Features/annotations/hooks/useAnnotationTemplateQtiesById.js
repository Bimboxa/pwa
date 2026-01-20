import { useMemo } from "react";
import { useSelector } from "react-redux";

import useAnnotationTemplates from "./useAnnotationTemplates";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useAnnotationsV2 from "./useAnnotationsV2";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import getAnnotationTemplateMainQtyLabel from "Features/annotations/utils/getAnnotationTemplateMainQtyLabel";

// Assurez-vous que le chemin est correct vers votre nouveau fichier utilitaire
import getAnnotationQties from "Features/annotations/utils/getAnnotationQties";

export default function useAnnotationTemplateQtiesById() {
  // --- DATA ---
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const annotations = useAnnotationsV2({ filterByProjectId: projectId });
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
      const templateId = annotation?.annotationTemplateId;
      if (!templateId) return acc;

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

      // 4. Calcul des Quantités via la fonction utilitaire
      // Cette fonction gère désormais : POLYGON, POLYLINE, STRIP (avec récursion), Cuts et HiddenSegments
      const qty = getAnnotationQties({ annotation, meterByPx });

      if (qty && qty.enabled) {
        if (Number.isFinite(qty.length)) {
          stats.length += qty.length;
        }
        if (Number.isFinite(qty.surface)) {
          stats.surface += qty.surface;
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
  }, [annotations, baseMapById, annotationTemplateById]);
}