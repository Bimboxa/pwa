import { useEffect, useMemo, useRef, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import db from "App/db/db";

import useSelectedBaseMap from "Features/baseMaps/hooks/useSelectedBaseMap";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import getBaseMapTransform, {
  DEFAULT_ANGLE_DEG,
  DEFAULT_ORIENTATION,
  DEFAULT_POSITION,
} from "Features/baseMaps/js/getBaseMapTransform";
import { setBaseMapOpacity as setBaseMapOpacityRedux } from "Features/mapEditor/mapEditorSlice";

import usePanelDrag from "Features/layout/hooks/usePanelDrag";

import {
  toUserCoords,
  fromUserCoords,
} from "Features/threedEditor/utils/userCoords";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { setDrawingOffset } from "Features/threedEditor/threedEditorSlice";

import {
  Box,
  IconButton,
  Paper,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import DragIndicator from "@mui/icons-material/DragIndicator";
import OpenWith from "@mui/icons-material/OpenWith";
import RotateLeft from "@mui/icons-material/RotateLeft";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

const ROW_LABEL_WIDTH = 80;
const FIELD_WIDTH = 70;

function NumberField({ label, value, onChange, onCommit, step = 0.1, width = FIELD_WIDTH }) {
  return (
    <TextField
      label={label}
      size="small"
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      inputProps={{ step }}
      sx={{ width }}
    />
  );
}

function Row({ label, children }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Typography variant="caption" sx={{ width: ROW_LABEL_WIDTH, color: "text.secondary" }}>
        {label}
      </Typography>
      {children}
    </Stack>
  );
}

export default function PanelBaseMapPosition3D() {
  const dispatch = useDispatch();

  // baseMap to edit — prefer the slice's selectedBaseMapId, fall back to the
  // main basemap (the one actually loaded in the 3D editor today).
  const selected = useSelectedBaseMap();
  const main = useMainBaseMap();
  const baseMap = selected ?? main;
  const baseMapId = baseMap?.id ?? null;

  const drawingOffset = useSelector((s) => s.threedEditor.drawingOffset ?? 0);

  const drag = usePanelDrag();

  // Independent gizmo modes — the user can have one of {none, translate, rotate}
  // active at a time. Rotation is constrained to the scene's vertical axis.
  const [gizmoMode, setGizmoMode] = useState("off"); // "off" | "translate" | "rotate"

  // Form state holds USER-FACING values.
  const [orientation, setOrientation] = useState(DEFAULT_ORIENTATION);
  const [angleDeg, setAngleDegStr] = useState("0");
  const [posUser, setPosUser] = useState({ x: "0", y: "0", z: "0" });

  // Local panel-only config: the slider's max value (meters). Default 5m.
  const [offsetMax, setOffsetMax] = useState(5);

  // Opacity local state for snappy slider feedback + visibility toggle.
  const [localOpacity, setLocalOpacity] = useState(baseMap?.opacity ?? 1);
  const lastVisibleOpacityRef = useRef(localOpacity > 0 ? localOpacity : 1);

  // Track in-progress edits so async sync from Dexie / gizmo doesn't stomp.
  const editingRef = useRef(false);

  const refreshFromBaseMap = useMemo(
    () => () => {
      if (!baseMap) return;
      const t = getBaseMapTransform(baseMap);
      setOrientation(t.orientation);
      setAngleDegStr(roundFmt(t.angleDeg));
      const userPos = toUserCoords(t.position);
      setPosUser({
        x: roundFmt(userPos.x),
        y: roundFmt(userPos.y),
        z: roundFmt(userPos.z),
      });
      setLocalOpacity(typeof baseMap.opacity === "number" ? baseMap.opacity : 1);
      if ((baseMap.opacity ?? 1) > 0) {
        lastVisibleOpacityRef.current = baseMap.opacity ?? 1;
      }
    },
    [baseMap]
  );

  useEffect(() => {
    if (editingRef.current) return;
    refreshFromBaseMap();
  }, [
    baseMap?.id,
    baseMap?.orientation,
    baseMap?.angleDeg,
    baseMap?.position?.x,
    baseMap?.position?.y,
    baseMap?.position?.z,
    baseMap?.opacity,
    refreshFromBaseMap,
  ]);

  // Sync mesh material opacity in real time so the slider feels live without
  // waiting for a Dexie roundtrip + livequery rerender.
  useEffect(() => {
    const editor = getActiveThreedEditor();
    const group = editor?.sceneManager?.imagesManager?.getGroup(baseMapId);
    if (!group) return;
    group.children.forEach((child) => {
      if (child.userData?.isBasemap && child.material) {
        child.material.opacity = localOpacity;
      }
    });
    editor.renderScene();
  }, [baseMapId, localOpacity]);

  // Attach the gizmo to the basemap group when a mode is picked. Configure
  // axis visibility per mode: rotation is Y-only (world up), translation is
  // all three axes.
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
    if (gizmoMode === "rotate") {
      tcm.setShowAxes({ x: false, y: true, z: false });
    } else {
      tcm.setShowAxes({ x: true, y: true, z: true });
    }

    return () => tcm.detach();
  }, [baseMapId, gizmoMode]);

  // Mirror the live group transform into form fields during drag, and persist
  // once on drag end.
  useEffect(() => {
    if (!baseMapId) return;
    const editor = getActiveThreedEditor();
    const tcm = editor?.sceneManager?.transformControlsManager;
    const group = editor?.sceneManager?.imagesManager?.getGroup(baseMapId);
    if (!tcm || !group) return;

    const updateFromGroup = () => {
      // angle around world Y (group rotation order is "YXZ", so rotation.y is
      // exactly the angle around world Y when the X angle stays at the
      // orientation default).
      const ang = group.rotation.y * (180 / Math.PI);
      setAngleDegStr(roundFmt(ang));
      const userPos = toUserCoords({
        x: group.position.x,
        y: group.position.y,
        z: group.position.z,
      });
      setPosUser({
        x: roundFmt(userPos.x),
        y: roundFmt(userPos.y),
        z: roundFmt(userPos.z),
      });
    };

    const unsub = tcm.subscribe(updateFromGroup);
    tcm.setDragEndCallback(() => {
      const ang = group.rotation.y * (180 / Math.PI);
      const position = {
        x: group.position.x,
        y: group.position.y,
        z: group.position.z,
      };
      db.baseMaps.update(baseMapId, { angleDeg: ang, position });
    });

    return () => {
      unsub();
      tcm.setDragEndCallback(null);
    };
  }, [baseMapId]);

  // ─── handlers ──────────────────────────────────────────────────────────

  function applyTransformToGroup({ orientationOverride, angleDegOverride, positionOverride } = {}) {
    const editor = getActiveThreedEditor();
    const group = editor?.sceneManager?.imagesManager?.getGroup(baseMapId);
    if (!group) return;
    const o = orientationOverride ?? orientation;
    const a = angleDegOverride ?? parseFloatSafe(angleDeg);
    const p =
      positionOverride ??
      fromUserCoords({
        x: parseFloatSafe(posUser.x),
        y: parseFloatSafe(posUser.y),
        z: parseFloatSafe(posUser.z),
      });
    const xRad = o === "VERTICAL" ? 0 : -Math.PI / 2;
    const yRad = (a * Math.PI) / 180;
    group.rotation.set(xRad, yRad, 0);
    group.position.set(p.x, p.y, p.z);
    editor.renderScene();
  }

  function commitOrientation(value) {
    if (!value || value === orientation) return;
    editingRef.current = false;
    setOrientation(value);
    applyTransformToGroup({ orientationOverride: value });
    db.baseMaps.update(baseMapId, { orientation: value });
  }

  function commitAngle() {
    editingRef.current = false;
    const a = parseFloatSafe(angleDeg);
    applyTransformToGroup({ angleDegOverride: a });
    db.baseMaps.update(baseMapId, { angleDeg: a });
  }

  function commitPosition() {
    editingRef.current = false;
    const p = fromUserCoords({
      x: parseFloatSafe(posUser.x),
      y: parseFloatSafe(posUser.y),
      z: parseFloatSafe(posUser.z),
    });
    applyTransformToGroup({ positionOverride: p });
    db.baseMaps.update(baseMapId, { position: p });
  }

  function setPosField(axis, value) {
    editingRef.current = true;
    setPosUser((s) => ({ ...s, [axis]: value }));
  }

  function resetRotation() {
    editingRef.current = false;
    setOrientation(DEFAULT_ORIENTATION);
    setAngleDegStr("0");
    applyTransformToGroup({
      orientationOverride: DEFAULT_ORIENTATION,
      angleDegOverride: 0,
    });
    db.baseMaps.update(baseMapId, {
      orientation: DEFAULT_ORIENTATION,
      angleDeg: DEFAULT_ANGLE_DEG,
    });
  }

  function resetTranslation() {
    editingRef.current = false;
    setPosUser({ x: "0", y: "0", z: "0" });
    applyTransformToGroup({ positionOverride: { ...DEFAULT_POSITION } });
    db.baseMaps.update(baseMapId, { position: { ...DEFAULT_POSITION } });
  }

  function resetOffset() {
    dispatch(setDrawingOffset(0));
  }

  function handleOpacityChange(_e, value) {
    editingRef.current = true;
    setLocalOpacity(value);
    if (value > 0) lastVisibleOpacityRef.current = value;
    dispatch(setBaseMapOpacityRedux(value));
  }

  function commitOpacity() {
    editingRef.current = false;
    db.baseMaps.update(baseMapId, { opacity: localOpacity });
  }

  function toggleVisibility() {
    const next = localOpacity > 0 ? 0 : lastVisibleOpacityRef.current || 1;
    setLocalOpacity(next);
    dispatch(setBaseMapOpacityRedux(next));
    db.baseMaps.update(baseMapId, { opacity: next });
  }

  function handleOffsetSliderChange(_e, value) {
    dispatch(setDrawingOffset(value));
  }

  function handleOffsetFieldChange(value) {
    const n = parseFloatSafe(value);
    dispatch(setDrawingOffset(n));
  }

  if (!baseMap) return null;

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
        minWidth: 460,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1.5 }}>
        <Box
          onMouseDown={drag.handleMouseDown}
          sx={{ cursor: "grab", display: "flex", alignItems: "center", color: "text.secondary" }}
        >
          <DragIndicator fontSize="small" />
        </Box>
        <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: 600 }}>
          Fond de plan
        </Typography>
      </Stack>

      <Stack spacing={1.5}>
        {/* Opacité */}
        <Row label="Opacité">
          <Slider
            size="small"
            value={localOpacity}
            min={0}
            max={1}
            step={0.01}
            onChange={handleOpacityChange}
            onChangeCommitted={commitOpacity}
            sx={{ flexGrow: 1, mx: 1 }}
          />
          <Tooltip title={localOpacity > 0 ? "Masquer" : "Afficher"}>
            <IconButton size="small" onClick={toggleVisibility}>
              {localOpacity > 0 ? (
                <Visibility fontSize="small" />
              ) : (
                <VisibilityOff fontSize="small" color="error" />
              )}
            </IconButton>
          </Tooltip>
        </Row>

        {/* Rotation */}
        <Row label="Rotation">
          <ToggleButtonGroup
            exclusive
            size="small"
            value={orientation}
            onChange={(_e, v) => commitOrientation(v)}
          >
            <ToggleButton value="HORIZONTAL" sx={{ textTransform: "none", py: 0.25 }}>
              Horizontal
            </ToggleButton>
            <ToggleButton value="VERTICAL" sx={{ textTransform: "none", py: 0.25 }}>
              Vertical
            </ToggleButton>
          </ToggleButtonGroup>
          <NumberField
            label="°"
            value={angleDeg}
            onChange={(v) => {
              editingRef.current = true;
              setAngleDegStr(v);
            }}
            onCommit={commitAngle}
            step={1}
            width={70}
          />
          <Tooltip title="Gizmo rotation">
            <IconButton
              size="small"
              color={gizmoMode === "rotate" ? "primary" : "default"}
              onClick={() => setGizmoMode((m) => (m === "rotate" ? "off" : "rotate"))}
            >
              <RotateLeft fontSize="small" />
            </IconButton>
          </Tooltip>
          <Box sx={{ flexGrow: 1 }} />
          <ResetButton onClick={resetRotation} />
        </Row>

        {/* Translation */}
        <Row label="Translation">
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
          <Tooltip title="Gizmo translation">
            <IconButton
              size="small"
              color={gizmoMode === "translate" ? "primary" : "default"}
              onClick={() => setGizmoMode((m) => (m === "translate" ? "off" : "translate"))}
            >
              <OpenWith fontSize="small" />
            </IconButton>
          </Tooltip>
          <Box sx={{ flexGrow: 1 }} />
          <ResetButton onClick={resetTranslation} />
        </Row>

        {/* Offset (drawing offset, distinct from baseMap fields) */}
        <Row label="Offset">
          <Slider
            size="small"
            value={Math.min(Math.max(drawingOffset, 0), offsetMax)}
            min={0}
            max={offsetMax}
            step={0.01}
            onChange={handleOffsetSliderChange}
            sx={{ flexGrow: 1, mx: 1, maxWidth: 160 }}
          />
          <NumberField
            label="m"
            value={String(drawingOffset)}
            onChange={handleOffsetFieldChange}
            onCommit={() => {}}
            step={0.1}
          />
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Max
          </Typography>
          <NumberField
            label="m"
            value={String(offsetMax)}
            onChange={(v) => setOffsetMax(parseFloatSafe(v) || 1)}
            onCommit={() => {}}
            step={1}
          />
          <ResetButton onClick={resetOffset} />
        </Row>
      </Stack>
    </Paper>
  );
}

function ResetButton({ onClick }) {
  return (
    <Box
      role="button"
      onClick={onClick}
      sx={{
        cursor: "pointer",
        color: "text.secondary",
        fontSize: 12,
        textDecoration: "underline",
        ml: 0.5,
        userSelect: "none",
        "&:hover": { color: "text.primary" },
      }}
    >
      Reset
    </Box>
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
