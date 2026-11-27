import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";

import getPageDimensions from "../utils/getPageDimensions";
import { resolveLegendFormat } from "../utils/getDefaultLegendFormat";

// Legends (= containers showing a base map) of the other pages of the
// portfolio owning `page`, with their page.
export async function getOtherPagesLegendContainers(page) {
  if (!page?.listingId) return [];
  const pages = (
    await db.portfolioPages.where("listingId").equals(page.listingId).toArray()
  ).filter((p) => !p.deletedAt && p.id !== page.id && p.type !== "FOLIO_PAGE");
  if (!pages.length) return [];
  const pageById = new Map(pages.map((p) => [p.id, p]));
  const containers = await db.portfolioBaseMapContainers
    .where("portfolioPageId")
    .anyOf([...pageById.keys()])
    .toArray();
  return containers
    .filter((c) => !c.deletedAt && c.baseMapId)
    .map((container) => ({
      container,
      page: pageById.get(container.portfolioPageId),
    }));
}

// Page corner the legend is the closest to (legend center vs page center).
export function getLegendAnchorCorner(rect, pageDims) {
  return {
    isLeft: rect.x + rect.width / 2 < pageDims.width / 2,
    isTop: rect.y + rect.height / 2 < pageDims.height / 2,
  };
}

// Aligns the legends of the other pages on the source legend: the legend
// corner matching the page corner the source legend sits in (top-right
// legend => top-right corners aligned, ...) is put at the same distance
// from that page corner, so it also works across page formats. Each target
// keeps its own width / font / options.
//
// heightById: rendered legend heights (pt), measured in the DOM — heights
// are content-driven and not stored. A target without a measured height
// (legend not rendered) is skipped when a bottom corner is aligned.
//
// Returns the number of updated legends.
export default async function alignLegendsOnLegendService({
  container,
  page,
  pageFrame,
  heightById = {},
}) {
  if (!container || !page) return 0;

  const pageDims = getPageDimensions(page.format, page.orientation);
  const format = resolveLegendFormat(container, { pageDims, pageFrame });
  const height = heightById[container.id];
  const rect = {
    x: format.x,
    y: format.y,
    width: format.width,
    height: height ?? 0,
  };
  const { isLeft, isTop } = getLegendAnchorCorner(rect, pageDims);
  // without a measured source height only a top corner can be aligned
  const alignTop = isTop || height == null;

  const dx = isLeft ? rect.x : pageDims.width - (rect.x + rect.width);
  const dy = alignTop ? rect.y : pageDims.height - (rect.y + rect.height);

  const targets = await getOtherPagesLegendContainers(page);
  const updates = [];
  for (const { container: target, page: targetPage } of targets) {
    const targetDims = getPageDimensions(
      targetPage.format,
      targetPage.orientation
    );
    const targetFormat = resolveLegendFormat(target, {
      pageDims: targetDims,
      pageFrame,
    });
    const targetHeight = heightById[target.id];
    if (!alignTop && targetHeight == null) continue;

    const x = isLeft ? dx : targetDims.width - dx - targetFormat.width;
    const y = alignTop ? dy : targetDims.height - dy - targetHeight;
    updates.push({
      id: target.id,
      legendFormat: { ...targetFormat, x, y },
    });
  }
  if (!updates.length) return 0;

  // one transaction, one undo step
  await withUndoGroup(() =>
    db.transaction("rw", db.portfolioBaseMapContainers, async () => {
      for (const { id, legendFormat } of updates) {
        await db.portfolioBaseMapContainers.update(id, { legendFormat });
      }
    })
  );
  return updates.length;
}
