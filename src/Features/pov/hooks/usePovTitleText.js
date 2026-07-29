import { useSelector } from "react-redux";

import { selectSelectedItem } from "Features/selection/selectionSlice";
import { selectIsPovViewer } from "Features/viewers/utils/effectiveViewerKey";

import usePovs from "./usePovs";

// Text of the capture title banner: the selected POV's description, or the
// draft description typed in the "Nouveau point de vue" panel. Empty outside
// the POV viewer (the banner is then not rendered) — except when the global
// Capture tool owns the frame: its own title then feeds the banner.
export default function usePovTitleText() {
  const isPovViewer = useSelector(selectIsPovViewer);
  const selectedItem = useSelector(selectSelectedItem);
  const draftDescription = useSelector((s) => s.pov.draftDescription);
  const captureTitleOverride = useSelector((s) => s.pov.captureTitleOverride);
  const captureToolActive = useSelector((s) => s.mapEditor.captureToolActive);
  const captureTitleText = useSelector((s) => s.mapEditor.captureTitleText);
  const povs = usePovs() ?? [];

  // Mutually exclusive with the POV framing (setCaptureToolActive /
  // useEnterPovFraming enforce it), so no precedence conflict.
  if (captureToolActive) return (captureTitleText ?? "").trim();

  if (!isPovViewer) return "";

  // Batch capture (video): the POV being rendered drives the banner, not the
  // selection — which the generator leaves untouched.
  if (captureTitleOverride !== null) return captureTitleOverride.trim();

  const pov =
    selectedItem?.type === "POV"
      ? povs.find((p) => p.id === selectedItem.id)
      : null;

  return (pov ? pov.description : draftDescription)?.trim() ?? "";
}
