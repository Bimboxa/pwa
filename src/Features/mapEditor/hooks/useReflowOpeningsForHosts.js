import { useSelector } from "react-redux";

import useMainBaseMap from "./useMainBaseMap";
import reflowOpeningsForHost from "../services/reflowOpeningsForHostService";

// Reusable wrapper around reflowOpeningsForHost with the main base map
// context (image size + scale) and the selected project. Same fire-and-forget
// contract as the `reflowOpenings` helper of MainMapEditorV3: errors are
// logged, never thrown, so a property edit never fails because of its glued
// openings.
//
// Used by non-geometric host edits that still move the opening glue curve:
// a STRIP's thickness / side / type change shifts its median line.
export default function useReflowOpeningsForHosts() {
  const baseMap = useMainBaseMap();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  return async ({ hostIds = [], movedPointIds = [] }) => {
    if (!projectId || (!hostIds.length && !movedPointIds.length)) return;
    const imageSize = baseMap?.getImageSize?.() || baseMap?.image?.imageSize;
    const meterByPx = baseMap?.getMeterByPx?.() ?? baseMap?.meterByPx;
    if (!imageSize?.width || !imageSize?.height || !(meterByPx > 0)) return;
    try {
      await reflowOpeningsForHost({
        hostIds,
        movedPointIds,
        projectId,
        imageSize,
        meterByPx,
      });
    } catch (e) {
      console.error("[openings] reflow failed", e);
    }
  };
}
