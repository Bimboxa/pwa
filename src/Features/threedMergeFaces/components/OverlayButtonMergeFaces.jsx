import { useDispatch, useStore } from "react-redux";

import { IconButton, Tooltip } from "@mui/material";
import CallMergeIcon from "@mui/icons-material/CallMerge";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import activateMergeFacesTool from "../utils/activateMergeFacesTool";

// « Fusionner » button of the quick-action row rendered above the clicked
// point of the SELECTED FACE in the 3D editor (ThreedAnnotationOverlayActions):
// arms « Fusionner des faces » with that face as the seed — the next clicks
// on coplanar faces of neighbor annotations merge them into this one.
export default function OverlayButtonMergeFaces({ overlayColor = "#2196f3" }) {
  const dispatch = useDispatch();
  const store = useStore();

  // strings

  const tooltipS =
    "Fusionner avec les faces coplanaires d'autres annotations (Esc pour quitter)";

  // handlers

  function handleClick() {
    activateMergeFacesTool({
      dispatch,
      state: store.getState(),
      editor: getActiveThreedEditor(),
    });
  }

  // render

  return (
    <Tooltip placement="top" arrow title={tooltipS}>
      <IconButton
        size="small"
        onClick={handleClick}
        sx={{
          bgcolor: "rgba(255,255,255,0.9)",
          border: `1px solid ${overlayColor}`,
          color: "text.disabled",
          "&:hover": { bgcolor: "white", color: overlayColor },
          p: 0.5,
        }}
      >
        <CallMergeIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Tooltip>
  );
}
