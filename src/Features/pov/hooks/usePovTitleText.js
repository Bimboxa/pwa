import { useSelector } from "react-redux";

import { selectSelectedItem } from "Features/selection/selectionSlice";
import { selectIsPovViewer } from "Features/viewers/utils/effectiveViewerKey";

import usePovs from "./usePovs";

// Text of the capture title banner: the selected POV's description, or the
// draft description typed in the "Nouveau point de vue" panel. Empty outside
// the POV viewer (the banner is then not rendered).
export default function usePovTitleText() {
  const isPovViewer = useSelector(selectIsPovViewer);
  const selectedItem = useSelector(selectSelectedItem);
  const draftDescription = useSelector((s) => s.pov.draftDescription);
  const povs = usePovs() ?? [];

  if (!isPovViewer) return "";

  const pov =
    selectedItem?.type === "POV"
      ? povs.find((p) => p.id === selectedItem.id)
      : null;

  return (pov ? pov.description : draftDescription)?.trim() ?? "";
}
