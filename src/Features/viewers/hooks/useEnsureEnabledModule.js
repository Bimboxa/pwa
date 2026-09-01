import { useEffect } from "react";

import { useSelector } from "react-redux";

import useViewers from "./useViewers";
import useSwitchViewer from "./useSwitchViewer";

// Keeps the selected module inside the enabled list. Covers both the live
// disable of the current module from the Configuration dialog and the boot
// restore of a module the scope has disabled (getInitSelectedModuleKey is
// deliberately not scope-aware — this guard corrects right after the
// scopeConfig slice hydrates, same one-frame-correction pattern as the
// disable3D landing). Gated on `synced` so an empty pre-hydration list never
// triggers a spurious switch.
export default function useEnsureEnabledModule() {
  const viewers = useViewers(); // already scope-filtered
  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const synced = useSelector((s) => s.scopeConfig.synced);
  const switchViewer = useSwitchViewer();

  useEffect(() => {
    if (!synced || viewers.length === 0) return;
    if (viewers.some((v) => v.key === selectedViewerKey)) return;
    const fallback = viewers.find((v) => v.key === "MAP") ?? viewers[0];
    switchViewer(fallback.key);
  }, [synced, viewers, selectedViewerKey]);
}
