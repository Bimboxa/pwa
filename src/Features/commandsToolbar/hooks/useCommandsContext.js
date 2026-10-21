import { useMemo, useRef } from "react";
import { useSelector } from "react-redux";

import {
  selectSelectedItem,
  selectSelectedItems,
  selectSelectedPartIds,
  selectSelectedPointIds,
} from "Features/selection/selectionSlice";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { selectSubtractPickAnnotationId } from "Features/mapEditor/utils/subtractPickMode";
import selectEffectiveInteractionMode from "Features/popperMapListings/utils/selectEffectiveInteractionMode";
import selectActiveThreedTool from "Features/threedDrawing/utils/selectActiveThreedTool";
import { getFaceCutLockedPart } from "Features/threedFaceCut/utils/resolveFaceCutLockedFace";
import { isAxesFrameDefault } from "Features/threedEditor/constants/axesDisplay";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import { resolveSelectedAnnotationPart } from "Features/annotations/hooks/useSelectedAnnotationPart";
import useAnnotationPermissions from "Features/mapEditor/hooks/useAnnotationPermissions";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useReadOnlyScope from "Features/scopes/hooks/useReadOnlyScope";
import useDrawingToolsAvailability from "./useDrawingToolsAvailability";

import { EDITOR_2D, EDITOR_3D } from "../constants/commandEditors";
import { getToolTypeForDrawingMode } from "../utils/startToolGroupDraw";

export const READ_ONLY_REASON = "Lecture seule";
export const SELECTION_LOADING_REASON = "Chargement des annotations…";

// Selected annotation ids, in selection order (labels resolve to their
// annotation, like useSelectedAnnotation).
function getSelectedAnnotationIds(selectedItems) {
  const ids = [];
  selectedItems.forEach((item) => {
    let id = null;
    if (item?.type === "ANNOTATION_LABEL") id = item.annotationId;
    else if (item?.nodeType === "ANNOTATION") id = item.nodeId;
    if (typeof id === "string" && id.startsWith("label::"))
      id = id.replace("label::", "");
    if (id && !ids.includes(id)) ids.push(id);
  });
  return ids;
}

