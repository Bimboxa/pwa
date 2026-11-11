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
  setCoplanarPoints3d,
  setDefaultOffsetOnCommit,
  setJoinMergeIfPossible,
  setMeshBrushCreateAnnotation,
  setMeshBrushPaintAllEdges,
  setMeshBrushPaintAllFaces,
  setMeshBrushPartMode,
  setRepairMode,
  setTemplateBrushDuplicateTarget,
} from "Features/mapEditor/mapEditorSlice";
import { REPAIR_MODES } from "Features/localizedRepair/constants/repairShortcuts";
import { selectMeshBrushPartType } from "Features/meshPaint/utils/meshBrushSelectors";
import { isMeshBrushDrawingMode } from "Features/meshPaint/utils/meshBrushTools";
import { selectHiddenAnnotationTemplateIdSet } from "Features/scopeVisibility/selectors/scopeVisibilitySelectors";
import { MESH_PAINT_PART_TYPES } from "Features/meshPaint/constants/meshPaintConstants";
import { isSurfaceCutDraft } from "Features/surfaceCut/utils/surfaceCutTools";
import {
  selectIsCutLineDrawActive,
  selectIsFaceCutDrawActive,
  selectIsThreedAxisLockAvailable,
  isCircleRadiusDraftFor3d,
  selectIsThreedPolylineClickDraw,
} from "Features/threedDrawing/utils/templateFaceDrawSelectors";
import { getFaceCutLockedPart } from "Features/threedFaceCut/utils/resolveFaceCutLockedFace";
import { selectIsLoupeEnabled } from "Features/scopeConfig/utils/scopeConfigSelectors";

import CardLoupe from "Features/smartDetect/components/CardLoupe";
import SmartDetectContainer from "Features/smartDetect/components/SmartDetectContainer";
import CardSmartDetect from "Features/smartDetect/components/CardSmartDetect";
import CardWallVectorization from "Features/smartDetect/components/CardWallVectorization";
import SectionSurfaceDropOptions from "Features/smartDetect/components/SectionSurfaceDropOptions";
import SectionHeightCutDrawingOptions from "Features/heightCuts/components/SectionHeightCutDrawingOptions";
import SectionShortcutHelpers from "Features/annotations/components/SectionShortcutHelpers";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import SectionDrawingConstraints from "./SectionDrawingConstraints";
import SectionBaseMapLinkDrawingHelper, {
  SwitchBaseMapLinkAdaptScale,
} from "Features/baseMapLinks/components/SectionBaseMapLinkDrawingHelper";
import {
  isBaseMapLinkDraft,
  isBaseMapLinkLocateDraft,
} from "Features/baseMapLinks/utils/startBaseMapLinkTools";
import SectionDrawingPatternRepeat from "./SectionDrawingPatternRepeat";
import getEffectiveDetectionMode, {
  SMART_DETECT_UI_MODES,
} from "Features/mapEditor/utils/getEffectiveDetectionMode";
import SectionScene3dPickingStatus from "Features/scene3d/components/SectionScene3dPickingStatus";
import SectionMeshBrushPaintedTotal from "Features/meshPaint/components/SectionMeshBrushPaintedTotal";
import { selectIsObject3DPlacementActive } from "Features/threedEditor/utils/object3DPlacementSelectors";
import { selectIsTemplateCoteDrawActive } from "Features/threedDrawing/utils/templateCoteDrawSelectors";
import { selectIsTemplateRulerDrawActive } from "Features/threedDrawing/utils/templateRulerDrawSelectors";
import selectActiveThreedTool from "Features/threedDrawing/utils/selectActiveThreedTool";
import SectionThreedToolHelperContent from "Features/threedDrawing/components/SectionThreedToolHelperContent";
import SectionMeshCreateHelperContent from "Features/threedMesh/components/SectionMeshCreateHelperContent";
import selectIsMeshCreateToolActive from "Features/threedMesh/utils/selectIsMeshCreateToolActive";
import SectionThreedAxisLockHelper from "Features/threedDrawing/components/SectionThreedAxisLockHelper";
import SectionTransformToolHelper2d from "Features/annotationTransform/components/SectionTransformToolHelper2d";
import { isTransformToolMode } from "Features/annotationTransform/utils/transformToolModes";
import SectionChangeStyleHelper from "Features/commandsToolbar/commands/changeStyle/SectionChangeStyleHelper";
import SectionHideAnnotationHelper from "Features/commandsToolbar/commands/hideAnnotation/SectionHideAnnotationHelper";
import SectionProcedureSourceDrawingHelper from "Features/annotationsAuto/components/SectionProcedureSourceDrawingHelper";
import { CHANGE_STYLE_MODE } from "Features/commandsToolbar/commands/changeStyle/changeStyleMode";
import { HIDE_ANNOTATION_MODE } from "Features/commandsToolbar/commands/hideAnnotation/hideAnnotationMode";

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

