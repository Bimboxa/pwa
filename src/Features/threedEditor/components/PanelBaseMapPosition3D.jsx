import { useEffect, useMemo, useRef, useState } from "react";

import db from "App/db/db";

import useSelectedBaseMap from "Features/baseMaps/hooks/useSelectedBaseMap";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";

import usePanelDrag from "Features/layout/hooks/usePanelDrag";

import {
  toUserCoords,
  fromUserCoords,
  eulerRadToDeg,
  eulerDegToRad,
} from "Features/threedEditor/utils/userCoords";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import {
  Box,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import DragIndicator from "@mui/icons-material/DragIndicator";
import OpenWith from "@mui/icons-material/OpenWith";
import RotateLeft from "@mui/icons-material/RotateLeft";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

const FIELD_WIDTH = 80;

function NumberField({ label, value, onChange, onCommit, step = 0.1 }) {
  return (
    <TextField
      label={label}
      size="small"
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      inputProps={{ step }}
      sx={{ width: FIELD_WIDTH }}
    />
  );
}

export default function PanelBaseMapPosition3D() {
  // baseMap to edit — prefer the slice's selectedBaseMapId, fall back to the
  // main basemap (the one actually loaded in the 3D editor today).
  const selected = useSelectedBaseMap();
  const main = useMainBaseMap();
  const baseMap = selected ?? main;
  const baseMapId = baseMap?.id ?? null;

  const drag = usePanelDrag();

  // gizmoMode: "off" | "translate" | "rotate"
  const [gizmoMode, setGizmoMode] = useState("off");

  // Form state holds USER-FACING values: position in meters (with Y/Z swap)
  // and rotation in degrees (with Y/Z swap on the radians, then converted).
  const [posUser, setPosUser] = useState({ x: "0", y: "0", z: "0" });
  const [rotUserDeg, setRotUserDeg] = useState({ x: "0", y: "0", z: "0" });

  // Track whether the user is editing a field so we don't stomp their input
  // when the gizmo or Dexie pushes a fresh value.
  const editingRef = useRef(false);

  // Helper: read the live group transform → user-coord strings.
  const refreshFromBaseMap = useMemo(
    () => () => {
      if (!baseMap) return;
      const t = getBaseMapTransform(baseMap);
      const userPos = toUserCoords(t.position);
      const userRot = toUserCoords(eulerRadToDeg(t.rotation));
      setPosUser({
        x: roundFmt(userPos.x),
        y: roundFmt(userPos.y),
        z: roundFmt(userPos.z),
      });
      setRotUserDeg({
        x: roundFmt(userRot.x),
        y: roundFmt(userRot.y),
        z: roundFmt(userRot.z),
      });
    },
    [baseMap]
  );

  // Seed and resync when the targeted basemap changes (or its persisted
  // transform changes via Dexie liveQuery).
  useEffect(() => {
    if (editingRef.current) return;
    refreshFromBaseMap();
  }, [
    baseMap?.position?.x,
    baseMap?.position?.y,
    baseMap?.position?.z,
    baseMap?.rotation?.x,
    baseMap?.rotation?.y,
    baseMap?.rotation?.z,
    baseMap?.id,
    refreshFromBaseMap,
  ]);

  // Attach the gizmo to the basemap group for the duration the panel is
  // mounted; detach on unmount or basemap change. The gizmo stays hidden
  // until the user picks a mode.
  useEffect(() => {
    if (!baseMapId) return;
    const editor = getActiveThreedEditor();
    if (!editor) return;
    const tcm = editor.sceneManager?.transformControlsManager;
    const group = editor.sceneManager?.imagesManager?.getGroup(baseMapId);
    if (!tcm || !group) return;

    if (gizmoMode === "off") {
      tcm.detach();
      return;
    }
    tcm.attach(group);
    tcm.setMode(gizmoMode);

    return () => {
      tcm.detach();
    };
  }, [baseMapId, gizmoMode]);

  // While the gizmo is being dragged, mirror the live group transform into
  // the form fields. Persist on drag end.
  useEffect(() => {
    if (!baseMapId) return;
    const editor = getActiveThreedEditor();
    const tcm = editor?.sceneManager?.transformControlsManager;
    const group = editor?.sceneManager?.imagesManager?.getGroup(baseMapId);
    if (!tcm || !group) return;

    const updateFromGroup = () => {
      const userPos = toUserCoords({
        x: group.position.x,
        y: group.position.y,
        z: group.position.z,
      });
      const userRot = toUserCoords(
        eulerRadToDeg({
          x: group.rotation.x,
          y: group.rotation.y,
          z: group.rotation.z,
        })
      );
      setPosUser({
        x: roundFmt(userPos.x),
        y: roundFmt(userPos.y),
        z: roundFmt(userPos.z),
      });
      setRotUserDeg({
        x: roundFmt(userRot.x),
        y: roundFmt(userRot.y),
        z: roundFmt(userRot.z),
      });
    };

    const unsub = tcm.subscribe(updateFromGroup);
    tcm.setDragEndCallback(() => {
      persistFromGroup(group, baseMapId);
    });

    return () => {
      unsub();
      tcm.setDragEndCallback(null);
    };
  }, [baseMapId]);

  function commitPosition() {
    editingRef.current = false;
    if (!baseMapId) return;
    const editor = getActiveThreedEditor();
    const group = editor?.sceneManager?.imagesManager?.getGroup(baseMapId);
    const userVec = {
      x: parseFloatSafe(posUser.x),
      y: parseFloatSafe(posUser.y),
      z: parseFloatSafe(posUser.z),
    };
    const threeVec = fromUserCoords(userVec);
    if (group) {
      group.position.set(threeVec.x, threeVec.y, threeVec.z);
      editor.renderScene();
    }
    db.baseMaps.update(baseMapId, { position: threeVec });
  }

  function commitRotation() {
    editingRef.current = false;
    if (!baseMapId) return;
    const editor = getActiveThreedEditor();
    const group = editor?.sceneManager?.imagesManager?.getGroup(baseMapId);
    const userDeg = {
      x: parseFloatSafe(rotUserDeg.x),
      y: parseFloatSafe(rotUserDeg.y),
      z: parseFloatSafe(rotUserDeg.z),
    };
    const threeRad = eulerDegToRad(fromUserCoords(userDeg));
    if (group) {
      group.rotation.set(threeRad.x, threeRad.y, threeRad.z);
      editor.renderScene();
    }
    db.baseMaps.update(baseMapId, { rotation: threeRad });
  }

  function setPosField(axis, value) {
    editingRef.current = true;
    setPosUser((s) => ({ ...s, [axis]: value }));
  }

  function setRotField(axis, value) {
    editingRef.current = true;
    setRotUserDeg((s) => ({ ...s, [axis]: value }));
  }

  if (!baseMap) {
    return null;
  }

  return (
    <Paper
      elevation={6}
      sx={{
        position: "absolute",
        top: 64,
        left: 8,
        zIndex: 2,
        transform: `translate(${drag.position.x}px, ${drag.position.y}px)`,
        p: 1,
        minWidth: 280,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
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
        <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: 600 }}>
          Position du fond de plan
        </Typography>
        <Tooltip title="Translate">
          <IconButton
            size="small"
            color={gizmoMode === "translate" ? "primary" : "default"}
            onClick={() =>
              setGizmoMode((m) => (m === "translate" ? "off" : "translate"))
            }
          >
            <OpenWith fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Rotate">
          <IconButton
            size="small"
            color={gizmoMode === "rotate" ? "primary" : "default"}
            onClick={() =>
              setGizmoMode((m) => (m === "rotate" ? "off" : "rotate"))
            }
          >
            <RotateLeft fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Masquer le gizmo">
          <span>
            <IconButton
              size="small"
              disabled={gizmoMode === "off"}
              onClick={() => setGizmoMode("off")}
            >
              <VisibilityOff fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" sx={{ width: 60 }}>
            Position
          </Typography>
          <NumberField
            label="X"
            value={posUser.x}
            onChange={(v) => setPosField("x", v)}
            onCommit={commitPosition}
          />
          <NumberField
            label="Y"
            value={posUser.y}
            onChange={(v) => setPosField("y", v)}
            onCommit={commitPosition}
          />
          <NumberField
            label="Z"
            value={posUser.z}
            onChange={(v) => setPosField("z", v)}
            onCommit={commitPosition}
          />
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" sx={{ width: 60 }}>
            Rotation°
          </Typography>
          <NumberField
            label="X"
            value={rotUserDeg.x}
            onChange={(v) => setRotField("x", v)}
            onCommit={commitRotation}
            step={1}
          />
          <NumberField
            label="Y"
            value={rotUserDeg.y}
            onChange={(v) => setRotField("y", v)}
            onCommit={commitRotation}
            step={1}
          />
          <NumberField
            label="Z"
            value={rotUserDeg.z}
            onChange={(v) => setRotField("z", v)}
            onCommit={commitRotation}
            step={1}
          />
        </Stack>
      </Stack>
    </Paper>
  );
}

function parseFloatSafe(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function roundFmt(n) {
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n * 1000) / 1000);
}

function persistFromGroup(group, baseMapId) {
  const position = {
    x: group.position.x,
    y: group.position.y,
    z: group.position.z,
  };
  const rotation = {
    x: group.rotation.x,
    y: group.rotation.y,
    z: group.rotation.z,
  };
  db.baseMaps.update(baseMapId, { position, rotation });
}
