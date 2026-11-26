import db from "App/db/db";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import { triggerBaseMapsUpdate } from "Features/baseMaps/baseMapsSlice";

// Writes one depth of the clipping box of a base map (baseMap.clipping3d):
// side "front" → frontM, "back" → backM, in metres (null = no limit). The
// other fields of the box are kept. The dispatches refresh the 3D cut
// (useApplyBaseMapClippingIn3d), the clip box and the properties panel.
export default async function setBaseMapClipDepthService({
  baseMapId,
  side,
  depthM,
  dispatch,
}) {
  if (!baseMapId || (side !== "front" && side !== "back")) return;
  const record = await db.baseMaps.get(baseMapId);
  if (!record) return;
  const value =
    depthM === null ? null : Math.max(0, Math.round(depthM * 1e3) / 1e3);
  await db.baseMaps.update(baseMapId, {
    clipping3d: {
      ...(record.clipping3d ?? {}),
      [side === "front" ? "frontM" : "backM"]: value,
    },
  });
  dispatch?.(triggerEntitiesTableUpdate("baseMaps"));
  dispatch?.(triggerBaseMapsUpdate());
}