// A line drawn click by click in 3D: T toggles its last point to an arc
// point (2D parity, SectionShortcutHelpers).
// Cut line of the Maillage module (Features/threedCutLines): a click line
// whose ends the commit extends along the faces; the axis tools and the
// « Décalage » live in its bottom toolbar (CutLineToolbarThreed).
const THREED_CUT_LINE_MESSAGE =
  "Cliquez les points de la ligne de coupe (plan, face, sommet, arête) — Entrée ou double-clic pour terminer : le trait est prolongé le long des faces";
const THREED_CUT_LINE_SHORTCUTS = [
  { key: "0-9", label: "Longueur du segment" },
  { key: "Entrée", label: "Terminer la ligne de coupe" },
  { key: "Esc", label: "Terminer / Quitter la ligne de coupe" },
  { key: "X / Y / Z", label: "Trait selon un axe (barre du bas)" },
];

// Line / surface circle drawn from its centre and radius in 3D: the 2nd
// click commits (useDrawingPointerHandlers), Enter does nothing.
const THREED_CIRCLE_RADIUS_MESSAGE =
  "Cliquez le centre du cercle, puis un point du cercle (ou tapez le rayon)";
const THREED_CIRCLE_RADIUS_SHORTCUTS = [
  { key: "Esc", label: "Annuler le centre / Quitter le dessin" },
];

const THREED_POLYLINE_SHORTCUTS = [
  ...THREED_DRAWING_SHORTCUTS,
  { key: "T", label: "Basculer le dernier point en arc" },
];

// Shortcuts of « Couper une surface » (2D): the segment cuts at its 2nd click.
const SURFACE_CUT_SHORTCUTS = [
  { key: "Entrée", label: "Couper (polyligne)" },
  { key: "Tab", label: "Segment / Polyligne" },
  { key: "Esc", label: "Annuler le trait / Quitter" },
];

// Shortcuts of the "Coupe face" tools (useDrawingToolHotkeys for the tool
// letters, useDrawingPointerHandlers for the rest). The typed dimension /
// distance / length keys are shown by the « Contraintes » card, the arrow
// keys of the segment / polyline by the « Verrou d'axe » card.
const FACE_CUT_SHORTCUTS = [
  { key: "Tab", label: "Outil suivant" },
  { key: "K / L / R", label: "Segment / Polyligne / Rectangle" },
  { key: "H / V", label: "Découpe horizontale / verticale" },
  { key: "S", label: "Changer de côté (découpe verticale)" },
  { key: "0-9", label: "Longueur du segment (segment / polyligne)" },
  { key: "Entrée", label: "Couper" },
  { key: "Esc", label: "Annuler le tracé / Quitter" },
];

// Message of each "Coupe face" tool, by its key (enabledDrawingMode).
const FACE_CUT_MESSAGES = {
  FACE_CUT_SEGMENT:
    "Cliquez 2 points sur une face pour la couper (0-9 : longueur, ↑ → ↓ : verrou d'axe)",
  FACE_CUT_POLYLINE:
    "Cliquez les points du tracé sur une face (0-9 : longueur, ↑ → ↓ : verrou d'axe, Entrée pour couper)",
  FACE_CUT_RECTANGLE:
    "Cliquez les 2 angles du rectangle sur une face (X / Y pour saisir les dimensions)",
  FACE_CUT_HORIZONTAL:
    "Survolez une face : cliquez pour la couper à l'horizontale (un mur devient un maillage, une surface courbe est découpée en pièces)",
  FACE_CUT_VERTICAL:
    "Survolez une face : cliquez pour la couper à la verticale (une révolution se coupe le long d'un méridien)",
};
// Tool launched on a selected face: every tool cuts that face only.
const FACE_CUT_LOCKED_MESSAGE =
  "Face sélectionnée : la coupe se fera sur cette face";

