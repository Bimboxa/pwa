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
import usePanelDrag from "Features/layout/hooks/usePanelDrag";

import {
  toUserCoords,
  fromUserCoords,
} from "Features/threedEditor/utils/userCoords";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import {
  setDrawingOffset,
  setBaseMapOpacityIn3d,
} from "Features/threedEditor/threedEditorSlice";

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
import RestartAlt from "@mui/icons-material/RestartAlt";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

const SECTION_INDENT = 0;
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

function SectionRow({ children }) {
  // useFlexGap so `ml: auto` on the trailing gizmo actually pushes it to the
  // right end. Default Stack spacing uses margins, which take precedence over
  // an item's own `marginLeft: auto` and break the vertical alignment of the
  // gizmos across rows.
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      useFlexGap
      sx={{ pl: SECTION_INDENT }}
    >
      {children}
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
          // Lock the size on every axis so the offset row's flex-grow slider
          // can't compress this button and break vertical alignment with the
          // rotation/translation gizmos above.
          width: GIZMO_BTN_SIZE,
          height: GIZMO_BTN_SIZE,
          minWidth: GIZMO_BTN_SIZE,
          minHeight: GIZMO_BTN_SIZE,
          flexShrink: 0,
          p: 0,
          ml: "auto", // pin to the right end so gizmos align across rows
        }}
      >
        {children}
      </ToggleButton>
    </Tooltip>
  );
}

