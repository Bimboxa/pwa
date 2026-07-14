import { useSelector } from "react-redux";

import useSwitchViewer from "../hooks/useSwitchViewer";
import useToggleThreedViewerHotkey from "../hooks/useToggleThreedViewerHotkey";

import { Button, Typography } from "@mui/material";

import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";

export default function ButtonToggleThreedViewer() {
  const switchViewer = useSwitchViewer();

  useToggleThreedViewerHotkey();

  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);

  const isThreed = selectedViewerKey === "THREED";

  const buttonLabel = isThreed ? "2D" : "3D";

  function handleClick() {
    switchViewer(isThreed ? "MAP" : "THREED");
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