// Shortcuts of the 3D two-click cote (useDrawingPointerHandlers): the 2nd
// click commits, the typed length is shown by the « Contraintes » card.
const THREED_COTE_SHORTCUTS = [
  { key: "0-9", label: "Longueur de la cote" },
  { key: "Esc", label: "Annuler le point / Quitter" },
];

// Shortcuts of the 3D ruler (dimension chain, useDrawingPointerHandlers):
// each segment can take a typed length, Enter / a double click end the chain.
const THREED_RULER_SHORTCUTS = [
  { key: "0-9", label: "Longueur du segment" },
  { key: "Entrée", label: "Terminer la règle" },
  { key: "Esc", label: "Terminer / Quitter la règle" },
];

// Shortcuts of the « Pinceau » (useMeshBrushPointerHandlers).
const THREED_MESH_BRUSH_SHORTCUTS = [
  { key: "Clic", label: "Peindre / retirer la peinture" },
  { key: "Esc", label: "Quitter le pinceau" },
];

// Section mark (Fonds de plan module): a two-click segment, nothing to
// finish.
const SECTION_MARK_SHORTCUTS = [{ key: "Esc", label: "Quitter" }];

// Shortcuts of the « Pinceau » armed in the 2D editor (template brush:
// InteractionLayer MESH_BRUSH branch + useTemplateBrushClick).
const TEMPLATE_BRUSH_2D_SHORTCUTS = [
  { key: "Clic", label: "Appliquer le modèle / dupliquer" },
  { key: "D", label: "Dupliquer l'annotation cible" },
  { key: "Esc", label: "Quitter le pinceau" },
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

// Loupe card, or (loupe disabled in the Dessin module configuration) a hidden
// container so SmartDetectLayer stays mounted — the RECTANGLE / SMART_DETECT
// OpenCV detection runs in it (canvas drawImage + toDataURL work unrendered).
function LoupeSlot({ enabled }) {
  if (enabled) return <CardLoupe />;
  return (
    <Box sx={{ display: "none" }}>
      <SmartDetectContainer />
    </Box>
  );
}

export default function SectionDrawingHelperContent() {
  const dispatch = useDispatch();

  // strings

  const meshBrushHiddenS =
    "Le modèle actif est masqué : les parties peintes ne seront pas visibles.";
  const meshBrushOptionsS = "Options de peinture";
  const meshBrushPartS = "Partie peinte";
  const meshBrushFaceS = "Facette";
  const meshBrushEdgeS = "Arête";
  const meshBrushCreateAnnotationS = "Créer une annotation";
  const meshBrushPaintAllFacesS = "Peindre toutes les faces de l'annotation";
  const meshBrushPaintAllEdgesS = "Peindre toutes les arêtes de l'annotation";
  const templateBrushConvertS =
    "Cliquez sur une annotation pour lui appliquer le modèle";
  const templateBrushDuplicateS =
    "Cliquez sur une annotation pour la dupliquer avec le modèle";
  const templateBrushSwitchS = "Dupliquer l'annotation cible";
  const templateBrushHiddenS =
    "Le modèle actif est masqué : les annotations converties ou dupliquées ne seront pas visibles.";
  const surfaceCutS =
    "Tracez un trait à travers la surface : elle est coupée en autant d'annotations que de morceaux";
  const coplanarPointsS = "Points coplanaires";

  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  // threedEditor tool armed from « Outils de dessin » (Extruder / Déplacer /
  // Tourner in the 3D editor): its own helper body, no drawing state.
  const activeThreedTool = useSelector(selectActiveThreedTool);
  // « Ajouter une maille » (Maillage module, CREATE tool of the meshing mode).
  const isMeshCreate = useSelector(selectIsMeshCreateToolActive);
  const smartDetectEnabled = useSelector((s) => s.mapEditor.smartDetectEnabled);
  // Configuration > Dessin > Loupe: false hides the loupe card (2D only).
  const loupeEnabled = useSelector(selectIsLoupeEnabled);
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
  const isThreedRulerDraw = useSelector(selectIsTemplateRulerDrawActive);
  // « Pinceau »: "FACE" (Surface template) / "EDGE" (Ligne template), null
  // when the brush is not armed.
  const meshBrushPartType = useSelector(selectMeshBrushPartType);
  const isMeshBrush = Boolean(meshBrushPartType);
  // « Créer une annotation »: a painted part the plan can
  // hold becomes a 2D annotation instead of a paint row.
  const meshBrushCreateAnnotation = useSelector(
    (s) => s.mapEditor.meshBrushCreateAnnotation
  );
  // « Peindre toutes les faces / arêtes de l'annotation »: one click paints
  // every bare part of the host of the brush's part type, or removes them
  // all — one switch per part type, the one of the current type is shown.
  const meshBrushPaintAllFaces = useSelector(
    (s) => s.mapEditor.meshBrushPaintAllFaces
  );
  const meshBrushPaintAllEdges = useSelector(
    (s) => s.mapEditor.meshBrushPaintAllEdges
  );
  const isMeshBrushFace = meshBrushPartType === MESH_PAINT_PART_TYPES.FACE;
  // « Pinceau » armed in the 2D editor (template brush): the click converts
  // the annotation to the armed template, or duplicates it with that
  // template when the switch below is on (hotkey D, InteractionLayer).
  const isTemplateBrush2d =
    !isThreedToggledEditor && isMeshBrushDrawingMode(enabledDrawingMode);
  const templateBrushDuplicateTarget = useSelector(
    (s) => s.mapEditor.templateBrushDuplicateTarget
  );
  // The armed template (or its listing) is hidden: a paint would not show
  // (3D), a converted / duplicated annotation would vanish (2D) — warn.
  const isArmedTemplateHidden = useSelector((s) => {
    const na = s.annotations.newAnnotation;
    if (!na?.annotationTemplateId) return false;
    return (
      selectHiddenAnnotationTemplateIdSet(s).has(na.annotationTemplateId) ||
      Boolean(
        na.listingId && s.listings.hiddenListingsIds?.includes(na.listingId)
      )
    );
  });
  const isMeshBrushTemplateHidden = isMeshBrush && isArmedTemplateHidden;
  // Lines and cotes can land their points on a scan base map: show the
  // status of its picking data (being prepared / ready). Not the brush: it
  // paints annotation parts only.
  const canDrawOnScan = useSelector(
    (s) =>
      s.annotations.newAnnotation?.type === "POLYLINE" ||
      selectIsTemplateCoteDrawActive(s) ||
      selectIsTemplateRulerDrawActive(s)
  );
  // A line drawn click by click in the 3D editor (template or "Dessin"):
  // the arc toggle (T) and the « Points coplanaires » switch — once 3 points
  // are placed, the next ones stay on their plane (DrawingOverlayThreed).
  const isThreedPolylineClickDraw = useSelector(
    selectIsThreedPolylineClickDraw
  );
  // A line / surface circle on its centre / radius tool in the 3D editor.
  const isThreedCircleRadiusDraw = useSelector((s) =>
    isCircleRadiusDraftFor3d(
      s.annotations.newAnnotation,
      s.mapEditor.enabledDrawingMode
    )
  );
  const coplanarPoints3d = useSelector((s) => s.mapEditor.coplanarPoints3d);
  // Arrow-key axis lock (↑ → ↓ / ←) of the point-by-point 3D flows: its
  // own card, with the axis each arrow locks from the camera orientation.
  const isThreedAxisLockAvailable = useSelector(
    selectIsThreedAxisLockAvailable
  );
  // Cut line (Maillage module): its own message and shortcuts (no arc).
  const isCutLineDraw = useSelector(selectIsCutLineDrawActive);
  // "Coupe face" (3D): one message per tool, its own shortcuts.
  const isFaceCut = useSelector(selectIsFaceCutDrawActive);
  // Launched on a selected face: the cut is bound to it.
  const hasFaceCutLock = useSelector(
    (s) => selectIsFaceCutDrawActive(s) && Boolean(getFaceCutLockedPart(s))
  );
  const faceCutMessage = isFaceCut
    ? hasFaceCutLock
      ? FACE_CUT_LOCKED_MESSAGE
      : (FACE_CUT_MESSAGES[enabledDrawingMode] ??
        "Tracez sur une face pour la couper")
    : null;
  const threedMessage = isObject3DPlacement
    ? "Cliquez sur le plan pour poser l'objet 3D"
    : isCutLineDraw
      ? THREED_CUT_LINE_MESSAGE
      : isThreedCoteDraw
        ? "Cliquez le 1ᵉʳ point de la cote, puis le 2ᵉ (plan, face, sommet, arête ou axe)"
        : isThreedRulerDraw
          ? "Cliquez les points de la règle (plan, face, sommet, arête ou axe) — Entrée ou double-clic pour terminer"
          : isMeshBrush
            ? meshBrushPartType === MESH_PAINT_PART_TYPES.EDGE
              ? "Cliquez une arête pour la peindre (re-cliquez pour retirer)"
              : "Cliquez une face pour la peindre (re-cliquez pour retirer)"
            : (faceCutMessage ??
              (isThreedCircleRadiusDraw
                ? THREED_CIRCLE_RADIUS_MESSAGE
                : "Cliquez pour poser les points du tracé"));
  const threedShortcuts = isObject3DPlacement
    ? THREED_PLACEMENT_SHORTCUTS
    : isCutLineDraw
      ? THREED_CUT_LINE_SHORTCUTS
      : isThreedCoteDraw
        ? THREED_COTE_SHORTCUTS
        : isThreedRulerDraw
          ? THREED_RULER_SHORTCUTS
          : isMeshBrush
            ? THREED_MESH_BRUSH_SHORTCUTS
            : isFaceCut
              ? FACE_CUT_SHORTCUTS
              : isThreedPolylineClickDraw
                ? THREED_POLYLINE_SHORTCUTS
                : isThreedCircleRadiusDraw
                  ? THREED_CIRCLE_RADIUS_SHORTCUTS
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
  // Section mark (Fonds de plan module): its own instruction, no image
  // detection nor offset; locating one on a vertical base map adds the
  // « Adapter l'échelle » option and drops the length constraints (the
  // length is the mark's).
  const isSectionMarkDraw = useSelector(
    (s) =>
      Boolean(s.mapEditor.enabledDrawingMode) &&
      isBaseMapLinkDraft(s.annotations.newAnnotation)
  );
  const isSectionMarkLocate = useSelector(
    (s) =>
      Boolean(s.mapEditor.enabledDrawingMode) &&
      isBaseMapLinkLocateDraft(s.annotations.newAnnotation)
  );
  const showSmartDetectCard =
    !isSurfaceCut &&
    !isSectionMarkDraw &&
    SMART_DETECT_UI_MODES.includes(enabledDrawingMode);
  // « Détection auto » of the plain clic-clic polyline (wall vectorization,
  // V): not for the tools sharing POLYLINE_CLICK — the ruler (RULER draft)
  // and the openings (isOpening), nor the surface cut.
  const isPlainPolylineDraft = useSelector((s) => {
    const na = s.annotations.newAnnotation;
    return na?.type === "POLYLINE" && !na?.isOpening;
  });
  const showWallVectorizationCard =
    enabledDrawingMode === "POLYLINE_CLICK" &&
    !isSurfaceCut &&
    isPlainPolylineDraft;
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
    !isSectionMarkDraw &&
    Boolean(enabledDrawingMode) &&
    ![
      "REASSIGN_TEMPLATE",
      "MESH_BRUSH",
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

  if (isMeshCreate) {
    return <SectionMeshCreateHelperContent />;
  }

  if (activeThreedTool) {
    return <SectionThreedToolHelperContent tool={activeThreedTool} />;
  }

  // 2D « Déplacer » / « Tourner »: the loupe (to aim at the points) + the
  // tool's own helper body.
  if (!isThreedToggledEditor && isTransformToolMode(enabledDrawingMode)) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        {loupeEnabled ? (
          <Box sx={{ p: 1, pb: 0 }}>
            <CardLoupe />
          </Box>
        ) : (
          <LoupeSlot enabled={false} />
        )}
        <SectionTransformToolHelper2d mode={enabledDrawingMode} />
      </Box>
    );
  }

  // « Changer de style » armed from the commands toolbar (2D and 3D): the
  // selection + the template picker, no loupe / smart detect.
  if (enabledDrawingMode === CHANGE_STYLE_MODE) {
    return <SectionChangeStyleHelper />;
  }

  // « Masquer l'annotation » armed from the commands toolbar (2D and 3D):
  // the hint + the count of hidden items, no loupe / smart detect.
  if (enabledDrawingMode === HIDE_ANNOTATION_MODE) {
    return <SectionHideAnnotationHelper />;
  }

  return (
    <Box sx={{ p: 1, display: "flex", flexDirection: "column", gap: 1 }}>
      {!isThreedToggledEditor &&
        !isSegmentSelectMode &&
        enabledDrawingMode !== "REASSIGN_TEMPLATE" &&
        !isTemplateBrush2d &&
        enabledDrawingMode !== "LOCALIZED_REPAIR" &&
        enabledDrawingMode !== "JOIN_ANNOTATIONS" &&
        enabledDrawingMode !== "CHAT_REPAIR" && (
          <LoupeSlot enabled={loupeEnabled} />
        )}
      {/* Source annotation of a procedure being drawn (2D): the procedure's
          own schematic — null otherwise. */}
      {!isThreedToggledEditor && <SectionProcedureSourceDrawingHelper />}
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
        <WhiteSectionGeneric>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              {meshBrushOptionsS}
            </Typography>
            <Box
              sx={{
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
            </Box>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {isMeshBrushFace
                  ? meshBrushPaintAllFacesS
                  : meshBrushPaintAllEdgesS}
              </Typography>
              <Switch
                size="small"
                checked={Boolean(
                  isMeshBrushFace
                    ? meshBrushPaintAllFaces
                    : meshBrushPaintAllEdges
                )}
                onChange={(e) =>
                  dispatch(
                    isMeshBrushFace
                      ? setMeshBrushPaintAllFaces(e.target.checked)
                      : setMeshBrushPaintAllEdges(e.target.checked)
                  )
                }
              />
            </Box>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {meshBrushCreateAnnotationS}
              </Typography>
              <Switch
                size="small"
                checked={Boolean(meshBrushCreateAnnotation)}
                onChange={(e) =>
                  dispatch(setMeshBrushCreateAnnotation(e.target.checked))
                }
              />
            </Box>
            <SectionMeshBrushPaintedTotal />
          </Box>
        </WhiteSectionGeneric>
      )}
      {isThreedToggledEditor && canDrawOnScan && !isMeshBrush && (
        <SectionScene3dPickingStatus />
      )}
      {isThreedToggledEditor && isThreedPolylineClickDraw && (
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
            {coplanarPointsS}
          </Typography>
          <Switch
            size="small"
            checked={Boolean(coplanarPoints3d)}
            onChange={(e) => dispatch(setCoplanarPoints3d(e.target.checked))}
          />
        </Paper>
      )}
      {isThreedToggledEditor && isThreedAxisLockAvailable && (
        <SectionThreedAxisLockHelper />
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
      {isTemplateBrush2d && (
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
          {templateBrushDuplicateTarget
            ? templateBrushDuplicateS
            : templateBrushConvertS}
        </Box>
      )}
      {isTemplateBrush2d && isArmedTemplateHidden && (
        <Alert severity="warning" sx={{ py: 0, fontSize: "0.8125rem" }}>
          {templateBrushHiddenS}
        </Alert>
      )}
      {isTemplateBrush2d && (
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
              {templateBrushSwitchS}
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
              D
            </Box>
          </Box>
          <Switch
            size="small"
            checked={Boolean(templateBrushDuplicateTarget)}
            onChange={(e) =>
              dispatch(setTemplateBrushDuplicateTarget(e.target.checked))
            }
          />
        </Paper>
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
      {isSectionMarkDraw && !isThreedToggledEditor && (
        <SectionBaseMapLinkDrawingHelper />
      )}
      {/* Typed length / dimension constraints of the armed mode (rectangle
          sides, segment length, radius, cut distance) — null otherwise. */}
      {!isSectionMarkLocate && <SectionDrawingConstraints />}
      {/* `*N` repetition of the pattern just drawn (click-drawn paths,
          2D and 3D) — null otherwise. */}
      <SectionDrawingPatternRepeat />
      {/* 2D image detection: meaningless in the 3D editor */}
      {showSmartDetectCard && !isThreedToggledEditor && <CardSmartDetect />}
      {showWallVectorizationCard && !isThreedToggledEditor && (
        <CardWallVectorization />
      )}
      {enabledDrawingMode === "SURFACE_DROP" && <SectionSurfaceDropOptions />}
      {/* « Ne pas découper » of the opening / surface cut tools — null
          otherwise. */}
      {!isThreedToggledEditor && <SectionHeightCutDrawingOptions />}
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
      {isSectionMarkLocate && !isThreedToggledEditor && (
        <SwitchBaseMapLinkAdaptScale />
      )}
      <SectionShortcutHelpers
        shortcuts={
          isThreedToggledEditor
            ? threedShortcuts
            : isTemplateBrush2d
              ? TEMPLATE_BRUSH_2D_SHORTCUTS
              : isSurfaceCut
                ? SURFACE_CUT_SHORTCUTS
                : isSectionMarkDraw
                  ? SECTION_MARK_SHORTCUTS
                  : undefined
        }
      />
    </Box>
  );
}
