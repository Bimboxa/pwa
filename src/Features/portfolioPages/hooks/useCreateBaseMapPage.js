import useCreatePortfolioPage from "./useCreatePortfolioPage";
import usePortfolioPageFrame from "Features/portfolios/hooks/usePortfolioPageFrame";

import getPageLayout from "Features/portfolioEditor/utils/getPageLayout";
import fitContainerToBaseMap from "Features/portfolioEditor/utils/fitContainerToBaseMap";

import db from "App/db/db";

// Creates one BASE_MAPS_PAGE holding the given baseMap: the page is created
// with the baseMap name as title, then the auto-created container is filled
// with the baseMap fitted to the content area (full-image viewBox), mirroring
// PortfolioPageSvg.handleSelectBaseMap.
export default function useCreateBaseMapPage() {
  const createPage = useCreatePortfolioPage();
  const pageFrame = usePortfolioPageFrame();

  const create = async ({ listing, projectId, baseMapId, afterSortIndex }) => {
    const baseMap = await db.baseMaps.get(baseMapId);
    const page = await createPage({
      listing,
      projectId,
      title: baseMap?.name || "Plan",
      afterSortIndex,
    });

    const container = await db.portfolioBaseMapContainers
      .where("portfolioPageId")
      .equals(page.id)
      .first();
    if (!container) return page;

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

    return page;
  };

  return create;
}
