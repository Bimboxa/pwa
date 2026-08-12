import useCreatePortfolio from "./useCreatePortfolio";
import useCreatePortfolioPage from "Features/portfolioPages/hooks/useCreatePortfolioPage";

import getPageLayout from "Features/portfolioEditor/utils/getPageLayout";
import fitContainerToBaseMap from "Features/portfolioEditor/utils/fitContainerToBaseMap";

import db from "App/db/db";

// Creates a "carnet de détails": one plan page per baseMap holding the
// selected DETAIL annotations, then one FOLIO_PAGE per referenced folio
// (deduplicated by {resourceId, pageNumber}).
export default function useCreateDetailsPortfolio() {
  const createPortfolio = useCreatePortfolio();
  const createPage = useCreatePortfolioPage();

  const create = async ({ scopeId, projectId, title, details }) => {
    const portfolio = await createPortfolio({ scopeId, projectId, title });

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
        const contentArea = getPageLayout("A3", "landscape").contentArea;
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

    // 2. folio pages: one per referenced folio, deduplicated
    const foliosByKey = new Map(); // "resourceId:pageNumber" -> {folio, details}
    for (const detail of details) {
      if (!detail.folio?.resourceId) continue;
      const key = `${detail.folio.resourceId}:${detail.folio.pageNumber}`;
      if (!foliosByKey.has(key)) {
        foliosByKey.set(key, { folio: detail.folio, details: [] });
      }
      foliosByKey.get(key).details.push(detail);
    }

    for (const { folio, details: folioDetails } of foliosByKey.values()) {
      const labels = folioDetails.map((d) => d.label).filter(Boolean);
      const pageTitle =
        labels.length > 1
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
