import { useRef, useEffect, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";

import { nanoid } from "@reduxjs/toolkit";


import { setAnchorPositionScale, setScaleInPx, setAngleInRad } from "../mapEditorSlice";
import { setEnabledDrawingMode } from "../mapEditorSlice";
import { setTempAnnotations, triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { setBaseMapPoseInBg, setLegendFormat } from "../mapEditorSlice";
import { setBgImageRawTextAnnotations } from "Features/bgImage/bgImageSlice";
import { setShowCreateBaseMapSection } from "Features/mapEditor/mapEditorSlice";
import { selectSelectedItems } from "Features/selection/selectionSlice";
import { resetVersionCompare } from "Features/baseMapEditor/baseMapEditorSlice";
import { setLocalizingPhotoId } from "Features/photos/photosSlice";
import { DEFAULT_FOV_DEG } from "Features/photos/constants/photoNode";

import useMeasure from "react-use-measure";

import theme from "Styles/theme";

import {
    setActiveMapEditor,
    clearActiveMapEditor,
} from "../services/mapEditorRegistry";

import useBgImageInMapEditor from "Features/mapEditor/hooks/useBgImageInMapEditor";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBaseMapPose from "Features/mapEditor/hooks/useBaseMapPose";
import applyDeltaPosToAnnotation from "Features/mapEditorGeneric/utils/applyDeltaPosToAnnotation";
import resyncRevolutionAxisPlacementsService from "Features/elevation/services/resyncRevolutionAxisPlacementsService";
import useImageModeLabelsLayout from "Features/mapEditor/hooks/useImageModeLabelsLayout";

import useAutoSelectMainBaseMap from "../hooks/useAutoSelectMainBaseMap";
import useAutoResetBaseMapPose from "Features/bgImage/hooks/useAutoResetBaseMapPose";
import useAutoShowBgImage from "Features/bgImage/hooks/useAutoShowBgImage";
import useAutoBgImageRawTextAnnotations from "Features/bgImage/hooks/useAutoBgImageRawTextAnnotations";
import useHandleCommitDrawing from "../hooks/useHandleCommitDrawing";
import useHandleCommitGuideLine from "../hooks/useHandleCommitGuideLine";
import useHandleCommitIsoHeightLine from "../hooks/useHandleCommitIsoHeightLine";
import useHandleCommitProfileLine from "../hooks/useHandleCommitProfileLine";
import useHandleCommitRamp from "../hooks/useHandleCommitRamp";
import useDeleteGuideLine from "Features/annotations/hooks/useDeleteGuideLine";
import useDeleteIsoHeightLine from "Features/annotations/hooks/useDeleteIsoHeightLine";
import useDeleteProfileLine from "Features/annotations/hooks/useDeleteProfileLine";
import useHandleSplitCommit from "../hooks/useHandleSplitCommit";
import useHandleCompleteAnnotation from "../hooks/useHandleCompleteAnnotation";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useMeshCellRelations from "Features/annotations/hooks/useMeshCellRelations";
import useNewAnnotationType from "Features/annotations/hooks/useNewAnnotationType";
import useResetNewAnnotation from "Features/annotations/hooks/useResetNewAnnotation";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import applyLayerStackingToAnnotations from "Features/annotations/utils/applyLayerStackingToAnnotations";
import applyOpeningOnPolygon from "Features/annotations/utils/applyOpeningOnPolygon";
import reflowOpeningsForHost from "Features/mapEditor/services/reflowOpeningsForHostService";
import applyPointsMovesService from "Features/annotations/services/applyPointsMovesService";
import shadeMeshCellColor from "Features/mesh/utils/meshCellColor";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useLegendItems from "Features/legend/hooks/useLegendItems";
import useLegendItemsByBaseMapId from "Features/legend/hooks/useLegendItemsByBaseMapId";
import {
  selectActive2dEditorKey,
  selectEffectiveViewerKey,
  selectPovFramingActive,
} from "Features/viewers/utils/effectiveViewerKey";
import useAnnotationTemplateQtiesByIdForBaseMap from "Features/annotations/hooks/useAnnotationTemplateQtiesByIdForBaseMap";

import { Box } from "@mui/material";

import InteractionLayer from "./InteractionLayer";
import PrintableMap from "./PrintableMap";

import UILayer from "./UILayer";
import PhotoPlanMaskLayer from "Features/photoPlans/components/PhotoPlanMaskLayer";
import PhotoPlanGuideLinesLayer from "Features/photoPlans/components/PhotoPlanGuideLinesLayer";
import PhotoPlanReprojectedAnnotationsLayer from "Features/photoPlans/components/PhotoPlanReprojectedAnnotationsLayer";
import TopPhotoPlanChips from "Features/photoPlans/components/TopPhotoPlanChips";
import LayerTools from "./LayerTools";
import StaticMapContent from "./StaticMapContent";
import EditedObjectLayer from "./EditedObjectLayer";
import EditedBaseMapLayer from "./EditedBaseMapLayer";
import EditedVersionLayer from "./EditedVersionLayer";
import EditedLegendLayer from "./EditedLegendLayer";
import LayerCreateBaseMap from "./LayerCreateBaseMap";

import CompareVersionSlider from "./CompareVersionSlider";
import DialogAutoCreateEntity from "Features/entities/components/DialogAutoCreateEntity";
import DialogDeleteSelectedAnnotation from "Features/annotations/components/DialogDeleteSelectedAnnotation";
import PopperEditAnnotation from "./PopperEditAnnotation";
import PopperEditAnnotations from "./PopperEditAnnotations";
import PopperEditScale from "./PopperEditScale";
import PopperContextMenu from "Features/contextMenu/component/PopperContextMenu";
import DialogAutoMigrateToMapEditorV3 from "./DialogAutoMigrateToMapEditorV3";
import useSaveTempAnnotations from "Features/mapEditor/hooks/useSaveTempAnnotations";
import useCreateAnnotationsFromDetectedStrips from "Features/smartDetect/hooks/useCreateAnnotationsFromDetectedStrips";
import useCreateAnnotationsFromDetectedFeatures from "Features/smartDetect/hooks/useCreateAnnotationsFromDetectedFeatures";
import useCommitLocalizedRepair from "Features/localizedRepair/hooks/useCommitLocalizedRepair";
import useCreateAnnotationFromSurfaceDrop from "Features/smartDetect/hooks/useCreateAnnotationFromSurfaceDrop";
import PopperMapListings from "./PopperMapListings";
import FloatingHelpersDessin from "Features/panelDrawing/components/FloatingHelpersDessin";
import PopperLinkBusinessObjectHelper from "Features/businessObjects/components/PopperLinkBusinessObjectHelper";
import PanelDrawingHelperPortal from "Features/panelDrawing/components/PanelDrawingHelperPortal";
import ImageModeOverlay from "./ImageModeOverlay";
import ButtonCloseImageMode from "./ButtonCloseImageMode";


import { InteractionProvider } from "../context/InteractionContext";
import { SmartZoomProvider } from "App/contexts/SmartZoomContext";
import { DrawingMetricsProvider } from "App/contexts/DrawingMetricsContext";

import db from "App/db/db";

import cleanSegments from "Features/annotations/utils/cleanSegments";
import editor from "App/editor";
import getPolylinePointsFromRectangle from "Features/geometry/utils/getPolylinePointsFromRectangle";
import getPolylinePointsFromCircle from "Features/geometry/utils/getPolylinePointsFromCircle";
import getPolylinePointsFromCircleCenterRadius from "Features/geometry/utils/getPolylinePointsFromCircleCenterRadius";
import getPolylinePointsFromArc from "Features/geometry/utils/getPolylinePointsFromArc";
import splitArcOnInsert from "Features/geometry/utils/splitArcOnInsert";
import getDefaultCameraMatrix from "../utils/getDefaultCameraMatrix";
import getDefaultBaseMapPoseInBg from "../utils/getDefaultBaseMapPoseInBg";
import getAnnotationLabelDeltaFromDeltaPos from "Features/annotations/utils/getAnnotationLabelDeltaFromDeltaPos";
import deletePointAsync from "../services/deletePointAsync";
import useDeletePoints from "Features/annotations/hooks/useDeletePoints";
import duplicateAndMovePoint from "../services/duplicateAndMovePoint";
import replacePointBySnap from "../services/replacePointBySnap";
import toggleAnnotationPointType from "../services/toggleAnnotationPointType";
import commitWrapperTransform from "../services/commitWrapperTransform";
import moveProfileLineService from "Features/elevation/services/moveProfileLineService";
import computeWrapperBbox from "../utils/computeWrapperBbox";
import applyWrapperTransformToPoints from "../utils/applyWrapperTransformToPoints";
import removeCutAsync from "../services/removeCutAsync";
import useHandleCutSegment from "../hooks/useHandleCutSegment";
import useHandleTechnicalReturn from "../hooks/useHandleTechnicalReturn";
import useHandleSplitPolyline from "../hooks/useHandleSplitPolyline";
import useHandleSplitPolylineClick from "../hooks/useHandleSplitPolylineClick";
import useNewEntity from "Features/entities/hooks/useNewEntity";
import getSegmentAngle from "Features/geometry/utils/getSegmentAngle";
import { buildSegmentFlagChanges } from "Features/annotations/utils/segmentFlags";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import fitBoundsToViewport from "../utils/fitBoundsToViewport";
import getAnnotationBounds from "../utils/getAnnotationBounds";
import getAnnotationTemplateSizeInPx from "Features/annotations/utils/getAnnotationTemplateSizeInPx";
import getRectangleRawPointsFromOnePoint from "Features/rectangles/utils/getRectangleRawPointsFromOnePoint";
import getImageAnnotationRectanglePointsFromOnePoint from "Features/imageAnnotations/utils/getImageAnnotationRectanglePointsFromOnePoint";
import getObject3DAnnotationRectanglePointsFromOnePoint from "Features/object3D/utils/getObject3DAnnotationRectanglePointsFromOnePoint";
import imageUrlToPng from "Features/images/utils/imageUrlToPng";
import useUserEmail from "Features/auth/hooks/useUserEmail";
import useDeferredDrawingCommit from "../hooks/useDeferredDrawingCommit";
import DeferredCommitDialogOutlet from "./DeferredCommitDialogOutlet";
import useSelectedNodes from "../hooks/useSelectedNodes";
import useDrawingToolHotkeys from "../hooks/useDrawingToolHotkeys";
import useFreeAnnotationHotkeys from "../hooks/useFreeAnnotationHotkeys";
import useResetInteractionMode from "../hooks/useResetInteractionMode";
import useOpeningHotkey from "../hooks/useOpeningHotkey";
import useToolGroupHotkey from "../hooks/useToolGroupHotkey";

const contextDimmedStyle = {
    //filter: "grayscale(100%) brightness(1.4) opacity(0.8)", // Rend gris, clair et semi-transparent
    filter: "grayscale(90%) opacity(0.8)",
    transition: "filter 0.3s ease, opacity 0.3s ease",      // Transition douce
    pointerEvents: "none" // (Optionnel) Empêche de cliquer sur le fond pendant l'édition
};

const contextNormalStyle = {
    filter: "none",
    opacity: 1,
    transition: "filter 0.3s ease, opacity 0.3s ease"
};


// Render tracker — logs which values changed between renders
const _prevValues = {};
function _track(label, value) {
    const prev = _prevValues[label];
    const serialized = typeof value === "object" ? JSON.stringify(value)?.slice(0, 80) : String(value);
    const prevSerialized = typeof prev === "object" ? JSON.stringify(prev)?.slice(0, 80) : String(prev);
    if (prevSerialized !== serialized) {
        console.log(`[debug_perf] ⚡ CHANGED: ${label}`, prevSerialized?.slice(0, 40), "→", serialized?.slice(0, 40));
        _prevValues[label] = value;
    }
    return value;
}

export default function MainMapEditorV3({ forViewerKey = "MAP" }) {
    const dispatch = useDispatch();

    // hotkeys — switch drawing tool via keyboard (Tab / R / L / C / G)
    useDrawingToolHotkeys();
    // hotkeys — start a free draw (L = line, P = polygon) when in DRAW mode
    useFreeAnnotationHotkeys();
    // reset a residual interaction mode (set by ZONES / POV flows) to the default
    useResetInteractionMode();
    // hotkeys — start an opening draw (O) when not drawing
    useOpeningHotkey();
    // hotkeys — start segment removal (X = Retirer un segment) when not drawing
    useToolGroupHotkey("x", "SPLIT_LINE");
    // hotkeys — start polyline cut (C = Couper un segment) when not drawing
    useToolGroupHotkey("c", "SPLIT_POLYLINE_CLICK");

    // const

    const activeContext = "BASE_MAP";

    // ref

    const [containerRef, bounds] = useMeasure();
    const interactionLayerRef = useRef(null);
    const printableMapRef = useRef(null);

    // init ref
    useEffect(() => {
        if (printableMapRef?.current) {
            editor.printableMapSvgElement = printableMapRef.current;
        }
    }, [printableMapRef?.current]);

    // Register the camera handle of the instance that is the selected module's
    // 2D editor (the BASE_MAPS instance in the BaseMap module, the MAP instance
    // everywhere else) so the 2D/3D viewer switch syncs the right camera.
    const registersCamera = useSelector(selectActive2dEditorKey) === forViewerKey;
    useEffect(() => {
        if (!registersCamera) return;
        const handle = {
            getCameraMatrix: () => interactionLayerRef.current?.getCameraMatrix?.(),
            setCameraMatrix: (m) => interactionLayerRef.current?.setCameraMatrix?.(m),
            getViewportSize: () => interactionLayerRef.current?.getViewportSize?.(),
            getViewportRect: () => interactionLayerRef.current?.getViewportRect?.(),
        };
        setActiveMapEditor(handle);
        return () => clearActiveMapEditor(handle);
    }, [forViewerKey, registersCamera]);

    // data

    const projectId = useSelector((state) => state.projects.selectedProjectId);
    const listingId = useSelector((state) => state.listings.selectedListingId);
    const spriteImage = useAnnotationSpriteImage();
    _track("spriteImage", spriteImage?.src);
    const enabledDrawingMode = useSelector((state) => state.mapEditor.enabledDrawingMode);
    _track("enabledDrawingMode", enabledDrawingMode);
    const mapEditorMode = useSelector((state) => state.mapEditor.mapEditorMode);
    const orthoSnapAngleOffset = useSelector((state) => state.mapEditor.orthoSnapAngleOffset);

    // Selection from new Redux slice
    const { nodes: selectedNodes, node: selectedNode } = useSelectedNodes();
    _track("selectedNodes", selectedNodes);
    _track("selectedNode", selectedNode?.nodeId);
    const selectedItems = useSelector(selectSelectedItems);
    _track("selectedItems", selectedItems);

    const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);
    const grayLevelThreshold = useSelector((s) => s.baseMapEditor.grayLevelThreshold);
    const viewerKey = useSelector(selectEffectiveViewerKey);
    const isActiveViewer = viewerKey === forViewerKey;
    // Viewer module 2D: the selected chip's eye hides the baseMap image
    // entirely (annotations only). Module-key gated so Dessin is untouched.
    const hideBaseMapImage = useSelector(
        (s) =>
            s.viewers.selectedViewerKey === "THREED" &&
            s.viewers.hideBaseMapImageInViewer
    );
    // Viewer module (key THREED): read-only consultation. The left panel
    // (PanelViewerAnnotations) owns the legend when VISIBLE; otherwise the
    // popper shows it (SELECT-only) — same visibility pattern as Dessin below.
    const isViewerModule = useSelector((s) => s.viewers.selectedViewerKey === "THREED");
    // Dessin module (key MAP): the left panel (PanelDrawing) takes over the
    // listings popper (#310) whenever it is VISIBLE — docked, or drawer mode
    // while the left area is hovered (the drawer slides over the map). Docked
    // → the popper UNMOUNTS (stable state, avoids a permanent duplicate
    // annotations subscription); drawer hover → the popper is only CSS-hidden
    // so its local state (drag position, ...) survives the transient overlay.
    const isDessinModule = useSelector((s) => s.viewers.selectedViewerKey === "MAP");
    // Photos module (key PHOTOS): the Photos panel owns the left side and the
    // module has no use for the annotation listings popper — never mounted.
    const isPhotosModule = useSelector(
        (s) => s.viewers.selectedViewerKey === "PHOTOS"
    );
    // Photo being localized by the PHOTO_POSE two-click tool.
    const localizingPhotoId = useSelector((s) => s.photos.localizingPhotoId);
    // Viewer module popper: photos render on the map only while the header
    // toggle sits on its "Photos" tab.
    const viewerPhotosTabActive = useSelector(
        (s) => s.popperMapListings.viewerContentMode === "PHOTOS"
    );
    const leftPanelDocked = useSelector((s) => s.leftPanel.leftPanelDocked);
    const leftDrawerHovered = useSelector((s) => s.leftPanel.leftDrawerHovered);
    const dessinPanelDocked = isDessinModule && leftPanelDocked;
    const dessinPanelSlidedIn =
        isDessinModule && !leftPanelDocked && leftDrawerHovered;
    const viewerPanelDocked = isViewerModule && leftPanelDocked;
    const viewerPanelSlidedIn =
        isViewerModule && !leftPanelDocked && leftDrawerHovered;
    const hiddenVersionIds = useSelector((s) => s.baseMapEditor.hiddenVersionIds);
    const selectedVersionId = useSelector((s) => s.baseMapEditor.selectedVersionId);
    const versionTransformOverride = useSelector((s) => s.baseMapEditor.versionTransformOverride);
    const versionCompareEnabled = useSelector((s) => s.baseMapEditor.versionCompareEnabled);
    const versionCompareId = useSelector((s) => s.baseMapEditor.versionCompareId);
    const showDrawingToolsInBaseMaps = useSelector(
        (s) => s.popperMapListings.showInBaseMapsViewer
    );
    const compareSliderRef = useRef(null);

    // reset compare when leaving BASE_MAPS viewer
    useEffect(() => {
        if (viewerKey !== "BASE_MAPS" && versionCompareEnabled) {
            dispatch(resetVersionCompare());
        }
    }, [viewerKey]);

    // viewport

    const viewport = {
        w: bounds.width,
        h: bounds.height,
    };

    // bgImage

    useAutoShowBgImage();
    const bgImage = useBgImageInMapEditor();
    _track("bgImage", bgImage?.url);
    const showBgImage = useSelector((s) => s.bgImage.showBgImageInMapEditor);
    const showBgImageRef = useRef(showBgImage);
    useEffect(() => {
        showBgImageRef.current = showBgImage;
    }, [showBgImage]);


    // bgImage annotations

    useAutoBgImageRawTextAnnotations();
    const bgImageRawTextAnnotations = useSelector((s) => s.bgImage.bgImageRawTextAnnotations);

    function _updateBgImageRawTextAnnotation({ key, value }) {
        dispatch(setBgImageRawTextAnnotations({
            ...bgImageRawTextAnnotations,
            [key]: value,
        }));
    }

    // baseMaps

    const { value: baseMaps } = useBaseMaps();
    _track("baseMaps.length", baseMaps?.length);

    // baseMap
    const baseMap = useMainBaseMap();
    _track("baseMap", baseMap?.id);

    const baseMapOpacity = useSelector((s) => s.mapEditor.baseMapOpacity);
    const baseMapGrayScale = useSelector((s) => s.mapEditor.baseMapGrayScale);
    const showPrintableMap = useSelector((s) => s.mapEditor.showPrintableMap);

    // Whether to run the CLEAN-SEGMENTS PASS on strip-detection commit.
    // Default true. Toggleable via setCleanOnCommit (smartDetectSlice).
    const cleanOnCommit = useSelector((s) => s.smartDetect.cleanOnCommit);

    useEffect(() => {
        if (baseMap && bgImage) {
            const defaultBaseMapPoseInBg = getDefaultBaseMapPoseInBg({
                baseMap,
                bgImage,
            });
            console.log("=> defaultBaseMapPoseInBg", defaultBaseMapPoseInBg);
            dispatch(setBaseMapPoseInBg(defaultBaseMapPoseInBg));
        }
    }, [baseMap?.id, bgImage?.url]);

    useAutoSelectMainBaseMap();
    //useAutoResetBaseMapPose();
    const basePoseInBg = useSelector((s) => s.mapEditor.baseMapPoseInBg);


    const { pose: basePose } = useBaseMapPose({
        baseMap,
        viewport,
        basePoseInBg,
    });


    // handlers
    const handleBaseMapPoseChange = (newPose) => {
        // newPose = { x, y, k, r }
        dispatch(setBaseMapPoseInBg(newPose));
    };
    const isBaseMapSelected = showBgImage && selectedNode?.nodeType === "BASE_MAP";

    // annotation

    let newAnnotation = useSelector(s => s.annotations.newAnnotation);
    const type = newAnnotation?.type;

    // annotations

    const openedPanel = useSelector(s => s.listings.openedPanel);
    const hideBaseMapAnnotations = openedPanel !== "BASE_MAP_DETAIL";
    const showAnnotationsInBaseMaps = useSelector(
        (s) => s.baseMapEditor.showAnnotations
    );

    _track("newAnnotation", newAnnotation?.id);
    const rawAnnotations = useAnnotationsV2({
        caller: "MainMapEditorV3",
        enabled: isActiveViewer,
        withEntity: true,
        excludeListingsIds: hiddenListingsIds,
        hideBaseMapAnnotations,
        filterByMainBaseMap: true,
        filterBySelectedScope: true,
        sortByOrderIndex: true,
        excludeIsForBaseMapsListings: viewerKey !== "BASE_MAPS",
        // "Afficher les annotations" switch of the Fond de plan panel: ON
        // lifts the isForBaseMaps-only restriction so the drawing
        // annotations show too.
        onlyIsForBaseMapsListings:
            viewerKey === "BASE_MAPS" && !showAnnotationsInBaseMaps,
        // Read-only outlines of subtraction targets hosted by another base map
        // (clickable, so the toolbar can offer "Voir l'annotation d'origine").
        withForeignFootprints: true,
        // Photo camera poses (point + view cone) — Photos module, and the
        // Viewer module's 2D editor while the popper's Photos tab is active
        // (read-only consultation, hover preview + click-select in the grid).
        withPhotos: isPhotosModule || (isViewerModule && viewerPhotosTabActive),
    });

    // "Maillage" toggle: ON → replace meshed parents by their mesh cells (keep
    // cells + non-meshed annotations); OFF → hide mesh cells, show parents.
    // Mirrors useAutoLoadAnnotationsInThreedEditor.
    const showMeshCells = useSelector((s) => s.annotations.showMeshCells);
    const { parentIdSet } = useMeshCellRelations();
    const annotations = useMemo(() => {
        if (!rawAnnotations) return rawAnnotations;
        if (!showMeshCells) return rawAnnotations.filter((a) => !a.isMeshCell);
        // show the cells; shade adjacent ones (by meshCellIndex) so they're
        // distinguishable while staying close to the parent's color.
        return rawAnnotations
            .filter((a) => !parentIdSet.has(a.id))
            .map((a) => {
                if (!a.isMeshCell) return a;
                const base = a.strokeColor || a.fillColor;
                const shaded = shadeMeshCellColor(base, a.label);
                return { ...a, strokeColor: shaded, fillColor: shaded };
            });
    }, [rawAnnotations, showMeshCells, parentIdSet]);

    // Layer STRIPs (isLayer): DISPLAY-ONLY stacked geometry (offset by the
    // accumulated thickness of the layers beneath, 45° ramps at their edges).
    // Fed exclusively to the display consumers (StaticMapContent, PrintableMap,
    // image-mode label layout); interaction, snapping, drags and commit keep
    // the raw `annotations` (support geometry) — including EditedObjectLayer,
    // so a selected layer drops back onto its support line for editing.
    const displayAnnotations = useMemo(() => {
        if (!annotations?.length) return annotations;
        const stackedById = applyLayerStackingToAnnotations(annotations, {
            baseMapId: baseMap?.id,
            meterByPx: baseMap?.getMeterByPx?.(),
        });
        if (!stackedById.size) return annotations;
        return annotations.map((a) =>
            stackedById.has(a.id)
                ? {
                      ...a,
                      points: stackedById.get(a.id),
                      _layerSupportPoints: a.points,
                      _layerStacked: true,
                  }
                : a
        );
    }, [annotations, baseMap]);

    _track("annotations.length", annotations?.length);

    // legend

    const legendItems = useLegendItems();
    const legendFormat = useSelector((s) => s.mapEditor.legendFormat);
    const legendQtiesById = useAnnotationTemplateQtiesByIdForBaseMap(baseMap?.id);

    const isLegendSelected = showBgImage && selectedNode?.nodeType === "LEGEND";

    // image mode — Export rapide is MAP-only; the POV viewer and the global
    // Capture tool (hotkey V) arm the framing on demand, on any 2D instance
    const isMapViewer = forViewerKey === "MAP";
    const imageModeEnabled = useSelector((s) => s.mapEditor.imageModeEnabled);
    const captureToolActive = useSelector((s) => s.mapEditor.captureToolActive);
    const povFramingActive = useSelector(selectPovFramingActive);
    // isActiveViewer scoping: a hidden 2D instance (module displaying another
    // editor) must not run the framing overlay / label layout.
    const imageModeActive =
        (isMapViewer && imageModeEnabled) ||
        ((povFramingActive || captureToolActive) && isActiveViewer);
    // Same hook as Portfolio's LegendBlockSvg so the capture legend items
    // (shape, ordering, groupings) match exactly.
    const imageModeLegendItems = useLegendItemsByBaseMapId(baseMap?.id);
    const imageModeLegendSelected = useSelector(
        (s) => s.mapEditor.imageModeLegendSelected
    );

    // display-only label auto-layout while imageMode is active
    const { labelOverridesById, notifyCameraChange } = useImageModeLabelsLayout({
        enabled: imageModeActive,
        annotations: displayAnnotations,
        basePose,
        getCameraMatrix: () => interactionLayerRef.current?.getCameraMatrix?.(),
        viewportBounds: bounds,
        hostKey: forViewerKey,
    });

    function handleLegendFormatChange(newFormat) {
        dispatch(setLegendFormat(newFormat));
    }


    // default camera matrix

    const defaultCameraMatrixRef = useRef(null);

    defaultCameraMatrixRef.current = getDefaultCameraMatrix({
        showBgImage,
        bgSize: bgImage?.imageSize,
        baseSize: baseMap?.getImageSize?.(),
        viewport,
        basePose,
    });


    const lastAutoFitKeyRef = useRef(null);

    useEffect(() => {

        // Before the container is measured getDefaultCameraMatrix returns its
        // {x:0,y:0,k:1} guard value: applying it would show the baseMap at 1:1
        // image pixels for one frame, then refit once the width lands.
        if (!viewport?.w || !viewport?.h) return;

        // One auto-fit per displayed content: viewport growth/shrink (docked
        // drawer, window resize, module switch) must not clobber the user's
        // camera. Manual re-fit stays available via "Recentrer le fond de plan".
        // basePose.k only depends on the bg pose, never on the viewport size
        // (useBaseMapPose uses the viewport as a measured-yet guard only), so
        // a resize cannot re-arm the key.
        const fitKey = `${baseMap?.id}|${basePose?.k}|${bgImage?.imageSize?.width}`;
        if (lastAutoFitKeyRef.current === fitKey) return;

        if (defaultCameraMatrixRef.current && !showBgImage) {
            interactionLayerRef.current?.setCameraMatrix(defaultCameraMatrixRef.current);
            lastAutoFitKeyRef.current = fitKey;
        }

    }, [
        basePose?.k,
        baseMap?.id,
        bgImage?.imageSize?.width,
        viewport?.w,
        viewport?.h,
    ]);

    // effect - fit to selectedNode

    useEffect(() => {
        if (selectedNode?.origin !== "LISTING") return;
        const annotation = annotations.find(a => a.id === selectedNode?.nodeId);
        if (annotation && annotation.baseMapId === baseMap?.id) {
            const bounds = getAnnotationBounds(annotation, basePose);
            if (bounds) {
                const targetMatrix = fitBoundsToViewport(bounds, viewport, 260);
                interactionLayerRef.current?.setCameraMatrix(targetMatrix);
            }
        }
    }, [baseMap?.id, selectedNode?.nodeId, annotations?.length])


    // handler - commit drawing

    _track("legendItems.length", legendItems?.length);
    const newEntity = useNewEntity();
    _track("newEntity", newEntity);
    const { handleDrawingCommit: _handleCommitDrawing } = useHandleCommitDrawing({ newEntity, annotations });
    // Deferred commit mechanism: interactive draws funnel through
    // deferredCommit.commit so an armed newAnnotation.commitInterceptor can
    // divert the commit to a dialog (see drawingCommitInterceptors).
    const { value: userEmail } = useUserEmail();
    const deferredCommit = useDeferredDrawingCommit({
        commitFn: _handleCommitDrawing,
        deps: { projectId, createdBy: userEmail, dispatch },
    });
    const updateAnnotation = useUpdateAnnotation();
    const { handleSplitCommit, handlePolylineSplitAtVertex } = useHandleSplitCommit({ newEntity });
    const handleCutSegment = useHandleCutSegment({ newEntity });
    const handleTechnicalReturn = useHandleTechnicalReturn({ annotations, newEntity });
    const { handleSplitPolylineClick, handleSplitPolylineEnter, resetSplitPolyline } = useHandleSplitPolyline({ newEntity });
    const { handleSplitPolylineClickPoint } = useHandleSplitPolylineClick({ newEntity });
    const handleCommitGuideLine = useHandleCommitGuideLine();
    const handleCommitIsoHeightLine = useHandleCommitIsoHeightLine();
    const handleCommitProfileLine = useHandleCommitProfileLine();
    const handleCommitRamp = useHandleCommitRamp({ newEntity });
    const deleteGuideLine = useDeleteGuideLine();
    const deleteIsoHeightLine = useDeleteIsoHeightLine();
    const deleteProfileLine = useDeleteProfileLine();
    const { handleCompleteAnnotationCommit } = useHandleCompleteAnnotation({ newEntity });
    const saveTempAnnotations = useSaveTempAnnotations();
    const createAnnotationsFromDetectedStrips = useCreateAnnotationsFromDetectedStrips();
    const createAnnotationsFromDetectedFeatures = useCreateAnnotationsFromDetectedFeatures();
    const handleCommitLocalizedRepair = useCommitLocalizedRepair();
    const createAnnotationFromSurfaceDrop = useCreateAnnotationFromSurfaceDrop();

    const handleCommitDetectedFeatures = async ({ features, sourceAnnotation }) => {
        try {
            await createAnnotationsFromDetectedFeatures({
                features,
                sourceAnnotation: sourceAnnotation ?? newAnnotation,
            });
        } catch (err) {
            console.error("[handleCommitDetectedFeatures] bulk create failed", err);
        }
    };

    const handleCommitDrawing = (rawPoints, options) => {

        if (rawPoints.length === 1 && type === "RECTANGLE") {

            const imageSize = getAnnotationTemplateSizeInPx({
                size: newAnnotation.size,
                sizeUnit: newAnnotation.sizeUnit,
                meterByPx: baseMap?.meterByPx,
            })
            const width = imageSize.width;
            const height = imageSize.height;
            rawPoints = getRectangleRawPointsFromOnePoint({
                point: rawPoints[0],
                width,
                height,
            })

            options = { ...options ?? {}, drawRectangle: true }
        }

        if (rawPoints.length === 1 && type === "IMAGE") {
            const points = getImageAnnotationRectanglePointsFromOnePoint({
                annotation: newAnnotation,
                baseMapMeterByPx: baseMap?.getMeterByPx(),
                point: rawPoints[0],
            })
            rawPoints = points;
            options = { ...options ?? {}, drawRectangle: true }
        }

        if (rawPoints.length === 1 && type === "OBJECT_3D") {
            const points = getObject3DAnnotationRectanglePointsFromOnePoint({
                annotation: newAnnotation,
                baseMapMeterByPx: baseMap?.getMeterByPx(),
                point: rawPoints[0],
            })
            rawPoints = points;
            options = { ...options ?? {}, drawRectangle: true }
        }
        deferredCommit.commit(rawPoints, options)
    }

    // handler - commit points from drop_fill

    const handleCommitPointsFromSurfaceDrop = async ({ points, cuts }) => {
        // Batched DB path (single transaction, one bulkAdd per table) —
        // same pattern as useCreateAnnotationsFromDetectedStrips. Keeps the
        // Space-commit feedback instant once the flood-fill preview is ready.
        await createAnnotationFromSurfaceDrop({
            points,
            cuts,
            newAnnotation: {
                ...newAnnotation,
                baseMapId: baseMap.id,
            },
        });
    }

    // handler - commit detected similar strips

    const handleCommitSimilarStrips = async ({
        strips,
        sourceAnnotation,
        pointEdits,
    }) => {
        if (!strips?.length) return;

        // ── CLEAN-SEGMENTS PASS ──────────────────────────────────────────
        // Opt-in (default on — gated by `cleanOnCommit` in smartDetectSlice).
        // Runs cleanSegments on (detected strips + visible 2-point POLYLINE
        // annotations — same source that feeds the exclusion mask) BEFORE
        // persistence so junctions align (border-proximity snap from #182)
        // and duplicate / overlapping colinear neighbours get merged in.
        // Detected strips are tagged with a `tmp_` id prefix; the router
        // below splits the cleanSegments output into (a) centerline
        // rewrites for detected strips, (b) point-coord updates / deletes
        // for existing annotations (Dexie, atomic transaction). When the
        // flag is off, `strips` flows through unchanged. See #183 and
        // docs/smartDetect/CLEAN_ON_COMMIT.md.
        // ─────────────────────────────────────────────────────────────────
        let cleanedStrips = strips;
        // STRIP candidates carry control-EDGE points, not centerlines —
        // mixing them with POLYLINE centerlines would snap/merge with a
        // half-width offset, so the pass is skipped for strips.
        if (cleanOnCommit && sourceAnnotation?.type !== "STRIP") {
            const TMP_PREFIX = "tmp_";
            const meterByPx = baseMap?.getMeterByPx?.() ?? 0;
            const imageSize =
                baseMap?.getImageSize?.() || baseMap?.image?.imageSize;
            const width = imageSize?.width || 1;
            const height = imageSize?.height || 1;

            const existingSegments = (annotations || [])
                .filter(
                    (a) =>
                        a?.type === "POLYLINE" &&
                        !a.closeLine &&
                        Array.isArray(a.points) &&
                        a.points.length === 2
                )
                .map((a) => ({
                    id: a.id,
                    points: a.points.map((p) => ({
                        id: p.id,
                        x: p.x,
                        y: p.y,
                        type: p.type,
                    })),
                    strokeWidth: a.strokeWidth,
                    strokeWidthUnit: a.strokeWidthUnit,
                }));

            const detectedSegments = strips.map((strip) => ({
                id: `${TMP_PREFIX}${nanoid()}`,
                points: [
                    {
                        id: nanoid(),
                        x: strip.centerline[0].x,
                        y: strip.centerline[0].y,
                        type: "square",
                    },
                    {
                        id: nanoid(),
                        x: strip.centerline[1].x,
                        y: strip.centerline[1].y,
                        type: "square",
                    },
                ],
                strokeWidth:
                    strip.strokeWidth ?? sourceAnnotation?.strokeWidth,
                strokeWidthUnit:
                    strip.strokeWidthUnit ?? sourceAnnotation?.strokeWidthUnit,
                _strip: strip,
            }));

            const { updates, deleteIds } = cleanSegments({
                segments: [...existingSegments, ...detectedSegments],
                meterByPx,
            });

            const updateMap = new Map(updates.map((u) => [u.id, u.points]));
            const deleteSet = new Set(deleteIds);

            // 4a. Detected strips: drop if deleted, rewrite centerline if updated.
            cleanedStrips = detectedSegments
                .filter((s) => !deleteSet.has(s.id))
                .map((s) => {
                    const pts = updateMap.get(s.id) ?? s.points;
                    return {
                        ...s._strip,
                        centerline: [
                            { x: pts[0].x, y: pts[0].y },
                            { x: pts[1].x, y: pts[1].y },
                        ],
                    };
                });

            // 4b. Existing annotations: update changed point coords (by id,
            // normalized), delete annotations in deleteSet. Single atomic tx.
            const pointCoordsToUpdate = [];
            for (const u of updates) {
                if (u.id.startsWith(TMP_PREFIX)) continue;
                for (const p of u.points) {
                    pointCoordsToUpdate.push({
                        id: p.id,
                        x: p.x / width,
                        y: p.y / height,
                    });
                }
            }
            const existingIdsToDelete = [...deleteSet].filter(
                (id) => !id.startsWith(TMP_PREFIX)
            );

            if (
                pointCoordsToUpdate.length > 0 ||
                existingIdsToDelete.length > 0
            ) {
                try {
                    await db.transaction(
                        "rw",
                        [db.points, db.annotations],
                        async () => {
                            for (const { id, x, y } of pointCoordsToUpdate) {
                                await db.points.update(id, { x, y });
                            }
                            if (existingIdsToDelete.length > 0) {
                                await db.annotations.bulkDelete(
                                    existingIdsToDelete
                                );
                            }
                        }
                    );
                    dispatch(triggerAnnotationsUpdate());
                } catch (err) {
                    console.error(
                        "[handleCommitSimilarStrips] clean-segments DB update failed:",
                        err
                    );
                    return; // bail out — do not create new annotations on half-applied state
                }
            }
        }
        // ── end CLEAN-SEGMENTS PASS ──────────────────────────────────────

        await createAnnotationsFromDetectedStrips({
            strips: cleanedStrips,
            sourceAnnotation,
            pointEdits,
        });
    };

    // handlers - image drop

    const handleCommitImageDrop = async (droppedImage) => {
        let imageFile;
        try {
            imageFile = await imageUrlToPng({ url: droppedImage.imageUrl, name: "image.png" })
        } catch (error) {
            console.error("Error converting URL to PNG:", error);
        }
        const images = [{ file: imageFile, imageUrlRemote: droppedImage.imageUrl }]
        _handleCommitDrawing([{ x: droppedImage.x, y: droppedImage.y }], { newAnnotation: { type: "MARKER", images }, skipTemplateCreation: true })
    }

    // handlers - rectangle

    const handleCommitDrawingFromRectangle = (points, event) => {
        if (["POLYGON", "POLYLINE", "CUT"].includes(type) && points.length === 2) {
            points = getPolylinePointsFromRectangle(points, orthoSnapAngleOffset)
        }
        const options = {}
        if (type === "POLYLINE") options.closeLine = true;
        if (type === "RECTANGLE") {
            options.drawRectangle = true;
        }
        handleCommitDrawing(points, options)
    }
    // handlers - circle

    const handleCommitDrawingFromCircle = (points) => {
        const circlePoints = getPolylinePointsFromCircle(points);
        const options = {};
        if (type === "POLYLINE") options.closeLine = true;
        handleCommitDrawing(circlePoints, options);
    }

    const handleCommitDrawingFromCircleRadius = (points) => {
        const circlePoints = getPolylinePointsFromCircleCenterRadius(points);
        const options = {};
        if (type === "POLYLINE") options.closeLine = true;
        handleCommitDrawing(circlePoints, options);
    }

    // handlers - revolution axis (plan view)

    // The 2 clicks are [centre, edge]. Unlike the circle tools we do NOT
    // polygonize into a ring: the axis stores its CENTRE as its single point,
    // and turns the edge into the two scalars `radiusM` + `directionDeg`
    // (see getRevolutionAxisPlanFrame for the frame conventions).
    const handleCommitDrawingFromRevolutionAxis = (points) => {
        const [center, edge] = points ?? [];
        if (!center || !edge) return;
        const meterByPx = baseMap?.getMeterByPx?.();
        const dx = edge.x - center.x;
        const dy = edge.y - center.y;
        const radiusPx = Math.hypot(dx, dy);
        // Stored radius is rounded to 6 decimals (µm precision) — raw px→m
        // products carry meaningless float tails into the toolbar field.
        const radiusM =
            Number.isFinite(meterByPx) && meterByPx > 0
                ? Math.round(radiusPx * meterByPx * 1e6) / 1e6
                : null;
        // px -> plan LOCAL metre frame: y flips (see pixelToWorld).
        const directionDeg = (Math.atan2(-dy, dx) * 180) / Math.PI;
        handleCommitDrawing([center], {
            revolutionAxisProps: {
                ...(radiusM != null && { radiusM }),
                directionDeg,
            },
        });
    }

    // handlers - photo pose (Photos module)

    // Same [centre, edge] gesture as the revolution axis, but the commit
    // targets db.photos (photos are NOT annotations): the centre becomes the
    // photo's normalized inline point, the edge the camera direction + range.
    const handleCommitPhotoPose = async (points) => {
        const [center, edge] = points ?? [];
        const photoId = localizingPhotoId;
        dispatch(setEnabledDrawingMode(null));
        dispatch(setLocalizingPhotoId(null));
        const imageSize = baseMap?.getImageSize?.();
        if (!center || !edge || !photoId || !imageSize?.width) return;
        const meterByPx = baseMap?.getMeterByPx?.();
        const dx = edge.x - center.x;
        const dy = edge.y - center.y;
        const radiusPx = Math.hypot(dx, dy);
        const radiusM =
            Number.isFinite(meterByPx) && meterByPx > 0
                ? Math.round(radiusPx * meterByPx * 1e6) / 1e6
                : null;
        // px -> plan LOCAL metre frame: y flips (same as the revolution axis).
        const directionDeg = (Math.atan2(-dy, dx) * 180) / Math.PI;
        const photo = await db.photos.get(photoId);
        if (!photo) return;
        await db.photos.update(photoId, {
            point: {
                x: center.x / imageSize.width,
                y: center.y / imageSize.height,
            },
            baseMapId: baseMap.id,
            directionDeg,
            radiusM,
            fovDeg: photo.fovDeg ?? DEFAULT_FOV_DEG,
        });
    }

    // "Repositionner": move an existing placement's point instead of creating a
    // new annotation, then re-pose the elevation from the axis.
    const handleRepositionRevolutionPlacement = async (points) => {
        const pt = points?.[0];
        const imageSize = baseMap?.getImageSize?.();
        const annotation = annotations.find((a) => a.id === selectedNode?.nodeId);
        dispatch(setEnabledDrawingMode(null));
        if (!pt || !annotation?.point?.id || !imageSize?.width) return;
        if (annotation.type !== "REVOLUTION_AXIS_PLACEMENT") return;
        await db.points.update(annotation.point.id, {
            x: pt.x / imageSize.width,
            y: pt.y / imageSize.height,
        });
        dispatch(triggerAnnotationsUpdate());
        await resyncRevolutionAxisPlacementsService({
            placementId: annotation.id,
            dispatch,
        });
    }

    // handlers - arc

    const handleCommitDrawingFromArc = (points) => {
        const arcPoints = getPolylinePointsFromArc(points);
        handleCommitDrawing(arcPoints, { closeLine: false });
    }

    // handlers - measure

    const handleMeasureCommit = (points, event) => {
        console.log("handleMeasureCommit", points)
        const anchorPositionScale = { x: event.clientX, y: event.clientY }
        dispatch(setAnchorPositionScale(anchorPositionScale))
        dispatch(setTempAnnotations([{
            id: nanoid(),
            type: "POLYLINE",
            points,
            strokeColor: theme.palette.secondary.main,
            strokeWidth: 2,
            strokeWidthUnit: "PX",
            outOfSnapScope: true,
            baseMapId: baseMap.id,
            projectId,
        }]))
        const p1 = points[0];
        const p2 = points[points.length - 1];
        const distance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        const angle = getSegmentAngle(p1, p2);

        console.log("distance", distance)
        dispatch(setScaleInPx(distance));
        dispatch(setAngleInRad(angle));

        dispatch(setEnabledDrawingMode(null))
    };

    // handlers

    const handleResetCamera = () => {
        interactionLayerRef.current?.setCameraMatrix(defaultCameraMatrixRef.current);
    };

    // handlers - move point

    // Reflow openings glued on a host whose geometry just changed: reposition
    // their own point rows (fixed distance from the reference vertex) and
    // refresh the host carve. Fire-and-forget wrapper with shared context.
    const reflowOpenings = async ({ movedPointIds, hostIds }) => {
        const imageSize = baseMap?.getImageSize?.();
        const meterByPx = baseMap?.getMeterByPx?.();
        if (!imageSize || !(meterByPx > 0) || !projectId) return;
        try {
            await reflowOpeningsForHost({
                movedPointIds,
                hostIds,
                projectId,
                imageSize,
                meterByPx,
            });
        } catch (e) {
            console.error("[openings] reflow failed", e);
        }
    };

    const handlePointMoveCommit = async (pointId, newPos) => {
        const imageSize = baseMap?.getImageSize?.();
        if (!imageSize) return;

        // Find annotations that reference this point and have rotation metadata.
        // Moving a vertex "bakes in" the rotation for that point, so rotation
        // metadata is no longer valid and must be cleared.
        const rotatedAnns = annotations?.filter((ann) => {
            if (!ann.rotation && !ann.rotationCenter) return false;
            const inMain = ann.points?.some((pt) => pt.id === pointId);
            const inCuts = ann.cuts?.some((cut) => cut.points?.some((pt) => pt.id === pointId));
            return inMain || inCuts;
        }) ?? [];

        await db.transaction("rw", db.points, db.annotations, async () => {
            const ops = [
                db.points.update(pointId, {
                    x: newPos.x / imageSize.width,
                    y: newPos.y / imageSize.height,
                }),
            ];
            for (const ann of rotatedAnns) {
                ops.push(
                    db.annotations.update(ann.id, {
                        rotation: 0,
                        rotationCenter: null,
                    })
                );
            }
            await Promise.all(ops);
        });

        // Reflow a cut into the outer contour when the user drags one of its
        // vertices onto (or beyond) the host polygon's outer boundary. See
        // [annotations] issue #224.
        const hostAnn = annotations?.find((ann) =>
            ann.type === "POLYGON" &&
            ann.cuts?.some((cut) => cut.points?.some((pt) => pt.id === pointId))
        );
        if (hostAnn) {
            const cutOwning = hostAnn.cuts.find((cut) =>
                cut.points?.some((pt) => pt.id === pointId)
            );
            const cutId = cutOwning?.id;
            const cutPointIds = (cutOwning?.points ?? []).map((p) => p.id);
            if (cutPointIds.length >= 3) {
                const cutPointDocs = await db.points.bulkGet(cutPointIds);
                const cutPx = cutPointDocs
                    .filter(Boolean)
                    .map((p) => ({
                        x: p.x * imageSize.width,
                        y: p.y * imageSize.height,
                    }));
                if (cutPx.length >= 3) {
                    const reflowResult = await applyOpeningOnPolygon({
                        host: hostAnn,
                        openingPointsPx: cutPx,
                        imageSize,
                        baseMapId: hostAnn.baseMapId,
                        projectId: hostAnn.projectId,
                        listingId: hostAnn.listingId,
                        excludeCutId: cutId,
                    });
                    if (reflowResult?.handled && reflowResult.updatedAnnotation) {
                        await updateAnnotation(reflowResult.updatedAnnotation);
                    }
                }
            }
        }

        // Reposition openings anchored on the moved vertex (glued openings
        // follow their host wall) + refresh their carve.
        await reflowOpenings({ movedPointIds: [pointId] });
    };

    // Multi-point commit (EDIT-mode segment drag / angle-locked vertex drag):
    // normalized db.points bulkUpdate + rotation clearing + openings reflow,
    // all shared with the segment-length editor via applyPointsMovesService.
    const handlePointsMoveCommit = async (annotation, moves) => {
        await applyPointsMovesService({
            annotation,
            moves,
            meterByPx: baseMap?.getMeterByPx?.(),
            dispatch,
        });
    };

    // Multi-selection shared-vertex drag: every matched pointId lands on the
    // same final position. commitWrapperTransform owns the topology semantics
    // (points exclusive to the matched annotations updated in place, points
    // shared with non-selected annotations duplicated and re-referenced on
    // the matched annotations only). Note: the cut→contour reflow (#224) is
    // not run here — same accepted limitation as the wrapper transform.
    const handleMultiVertexMoveCommit = async ({ annotationIds, pointIds, newPos }) => {
        const imageSize = baseMap?.getImageSize?.();
        if (!imageSize) return;
        await commitWrapperTransform({
            selectedAnnotationIds: annotationIds, // matched subset, NOT the full selection
            allAnnotations: annotations,
            pointUpdates: new Map(pointIds.map((pid) => [pid, newPos])),
            imageSize,
            clearRotation: true, // vertex move bakes in rotation — same rule as handlePointMoveCommit
        });
        await reflowOpenings({ movedPointIds: pointIds, hostIds: annotationIds });
        dispatch(triggerAnnotationsUpdate());
    };

    const handleDuplicateAndMovePoint = async ({ originalPointId, annotationId, newPos }) => {
        const imageSize = baseMap?.getImageSize?.();
        const { newPointId } = await duplicateAndMovePoint({ originalPointId, annotationId, newPos, imageSize, annotations });
        // The fork remapped the glued-opening anchors onto the fresh id —
        // reflow repositions them on the moved segment. hostIds also self-heals
        // rels whose anchors were already stale (projection re-anchor).
        await reflowOpenings({ movedPointIds: [newPointId], hostIds: [annotationId] });
    };

    const handlePointSnapReplace = async ({ oldPointId, snapPointId, affectedAnnotationIds }) => {
        await replacePointBySnap({ oldPointId, snapPointId, affectedAnnotationIds, annotations });
        await reflowOpenings({ movedPointIds: [snapPointId], hostIds: affectedAnnotationIds });
    };

    const handleToggleAnnotationPointType = async ({ annotationId, pointId }) => {
        await toggleAnnotationPointType({ annotationId, pointId });
    };

    // handlers - split line

    const handleSegmentSplit = async (segment) => {
        console.log("splitSegment", segment);
        const { segmentStartId, segmentEndId, x, y } = segment;
        const imageSize = baseMap?.getImageSize?.();
        if (!imageSize) return;

        const newPointId = nanoid();

        // 1. Create the new physical point object
        const newPointEntity = {
            id: newPointId,
            x: x / imageSize.width,
            y: y / imageSize.height,
            baseMapId: baseMap.id,
            projectId,
            listingId,
            // ...other default point props
        };

        const newPointObject = { id: newPointId, type: 'square' };
        // guideLine refs key on `pointId` (not `id`).
        const newGuidePointObject = { pointId: newPointId, type: 'square' };

        // Arc-midpoint control points to persist when a split lands on an arc.
        const extraCircleRecords = [];

        // Helper function to try inserting point in a specific list of points.
        // Returns the new array if insertion happened, or null if segment not
        // found. When the matched segment is one half of an S-C-S arc, the
        // insertion preserves the curve (S-C-S-C-S) via splitArcOnInsert and
        // queues the extra circle control for persistence.
        // `pointsList` is pixel-resolved here (points carry {id,x,y,type}).
        const insertPointInPath = (pointsList, { closed } = {}) => {
            if (!pointsList || pointsList.length < 2) return null;

            for (let i = 0; i < pointsList.length; i++) {
                const currentPt = pointsList[i];
                const nextPt = pointsList[(i + 1) % pointsList.length]; // Handle closed loop

                const matchFwd = currentPt.id === segmentStartId && nextPt.id === segmentEndId;
                const matchRev = currentPt.id === segmentEndId && nextPt.id === segmentStartId;
                if (!matchFwd && !matchRev) continue;

                const { points: newPoints, newCircle } = splitArcOnInsert({
                    points: pointsList,
                    segmentStartIndex: i,
                    newRef: newPointObject,
                    newPx: { x, y },
                    getPx: (id) => {
                        const p = pointsList.find((pt) => pt.id === id);
                        return p && Number.isFinite(p.x) ? { x: p.x, y: p.y } : undefined;
                    },
                    closed: !!closed,
                    makeId: () => nanoid(),
                });

                if (newCircle) {
                    extraCircleRecords.push({
                        id: newCircle.id,
                        x: newCircle.x / imageSize.width,
                        y: newCircle.y / imageSize.height,
                        baseMapId: baseMap.id,
                        projectId,
                        listingId,
                    });
                }

                return newPoints;
            }
            return null;
        };

        // 2. Find ALL annotations affected by this segment (Main contour OR Cuts)
        const annotationsToUpdate = [];

        annotations.forEach(ann => {
            let hasChanges = false;
            const updates = { id: ann.id };

            // A. Check Main Contour
            const mainClosed = ann.type === "POLYGON" || ann.closeLine === true;
            const newMainPoints = insertPointInPath(ann.points, { closed: mainClosed });
            if (newMainPoints) {
                updates.points = newMainPoints;
                hasChanges = true;
            }

            // B'. Check guideLines (open polylines, ref key `pointId`)
            if (Array.isArray(ann.guideLines)) {
                let glChanged = false;
                const newGuideLines = ann.guideLines.map((glObj) => {
                    const gl = glObj?.points || [];
                    if (gl.length < 2) return glObj;
                    for (let i = 0; i < gl.length - 1; i++) {
                        const a = gl[i];
                        const b = gl[i + 1];
                        const aId = a.pointId || a.id;
                        const bId = b.pointId || b.id;
                        if (
                            (aId === segmentStartId && bId === segmentEndId) ||
                            (aId === segmentEndId && bId === segmentStartId)
                        ) {
                            const newGuide = [...gl];
                            newGuide.splice(i + 1, 0, newGuidePointObject);
                            glChanged = true;
                            return { ...glObj, points: newGuide };
                        }
                    }
                    return glObj;
                });
                if (glChanged) {
                    updates.guideLines = newGuideLines;
                    hasChanges = true;
                }
            }

            // B. Check Cuts (Holes)
            if (ann.cuts && Array.isArray(ann.cuts)) {
                let cutsChanged = false;

                // On mappe sur les cuts pour voir si l'un d'eux contient le segment
                const newCuts = ann.cuts.map(cut => {
                    // Cut rings are closed loops.
                    const newCutPoints = insertPointInPath(cut.points, { closed: true });

                    if (newCutPoints) {
                        cutsChanged = true;
                        // On retourne le cut mis à jour
                        return { ...cut, points: newCutPoints };
                    }
                    // Sinon on retourne le cut tel quel
                    return cut;
                });

                if (cutsChanged) {
                    updates.cuts = newCuts;
                    hasChanges = true;
                }
            }

            if (hasChanges) {
                annotationsToUpdate.push(updates);
            }
        });

        // 3. Execute Database Operations
        if (annotationsToUpdate.length > 0) {
            try {
                // A. Add the new point (+ any arc-midpoint control points)
                await db.points.bulkAdd([newPointEntity, ...extraCircleRecords]);

                // B. Update annotations (Updating 'points' or 'cuts' or both)
                await Promise.all(
                    annotationsToUpdate.map(update => {
                        // On extrait l'ID et on passe le reste (points et/ou cuts) à l'update
                        const { id, ...changes } = update;
                        return db.annotations.update(id, changes);
                    })
                );

                console.log("Segment split successfully committed (Main or Cut).");

                // Openings anchored on the split segment re-anchor to the
                // right sub-segment (adjacency check fails → projection).
                await reflowOpenings({
                    movedPointIds: [segmentStartId, segmentEndId],
                });
            } catch (error) {
                console.error("Failed to split segment:", error);
            }
        }
    };

    // Insert an existing point into a target annotation's segment (projection snap during drag)
    const handleProjectionSnapInsert = async ({ pointId, annotationId, segmentStartId, segmentEndId, cutIndex }) => {
        const ann = await db.annotations.get(annotationId);
        if (!ann) return;

        const imageSize = baseMap?.getImageSize?.();
        if (!imageSize) return;

        // The target path (raw refs) and whether it is a closed ring.
        const isCut = cutIndex != null && ann.cuts?.[cutIndex];
        const targetPoints = isCut ? ann.cuts[cutIndex].points : ann.points;
        const closed = isCut || ann.type === "POLYGON" || ann.closeLine === true;

        // Pre-resolve the path's points (+ the inserted point) to pixel space so
        // splitArcOnInsert can preserve the arc when the segment is curved.
        const ids = [...new Set([...(targetPoints || []).map((p) => p.id), pointId])];
        const recs = await db.points.bulkGet(ids);
        const pxById = {};
        recs.forEach((r, i) => {
            if (r) pxById[ids[i]] = { x: r.x * imageSize.width, y: r.y * imageSize.height };
        });
        const newPx = pxById[pointId];

        const extraCircleRecords = [];

        const insertPointInPath = (pointsList) => {
            if (!pointsList || pointsList.length < 2 || !newPx) return null;
            for (let i = 0; i < pointsList.length; i++) {
                const cur = pointsList[i];
                const next = pointsList[(i + 1) % pointsList.length];
                if ((cur.id === segmentStartId && next.id === segmentEndId) ||
                    (cur.id === segmentEndId && next.id === segmentStartId)) {
                    const { points: newPoints, newCircle } = splitArcOnInsert({
                        points: pointsList,
                        segmentStartIndex: i,
                        newRef: { id: pointId, type: 'square' },
                        newPx,
                        getPx: (id) => pxById[id],
                        closed,
                        makeId: () => nanoid(),
                    });
                    if (newCircle) {
                        extraCircleRecords.push({
                            id: newCircle.id,
                            x: newCircle.x / imageSize.width,
                            y: newCircle.y / imageSize.height,
                            baseMapId: baseMap.id,
                            projectId,
                            listingId,
                        });
                    }
                    return newPoints;
                }
            }
            return null;
        };

        const changes = {};
        if (isCut) {
            const result = insertPointInPath(ann.cuts[cutIndex].points);
            if (result) {
                const newCuts = ann.cuts.map((c, i) => i === cutIndex ? { ...c, points: result } : c);
                changes.cuts = newCuts;
            }
        } else {
            const result = insertPointInPath(ann.points);
            if (result) changes.points = result;
        }

        if (Object.keys(changes).length > 0) {
            if (extraCircleRecords.length > 0) {
                await db.points.bulkAdd(extraCircleRecords);
            }
            await db.annotations.update(annotationId, changes);
        }
    };

    const handleAnnotationMoveCommit = async (annotationId, deltaPos, partType, localPos) => {
        const imageSize = baseMap?.getImageSize?.();
        if (!imageSize) return;

        // PROFILE_LINE_MOVE::<index>: slide ONE profile line (extrusion
        // cross-section) along its cut axis — see moveProfileLineService.
        if (typeof partType === "string" && partType.startsWith("PROFILE_LINE_MOVE::")) {
            await moveProfileLineService({
                annotationId,
                profileIndex: Number(partType.split("::")[1]),
                deltaPos,
                dispatch,
            });
            return;
        }

        // WRAPPER (group transform for point-based annotations)
        if (annotationId === "wrapper") {
            const POINT_BASED_TYPES = ["POLYLINE", "POLYGON", "STRIP", "LINEAR_LAYOUT"];
            const wrapperAnnotationIds = selectedItems
                .filter(item => item.type === "NODE" && POINT_BASED_TYPES.includes(item.annotationType))
                .map(item => item.nodeId);
            const wrapperAnnotations = annotations?.filter(a => wrapperAnnotationIds.includes(a.id)) ?? [];
            if (wrapperAnnotations.length === 0) return;

            // For ROTATE with existing rotation, use canonical bbox (consistent pivot)
            const cumulativeRotation = wrapperAnnotations[0]?.rotation ?? 0;
            const rotationCenter = wrapperAnnotations[0]?.rotationCenter ?? null;
            const wrapperBbox = (partType === "ROTATE" && cumulativeRotation !== 0 && rotationCenter)
                ? computeWrapperBbox(wrapperAnnotations, cumulativeRotation, rotationCenter)
                : computeWrapperBbox(wrapperAnnotations);
            if (!wrapperBbox) return;

            const pointUpdates = applyWrapperTransformToPoints({
                annotations: wrapperAnnotations,
                wrapperBbox,
                deltaPos,
                partType,
            });

            await commitWrapperTransform({
                selectedAnnotationIds: wrapperAnnotationIds,
                allAnnotations: annotations,
                pointUpdates,
                imageSize,
                rotationDelta: partType === "ROTATE" ? deltaPos.x : null,
                wrapperBbox,
                moveDelta: (!partType || partType === "MOVE") ? deltaPos : null,
                isResize: partType?.startsWith("RESIZE_"),
            });

            // Openings glued on a transformed wall follow it.
            await reflowOpenings({ hostIds: wrapperAnnotationIds });

            dispatch(triggerAnnotationsUpdate());
            return;
        }

        // LABEL
        if (annotationId.startsWith("label::")) {
            const annotation = annotations.find(a => a.id === annotationId.replace("label::", ""));
            console.log("handleAnnotationMoveCommit", annotationId, annotation);
            if (!annotation) return;

            else if (annotation.type === "MARKER" && partType === "TARGET") {
                const point = await db.points.get(annotation.point.id);
                const x = point.x + deltaPos.x / imageSize.width;
                const y = point.y + deltaPos.y / imageSize.height;
                console.log("save_point", point.id, { x, y });
                await db.points.update(point.id, { x, y });
            }


            const labelDelta = getAnnotationLabelDeltaFromDeltaPos(annotation, deltaPos, partType);
            await db.annotations.update(annotation.id, { labelDelta });


        }

        // OTHER ANNOTATIONS
        else {

            const annotation = annotations.find(a => a.id === annotationId);
            if (!annotation) return;


            console.log("handleAnnotationMoveCommit", annotationId, annotation);

            // Revolution axis handles: the centre never moves, only the two
            // derived scalars. Same math as applyDeltaPosToAnnotation so the
            // transient preview and the committed value agree.
            if (
                annotation.type === "REVOLUTION_AXIS" &&
                (partType?.startsWith("REVOLUTION_RIM::") ||
                    partType?.startsWith("REVOLUTION_ANGLE::"))
            ) {
                const next = applyDeltaPosToAnnotation(annotation, deltaPos, partType);
                const updates = partType.startsWith("REVOLUTION_RIM::")
                    // Same 6-decimal rounding as the drawing commit.
                    ? {
                        radiusM: Math.round(next.radiusM * 1e6) / 1e6,
                        directionDeg: next.directionDeg,
                    }
                    : {
                        revolutionAngleStartDeg: next.revolutionAngleStartDeg,
                        revolutionAngleEndDeg: next.revolutionAngleEndDeg,
                    };
                await db.annotations.update(annotation.id, updates);
                // Orientation drives the pose of every elevation this axis places.
                if (partType.startsWith("REVOLUTION_RIM::")) {
                    await resyncRevolutionAxisPlacementsService({
                        axisId: annotation.id,
                        dispatch,
                    });
                }
            }

            // DETAIL rotation: the tip (the stored point) is the pivot and
            // never moves — only arrowAngle changes. Same math as
            // applyDeltaPosToAnnotation so preview and commit agree.
            else if (annotation.type === "DETAIL" && partType === "ROTATE") {
                const next = applyDeltaPosToAnnotation(annotation, deltaPos, partType);
                await db.annotations.update(annotation.id, { arrowAngle: next.arrowAngle });
            }

            else if (
                annotation.type === "MARKER" ||
                annotation.type === "POINT" ||
                annotation.type === "DETAIL" ||
                annotation.type === "REVOLUTION_AXIS" ||
                annotation.type === "REVOLUTION_AXIS_PLACEMENT"
            ) {
                const point = await db.points.get(annotation.point.id);
                const x = point.x + deltaPos.x / imageSize.width;
                const y = point.y + deltaPos.y / imageSize.height;
                console.log("save_point", point.id, { x, y });
                await db.points.update(point.id, { x, y });
                // Moving the axis centre (or its drop point on an elevation)
                // moves the base maps it places.
                if (annotation.type === "REVOLUTION_AXIS") {
                    await resyncRevolutionAxisPlacementsService({
                        axisId: annotation.id,
                        dispatch,
                    });
                } else if (annotation.type === "REVOLUTION_AXIS_PLACEMENT") {
                    await resyncRevolutionAxisPlacementsService({
                        placementId: annotation.id,
                        dispatch,
                    });
                }
            }

            else if (annotation.type === "LABEL" || annotation.type === "FREE_TEXT") {
                const { targetPoint, labelPoint } = annotation;

                const updates = {};

                // FREE_TEXT sans connecteur : la boîte emporte aussi le
                // targetPoint (coïncident, invisible) — même règle que la
                // preview dans applyDeltaPosToAnnotation.
                const moveBothOnBox =
                    annotation.type === "FREE_TEXT" && !annotation.hasConnector;

                // 1. Déplacement de la cible (Target) uniquement
                if (partType === 'TARGET') {
                    updates.targetPoint = {
                        x: (targetPoint.x + deltaPos.x) / imageSize.width,
                        y: (targetPoint.y + deltaPos.y) / imageSize.height
                    };
                }
                // 2. Déplacement du Label uniquement
                else if (partType === 'LABEL_BOX') {
                    updates.labelPoint = {
                        x: (labelPoint.x + deltaPos.x) / imageSize.width,
                        y: (labelPoint.y + deltaPos.y) / imageSize.height
                    };
                    if (moveBothOnBox) {
                        updates.targetPoint = {
                            x: (targetPoint.x + deltaPos.x) / imageSize.width,
                            y: (targetPoint.y + deltaPos.y) / imageSize.height
                        };
                    }
                }
                // 3. Cas général (Déplacement global)
                else {
                    updates.targetPoint = {
                        x: (targetPoint.x + deltaPos.x) / imageSize.width,
                        y: (targetPoint.y + deltaPos.y) / imageSize.height
                    };
                    updates.labelPoint = {
                        x: (labelPoint.x + deltaPos.x) / imageSize.width,
                        y: (labelPoint.y + deltaPos.y) / imageSize.height
                    };
                }

                await db.annotations.update(annotation.id, updates);
            }

            // --- IMAGE : resize avec aspect ratio contraint ---
            else if (annotation.type === "IMAGE") {
                const bgW = imageSize.width;
                const bgH = imageSize.height;

                const currentBBox = annotation.bbox;
                const currentRotation = annotation.rotation ?? 0;

                const cx = currentBBox.x;
                const cy = currentBBox.y;
                const cw = currentBBox.width;
                const ch = currentBBox.height;

                const aspectRatio = cw / ch;

                let nx = cx;
                let ny = cy;
                let nw = cw;
                let nh = ch;

                const updates = {};

                if (partType === "ROTATE") {
                    const sensitivity = 1;
                    let newRotation = (currentRotation + deltaPos.x * sensitivity) % 360;
                    if (newRotation < 0) newRotation += 360;
                    updates.rotation = newRotation;
                }

                else if (partType && partType.startsWith("RESIZE_")) {
                    const handle = partType.replace("RESIZE_", "");

                    // A. COINS (Fixe le coin opposé, aspect ratio contraint)
                    if (handle === "SE") {
                        nw = cw + deltaPos.x;
                        nh = nw / aspectRatio;
                    }
                    else if (handle === "SW") {
                        nw = cw - deltaPos.x;
                        nh = nw / aspectRatio;
                        nx = cx + (cw - nw);
                    }
                    else if (handle === "NE") {
                        nw = cw + deltaPos.x;
                        nh = nw / aspectRatio;
                        ny = cy + (ch - nh);
                    }
                    else if (handle === "NW") {
                        nw = cw - deltaPos.x;
                        nh = nw / aspectRatio;
                        nx = cx + (cw - nw);
                        ny = cy + (ch - nh);
                    }

                    // B. BORDS
                    else if (handle === "E") {
                        nw = cw + deltaPos.x;
                        nh = nw / aspectRatio;
                        ny = cy + (ch - nh) / 2;
                    }
                    else if (handle === "W") {
                        nw = cw - deltaPos.x;
                        nh = nw / aspectRatio;
                        nx = cx + (cw - nw);
                        ny = cy + (ch - nh) / 2;
                    }
                    else if (handle === "S") {
                        nh = ch + deltaPos.y;
                        nw = nh * aspectRatio;
                        nx = cx + (cw - nw) / 2;
                    }
                    else if (handle === "N") {
                        nh = ch - deltaPos.y;
                        nw = nh * aspectRatio;
                        ny = cy + (ch - nh);
                        nx = cx + (cw - nw) / 2;
                    }

                    // Sécurité min 20px
                    if (nw < 20) {
                        nw = 20;
                        nh = nw / aspectRatio;
                        if (handle.includes("W")) nx = cx + (cw - nw);
                        if (handle.includes("N")) ny = cy + (ch - nh);
                        if (handle === "N" || handle === "S") nx = cx + (cw - nw) / 2;
                        if (handle === "E" || handle === "W") ny = cy + (ch - nh) / 2;
                    }

                    updates.bbox = {
                        x: nx / bgW,
                        y: ny / bgH,
                        width: nw / bgW,
                        height: nh / bgH
                    };
                }

                // DÉPLACEMENT (MOVE)
                else {
                    nx = cx + deltaPos.x;
                    ny = cy + deltaPos.y;
                    updates.bbox = {
                        x: nx / bgW,
                        y: ny / bgH,
                        width: nw / bgW,
                        height: nh / bgH
                    };
                }

                console.log("save_image (bbox)", annotation.id, updates);
                await db.annotations.update(annotation.id, updates);
            }

            // --- RECTANGLE : resize libre par dimension, contraintes template ---
            else if (annotation.type === "RECTANGLE") {
                const bgW = imageSize.width;
                const bgH = imageSize.height;

                const currentBBox = annotation.bbox;
                const currentRotation = annotation.rotation ?? 0;

                const cx = currentBBox.x;
                const cy = currentBBox.y;
                const cw = currentBBox.width;
                const ch = currentBBox.height;

                // Contraintes template
                const templateSize = annotation.annotationTemplateProps?.size;
                const lockedWidth = templateSize?.width != null;
                const lockedHeight = templateSize?.height != null;

                let nx = cx;
                let ny = cy;
                let nw = cw;
                let nh = ch;

                const updates = {};

                if (partType === "ROTATE") {
                    const sensitivity = 1;
                    let newRotation = (currentRotation + deltaPos.x * sensitivity) % 360;
                    if (newRotation < 0) newRotation += 360;
                    updates.rotation = newRotation;
                }

                else if (partType && partType.startsWith("RESIZE_")) {
                    const handle = partType.replace("RESIZE_", "");

                    // Deltas libres par dimension, verrouillés si template contraint
                    const dx = lockedWidth ? 0 : deltaPos.x;
                    const dy = lockedHeight ? 0 : deltaPos.y;

                    if (handle === "SE") {
                        nw = cw + dx;
                        nh = ch + dy;
                    }
                    else if (handle === "SW") {
                        nw = cw - dx;
                        nh = ch + dy;
                        nx = cx + dx;
                    }
                    else if (handle === "NE") {
                        nw = cw + dx;
                        nh = ch - dy;
                        ny = cy + dy;
                    }
                    else if (handle === "NW") {
                        nw = cw - dx;
                        nh = ch - dy;
                        nx = cx + dx;
                        ny = cy + dy;
                    }

                    // Sécurité min 20px
                    if (nw < 20) {
                        nw = 20;
                        if (handle.includes("W")) nx = cx + (cw - 20);
                    }
                    if (nh < 20) {
                        nh = 20;
                        if (handle.includes("N")) ny = cy + (ch - 20);
                    }

                    updates.bbox = {
                        x: nx / bgW,
                        y: ny / bgH,
                        width: nw / bgW,
                        height: nh / bgH
                    };
                }

                // DÉPLACEMENT (MOVE)
                else {
                    nx = cx + deltaPos.x;
                    ny = cy + deltaPos.y;
                    updates.bbox = {
                        x: nx / bgW,
                        y: ny / bgH,
                        width: nw / bgW,
                        height: nh / bgH
                    };
                }

                console.log("save_rectangle (bbox)", annotation.id, updates);
                await db.annotations.update(annotation.id, updates);
            }

            // --- OBJECT_3D : move + rotate only (no resize) ---
            else if (annotation.type === "OBJECT_3D") {
                const bgW = imageSize.width;
                const bgH = imageSize.height;

                const currentBBox = annotation.bbox;
                const currentRotation = annotation.rotation ?? 0;

                const updates = {};

                if (partType === "ROTATE") {
                    let newRotation = (currentRotation + deltaPos.x) % 360;
                    if (newRotation < 0) newRotation += 360;
                    updates.rotation = newRotation;
                } else {
                    const nx = currentBBox.x + deltaPos.x;
                    const ny = currentBBox.y + deltaPos.y;
                    updates.bbox = {
                        x: nx / bgW,
                        y: ny / bgH,
                        width: currentBBox.width / bgW,
                        height: currentBBox.height / bgH,
                    };
                }

                console.log("save_object3d (bbox)", annotation.id, updates);
                await db.annotations.update(annotation.id, updates);
            }

            // RULER — dragged as a whole from any of its segments (a dimension
            // chain has no per-segment semantics to preserve), so a plain MOVE
            // translates every point. Reuses the wrapper commit for its
            // shared-point handling: a point also referenced by another
            // annotation is forked instead of dragging that annotation along.
            else if (annotation.type === "RULER") {
                const pointUpdates = new Map();
                for (const pt of annotation.points ?? []) {
                    if (!pt?.id) continue;
                    pointUpdates.set(pt.id, {
                        x: pt.x + deltaPos.x,
                        y: pt.y + deltaPos.y,
                    });
                }
                if (pointUpdates.size > 0) {
                    await commitWrapperTransform({
                        selectedAnnotationIds: [annotation.id],
                        allAnnotations: annotations,
                        pointUpdates,
                        imageSize,
                        rotationDelta: null,
                        moveDelta: null, // rulers carry no rotationCenter
                    });
                }
            }
        }

        // Notifier useLiveQuery du changement pour que la convergence optimistic overlay fonctionne
        dispatch(triggerAnnotationsUpdate());
    };


    // handlers - text value change

    const handleTextValueChange = ({ annotationId, textValue }) => {
        _updateBgImageRawTextAnnotation({
            key: annotationId,
            value: textValue,
        });
    };

    // handlers - delete point

    const handleDeletePoint = async ({ annotationId, pointId }) => {
        console.log("handleDeletePoint", annotationId, pointId, annotations);
        await deletePointAsync({ pointId, annotationId, annotations });
    };

    const deletePoints = useDeletePoints();
    const handleDeletePoints = async ({ annotationId, pointIds }) => {
        console.log("handleDeletePoints", annotationId, pointIds, annotations);
        await deletePoints({ pointIds, annotationId, annotations });
    };

    // handlers - hide segments
    // Hidden segments are persisted as start-point-id arrays (segmentFlags.js).
    // The segment indices decoded from partIds are transient (valid against the
    // RESOLVED rings), so buildSegmentFlagChanges maps them to point ids via the
    // resolved annotation and writes on the RAW db row (never write resolved
    // pixel points back). The first write also migrates the whole row off the
    // legacy index fields.
    const applyHideSegmentOps = async (annotationId, ops) => {
        const annotation = annotations.find(a => a.id === annotationId);
        if (!annotation) return;
        const record = await db.annotations.get(annotationId);
        if (!record) return;
        const changes = buildSegmentFlagChanges({
            record,
            resolvedAnnotation: annotation,
            ops,
        });
        if (changes) await db.annotations.update(annotationId, changes);
    };

    const handleHideSegment = async ({ annotationId, segmentIndex, cutIndex }) => {
        const ringKey = cutIndex == null ? "MAIN" : `CUT::${cutIndex}`;
        await applyHideSegmentOps(annotationId, [
            { idxField: "hiddenSegmentsIdx", ringKey, segIdxs: [segmentIndex], mode: "toggle" },
        ]);
    };

    // Toggles the hidden state of many segments at once (multi-segment Delete).
    // Part IDs are grouped per annotation and ring so each annotation gets a
    // single db update (a naive loop would clobber writes, each reading the
    // same stale row).
    const handleHideSegments = async ({ partIds }) => {
        const byAnnotation = new Map(); // annotationId -> Map<ringKey, Set<segIdx>>
        for (const partId of partIds || []) {
            const parts = partId.split('::'); // annotationId::TYPE::index[::subIndex]
            const annotationId = parts[0];
            const type = parts[1];
            if (type !== 'SEG' && type !== 'CUT_SEG') continue;
            const ringKey = type === 'SEG' ? 'MAIN' : `CUT::${parseInt(parts[2], 10)}`;
            const segIdx = parseInt(type === 'SEG' ? parts[2] : parts[3], 10);
            if (!Number.isInteger(segIdx)) continue;
            if (!byAnnotation.has(annotationId)) byAnnotation.set(annotationId, new Map());
            const rings = byAnnotation.get(annotationId);
            if (!rings.has(ringKey)) rings.set(ringKey, new Set());
            rings.get(ringKey).add(segIdx);
        }

        for (const [annotationId, rings] of byAnnotation) {
            const ops = [...rings].map(([ringKey, segIdxs]) => ({
                idxField: "hiddenSegmentsIdx",
                ringKey,
                segIdxs: [...segIdxs],
                mode: "toggle",
            }));
            await applyHideSegmentOps(annotationId, ops);
        }
    };

    const handleRemoveCut = async ({ annotationId, cutIndex }) => {
        await removeCutAsync({ annotationId, cutIndex, annotations });
    };

    // Deletes the whole guideLine: drops every db.points it referenced and
    // clears annotation.guideLine. Triggered by Delete/Backspace when the
    // guideLine polyline is the selected part.
    const handleDeleteGuideLine = deleteGuideLine;

    // Same for isoHeightLines (constant-height contour lines).
    const handleDeleteIsoHeightLine = deleteIsoHeightLine;

    // Same for profileLines (shell cross-sections).
    const handleDeleteProfileLine = deleteProfileLine;

    // snapping

    //const isSnappingEnabled = enabledDrawingMode || !selectedNode;
    const isSnappingEnabled =
        enabledDrawingMode ||
        !Boolean(selectedNode) ||
        (Boolean(selectedNode) && selectedNode.nodeType === "ANNOTATION");



    // helper - sizeVariant

    const sizeVariant = showBgImage ? "FIXED_IN_CONTAINER_PARENT" : "FIXED_IN_SCREEN";

    // render

    //if (!baseMap) return <ScreenNoBaseMap />;

    useEffect(() => {
        if (baseMaps?.length === 0) {
            dispatch(setShowCreateBaseMapSection(true));
        }
    }, [baseMaps?.length]);

    return (
        <SmartZoomProvider>
        <DrawingMetricsProvider>
        <Box ref={containerRef} data-image-capture-host={forViewerKey} sx={{ width: '100%', height: '100%', position: "relative", bgcolor: "background.default" }}>
            <InteractionProvider>
                <InteractionLayer
                    isActiveViewer={isActiveViewer}
                    enabledDrawingMode={enabledDrawingMode}
                    selectedNode={selectedNode}
                    selectedNodes={selectedNodes}
                    newAnnotation={newAnnotation}
                    ref={interactionLayerRef}
                    showBgImage={showBgImage}
                    onCommitDrawing={({ points, event, cutHostId, options }) => {
                        // COMPLETE_ANNOTATION: extend existing annotation
                        if (options?.completeAnnotationId) {
                            return handleCompleteAnnotationCommit(points, options);
                        }
                        if (type === "SPLIT") {
                            return handleSplitCommit(points);
                        }
                        else if (cutHostId) {
                            if (["RECTANGLE", "POLYLINE_RECTANGLE", "POLYGON_RECTANGLE", "CUT_RECTANGLE"].includes(enabledDrawingMode) && points.length === 2) points = getPolylinePointsFromRectangle(points, orthoSnapAngleOffset)
                            else if (["CIRCLE", "POLYLINE_CIRCLE", "POLYGON_CIRCLE", "CUT_CIRCLE"].includes(enabledDrawingMode)) points = getPolylinePointsFromCircle(points)
                            return handleCommitDrawing(points, { cutHostId });
                        }
                        else if (enabledDrawingMode === 'MEASURE') {
                            return handleMeasureCommit(points, event);
                        }
                        else if (["RECTANGLE", "POLYLINE_RECTANGLE", "POLYGON_RECTANGLE", "CUT_RECTANGLE"].includes(enabledDrawingMode)) {
                            return handleCommitDrawingFromRectangle(points, event);
                        }
                        else if (["CIRCLE", "POLYLINE_CIRCLE", "POLYGON_CIRCLE", "CUT_CIRCLE"].includes(enabledDrawingMode)) {
                            return handleCommitDrawingFromCircle(points);
                        }
                        else if (enabledDrawingMode === "REVOLUTION_AXIS_PLAN") {
                            return handleCommitDrawingFromRevolutionAxis(points);
                        }
                        else if (enabledDrawingMode === "PHOTO_POSE") {
                            return handleCommitPhotoPose(points);
                        }
                        else if (["POLYLINE_CIRCLE_RADIUS", "POLYGON_CIRCLE_RADIUS"].includes(enabledDrawingMode)) {
                            return handleCommitDrawingFromCircleRadius(points);
                        }
                        else if (enabledDrawingMode === "REPOSITION_REVOLUTION_PLACEMENT") {
                            return handleRepositionRevolutionPlacement(points);
                        }
                        else if (["ARC", "POLYLINE_ARC"].includes(enabledDrawingMode)) {
                            return handleCommitDrawingFromArc(points);
                        }
                        else {
                            console.log("handleCommitDrawing - points", points);
                            return handleCommitDrawing(points, options);
                        }
                    }}
                    onCommitSplitAtVertex={handlePolylineSplitAtVertex}
                    onCommitImageDrop={handleCommitImageDrop}
                    onCommitPointsFromSurfaceDrop={handleCommitPointsFromSurfaceDrop}
                    onCommitSimilarStrips={handleCommitSimilarStrips}
                    onCommitDetectedFeatures={handleCommitDetectedFeatures}
                    onCommitLocalizedRepair={handleCommitLocalizedRepair}
                    baseMapImageSize={baseMap?.getImageSize?.() || baseMap?.getImageSize?.()}
                    baseMapImageScale={baseMap?.getImageScale()}
                    baseMapImageOffset={baseMap?.getImageOffset()}
                    baseMapImageUrl={baseMap?.getUrl()}
                    baseMapMainAngleInDeg={baseMap?.mainAngleInDeg}
                    basePose={basePose}
                    onBaseMapPoseChange={handleBaseMapPoseChange}
                    activeContext={activeContext}
                    annotations={annotations}
                    onPointMoveCommit={handlePointMoveCommit}
                    onPointsMoveCommit={handlePointsMoveCommit}
                    onPointSnapReplace={handlePointSnapReplace}
                    onToggleAnnotationPointType={handleToggleAnnotationPointType}
                    onPointDuplicateAndMoveCommit={handleDuplicateAndMovePoint}
                    onMultiVertexMoveCommit={handleMultiVertexMoveCommit}
                    onDeletePoint={handleDeletePoint}
                    onDeletePoints={handleDeletePoints}
                    onHideSegment={handleHideSegment}
                    onHideSegments={handleHideSegments}
                    onRemoveCut={handleRemoveCut}
                    onDeleteGuideLine={handleDeleteGuideLine}
                    onDeleteIsoHeightLine={handleDeleteIsoHeightLine}
                    onDeleteProfileLine={handleDeleteProfileLine}
                    onAnnotationMoveCommit={handleAnnotationMoveCommit}
                    onSegmentSplit={handleSegmentSplit}
                    onCutSegment={handleCutSegment}
                    onTechnicalReturn={handleTechnicalReturn}
                    onSplitPolylineClick={handleSplitPolylineClick}
                    onSplitPolylineEnter={handleSplitPolylineEnter}
                    onSplitPolylineReset={resetSplitPolyline}
                    onSplitPolylineClickPoint={handleSplitPolylineClickPoint}
                    onCommitGuideLine={handleCommitGuideLine}
                    onCommitIsoHeightLine={handleCommitIsoHeightLine}
                    onCommitProfileLine={handleCommitProfileLine}
                    onCommitRamp={handleCommitRamp}
                    onProjectionSnapInsert={handleProjectionSnapInsert}
                    snappingEnabled={isSnappingEnabled}
                    baseMapMeterByPx={baseMap?.getMeterByPx()}
                    legendFormat={legendFormat}
                    onLegendFormatChange={handleLegendFormatChange}
                    onCameraChangeExternal={() => {
                        compareSliderRef.current?.updateClipRect?.();
                        notifyCameraChange();
                    }}
                >
                    <g style={(selectedNode || selectedNodes?.length > 0) ? contextDimmedStyle : contextNormalStyle}>
                        <StaticMapContent
                            selectedNode={selectedNode}
                            selectedNodes={selectedNodes}
                            bgImageUrl={bgImage?.url}
                            bgImageSize={bgImage?.imageSize}
                            showBgImage={showBgImage}
                            basePose={basePose}
                            baseMapImageUrl={baseMap?.getUrl()}
                            baseMapImageSize={baseMap?.getImageSize?.() || baseMap?.getImageSize?.()}
                            annotations={displayAnnotations}
                            labelOverridesById={labelOverridesById}
                            legendItems={imageModeActive ? null : legendItems}
                            legendFormat={legendFormat}
                            sizeVariant={sizeVariant}
                            isEditingBaseMap={isBaseMapSelected}
                            hideBaseMapImage={hideBaseMapImage}
                            baseMapMeterByPx={baseMap?.meterByPx}
                            baseMapImageScale={baseMap?.getImageScale?.() ?? 1}
                            opacity={baseMapOpacity}
                            grayScale={baseMapGrayScale}
                            grayLevelThreshold={grayLevelThreshold}
                            versions={baseMap?.versions}
                            hiddenVersionIds={hiddenVersionIds}
                            selectedVersionId={selectedVersionId}
                            isBaseMapsViewer={viewerKey === "BASE_MAPS"}
                            isEditingVersion={viewerKey === "BASE_MAPS" && !!selectedVersionId && showBgImage}
                            versionCompareEnabled={versionCompareEnabled}
                            versionCompareId={versionCompareId}
                        />
                    </g>
                    {/* 2. LAYER ÉDITION BASEMAP (Exclusif) */}
                    {isBaseMapSelected && (
                        <EditedBaseMapLayer
                            basePose={basePose}
                            baseMapImageUrl={baseMap?.getUrl()}
                            baseMapImageSize={baseMap?.getImageSize?.() || baseMap?.getImageSize?.()}
                        />
                    )}
                    {/* 2b. LAYER ÉDITION VERSION (BASE_MAPS viewer only) */}
                    {viewerKey === "BASE_MAPS" && selectedVersionId && showBgImage && (() => {
                        const selectedVersion = baseMap?.versions?.find(v => v.id === selectedVersionId);
                        if (!selectedVersion) return null;
                        const vUrl = selectedVersion.image?.imageUrlClient ?? selectedVersion.image?.imageUrlRemote;
                        const vSize = selectedVersion.image?.imageSize;
                        const vTransform = versionTransformOverride?.versionId === selectedVersionId
                            ? versionTransformOverride.transform
                            : selectedVersion.transform || { x: 0, y: 0, rotation: 0, scale: 1 };
                        return (
                            <EditedVersionLayer
                                basePose={basePose}
                                versionTransform={vTransform}
                                versionImageUrl={vUrl}
                                versionImageSize={vSize}
                                versionId={selectedVersionId}
                                baseMapId={baseMap?.id}
                            />
                        );
                    })()}
                    {isLegendSelected && (
                        <EditedLegendLayer
                            legendItems={legendItems}
                            spriteImage={spriteImage}
                            legendFormat={legendFormat}
                        />
                    )}

                    {!isBaseMapSelected && <EditedObjectLayer
                        basePose={basePose}
                        annotations={annotations}
                        spriteImage={spriteImage}
                        selectedNode={selectedNode}
                        selectedNodes={selectedNodes}
                        baseMapMeterByPx={baseMap?.getMeterByPx()} // If needed for width calc
                        baseMapImageScale={baseMap?.getImageScale?.() ?? 1}
                        onTextValueChange={handleTextValueChange}
                    />}

                    {/* PhotoPlan focus mask (photo baseMaps): blurs everything
                        outside the selected plan's zone. Display-only. */}
                    {baseMap?.isPhoto && (
                        <PhotoPlanMaskLayer baseMap={baseMap} basePose={basePose} />
                    )}

                    {/* PhotoPlan quick-flatten guide lines (Transfo. tool):
                        draggable vanishing lines over the photo. */}
                    {baseMap?.isPhoto && (
                        <PhotoPlanGuideLinesLayer baseMap={baseMap} basePose={basePose} />
                    )}

                    {/* Read-only reprojection of the annotations drawn on the
                        flattened counterparts ("mise à plat", whole-photo and
                        zone plans). Self-hiding. */}
                    {baseMap?.isPhoto && (
                        <PhotoPlanReprojectedAnnotationsLayer baseMap={baseMap} basePose={basePose} />
                    )}

                </InteractionLayer>

                {/* Editor chrome (ortho snap, clipping plane, edit scale…) is
                    hidden while a capture frame is active (POV framing or the
                    CAPTURE export) so it never lands in the generated image and
                    the framed view stays clean. */}
                {!imageModeActive && (
                    <UILayer mapController={interactionLayerRef.current} onResetCamera={handleResetCamera} viewport={viewport} />
                )}

            </InteractionProvider>

            {/* PhotoPlan chips band (photo baseMaps) */}
            {baseMap?.isPhoto && !imageModeActive && (
                <TopPhotoPlanChips baseMap={baseMap} />
            )}

            {/* Version compare slider overlay */}
            {versionCompareEnabled && versionCompareId && (
                <CompareVersionSlider
                    ref={compareSliderRef}
                    getCameraMatrix={() => interactionLayerRef.current?.getCameraMatrix?.()}
                    basePose={basePose}
                    containerBounds={{ width: bounds.width, height: bounds.height }}
                    activeVersionLabel={baseMap?.getActiveVersion?.()?.label}
                    comparedVersionLabel={baseMap?.versions?.find(v => v.id === versionCompareId)?.label}
                />
            )}

            {showPrintableMap && (
                <PrintableMap
                    ref={printableMapRef}
                    bgImageUrl={bgImage?.url}
                    bgImageSize={bgImage?.imageSize}
                    showBgImage={showBgImage}
                    basePose={basePose}
                    baseMapImageUrl={baseMap?.getUrl()}
                    baseMapImageSize={baseMap?.getImageSize?.() || baseMap?.getImageSize?.()}
                    annotations={displayAnnotations}
                    spriteImage={spriteImage}
                    baseMapMeterByPx={baseMap?.getMeterByPx()}
                    legendItems={legendItems}
                    legendFormat={legendFormat}
                    versions={baseMap?.versions}
                />
            )}

            <DialogDeleteSelectedAnnotation />
            <DialogAutoCreateEntity />
            <DeferredCommitDialogOutlet
                pending={deferredCommit.pending}
                onResume={deferredCommit.resumeCommit}
                onCancel={deferredCommit.cancelCommit}
            />
            <PopperEditAnnotation viewerKey={forViewerKey} />
            <PopperEditAnnotations viewerKey={forViewerKey} allAnnotations={annotations} />
            <PopperEditScale viewerKey={forViewerKey} />
            <PopperContextMenu />

            {/* <DialogAutoMigrateToMapEditorV3 /> */}

            <LayerTools />
            <LayerCreateBaseMap />

            {!versionCompareEnabled &&
                !imageModeActive &&
                !dessinPanelDocked &&
                !viewerPanelDocked &&
                !isPhotosModule &&
                (forViewerKey !== "BASE_MAPS" || showDrawingToolsInBaseMaps) && (
                    /* display:none (not unmount) while the drawer slides over
                       the map, so the popper keeps its state; "contents" keeps
                       the wrapper out of the absolute positioning. */
                    <Box
                        sx={{
                            display:
                                dessinPanelSlidedIn || viewerPanelSlidedIn
                                    ? "none"
                                    : "contents",
                        }}
                    >
                        <PopperMapListings />
                    </Box>
                )}

            {/* Dessin module with the docked panel: floating paste / subtract
                helpers only — listings and the drawing helper live in the
                panel. The helper content is portaled INTO the panel from here
                so it keeps this editor's SmartZoomProvider (loupe). */}
            {dessinPanelDocked && !versionCompareEnabled && !imageModeActive && (
                <>
                    <FloatingHelpersDessin />
                    <PanelDrawingHelperPortal />
                </>
            )}

            {/* Business-object link mode helper ("Ouvrages") — self-guards on
                the linkingBusinessObjectId flag, armed from the
                BUSINESS_OBJECTS module (not the Dessin panel). */}
            {!versionCompareEnabled && !imageModeActive && (
                <PopperLinkBusinessObjectHelper />
            )}

            {imageModeActive && (
                <ImageModeOverlay
                    viewportWidth={bounds.width}
                    viewportHeight={bounds.height}
                    legendItems={imageModeLegendItems}
                    spriteImage={spriteImage}
                    qtiesById={legendQtiesById}
                />
            )}

            {/* Export rapide only — the POV and capture-tool save bars carry
                their own X */}
            {isMapViewer && imageModeEnabled && !povFramingActive && (
                <ButtonCloseImageMode />
            )}
        </Box>
        </DrawingMetricsProvider>
        </SmartZoomProvider>
    );
}