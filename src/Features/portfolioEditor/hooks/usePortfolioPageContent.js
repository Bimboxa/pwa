import { useLiveQuery } from "dexie-react-hooks";

import usePortfolioBaseMapContainers from "Features/portfolioBaseMapContainers/hooks/usePortfolioBaseMapContainers";

import db from "App/db/db";

export default function usePortfolioPageContent(pageId) {
  const { value: containers } = usePortfolioBaseMapContainers({
    filterByPageId: pageId,
  });

  const baseMapIds = (containers || [])
    .map((c) => c.baseMapId)
    .filter(Boolean);

  const baseMaps = useLiveQuery(async () => {
    if (!baseMapIds.length) return [];
    const records = await db.baseMaps.bulkGet(baseMapIds);
    return records.filter(Boolean);
  }, [baseMapIds.join(",")]);

  const baseMapById = new Map((baseMaps || []).map((bm) => [bm.id, bm]));

  const content = (containers || []).map((c) => {
    const bm = baseMapById.get(c.baseMapId);
    return {
      id: c.id,
      type: "BASE_MAP_CONTAINER",
      sortIndex: c.sortIndex,
      label: bm?.name ?? "Empty container",
    };
  });

  return content;
}
