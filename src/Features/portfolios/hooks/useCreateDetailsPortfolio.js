import useCreatePortfolio from "./useCreatePortfolio";
import useCreatePortfolioPage from "Features/portfolioPages/hooks/useCreatePortfolioPage";
import useCreateBaseMapPage from "Features/portfolioPages/hooks/useCreateBaseMapPage";

import db from "App/db/db";

import { resolveDetailResource } from "Features/baseMaps/services/detailBaseMapUtils";

// Creates a "carnet de détails": one plan page per selected baseMap (in the
// order received, i.e. the base map tree order), then one FOLIO_PAGE per
// referenced detail baseMap (annotation.detailBaseMapId, deduplicated) among
// the selected details drawn on those baseMaps. The page keeps a folio-shaped
// object ({resourceId, pageNumber, rotation, thumbnail}) built from the detail
// baseMap's createdFrom, so the folio page renderer and the vector PDF export
// are unchanged.
export default function useCreateDetailsPortfolio() {
  const createPortfolio = useCreatePortfolio();
  const createPage = useCreatePortfolioPage();
  const createBaseMapPage = useCreateBaseMapPage();

  const create = async ({
    scopeId,
    projectId,
    title,
    baseMapIds = [],
    details = [],
    metadata,
  }) => {
    const portfolio = await createPortfolio({
      scopeId,
      projectId,
      title,
      metadata,
    });

    let afterSortIndex = null;

    // 1. plan pages: one per selected baseMap, in order
    for (const baseMapId of baseMapIds) {
      const page = await createBaseMapPage({
        listing: portfolio,
        projectId,
        baseMapId,
        afterSortIndex,
      });
      afterSortIndex = page.sortIndex;
    }

    // 2. folio pages: one per referenced detail baseMap, deduplicated.
    // Only details drawn on a selected baseMap are kept (the dialog already
    // enforces this, defense in depth).
    const baseMapIdsSet = new Set(baseMapIds);
    const keptDetails = details.filter((d) => baseMapIdsSet.has(d.baseMapId));

    const foliosByKey = new Map(); // detailBaseMapId -> {folio, details}
    for (const detail of keptDetails) {
      if (!detail.detailBaseMapId) continue;
      const key = detail.detailBaseMapId;
      if (!foliosByKey.has(key)) {
        const record = await db.baseMaps.get(detail.detailBaseMapId);
        const createdFrom = record?.createdFrom;
        if (!createdFrom) continue;
        // resourceId may be stale after a resource re-import: resolve it.
        const resource = await resolveDetailResource({
          createdFrom,
          projectId: record.projectId,
        });
        foliosByKey.set(key, {
          folio: {
            type: "PDF_PAGE",
            resourceId: resource?.id ?? createdFrom.resourceId,
            pageNumber: createdFrom.pageNumber,
            rotation: createdFrom.rotation ?? 0,
            thumbnail: record.image?.thumbnail ?? null,
          },
          detailRef: record.detailRef ?? null,
          details: [],
        });
      }
      foliosByKey.get(key)?.details.push(detail);
    }

    for (const {
      folio,
      detailRef,
      details: folioDetails,
    } of foliosByKey.values()) {
      // The baseMap's detailRef is the displayed bubble reference; fall back
      // to the annotation labels (legacy / unset reference).
      const labels = [
        ...new Set(folioDetails.map((d) => d.label).filter(Boolean)),
      ];
      const pageTitle = detailRef
        ? `Détail ${detailRef}`
        : labels.length > 1
          ? `Détails ${labels.join(", ")}`
          : `Détail ${labels[0] || ""}`.trim();

      const page = await createPage({
        listing: portfolio,
        projectId,
        title: pageTitle,
        type: "FOLIO_PAGE",
        folio: { ...folio },
        sourceAnnotationId: folioDetails[0].id,
        afterSortIndex,
      });
      afterSortIndex = page.sortIndex;
    }

    return portfolio;
  };

  return create;
}
