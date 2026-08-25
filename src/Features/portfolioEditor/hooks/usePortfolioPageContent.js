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

  const povIds = (containers || []).map((c) => c.povId).filter(Boolean);

  const baseMaps = useLiveQuery(async () => {
    if (!baseMapIds.length) return [];
    const records = await db.baseMaps.bulkGet(baseMapIds);
    return records.filter(Boolean);
  }, [baseMapIds.join(",")]);

  const povs = useLiveQuery(async () => {
    if (!povIds.length) return [];
    const records = await db.povs.bulkGet(povIds);
    return records.filter(Boolean);
  }, [povIds.join(",")]);

  const baseMapById = new Map((baseMaps || []).map((bm) => [bm.id, bm]));
  const povById = new Map((povs || []).map((p) => [p.id, p]));

  const content = (containers || []).map((c) => {
    if (c.povId) {
      const pov = povById.get(c.povId);
      return {
        id: c.id,
        type: "POV_CONTAINER",
        sortIndex: c.sortIndex,
        label: pov
          ? pov.description || "Point de vue"
          : "Point de vue supprimé",
      };
    }
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
