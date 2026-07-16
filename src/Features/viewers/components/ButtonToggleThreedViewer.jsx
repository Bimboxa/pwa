import { useSelector } from "react-redux";

import useSwitchViewer from "../hooks/useSwitchViewer";
import useToggleThreedViewerHotkey from "../hooks/useToggleThreedViewerHotkey";
import useTogglePovViewerMode from "Features/pov/hooks/useTogglePovViewerMode";

import { Button, Typography } from "@mui/material";

import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";

export default function ButtonToggleThreedViewer() {
  const switchViewer = useSwitchViewer();
  const togglePovViewerMode = useTogglePovViewerMode();

  useToggleThreedViewerHotkey();

  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const povViewerMode = useSelector((s) => s.pov.viewerMode);

  // Inside the POV viewer the button toggles the displayed editor (2D/3D)
  // without leaving the viewer.
  const isPovViewer = selectedViewerKey === "POINT_OF_VIEW";
  const isThreed = isPovViewer
    ? povViewerMode === "THREED"
    : selectedViewerKey === "THREED";

  const buttonLabel = isThreed ? "2D" : "3D";

  function handleClick() {
    if (isPovViewer) {
      togglePovViewerMode();
    } else {
      switchViewer(isThreed ? "MAP" : "THREED");
    }
  }

  return (
    <Button
      variant="outlined"
      color="secondary"
      size="small"
      onClick={handleClick}
      sx={{
        gap: 1,
        borderRadius: "8px",
        border: (theme) => `1px solid ${theme.palette.secondary.main}`,
      }}
    >
      <ShortcutBadge>T</ShortcutBadge>
      <Typography variant="body2">{buttonLabel}</Typography>
    </Button>
  );
}
