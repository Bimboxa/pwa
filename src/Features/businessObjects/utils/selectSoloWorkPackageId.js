import { isBusinessObjectsModuleKey } from "./businessObjectModuleKeys";

// Soloed work package of the PLANNING module, null outside the
// business-objects modules (the solo must never filter Dessin / 3D).
export default function selectSoloWorkPackageId(s) {
  return isBusinessObjectsModuleKey(s.viewers?.selectedViewerKey)
    ? (s.businessObjects?.selectedWorkPackageId ?? null)
    : null;
}