export default function PanelBaseMapPosition3D() {
  const dispatch = useDispatch();

  const selected = useSelectedBaseMap();
  const main = useMainBaseMap();
  const baseMap = selected ?? main;
  const baseMapId = baseMap?.id ?? null;

  const drawingOffset = useSelector((s) => s.threedEditor.drawingOffset ?? 0);
  const opacity = useSelector(
    (s) => s.threedEditor.baseMapOpacityIn3d ?? 1
  );

  const drag = usePanelDrag();

  // "off" | "translate" | "rotate" | "offset". Mutually exclusive — only one
  // gizmo is active at a time, since TransformControls is a singleton.
  const [gizmoMode, setGizmoMode] = useState("off");

  const [orientation, setOrientation] = useState(DEFAULT_ORIENTATION);
  const [angleDeg, setAngleDegStr] = useState("0");
  const [posUser, setPosUser] = useState({ x: "0", y: "0", z: "0" });

  // Local panel-only config: the slider's max value (m). Default 5m.
  const [offsetMaxStr, setOffsetMaxStr] = useState("5");
  const offsetMax = Math.max(parseFloatSafe(offsetMaxStr) || 1, 0.01);

  const lastVisibleOpacityRef = useRef(opacity > 0 ? opacity : 1);
  useEffect(() => {
    if (opacity > 0) lastVisibleOpacityRef.current = opacity;
  }, [opacity]);

  const editingRef = useRef(false);

  const refreshFromBaseMap = useMemo(
    () => () => {
      if (!baseMap) return;
      const t = getBaseMapTransform(baseMap);
      setOrientation(t.orientation);
      setAngleDegStr(roundFmt(t.angleDeg, 1));
      const userPos = toUserCoords(t.position);
      setPosUser({
        x: roundFmt(userPos.x),
        y: roundFmt(userPos.y),
        z: roundFmt(userPos.z),
      });
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
    refreshFromBaseMap,
  ]);

  // Mirror drawingOffset to the inner meshWrap's local-Z translation. Affects
  // only the basemap mesh (not the annotations) so the user sees where the
  // next drawn annotation will land relative to the existing geometry.
  useEffect(() => {
    const editor = getActiveThreedEditor();
    const meshWrap = editor?.sceneManager?.imagesManager?.getMeshWrap(baseMapId);
    if (!meshWrap) return;
    meshWrap.position.set(0, 0, drawingOffset);
    editor.renderScene();
  }, [baseMapId, drawingOffset]);

  // Attach + configure the gizmo per mode.
  useEffect(() => {
    if (!baseMapId) return;
    const editor = getActiveThreedEditor();
    if (!editor) return;
    const tcm = editor.sceneManager?.transformControlsManager;
    if (!tcm) return;

    if (gizmoMode === "off") {
      tcm.detach();
      return;
    }

    const group = editor.sceneManager?.imagesManager?.getGroup(baseMapId);
    const meshWrap = editor.sceneManager?.imagesManager?.getMeshWrap(baseMapId);

    if (gizmoMode === "rotate" && group) {
      tcm.attach(group);
      tcm.setMode("rotate");
      tcm.setSpace("world");
      tcm.setShowAxes({ x: false, y: true, z: false });
    } else if (gizmoMode === "translate" && group) {
      tcm.attach(group);
      tcm.setMode("translate");
      tcm.setSpace("world");
      tcm.setShowAxes({ x: true, y: true, z: true });
    } else if (gizmoMode === "offset" && meshWrap) {
      tcm.attach(meshWrap);
      tcm.setMode("translate");
      tcm.setSpace("local");
      tcm.setShowAxes({ x: false, y: false, z: true });
    }

    return () => tcm.detach();
  }, [baseMapId, gizmoMode]);

  // Live updates from the gizmo: mirror to form fields (and Redux for offset),
  // and persist on drag end.
  useEffect(() => {
    if (!baseMapId) return;
    const editor = getActiveThreedEditor();
    const tcm = editor?.sceneManager?.transformControlsManager;
    if (!tcm) return;

    let unsub = () => {};

    if (gizmoMode === "rotate" || gizmoMode === "translate") {
      const group = editor.sceneManager?.imagesManager?.getGroup(baseMapId);
      if (!group) return;
      const update = () => {
        const ang = group.rotation.y * (180 / Math.PI);
        setAngleDegStr(roundFmt(ang, 1));
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
      unsub = tcm.subscribe(update);
      tcm.setDragEndCallback(() => {
        const ang = group.rotation.y * (180 / Math.PI);
        const position = {
          x: group.position.x,
          y: group.position.y,
          z: group.position.z,
        };
        db.baseMaps.update(baseMapId, { angleDeg: ang, position });
      });
    } else if (gizmoMode === "offset") {
      const meshWrap = editor.sceneManager?.imagesManager?.getMeshWrap(baseMapId);
      if (!meshWrap) return;
      const update = () => {
        dispatch(setDrawingOffset(meshWrap.position.z));
      };
      unsub = tcm.subscribe(update);
      tcm.setDragEndCallback(null);
    }

    return () => {
      unsub();
      tcm.setDragEndCallback(null);
    };
  }, [baseMapId, gizmoMode, dispatch]);

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
    setAngleDegStr(roundFmt(a, 1));
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
    if (value > 0) lastVisibleOpacityRef.current = value;
    dispatch(setBaseMapOpacityIn3d(value));
  }

  function toggleVisibility() {
    const next = opacity > 0 ? 0 : lastVisibleOpacityRef.current || 1;
    dispatch(setBaseMapOpacityIn3d(next));
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
        width: 380,
      }}
    >
      {/* Header: drag handle + title (left) and opacity slider + visibility
          toggle (right, same line as the title). */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        useFlexGap
        sx={{ mb: 1.5 }}
      >
        <Box
          onMouseDown={drag.handleMouseDown}
          sx={{ cursor: "grab", display: "flex", alignItems: "center", color: "text.secondary" }}
        >
          <DragIndicator fontSize="small" />
        </Box>
        <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: 700 }}>
          Fond de plan
        </Typography>
        <Slider
          size="small"
          value={opacity}
          min={0}
          max={1}
          step={0.01}
          onChange={handleOpacityChange}
          sx={{ width: 100, mr: 1 }}
        />
        <Tooltip title={opacity > 0 ? "Masquer" : "Afficher"}>
          <IconButton size="small" onClick={toggleVisibility}>
            {opacity > 0 ? (
              <Visibility fontSize="small" />
            ) : (
              <VisibilityOff fontSize="small" color="error" />
            )}
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack spacing={1.75}>
        {/* Rotation */}
        <Box>
          <SectionHeader title="Rotation" onReset={resetRotation} />
          <SectionRow>
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
              width={56}
            />
            <GizmoToggle
              tooltip="Gizmo rotation"
              active={gizmoMode === "rotate"}
              onClick={() => setGizmoMode((m) => (m === "rotate" ? "off" : "rotate"))}
            >
              <IconGizmoRotate />
            </GizmoToggle>
          </SectionRow>
        </Box>

        {/* Translation */}
        <Box>
          <SectionHeader title="Translation" onReset={resetTranslation} />
          <SectionRow>
            <FieldMeasure
              label="X"
              value={posUser.x}
              onChange={(v) => setPosField("x", v)}
              onCommit={commitPosition}
              width={56}
            />
            <FieldMeasure
              label="Y"
              value={posUser.y}
              onChange={(v) => setPosField("y", v)}
              onCommit={commitPosition}
              width={56}
            />
            <FieldMeasure
              label="Z"
              value={posUser.z}
              onChange={(v) => setPosField("z", v)}
              onCommit={commitPosition}
              width={56}
            />
            <GizmoToggle
              tooltip="Gizmo translation"
              active={gizmoMode === "translate"}
              onClick={() => setGizmoMode((m) => (m === "translate" ? "off" : "translate"))}
            >
              <IconGizmoTranslate />
            </GizmoToggle>
          </SectionRow>
        </Box>

        {/* Offset */}
        <Box>
          <SectionHeader title="Offset" onReset={resetOffset} />
          <SectionRow>
            <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
              Max
            </Typography>
            <FieldMeasure
              value={offsetMaxStr}
              onChange={setOffsetMaxStr}
              onCommit={() => {}}
              unit="m"
              width={42}
            />
            <Slider
              size="small"
              value={Math.min(Math.max(drawingOffset, -offsetMax), offsetMax)}
              min={-offsetMax}
              max={offsetMax}
              step={0.01}
              marks={[{ value: 0 }]}
              onChange={handleOffsetSliderChange}
              sx={{ flexGrow: 1, mx: 1, minWidth: 60 }}
            />
            <FieldMeasure
              value={roundFmt(drawingOffset, 2)}
              onChange={() => {}}
              onCommit={handleOffsetFieldCommit}
              unit="m"
              width={56}
            />
            <GizmoToggle
              tooltip="Gizmo offset (axe normal)"
              active={gizmoMode === "offset"}
              onClick={() => setGizmoMode((m) => (m === "offset" ? "off" : "offset"))}
            >
              <IconGizmoTranslate />
            </GizmoToggle>
          </SectionRow>
        </Box>
      </Stack>
    </Paper>
  );
}

function parseFloatSafe(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function roundFmt(n, decimals = 3) {
  if (!Number.isFinite(n)) return "0";
  const factor = Math.pow(10, decimals);
  return String(Math.round(n * factor) / factor);
}
