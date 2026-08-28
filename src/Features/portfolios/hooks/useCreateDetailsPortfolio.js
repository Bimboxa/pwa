import useCreatePortfolio from "./useCreatePortfolio";
import useCreatePortfolioPage from "Features/portfolioPages/hooks/useCreatePortfolioPage";
import usePortfolioPageFrame from "./usePortfolioPageFrame";

import getPageLayout from "Features/portfolioEditor/utils/getPageLayout";
import fitContainerToBaseMap from "Features/portfolioEditor/utils/fitContainerToBaseMap";

import db from "App/db/db";

import { resolveDetailResource } from "Features/baseMaps/services/detailBaseMapUtils";

// Creates a "carnet de détails": one plan page per baseMap holding the
// selected DETAIL annotations, then one FOLIO_PAGE per referenced detail
// baseMap (annotation.detailBaseMapId, deduplicated). The page keeps a
// folio-shaped object ({resourceId, pageNumber, rotation, thumbnail}) built
// from the detail baseMap's createdFrom, so the folio page renderer and the
// vector PDF export are unchanged.
export default function useCreateDetailsPortfolio() {
  const createPortfolio = useCreatePortfolio();
  const createPage = useCreatePortfolioPage();
  const pageFrame = usePortfolioPageFrame();

  const create = async ({ scopeId, projectId, title, details, metadata }) => {
    const portfolio = await createPortfolio({
      scopeId,
      projectId,
      title,
      metadata,
    });

    let afterSortIndex = null;

    // 1. plan pages: one per baseMap holding selected details
    const baseMapIds = [
      ...new Set(details.map((d) => d.baseMapId).filter(Boolean)),
    ];

    for (const baseMapId of baseMapIds) {
      const baseMap = await db.baseMaps.get(baseMapId);
      const page = await createPage({
        listing: portfolio,
        projectId,
        title: baseMap?.name || "Plan",
        afterSortIndex,
      });
      afterSortIndex = page.sortIndex;

      // fill the auto-created container with the baseMap (mirrors
      // PortfolioPageSvg.handleSelectBaseMap)
      const container = await db.portfolioBaseMapContainers
        .where("portfolioPageId")
        .equals(page.id)
        .first();
      if (!container) continue;

      const imageSize = baseMap?.image?.imageSize;
      if (imageSize) {
        const contentArea = getPageLayout(
          "A3",
          "landscape",
          0,
          undefined,
          pageFrame
        ).contentArea;
        const fitted = fitContainerToBaseMap(imageSize, contentArea);
        await db.portfolioBaseMapContainers.update(container.id, {
          baseMapId,
          ...fitted,
          viewBox: {
            x: 0,
            y: 0,
            width: imageSize.width,
            height: imageSize.height,
          },
        });
      } else {
        await db.portfolioBaseMapContainers.update(container.id, {
          baseMapId,
        });
      }
    }

    // 2. folio pages: one per referenced detail baseMap, deduplicated
    const foliosByKey = new Map(); // detailBaseMapId -> {folio, details}
    for (const detail of details) {
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
