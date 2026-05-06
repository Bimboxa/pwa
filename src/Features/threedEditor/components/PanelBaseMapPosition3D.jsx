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

import FieldMeasure from "./FieldMeasure";
import { IconGizmoTranslate, IconGizmoRotate } from "./iconsGizmo";

import {
  Box,
  IconButton,
  Paper,
  Slider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import DragIndicator from "@mui/icons-material/DragIndicator";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

const ROW_LABEL_WIDTH = 80;

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

function ResetText({ onClick }) {
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

export default function PanelBaseMapPosition3D() {
  const dispatch = useDispatch();

  const selected = useSelectedBaseMap();
  const main = useMainBaseMap();
  const baseMap = selected ?? main;
  const baseMapId = baseMap?.id ?? null;

  const drawingOffset = useSelector((s) => s.threedEditor.drawingOffset ?? 0);

  const drag = usePanelDrag();

  const [gizmoMode, setGizmoMode] = useState("off"); // "off" | "translate" | "rotate"

  const [orientation, setOrientation] = useState(DEFAULT_ORIENTATION);
  const [angleDeg, setAngleDegStr] = useState("0");
  const [posUser, setPosUser] = useState({ x: "0", y: "0", z: "0" });

  // Local panel-only config: the slider's max value (m). Default 5m.
  const [offsetMaxStr, setOffsetMaxStr] = useState("5");
  const offsetMax = Math.max(parseFloatSafe(offsetMaxStr) || 1, 0.01);

  const [localOpacity, setLocalOpacity] = useState(baseMap?.opacity ?? 1);
  const lastVisibleOpacityRef = useRef(localOpacity > 0 ? localOpacity : 1);

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

  // Mirror opacity to the basemap mesh material (live, no Dexie roundtrip).
  useEffect(() => {
    const editor = getActiveThreedEditor();
    const group = editor?.sceneManager?.imagesManager?.getGroup(baseMapId);
    if (!group) return;
    group.traverse((child) => {
      if (child.userData?.isBasemap && child.material) {
        child.material.opacity = localOpacity;
      }
    });
    editor.renderScene();
  }, [baseMapId, localOpacity]);

  // Mirror drawingOffset to the inner meshWrap's local-Z translation (the
  // plane normal after the basemap rotation). Affects only the basemap mesh,
  // not the annotations — so the user sees where the next drawn annotation
  // will land relative to the existing geometry.
  useEffect(() => {
    const editor = getActiveThreedEditor();
    const meshWrap = editor?.sceneManager?.imagesManager?.getMeshWrap(baseMapId);
    if (!meshWrap) return;
    meshWrap.position.set(0, 0, drawingOffset);
    editor.renderScene();
  }, [baseMapId, drawingOffset]);

  // Attach the gizmo to the basemap group when a mode is picked. Rotation is
  // constrained to the world Y ring (the scene's vertical axis); translation
  // shows all three axes.
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

  // Mirror live group transform into form fields during drag, persist on end.
  useEffect(() => {
    if (!baseMapId) return;
    const editor = getActiveThreedEditor();
    const tcm = editor?.sceneManager?.transformControlsManager;
    const group = editor?.sceneManager?.imagesManager?.getGroup(baseMapId);
    if (!tcm || !group) return;

    const updateFromGroup = () => {
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

  function commitAngle(raw) {
    editingRef.current = false;
    const a = parseFloatSafe(raw ?? angleDeg);
    setAngleDegStr(roundFmt(a));
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

  function handleOffsetFieldCommit(raw) {
    const n = parseFloatSafe(raw);
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
        minWidth: 480,
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

      <Stack spacing={1.25}>
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
          <FieldMeasure
            value={angleDeg}
            onChange={(v) => {
              editingRef.current = true;
              setAngleDegStr(v);
            }}
            onCommit={commitAngle}
            unit="°"
          />
          <Tooltip title="Gizmo rotation">
            <IconButton
              size="small"
              color={gizmoMode === "rotate" ? "primary" : "default"}
              onClick={() => setGizmoMode((m) => (m === "rotate" ? "off" : "rotate"))}
            >
              <IconGizmoRotate />
            </IconButton>
          </Tooltip>
          <Box sx={{ flexGrow: 1 }} />
          <ResetText onClick={resetRotation} />
        </Row>

        {/* Translation */}
        <Row label="Translation">
          <FieldMeasure
            label="X"
            value={posUser.x}
            onChange={(v) => setPosField("x", v)}
            onCommit={commitPosition}
          />
          <FieldMeasure
            label="Y"
            value={posUser.y}
            onChange={(v) => setPosField("y", v)}
            onCommit={commitPosition}
          />
          <FieldMeasure
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
              <IconGizmoTranslate />
            </IconButton>
          </Tooltip>
          <Box sx={{ flexGrow: 1 }} />
          <ResetText onClick={resetTranslation} />
        </Row>

        {/* Offset (drawing offset; lifts the basemap mesh visually so the user
            can see where the next annotation will land) */}
        <Row label="Offset">
          <Slider
            size="small"
            value={Math.min(Math.max(drawingOffset, 0), offsetMax)}
            min={0}
            max={offsetMax}
            step={0.01}
            onChange={handleOffsetSliderChange}
            sx={{ flexGrow: 1, mx: 1, maxWidth: 180 }}
          />
          <FieldMeasure
            value={String(drawingOffset)}
            onChange={() => {}}
            onCommit={handleOffsetFieldCommit}
            unit="m"
          />
          <Typography variant="caption" sx={{ color: "text.secondary", ml: 0.5 }}>
            Max
          </Typography>
          <FieldMeasure
            value={offsetMaxStr}
            onChange={setOffsetMaxStr}
            onCommit={() => {}}
            unit="m"
          />
          <ResetText onClick={resetOffset} />
        </Row>
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