// ---------------------------------------------------------------------------
// useCommandsContext — the ONE context object (`ctx`) every command of the
// toolbar reads in getState / run / Button: displayed editor and module,
// interaction modes, the resolved selection (annotations, single annotation
// with its template, sub-part, locked face), the main base map and its scale,
// the edit permissions, the armed draw / 3D tool, the view toggles.
//
// Built once per toolbar render (memoised) so the ~50 commands share a single
// useAnnotationsV2 / useMainBaseMap / useAnnotationPermissions instead of
// mounting their own (the former IconButtonXxx each did). `enabled` turns the
// annotations query off while the toolbar is hidden.
// ---------------------------------------------------------------------------
export default function useCommandsContext({ enabled = true } = {}) {
  // data — editor / module

  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const effectiveViewerKey = useSelector(selectEffectiveViewerKey);
  const isThreedEditor = isThreedFamilyViewerKey(effectiveViewerKey);
  const editor = isThreedEditor ? EDITOR_3D : EDITOR_2D;

  const interactionMode = useSelector(
    (s) => s.popperMapListings.interactionMode
  );
  const effectiveInteractionMode = useSelector(selectEffectiveInteractionMode);
  const viewerMode = useSelector((s) => s.urlParams.viewerMode);
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const { showDrawingTools, isLocateBusinessObjectMode } =
    useDrawingToolsAvailability();

  // data — modes

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const selectedToolKeyByTemplateId = useSelector(
    (s) => s.mapEditor.selectedToolKeyByTemplateId
  );
  const templatelessDrawingShape = useSelector(
    (s) => s.mapEditor.templatelessDrawingShape
  );
  const activeThreedTool = useSelector(selectActiveThreedTool);
  const pasteClipboard = useSelector((s) =>
    Boolean(s.mapEditor.pasteClipboard)
  );
  const subtractPickAnnotationId = useSelector(selectSubtractPickAnnotationId);
  const subtractSourceAnnotationId = useSelector(
    (s) => s.mapEditor.subtractSourceAnnotationId
  );
  const subtractTargetAnnotationId = useSelector(
    (s) => s.mapEditor.subtractTargetAnnotationId
  );
  const anchorSourceAnnotationId = useSelector(
    (s) => s.mapEditor.anchorSourceAnnotationId
  );
  const smartDetectEnabled = useSelector((s) =>
    Boolean(s.mapEditor.smartDetectEnabled)
  );
  const walkActive = useSelector((s) => s.threedEditor.walkMode.active);
  const moveAnnotationModeActive = useSelector(
    (s) => s.threedEditor.moveAnnotationMode.active
  );
  const moveBaseMapModeActive = useSelector(
    (s) => s.threedEditor.moveBaseMapMode.active
  );
  const rotateBaseMapModeActive = useSelector(
    (s) => s.threedEditor.rotateBaseMapMode.active
  );
  const axesPlacementModeActive = useSelector(
    (s) => s.threedEditor.axesPlacementMode.active
  );
  // « Repère » group: visibility of the in-scene axes + "already at the
  // world origin, no rotation" (disables « Réinitialiser »).
  const axesSettings = useSelector((s) => s.threedEditor.axesSettings);
  const showSceneAxes = Boolean(axesSettings?.showSceneAxes);
  const axesFrameIsDefault = isAxesFrameDefault(axesSettings ?? {});

  // data — view toggles (mapEditorSlice)

  const wrapperMode = useSelector((s) => Boolean(s.mapEditor.wrapperMode));
  const showSegmentCotes = useSelector((s) =>
    Boolean(s.mapEditor.showSegmentCotes)
  );
  const segmentDragEnabled = useSelector((s) =>
    Boolean(s.mapEditor.segmentDragEnabled)
  );
  const anglesLocked = useSelector((s) => Boolean(s.mapEditor.anglesLocked));

  // data — selection

  const selectedItems = useSelector(selectSelectedItems);
  const selectedItem = useSelector(selectSelectedItem);
  const selectedPartIds = useSelector(selectSelectedPartIds);
  const selectedPointIds = useSelector(selectSelectedPointIds);

  // withForeignFootprints / withRevolutionFootprints: a footprint is
  // selectable on the plan, so the commands must be able to resolve it.
  const annotations = useAnnotationsV2({
    caller: "CommandsToolbar",
    withForeignFootprints: true,
    withRevolutionFootprints: true,
    enabled,
  });
  const annotationTemplates = useAnnotationTemplates({ skip: !enabled });

  // data — base map / permissions

  const baseMap = useMainBaseMap();
  const meterByPx = baseMap?.getMeterByPx?.() ?? baseMap?.meterByPx;
  const hasScale = Number.isFinite(meterByPx) && meterByPx > 0;
  const isVerticalBaseMap = baseMap?.orientation === "VERTICAL";

  const { canEditAnnotation } = useAnnotationPermissions({ annotations });
  const { isReadOnly: isReadOnlyScope } = useReadOnlyScope();

  // helpers — resolved selection

  const selectedAnnotationIds = useMemo(
    () => getSelectedAnnotationIds(selectedItems),
    [selectedItems]
  );
  const selectedAnnotationIdsKey = selectedAnnotationIds.join("|");

  const selectedAnnotations = useMemo(() => {
    if (!annotations?.length || selectedAnnotationIds.length === 0) return [];
    const byId = new Map(annotations.map((a) => [a.id, a]));
    return selectedAnnotationIds.map((id) => byId.get(id)).filter(Boolean);
  }, [annotations, selectedAnnotationIdsKey]);

  const selectedAnnotation = useMemo(() => {
    if (selectedAnnotations.length !== 1) return null;
    const a = selectedAnnotations[0];
    const annotationTemplate = annotationTemplates?.find(
      (t) => t.id === a.annotationTemplateId
    );
    return annotationTemplate ? { ...a, annotationTemplate } : a;
  }, [selectedAnnotations, annotationTemplates]);

  const selectedPart = useMemo(
    () =>
      resolveSelectedAnnotationPart({
        annotation: selectedAnnotation,
        selectedItem,
        selectedPartIds,
        selectedPointIds,
        meterByPx,
      }),
    [
      selectedAnnotation,
      selectedItem,
      selectedPartIds,
      selectedPointIds,
      meterByPx,
    ]
  );

  // Exactly one selected face of a mesh annotation (3D) — same rule as the
  // face cut lock. A fresh object each call: computed here, not in a selector.
  const facePart = useMemo(
    () =>
      getFaceCutLockedPart({
        selection: { selectedItems, selectedPartIds },
      }),
    [selectedItems, selectedPartIds]
  );

  // Selected items name annotations the query has not delivered (yet): the
  // selection commands stay disabled with a neutral reason instead of
  // concluding the annotations are gone (useAnnotationsV2 returns [] while
  // loading).
  const annotationsLoading =
    selectedAnnotationIds.length > 0 && selectedAnnotations.length === 0;

  // Every selected annotation is editable by the current user (silent
  // probes: no toast) and the scope is not read-only.
  const selectionEditable = useMemo(() => {
    if (isReadOnlyScope || viewerMode) return false;
    return selectedAnnotations.every((a) =>
      canEditAnnotation(a.id, { silent: true })
    );
  }, [selectedAnnotations, canEditAnnotation, isReadOnlyScope, viewerMode]);
  const readOnly = Boolean(isReadOnlyScope || viewerMode);

  // Latest context object, exposed through a ref for the hotkey listener.
  const ctx = useMemo(
    () => ({
      // editor / module
      viewerKey,
      effectiveViewerKey,
      isThreedEditor,
      editor,
      interactionMode,
      effectiveInteractionMode,
      viewerMode,
      selectedScopeId,
      showDrawingTools,
      isLocateBusinessObjectMode,
      // modes
      enabledDrawingMode,
      activeToolType: getToolTypeForDrawingMode(enabledDrawingMode),
      isTemplatelessDraft: Boolean(
        enabledDrawingMode && newAnnotation?.isTemplateless
      ),
      selectedToolKeyByTemplateId: selectedToolKeyByTemplateId ?? {},
      templatelessDrawingShape,
      activeThreedTool,
      moveAnnotationModeActive,
      moveBaseMapModeActive,
      rotateBaseMapModeActive,
      axesPlacementModeActive,
      showSceneAxes,
      axesFrameIsDefault,
      pasteClipboard,
      subtractPickAnnotationId,
      subtractSourceAnnotationId,
      subtractTargetAnnotationId,
      anchorSourceAnnotationId,
      smartDetectEnabled,
      walkActive,
      // view toggles
      wrapperMode,
      showSegmentCotes,
      segmentDragEnabled,
      anglesLocked,
      // selection
      selectedItems,
      selectedPartIds,
      selectedPointIds,
      selectedAnnotationIds,
      annotations: annotations ?? [],
      selectedAnnotations,
      selectedAnnotation,
      selectedPart,
      facePart,
      annotationsLoading,
      // base map
      baseMap,
      meterByPx,
      hasScale,
      isVerticalBaseMap,
      // permissions
      canEditAnnotation,
      selectionEditable,
      readOnly,
      readOnlyReason: READ_ONLY_REASON,
    }),
    [
      viewerKey,
      effectiveViewerKey,
      isThreedEditor,
      editor,
      interactionMode,
      effectiveInteractionMode,
      viewerMode,
      selectedScopeId,
      showDrawingTools,
      isLocateBusinessObjectMode,
      enabledDrawingMode,
      newAnnotation?.isTemplateless,
      selectedToolKeyByTemplateId,
      templatelessDrawingShape,
      activeThreedTool,
      moveAnnotationModeActive,
      moveBaseMapModeActive,
      rotateBaseMapModeActive,
      axesPlacementModeActive,
      showSceneAxes,
      axesFrameIsDefault,
      pasteClipboard,
      subtractPickAnnotationId,
      subtractSourceAnnotationId,
      subtractTargetAnnotationId,
      anchorSourceAnnotationId,
      smartDetectEnabled,
      walkActive,
      wrapperMode,
      showSegmentCotes,
      segmentDragEnabled,
      anglesLocked,
      selectedItems,
      selectedPartIds,
      selectedPointIds,
      selectedAnnotationIds,
      annotations,
      selectedAnnotations,
      selectedAnnotation,
      selectedPart,
      facePart,
      annotationsLoading,
      baseMap,
      meterByPx,
      hasScale,
      isVerticalBaseMap,
      canEditAnnotation,
      selectionEditable,
      readOnly,
    ]
  );

  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  return { ctx, ctxRef };
}
