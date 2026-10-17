import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";
import selectEffectiveInteractionMode from "Features/popperMapListings/utils/selectEffectiveInteractionMode";
import selectShowDrawingTools from "../utils/selectShowDrawingTools";
import { isBusinessObjectsModuleKey } from "Features/businessObjects/utils/businessObjectModuleKeys";
import canLocateBusinessObjects from "Features/businessObjects/utils/canLocateBusinessObjects";

// Whether the drawing-tool commands (Dessin, Ouverture, cuts, Joindre, Axe,
// Déplacer, Tourner…) apply in the displayed module: the gates the
// former "Commandes" rows of PopperMapListings used
// (selectShowDrawingTools), including the business-objects module ones that
// need the active object's listing (locate mode: no tools; no active object:
// edit-only tools).
export default function useDrawingToolsAvailability() {
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const effectiveInteractionMode = useSelector(selectEffectiveInteractionMode);
  const isZonesViewer = viewerKey === "ZONES";

  const isBusinessObjectsModule = isBusinessObjectsModuleKey(viewerKey);
  const activeBusinessObjectId = useSelector(
    (s) => s.businessObjects?.activeBusinessObjectId ?? null
  );
  const businessObjectsUpdatedAt = useSelector(
    (s) => s.businessObjects?.businessObjectsUpdatedAt
  );
  const activeBusinessObject = useLiveQuery(async () => {
    if (!isBusinessObjectsModule || !activeBusinessObjectId) return null;
    const o = await db.businessObjects.get(activeBusinessObjectId);
    return o && !o.deletedAt ? o : null;
  }, [
    isBusinessObjectsModule,
    activeBusinessObjectId,
    businessObjectsUpdatedAt,
  ]);
  const activeBusinessObjectListing = useSelector((s) =>
    activeBusinessObject?.listingId
      ? (s.listings.listingsById?.[activeBusinessObject.listingId] ?? null)
      : null
  );
  const isLocateBusinessObjectMode =
    isBusinessObjectsModule &&
    Boolean(activeBusinessObject) &&
    canLocateBusinessObjects(activeBusinessObjectListing);
  const isBusinessObjectsModuleNoObject =
    isBusinessObjectsModule && !activeBusinessObject;

  const showDrawingTools = selectShowDrawingTools({
    effectiveInteractionMode,
    isZonesViewer,
    isBusinessObjectsModuleNoObject,
    isLocateBusinessObjectMode,
  });

  return {
    showDrawingTools,
    isLocateBusinessObjectMode,
    isBusinessObjectsModuleNoObject,
  };
}
