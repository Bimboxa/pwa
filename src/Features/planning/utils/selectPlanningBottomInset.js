import { getBusinessObjectTypeKeyFromModuleKey } from "Features/businessObjects/utils/businessObjectModuleKeys";

// Height of the bottom planning panel when it overlays the editor (PLANNING
// module, panel open) — the editors' bottom toolbars lift by this inset.
export default function selectPlanningBottomInset(s) {
  if (!s.planning?.panelOpen) return 0;
  if (
    getBusinessObjectTypeKeyFromModuleKey(s.viewers?.selectedViewerKey) !==
    "PLANNING"
  )
    return 0;
  return s.planning.panelHeight ?? 0;
}
