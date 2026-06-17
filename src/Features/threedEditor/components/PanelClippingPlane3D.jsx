import { useEffect, useRef, useState } from "react";

import { useDispatch } from "react-redux";

import usePanelDrag from "Features/layout/hooks/usePanelDrag";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import {
  setClippingPlaneEditing,
  setClippingPlaneEnabled,
} from "Features/threedEditor/threedEditorSlice";

import FieldMeasure from "./FieldMeasure";
import { IconGizmoTranslate, IconGizmoRotate } from "./iconsGizmo";

import {
  Box,
  Button,
  IconButton,
  Paper,
  Slider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DragIndicator from "@mui/icons-material/DragIndicator";
import RestartAlt from "@mui/icons-material/RestartAlt";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

const GIZMO_BTN_SIZE = 36;

function SectionHeader({ title, onReset }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.75 }}>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: "text.secondary",
        }}
      >
        {title}
      </Typography>
      {onReset && (
        <Tooltip title="Reset">
          <IconButton
            size="small"
            onClick={onReset}
            sx={{ p: 0.25, color: "text.secondary" }}
          >
            <RestartAlt sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );
}

function GizmoToggle({ active, onClick, tooltip, children }) {
  return (
    <Tooltip title={tooltip}>
      <ToggleButton
        value="on"
        size="small"
        selected={active}
        onChange={onClick}
        sx={{
          width: GIZMO_BTN_SIZE,
          height: GIZMO_BTN_SIZE,
          minWidth: GIZMO_BTN_SIZE,
          minHeight: GIZMO_BTN_SIZE,
          flexShrink: 0,
          p: 0,
        }}
      >
        {children}
      </ToggleButton>
    </Tooltip>
  );
}

export default function PanelClippingPlane3D() {
  const dispatch = useDispatch();

  const drag = usePanelDrag();

  // "X" | "Y" | "Z" | "FREE" — preset axis (FREE once the gizmo rotates it).
  const [axis, setAxis] = useState("X");
  // "translate" | "rotate".
  const [gizmoMode, setGizmoMode] = useState("translate");
  const [distance, setDistanceState] = useState(0);

  const maxDistanceRef = useRef(10);

  // Initialize from the manager and mirror live gizmo drags to the slider.
  useEffect(() => {
    const manager = getActiveThreedEditor()?.sceneManager?.clippingManager;
    if (!manager) return;
    manager.setGizmoMode("translate");
    maxDistanceRef.current = manager.getMaxDistance();
    setDistanceState(manager.getDistance());

    const unsub = manager.subscribe(() => {
      setDistanceState(manager.getDistance());
    });
    return () => unsub();
  }, []);

  // handlers

  function handleAxis(_e, value) {
    if (!value) return;
    setAxis(value);
    const manager = getActiveThreedEditor()?.sceneManager?.clippingManager;
    manager?.setAxis(value);
    if (manager) {
      maxDistanceRef.current = manager.getMaxDistance();
      setDistanceState(manager.getDistance());
    }
  }

  function handleFlip() {
    const manager = getActiveThreedEditor()?.sceneManager?.clippingManager;
    manager?.flip();
    setAxis("FREE");
  }

  function handleGizmoMode(mode) {
    setGizmoMode(mode);
    getActiveThreedEditor()?.sceneManager?.clippingManager?.setGizmoMode(mode);
  }

  function handleDistance(_e, value) {
    setDistanceState(value);
    getActiveThreedEditor()?.sceneManager?.clippingManager?.setDistance(value);
  }

  function handleReset() {
    const manager = getActiveThreedEditor()?.sceneManager?.clippingManager;
    manager?.reset();
    setAxis("X");
    if (manager) setDistanceState(manager.getDistance());
  }

  function handleClose() {
    dispatch(setClippingPlaneEditing(false));
  }

  function handleDelete() {
    dispatch(setClippingPlaneEnabled(false));
  }

  const max = maxDistanceRef.current;

  // render

  return (
    <Paper
      elevation={6}
      sx={{
        position: "absolute",
        top: 64,
        left: 8,
        zIndex: 2,
        transform: `translate(${drag.position.x}px, ${drag.position.y}px)`,
        p: 1.5,
        width: 320,
      }}
    >
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        useFlexGap
        sx={{ mb: 1.5 }}
      >
        <Box
          onMouseDown={drag.handleMouseDown}
          sx={{
            cursor: "grab",
            display: "flex",
            alignItems: "center",
            color: "text.secondary",
          }}
        >
          <DragIndicator fontSize="small" />
        </Box>
        <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: 700 }}>
          Plan de coupe
        </Typography>
        <Tooltip title="Fermer l'édition">
          <IconButton size="small" onClick={handleClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack spacing={1.75}>
        {/* Orientation */}
        <Box>
          <SectionHeader title="Orientation" />
          <Stack direction="row" alignItems="center" spacing={1} useFlexGap>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={axis}
              onChange={handleAxis}
            >
              <ToggleButton value="X" sx={{ textTransform: "none", py: 0.25 }}>
                X
              </ToggleButton>
              <ToggleButton value="Y" sx={{ textTransform: "none", py: 0.25 }}>
                Y
              </ToggleButton>
              <ToggleButton value="Z" sx={{ textTransform: "none", py: 0.25 }}>
                Z
              </ToggleButton>
            </ToggleButtonGroup>
            <Tooltip title="Inverser le sens de coupe">
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                startIcon={<SwapHorizIcon sx={{ fontSize: 18 }} />}
                onClick={handleFlip}
                sx={{ textTransform: "none", borderRadius: "8px" }}
              >
                Inverser
              </Button>
            </Tooltip>
          </Stack>
        </Box>

        {/* Gizmo mode */}
        <Box>
          <SectionHeader title="Gizmo" />
          <Stack direction="row" alignItems="center" spacing={1}>
            <GizmoToggle
              tooltip="Translation"
              active={gizmoMode === "translate"}
              onClick={() => handleGizmoMode("translate")}
            >
              <IconGizmoTranslate />
            </GizmoToggle>
            <GizmoToggle
              tooltip="Rotation"
              active={gizmoMode === "rotate"}
              onClick={() => handleGizmoMode("rotate")}
            >
              <IconGizmoRotate />
            </GizmoToggle>
          </Stack>
        </Box>

        {/* Position */}
        <Box>
          <SectionHeader title="Position" onReset={handleReset} />
          <Stack direction="row" alignItems="center" spacing={1} useFlexGap>
            <Slider
              size="small"
              value={Math.min(Math.max(distance, -max), max)}
              min={-max}
              max={max}
              step={0.01}
              marks={[{ value: 0 }]}
              onChange={handleDistance}
              sx={{ flexGrow: 1, mx: 1, minWidth: 60 }}
            />
            <FieldMeasure
              value={roundFmt(distance, 2)}
              onChange={() => {}}
              onCommit={(raw) => {
                const n = parseFloat(raw);
                if (Number.isFinite(n)) handleDistance(null, n);
              }}
              unit="m"
              width={56}
            />
          </Stack>
        </Box>

        {/* Delete */}
        <Button
          size="small"
          variant="outlined"
          color="error"
          startIcon={<DeleteOutlineIcon sx={{ fontSize: 18 }} />}
          onClick={handleDelete}
          sx={{ textTransform: "none", borderRadius: "8px", alignSelf: "flex-start" }}
        >
          Supprimer
        </Button>
      </Stack>
    </Paper>
  );
}

function roundFmt(n, decimals = 2) {
  if (!Number.isFinite(n)) return "0";
  const factor = Math.pow(10, decimals);
  return String(Math.round(n * factor) / factor);
}
