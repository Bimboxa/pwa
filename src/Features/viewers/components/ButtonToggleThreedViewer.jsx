import { useSelector } from "react-redux";

import useSelectedViewer from "../hooks/useSelectedViewer";
import useToggleModuleEditor from "../hooks/useToggleModuleEditor";
import useTogglePovViewerMode from "Features/pov/hooks/useTogglePovViewerMode";
import { selectEffectiveViewerKey } from "../utils/effectiveViewerKey";

import { Box, ToggleButton, ToggleButtonGroup } from "@mui/material";

import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";

// Explicit 2D | 3D toggle showing which editor the current module displays —
// the left-band (module) selection does not move. Rendered in the bottom-right
// overlay of both editors (UILayerDesktop / MainThreedEditor), not in the top
// bar. Only multi-editor modules (Dessin, POV, Zones, Viewer) show it;
// single-editor modules (MESHES, ...) have no toggle.
export default function ButtonToggleThreedViewer() {
  const toggleModuleEditor = useToggleModuleEditor();
  const togglePovViewerMode = useTogglePovViewerMode();

  const selectedViewer = useSelectedViewer();
  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const effectiveViewerKey = useSelector(selectEffectiveViewerKey);
  const disable3D = useSelector((s) => s.appConfig.disable3D);

  const hasEditorToggle = selectedViewer?.editors?.length > 1;
  if (!hasEditorToggle || disable3D) return null;

  const isThreed = effectiveViewerKey === "THREED";
  const selectedValue = isThreed ? "3D" : "2D";

  function handleChange(_e, newValue) {
    // Clicking the already-active segment yields null — ignore it.
    if (!newValue || newValue === selectedValue) return;
    if (selectedViewerKey === "POINT_OF_VIEW") {
      // POV keeps its own editor mode until it migrates to
      // editorKeyByModule (see issue #296).
      togglePovViewerMode();
    } else {
      toggleModuleEditor();
    }
  }

  return (
    <Box sx={{ position: "relative" }}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={selectedValue}
        onChange={handleChange}
        sx={{
          bgcolor: "background.default",
          borderRadius: "8px",
          "& .MuiToggleButton-root": {
            px: 1.5,
            py: 0.25,
            fontWeight: "bold",
            borderColor: "secondary.main",
            color: "secondary.main",
            "&.Mui-selected": {
              bgcolor: "secondary.main",
              color: "secondary.contrastText",
              "&:hover": { bgcolor: "secondary.dark" },
            },
            "&:first-of-type": { borderRadius: "8px 0 0 8px" },
            "&:last-of-type": { borderRadius: "0 8px 8px 0" },
          },
        }}
      >
        <ToggleButton value="2D">2D</ToggleButton>
        <ToggleButton value="3D">3D</ToggleButton>
      </ToggleButtonGroup>
      {/* The T shortcut triggers the inactive segment, so the badge sits on
          that side. Opaque backing so the button doesn't show through the
          translucent ShortcutBadge background. */}
      <Box
        sx={{
          position: "absolute",
          top: -14,
          ...(isThreed ? { left: -6 } : { right: -6 }),
          transform: "scale(0.75)",
          transformOrigin: isThreed ? "top left" : "top right",
          pointerEvents: "none",
          zIndex: 1,
          bgcolor: "background.paper",
          borderRadius: "6px",
          lineHeight: 0,
        }}
      >
        <ShortcutBadge>T</ShortcutBadge>
      </Box>
    </Box>
  );
}
