import useCreatePortfolioPage from "./useCreatePortfolioPage";
import usePortfolioPageFrame from "Features/portfolios/hooks/usePortfolioPageFrame";

import getPageLayout from "Features/portfolioEditor/utils/getPageLayout";
import getPageDimensions from "Features/portfolioEditor/utils/getPageDimensions";
import fitContainerToBaseMap from "Features/portfolioEditor/utils/fitContainerToBaseMap";
import { resolvePrintZone } from "Features/baseMaps/utils/printZone";

import db from "App/db/db";

// Creates one BASE_MAPS_PAGE holding the given baseMap: the page is created
// with the baseMap name as title, then the auto-created container is filled
// with the baseMap.
// - Print zone (« Zone d'impression », resolved to a default sheet when
//   none is stored): the page takes the zone's
//   format / orientation and the container is the FULL page with the zone
//   rect as viewBox — 1 zone px = 1 / pagePxPerPt pt, so a 1:N scale and the
//   page-pt text sizes are exact; the cartouche / title bar draw over it.
// - No image size at all: fitted to the content area with a full-image
//   viewBox, mirroring PortfolioPageSvg.handleSelectBaseMap.
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
    const zone = baseMap
      ? resolvePrintZone({
          printZone: baseMap.printZone,
          createdFrom: baseMap.createdFrom,
          imageSize,
        })
      : null;
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

    if (zone) {
      const dims = getPageDimensions(zone.format, zone.orientation);
      await db.portfolioBaseMapContainers.update(container.id, {
        baseMapId,
        x: 0,
        y: 0,
        width: dims.width,
        height: dims.height,
        viewBox: {
          x: zone.x,
          y: zone.y,
          width: zone.width,
          height: zone.height,
        },
      });
    } else if (imageSize) {
      const contentArea = getPageLayout(
        page.format ?? "A3",
        page.orientation ?? "landscape",
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
