import { useEffect, useState } from "react";

import { useDispatch } from "react-redux";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import {
  setClippingPlaneEditing,
  setClippingPlaneEnabled,
} from "Features/threedEditor/threedEditorSlice";

import {
  Box,
  Divider,
  IconButton,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import {
  IconCutPlaneFront,
  IconCutPlaneSide,
  IconCutPlaneTop,
} from "./iconsClippingPlane";

// Direction presets. `axis` values map to ClippingManager.setAxis (user
// convention): "Y" → normal along three.js Z (default vertical plane),
// "X" → three.js X (vertical plane), "Z" → three.js Y (horizontal cut).
const DIRECTIONS = [
  { axis: "Y", label: "Plan vertical (face avant)", Icon: IconCutPlaneFront },
  { axis: "X", label: "Plan vertical (face latérale)", Icon: IconCutPlaneSide },
  { axis: "Z", label: "Plan horizontal", Icon: IconCutPlaneTop },
];

// Specialized bottom toolbar shown while editing the 3D clipping plane. It
// replaces the regular drawing toolbar (BottomToolbarThreed) for as long as
// clippingPlane.editing is true. The plane is translated/rotated directly with
// the on-canvas gizmo; this toolbar only carries the discrete actions. Button
// sizing mirrors the 2D drawing toolbar (ToolbarDrawingDraft) so the two have
// the same height.
export default function ClippingToolbarThreed() {
  const dispatch = useDispatch();

  // "X" | "Y" | "Z" | "FREE" — default "Y" matches the manager's default
  // vertical plane (normal along three.js Z).
  const [axis, setAxis] = useState("Y");

  // Reset the highlighted direction whenever the toolbar (re)mounts — i.e. each
  // time a fresh plane is created.
  useEffect(() => {
    setAxis("Y");
  }, []);

  // helpers

  const getManager = () =>
    getActiveThreedEditor()?.sceneManager?.clippingManager;

  // handlers

  function handleAxis(_e, value) {
    if (!value) return; // Ignore toggling the active direction off.
    setAxis(value);
    getManager()?.setAxis(value);
  }

  function handleFlip() {
    getManager()?.flip();
    setAxis("FREE");
  }

  function handleReset() {
    getManager()?.reset();
    setAxis("Y");
  }

  function handleDelete() {
    dispatch(setClippingPlaneEnabled(false));
  }

  function handleClose() {
    dispatch(setClippingPlaneEditing(false));
  }

  // render

  return (
    <Paper
      elevation={3}
      sx={{
        position: "absolute",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        px: 1,
        py: 0.5,
        borderRadius: "10px",
        zIndex: 10,
      }}
    >
      <Stack direction="row" spacing={0.5} alignItems="center">
        <ToggleButtonGroup exclusive value={axis} onChange={handleAxis}>
          {DIRECTIONS.map(({ axis: value, label, Icon }) => (
            <Tooltip key={value} title={label}>
              <ToggleButton value={value} size="small">
                <Icon />
              </ToggleButton>
            </Tooltip>
          ))}
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Tooltip title="Inverser le sens de coupe">
          <IconButton onClick={handleFlip}>
            <SwapHorizIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Réinitialiser">
          <IconButton onClick={handleReset}>
            <RestartAltIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Supprimer le plan de coupe">
          <IconButton color="error" onClick={handleDelete}>
            <DeleteOutlineIcon />
          </IconButton>
        </Tooltip>

        {/* Push the close button slightly to the right. */}
        <Box sx={{ width: 24 }} />
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        <Tooltip title="Fermer l'édition">
          <IconButton onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  );
}
