import { useDispatch, useSelector } from "react-redux";

import { Box, Paper, Typography, Switch } from "@mui/material";

import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import {
  setAutoMergeOnCommit,
  setAutoOffsetsOnCommit,
  setAvoidVisibleAnnotationsOnCommit,
  setDefaultOffsetOnCommit,
  setRepairMode,
} from "Features/mapEditor/mapEditorSlice";
import { REPAIR_MODES } from "Features/localizedRepair/constants/repairShortcuts";

import CardLoupe from "Features/smartDetect/components/CardLoupe";
import CardSmartDetect from "Features/smartDetect/components/CardSmartDetect";
import SectionSurfaceDropOptions from "Features/smartDetect/components/SectionSurfaceDropOptions";
import SectionShortcutHelpers from "Features/annotations/components/SectionShortcutHelpers";
import getEffectiveDetectionMode from "Features/mapEditor/utils/getEffectiveDetectionMode";

// Modes that select existing geometry — no smart detect needed
const SEGMENT_SELECT_MODES = [
  "TECHNICAL_RETURN",
  "CUT_SEGMENT",
  "SPLIT_POLYLINE",
  "SPLIT_POLYLINE_CLICK",
];

// Shortcuts of the 3D OBJECT_3D placement mode (Dessin module toggled to 3D)
// — handled by object3DPlacementController.
const THREED_PLACEMENT_SHORTCUTS = [
  { key: "← →", label: "Tourner l'objet de 10°" },
  { key: "⇧ ← →", label: "Tourner l'objet de 1°" },
  { key: "R", label: "Réinitialiser la rotation" },
  { key: "Esc", label: "Quitter le mode dessin" },
];

// Modes where the "Détection auto" card makes sense — the base drawing
// tool has a backing detection algorithm (see getEffectiveDetectionMode).
const SMART_DETECT_CAPABLE_MODES = [
  "POLYLINE_RECTANGLE",
  "POLYGON_RECTANGLE",
  "CUT_RECTANGLE",
  "RECTANGLE",
  "STRIP",
  "POLYLINE_CLICK",
  "POLYGON_CLICK",
  // SEGMENT tool → dark-band snapping (SEGMENT_SNAP, hover-only)
  "SEGMENT",
  "POLYLINE_SEGMENT",
  "STRIP_SEGMENT",
];

// ---------------------------------------------------------------------------
// SectionRepairModes — localized-repair type selector (Auto / L / T / Lissage),
// one selectable line per mode with its keyboard shortcut at the end.
// ---------------------------------------------------------------------------

