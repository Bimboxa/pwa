import { useDispatch, useSelector } from "react-redux";

import {
  Alert,
  Box,
  Paper,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import {
  setAutoMergeOnCommit,
  setAutoOffsetsOnCommit,
  setAvoidVisibleAnnotationsOnCommit,
  setDefaultOffsetOnCommit,
  setJoinMergeIfPossible,
  setMeshBrushCreate2dIfPossible,
  setMeshBrushPartMode,
  setRepairMode,
} from "Features/mapEditor/mapEditorSlice";
import { REPAIR_MODES } from "Features/localizedRepair/constants/repairShortcuts";
import { selectMeshBrushPartType } from "Features/meshPaint/utils/meshBrushSelectors";
import { selectHiddenAnnotationTemplateIdSet } from "Features/scopeVisibility/selectors/scopeVisibilitySelectors";
import { MESH_PAINT_PART_TYPES } from "Features/meshPaint/constants/meshPaintConstants";
import { isSurfaceCutDraft } from "Features/surfaceCut/utils/surfaceCutTools";
import { selectIsFaceCutDrawActive } from "Features/threedDrawing/utils/templateFaceDrawSelectors";

import CardLoupe from "Features/smartDetect/components/CardLoupe";
import CardSmartDetect from "Features/smartDetect/components/CardSmartDetect";
import SectionSurfaceDropOptions from "Features/smartDetect/components/SectionSurfaceDropOptions";
import SectionShortcutHelpers from "Features/annotations/components/SectionShortcutHelpers";
import getEffectiveDetectionMode from "Features/mapEditor/utils/getEffectiveDetectionMode";
import SectionScene3dPickingStatus from "Features/scene3d/components/SectionScene3dPickingStatus";
import SectionMeshBrushPaintedTotal from "Features/meshPaint/components/SectionMeshBrushPaintedTotal";
import { selectIsObject3DPlacementActive } from "Features/threedEditor/utils/object3DPlacementSelectors";
import { selectIsTemplateCoteDrawActive } from "Features/threedDrawing/utils/templateCoteDrawSelectors";
import selectActiveThreedTool from "Features/threedDrawing/utils/selectActiveThreedTool";
import SectionThreedToolHelperContent from "Features/threedDrawing/components/SectionThreedToolHelperContent";
import SectionTransformToolHelper2d from "Features/annotationTransform/components/SectionTransformToolHelper2d";
import { isTransformToolMode } from "Features/annotationTransform/utils/transformToolModes";

// Modes that select existing geometry — no smart detect needed
const SEGMENT_SELECT_MODES = [
  "TECHNICAL_RETURN",
  "CUT_SEGMENT",
  "ISOLATE_SEGMENT",
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

// Shortcuts of the 3D line / face drawing (useDrawingPointerHandlers).
const THREED_DRAWING_SHORTCUTS = [
  { key: "Entrée", label: "Terminer le dessin" },
  { key: "Esc", label: "Terminer / Quitter le dessin" },
];

// Shortcuts of « Couper une surface » (2D): the segment cuts at its 2nd click.
const SURFACE_CUT_SHORTCUTS = [
  { key: "Entrée", label: "Couper (polyligne)" },
  { key: "Tab", label: "Segment / Polyligne" },
  { key: "Esc", label: "Annuler le trait / Quitter" },
];

// Shortcuts of the "Coupe face" tools (useDrawingToolHotkeys for the tool
// letters, useDrawingPointerHandlers for the rest).
const FACE_CUT_SHORTCUTS = [
  { key: "Tab", label: "Outil suivant" },
  { key: "K / L / R", label: "Segment / Polyligne / Rectangle" },
  { key: "H / V", label: "Découpe horizontale / verticale" },
  { key: "X / Y", label: "Saisir une dimension (rectangle)" },
  { key: "0-9", label: "Saisir la distance (découpe H / V)" },
  { key: "S", label: "Changer de côté (découpe verticale)" },
  { key: "Entrée", label: "Couper" },
  { key: "Esc", label: "Annuler le tracé / Quitter" },
];

// Message of each "Coupe face" tool, by its key (enabledDrawingMode).
const FACE_CUT_MESSAGES = {
  FACE_CUT_SEGMENT: "Cliquez 2 points sur une face pour la couper",
  FACE_CUT_POLYLINE:
    "Cliquez les points du tracé sur une face (Entrée pour couper)",
  FACE_CUT_RECTANGLE:
    "Cliquez les 2 angles du rectangle sur une face (X / Y pour saisir les dimensions)",
  FACE_CUT_HORIZONTAL:
    "Survolez une face : cliquez pour la couper à l'horizontale (un mur devient un maillage)",
  FACE_CUT_VERTICAL:
    "Survolez une face : cliquez pour la couper à la verticale",
};

// Shortcuts of the 3D two-click cote (useDimensionPointerHandlers).
const THREED_COTE_SHORTCUTS = [{ key: "Esc", label: "Quitter le mode dessin" }];

// Shortcuts of the « Pinceau » (useMeshBrushPointerHandlers).
const THREED_MESH_BRUSH_SHORTCUTS = [
  { key: "Clic", label: "Peindre / retirer la peinture" },
  { key: "Esc", label: "Quitter le pinceau" },
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

  // strings

  const meshBrushHiddenS =
    "Le modèle actif est masqué : les parties peintes ne seront pas visibles.";
  const meshBrushPartS = "Partie peinte";
  const meshBrushFaceS = "Facette";
  const meshBrushEdgeS = "Arête";
  const meshBrushCreate2dS = "Créer une annotation 2D si possible";
  const surfaceCutS =
    "Tracez un trait à travers la surface : elle est coupée en autant d'annotations que de morceaux";

  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  // threedEditor tool armed from « Outils de dessin » (Extruder / Déplacer /
  // Tourner in the 3D editor): its own helper body, no drawing state.
  const activeThreedTool = useSelector(selectActiveThreedTool);
  const smartDetectEnabled = useSelector((s) => s.mapEditor.smartDetectEnabled);
  // Dessin module toggled to its 3D editor: the drawing state drives a 3D
  // mode. The 2D-only helpers (loupe, 2D shortcuts, image detection) must
  // not mount — CardLoupe's SmartZoomContext only exists in the 2D editor.
  const isThreedToggledEditor = useSelector((s) =>
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
  // Which 3D mode the drawing state drives: OBJECT_3D placement, the
  // two-click cote, or (default) the line / face drawing.
  const isObject3DPlacement = useSelector(selectIsObject3DPlacementActive);
  const isThreedCoteDraw = useSelector(selectIsTemplateCoteDrawActive);
  // « Pinceau »: "FACE" (Surface template) / "EDGE" (Ligne template), null
  // when the brush is not armed.
  const meshBrushPartType = useSelector(selectMeshBrushPartType);
  const isMeshBrush = Boolean(meshBrushPartType);
  // « Créer une annotation 2D si possible »: a painted part the plan can
  // hold becomes a 2D annotation instead of a paint row.
  const meshBrushCreate2dIfPossible = useSelector(
    (s) => s.mapEditor.meshBrushCreate2dIfPossible
  );
  // A paint is shown only when its own template and listing are visible:
  // warn when the armed template (or its listing) is hidden.
  const isMeshBrushTemplateHidden = useSelector((s) => {
    if (!selectMeshBrushPartType(s)) return false;
    const na = s.annotations.newAnnotation;
    return (
      selectHiddenAnnotationTemplateIdSet(s).has(na.annotationTemplateId) ||
      Boolean(
        na.listingId && s.listings.hiddenListingsIds?.includes(na.listingId)
      )
    );
  });
  // Lines and cotes can land their points on a scan base map: show the
  // status of its picking data (being prepared / ready). Not the brush: it
  // paints annotation parts only.
  const canDrawOnScan = useSelector(
    (s) =>
      s.annotations.newAnnotation?.type === "POLYLINE" ||
      selectIsTemplateCoteDrawActive(s)
  );
  // "Coupe face" (3D): one message per tool, its own shortcuts.
  const isFaceCut = useSelector(selectIsFaceCutDrawActive);
  const faceCutMessage = isFaceCut
    ? (FACE_CUT_MESSAGES[enabledDrawingMode] ??
      "Tracez sur une face pour la couper")
    : null;
  const threedMessage = isObject3DPlacement
    ? "Cliquez sur le plan pour poser l'objet 3D"
    : isThreedCoteDraw
      ? "Cliquez deux points pour poser la cote"
      : isMeshBrush
        ? meshBrushPartType === MESH_PAINT_PART_TYPES.EDGE
          ? "Cliquez une arête pour la peindre (re-cliquez pour retirer)"
          : "Cliquez une face pour la peindre (re-cliquez pour retirer)"
        : (faceCutMessage ?? "Cliquez pour poser les points du tracé");
  const threedShortcuts = isObject3DPlacement
    ? THREED_PLACEMENT_SHORTCUTS
    : isThreedCoteDraw
      ? THREED_COTE_SHORTCUTS
      : isMeshBrush
        ? THREED_MESH_BRUSH_SHORTCUTS
        : isFaceCut
          ? FACE_CUT_SHORTCUTS
          : THREED_DRAWING_SHORTCUTS;
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
  const joinMergeIfPossible = useSelector(
    (s) => s.mapEditor.joinMergeIfPossible
  );
  const isSegmentSelectMode = SEGMENT_SELECT_MODES.includes(enabledDrawingMode);
  // « Couper une surface »: a POLYLINE_* mode drawing a trace, not an
  // annotation — no image detection, no offset.
  const isSurfaceCut = useSelector((s) =>
    isSurfaceCutDraft(s.annotations.newAnnotation)
  );
  const showSmartDetectCard =
    !isSurfaceCut && SMART_DETECT_CAPABLE_MODES.includes(enabledDrawingMode);
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
    !isSurfaceCut &&
    Boolean(enabledDrawingMode) &&
    ![
      "REASSIGN_TEMPLATE",
      "LOCALIZED_REPAIR",
      "JOIN_ANNOTATIONS",
      "CHAT_REPAIR",
    ].includes(enabledDrawingMode);

  // Kept for future use (e.g. to conditionally show helper UI per target).
  // Referenced here so the helper stays imported by the component.
  const effectiveDetection = getEffectiveDetectionMode({
    enabledDrawingMode,
    smartDetectEnabled,
  });
  void effectiveDetection;

  // render

  if (activeThreedTool) {
    return <SectionThreedToolHelperContent tool={activeThreedTool} />;
  }

  // 2D « Déplacer » / « Tourner »: the loupe (to aim at the points) + the
  // tool's own helper body.
  if (!isThreedToggledEditor && isTransformToolMode(enabledDrawingMode)) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        <Box sx={{ p: 1, pb: 0 }}>
          <CardLoupe />
        </Box>
        <SectionTransformToolHelper2d mode={enabledDrawingMode} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1, display: "flex", flexDirection: "column", gap: 1 }}>
      {!isThreedToggledEditor &&
        !isSegmentSelectMode &&
        enabledDrawingMode !== "REASSIGN_TEMPLATE" &&
        enabledDrawingMode !== "LOCALIZED_REPAIR" &&
        enabledDrawingMode !== "JOIN_ANNOTATIONS" &&
        enabledDrawingMode !== "CHAT_REPAIR" && <CardLoupe />}
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
          {threedMessage}
        </Box>
      )}
      {isThreedToggledEditor && isMeshBrush && isMeshBrushTemplateHidden && (
        <Alert severity="warning" sx={{ py: 0, fontSize: "0.8125rem" }}>
          {meshBrushHiddenS}
        </Alert>
      )}
      {isThreedToggledEditor && isMeshBrush && (
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
            {meshBrushPartS}
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={meshBrushPartType}
            onChange={(e, value) => {
              if (value) dispatch(setMeshBrushPartMode(value));
            }}
          >
            <ToggleButton
              value={MESH_PAINT_PART_TYPES.FACE}
              sx={{ py: 0.25, px: 1, textTransform: "none" }}
            >
              {meshBrushFaceS}
            </ToggleButton>
            <ToggleButton
              value={MESH_PAINT_PART_TYPES.EDGE}
              sx={{ py: 0.25, px: 1, textTransform: "none" }}
            >
              {meshBrushEdgeS}
            </ToggleButton>
          </ToggleButtonGroup>
        </Paper>
      )}
      {isThreedToggledEditor && isMeshBrush && (
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
            {meshBrushCreate2dS}
          </Typography>
          <Switch
            size="small"
            checked={Boolean(meshBrushCreate2dIfPossible)}
            onChange={(e) =>
              dispatch(setMeshBrushCreate2dIfPossible(e.target.checked))
            }
          />
        </Paper>
      )}
      {isThreedToggledEditor && isMeshBrush && <SectionMeshBrushPaintedTotal />}
      {isThreedToggledEditor && canDrawOnScan && !isMeshBrush && (
        <SectionScene3dPickingStatus />
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
      {isSurfaceCut && !isThreedToggledEditor && (
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
          {surfaceCutS}
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
      {enabledDrawingMode === "ISOLATE_SEGMENT" && (
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
          {"Cliquez sur un segment pour l'isoler (coupe à ses deux extrémités)"}
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
      {enabledDrawingMode === "JOIN_ANNOTATIONS" && (
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
          {"Dessinez un rectangle autour des extrémités à raccorder"}
        </Box>
      )}
      {enabledDrawingMode === "JOIN_ANNOTATIONS" && (
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
            Fusionner si possible
          </Typography>
          <Switch
            size="small"
            checked={Boolean(joinMergeIfPossible)}
            onChange={(e) => dispatch(setJoinMergeIfPossible(e.target.checked))}
          />
        </Paper>
      )}
      {enabledDrawingMode === "CHAT_REPAIR" && (
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
          {"Dessinez un rectangle autour de la zone à réparer (2 clics)"}
        </Box>
      )}
      {/* 2D image detection: meaningless in the 3D editor */}
      {showSmartDetectCard && !isThreedToggledEditor && <CardSmartDetect />}
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
          isThreedToggledEditor
            ? threedShortcuts
            : isSurfaceCut
              ? SURFACE_CUT_SHORTCUTS
              : undefined
        }
      />
    </Box>
  );
}
