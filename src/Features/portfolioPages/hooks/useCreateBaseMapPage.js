import useCreatePortfolioPage from "./useCreatePortfolioPage";
import usePortfolioPageFrame from "Features/portfolios/hooks/usePortfolioPageFrame";

import getPageLayout from "Features/portfolioEditor/utils/getPageLayout";
import getBaseMapContainerDefaultLayout from "Features/portfolioEditor/utils/getBaseMapContainerDefaultLayout";
import { getBaseMapRecordPrintZone } from "Features/baseMaps/utils/printZone";

import db from "App/db/db";

// Creates one BASE_MAPS_PAGE holding the given baseMap: the page is created
// with the baseMap name as title, then the auto-created container is filled
// with the baseMap following getBaseMapContainerDefaultLayout (print zone =
// full page with the zone as viewBox, else fitted to the content area), the
// same rule as PortfolioPageSvg.handleSelectBaseMap.
export default function useCreateBaseMapPage() {
  const createPage = useCreatePortfolioPage();
  const pageFrame = usePortfolioPageFrame();

  const create = async ({ listing, projectId, baseMapId, afterSortIndex }) => {
    const baseMap = await db.baseMaps.get(baseMapId);
    // Reference frame (annotations + print zone) first, legacy image size
    // otherwise.
    const imageSize =
      baseMap?.refWidth > 0 && baseMap?.refHeight > 0
        ? { width: baseMap.refWidth, height: baseMap.refHeight }
        : baseMap?.image?.imageSize;
    const zone = getBaseMapRecordPrintZone(baseMap);
    const page = await createPage({
      listing,
      projectId,
      title: baseMap?.name || "Plan",
      afterSortIndex,
      ...(zone && { format: zone.format, orientation: zone.orientation }),
    });

    const container = await db.portfolioBaseMapContainers
      .where("portfolioPageId")
      .equals(page.id)
      .first();
    if (!container) return page;

    const contentArea = getPageLayout(
      page.format ?? "A3",
      page.orientation ?? "landscape",
      0,
      undefined,
      pageFrame
    ).contentArea;
    const layout = getBaseMapContainerDefaultLayout({
      printZone: zone,
      imageSize,
      contentArea,
    });
    await db.portfolioBaseMapContainers.update(container.id, {
      baseMapId,
      ...(layout && {
        x: layout.x,
        y: layout.y,
        width: layout.width,
        height: layout.height,
        viewBox: layout.viewBox,
      }),
    });

    return page;
  };

  return create;
}
