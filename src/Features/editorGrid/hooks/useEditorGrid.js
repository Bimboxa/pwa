import { useSelector } from "react-redux";

import { selectShowCommandsToolbar } from "Features/commandsToolbar/hooks/useShowCommandsToolbar";

// Settings of the editor grid as the 2D editor must apply them. The grid is
// only active where its toggle (the « Grille » command) is reachable: it
// stays off wherever the commands toolbar is hidden (Viewer module, capture
// framing, PDF editor…), whatever the stored preference.
export default function useEditorGrid() {
  const enabled = useSelector(
    (s) => s.editorGrid.enabled && selectShowCommandsToolbar(s)
  );
  const stepM = useSelector((s) => s.editorGrid.stepM);
  const dynamic = useSelector((s) => s.editorGrid.dynamic);
  return { enabled, stepM, dynamic };
}