function SectionRepairModes() {
  const dispatch = useDispatch();
  const repairMode = useSelector((s) => s.mapEditor.repairMode);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
        Type de réparation
      </Typography>
      {REPAIR_MODES.map(({ mode, label, shortcut }) => {
        const selected = repairMode === mode;
        return (
          <Paper
            key={mode}
            elevation={0}
            onClick={() => dispatch(setRepairMode(mode))}
            sx={{
              px: 1,
              py: 0.5,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              border: "1px solid",
              borderColor: selected ? "primary.main" : "transparent",
              bgcolor: selected ? "primary.main" : "background.default",
              color: selected ? "primary.contrastText" : "text.secondary",
              "&:hover": {
                bgcolor: selected ? "primary.main" : "action.hover",
              },
            }}
          >
            <Typography
              variant="caption"
              sx={{ fontWeight: selected ? 600 : 400 }}
            >
              {label}
            </Typography>
            <Box
              sx={{
                px: 0.5,
                py: 0,
                borderRadius: 0.5,
                bgcolor: selected ? "rgba(255,255,255,0.25)" : "action.hover",
                color: selected ? "primary.contrastText" : "text.secondary",
                fontSize: "0.65rem",
                fontWeight: 600,
                lineHeight: 1.4,
              }}
            >
              {shortcut}
            </Box>
          </Paper>
        );
      })}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// SectionDrawingHelperContent — per-drawing-mode helper cards (loupe, smart
// detect, mode switches, shortcut helpers). Shared by the floating
// PopperDrawingHelper and the Dessin left panel.
// ---------------------------------------------------------------------------

export default function SectionDrawingHelperContent() {
  const dispatch = useDispatch();

  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const smartDetectEnabled = useSelector((s) => s.mapEditor.smartDetectEnabled);
  // Dessin module toggled to its 3D editor: the drawing state drives the 3D
  // OBJECT_3D placement mode. The 2D-only helpers (loupe, 2D shortcuts) must
  // not mount — CardLoupe's SmartZoomContext only exists in the 2D editor.
  const isThreedToggledEditor = useSelector((s) =>
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
  const autoMergeOnCommit = useSelector((s) => s.mapEditor.autoMergeOnCommit);
  const autoOffsetsOnCommit = useSelector(
    (s) => s.mapEditor.autoOffsetsOnCommit
  );
  const avoidVisibleAnnotationsOnCommit = useSelector(
    (s) => s.mapEditor.avoidVisibleAnnotationsOnCommit
  );
  const defaultOffsetOnCommit = useSelector(
    (s) => s.mapEditor.defaultOffsetOnCommit
  );
  const isSegmentSelectMode = SEGMENT_SELECT_MODES.includes(enabledDrawingMode);
  const showSmartDetectCard =
    SMART_DETECT_CAPABLE_MODES.includes(enabledDrawingMode);
  const showAutoMerge =
    enabledDrawingMode === "POLYGON_RECTANGLE" ||
    enabledDrawingMode === "POLYGON_CLICK";
  const showAutoOffsets = enabledDrawingMode === "POLYGON_CLICK";
  const showAvoidVisibleAnnotations =
    enabledDrawingMode === "POLYGON_RECTANGLE" ||
    enabledDrawingMode === "POLYGON_CLICK" ||
    enabledDrawingMode === "SURFACE_DROP";
  // "Offset par défaut" applies to every annotation-drawing mode/type — shown in
  // the 2D drawing helper, but not in the 3D-toggled placement branch (OBJECT_3D
  // placement uses drawingOffset) nor the non-annotation segment-select/repair modes.
  const showDefaultOffset =
    !isThreedToggledEditor &&
    !isSegmentSelectMode &&
    Boolean(enabledDrawingMode) &&
    !["REASSIGN_TEMPLATE", "LOCALIZED_REPAIR"].includes(enabledDrawingMode);

  // Kept for future use (e.g. to conditionally show helper UI per target).
  // Referenced here so the helper stays imported by the component.
  const effectiveDetection = getEffectiveDetectionMode({
    enabledDrawingMode,
    smartDetectEnabled,
  });
  void effectiveDetection;

  // render

  return (
    <Box sx={{ p: 1, display: "flex", flexDirection: "column", gap: 1 }}>
      {!isThreedToggledEditor &&
        !isSegmentSelectMode &&
        enabledDrawingMode !== "REASSIGN_TEMPLATE" &&
        enabledDrawingMode !== "LOCALIZED_REPAIR" && <CardLoupe />}
      {isThreedToggledEditor && (
        <Box
          sx={{
            px: 1.5,
            py: 1.5,
            borderRadius: 1,
            bgcolor: "primary.main",
            color: "primary.contrastText",
            fontSize: "0.875rem",
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          {"Cliquez sur le plan pour poser l'objet 3D"}
        </Box>
      )}
      {enabledDrawingMode === "LOCALIZED_REPAIR" && <SectionRepairModes />}
      {enabledDrawingMode === "REASSIGN_TEMPLATE" && (
        <Box
          sx={{
            px: 1.5,
            py: 1.5,
            borderRadius: 1,
            bgcolor: "primary.main",
            color: "primary.contrastText",
            fontSize: "0.875rem",
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          Cliquez sur une annotation pour modifier son modèle
        </Box>
      )}
      {enabledDrawingMode === "CUT_SEGMENT" && (
        <Box
          sx={{
            px: 1.5,
            py: 1.5,
            borderRadius: 1,
            bgcolor: "primary.main",
            color: "primary.contrastText",
            fontSize: "0.875rem",
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          Cliquez sur un segment pour le supprimer
        </Box>
      )}
      {enabledDrawingMode === "SPLIT_POLYLINE_CLICK" && (
        <Box
          sx={{
            px: 1.5,
            py: 1.5,
            borderRadius: 1,
            bgcolor: "primary.main",
            color: "primary.contrastText",
            fontSize: "0.875rem",
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          {"Cliquez sur un point le long d'une polyligne pour la couper en 2"}
        </Box>
      )}
      {showSmartDetectCard && <CardSmartDetect />}
      {enabledDrawingMode === "SURFACE_DROP" && <SectionSurfaceDropOptions />}
      {showAutoMerge && (
        <Paper
          elevation={0}
          sx={{
            px: 1,
            py: 0.5,
            bgcolor: "background.default",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Fusion automatique
          </Typography>
          <Switch
            size="small"
            checked={Boolean(autoMergeOnCommit)}
            onChange={(e) => dispatch(setAutoMergeOnCommit(e.target.checked))}
          />
        </Paper>
      )}
      {showAvoidVisibleAnnotations && (
        <Paper
          elevation={0}
          sx={{
            px: 1,
            py: 0.5,
            bgcolor: "background.default",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Eviter les annotations visibles
          </Typography>
          <Switch
            size="small"
            checked={Boolean(avoidVisibleAnnotationsOnCommit)}
            onChange={(e) =>
              dispatch(setAvoidVisibleAnnotationsOnCommit(e.target.checked))
            }
          />
        </Paper>
      )}
      {showAutoOffsets && (
        <Paper
          elevation={0}
          sx={{
            px: 1,
            py: 0.5,
            bgcolor: "background.default",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Typography variant="caption" color="text.secondary">
              Rampe auto
            </Typography>
            <Box
              sx={{
                px: 0.5,
                py: 0,
                borderRadius: 0.5,
                bgcolor: "action.hover",
                color: "text.secondary",
                fontSize: "0.65rem",
                fontWeight: 600,
                lineHeight: 1.4,
              }}
            >
              O
            </Box>
          </Box>
          <Switch
            size="small"
            checked={Boolean(autoOffsetsOnCommit)}
            onChange={(e) => dispatch(setAutoOffsetsOnCommit(e.target.checked))}
          />
        </Paper>
      )}
      {showDefaultOffset && (
        <Paper
          elevation={0}
          sx={{
            px: 1,
            py: 0.5,
            bgcolor: "background.default",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Typography variant="caption" color="text.secondary">
              Offset par défaut
            </Typography>
            <Box
              sx={{
                px: 0.5,
                py: 0,
                borderRadius: 0.5,
                bgcolor: "action.hover",
                color: "text.secondary",
                fontSize: "0.65rem",
                fontWeight: 600,
                lineHeight: 1.4,
              }}
            >
              Z
            </Box>
          </Box>
          <Switch
            size="small"
            checked={Boolean(defaultOffsetOnCommit)}
            onChange={(e) =>
              dispatch(setDefaultOffsetOnCommit(e.target.checked))
            }
          />
        </Paper>
      )}
      <SectionShortcutHelpers
        shortcuts={
          isThreedToggledEditor ? THREED_PLACEMENT_SHORTCUTS : undefined
        }
      />
    </Box>
  );
}
