import { useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { Plane, Raycaster, Vector2, Vector3 } from "three";

import {
  setSelectedBaseMapsListingId,
  setSelectedMainBaseMapId,
} from "Features/mapEditor/mapEditorSlice";
import {
  clearSelection,
  setSelectedItem,
} from "Features/selection/selectionSlice";
import { toggleBaseMapVisibleIn3d } from "Features/threedEditor/threedEditorSlice";
import { setToaster } from "Features/layout/layoutSlice";
import {
  SECTION_BASE_MAP_MODES,
  selectSectionBaseMapPlacement,
  stopSectionBaseMapPlacement,
} from "../sectionBaseMapPlacementSlice";

import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useCreateBaseMapFromImage from "Features/baseMaps/hooks/useCreateBaseMapFromImage";

import db from "App/db/db";
import baseMapNormalizedToWorld from "Features/baseMaps/js/baseMapNormalizedToWorld";
import getBlankBaseMapGeometry from "Features/baseMaps/utils/getBlankBaseMapGeometry";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { setMesh3dLabelGestureActive } from "Features/threedMesh/services/mesh3dLabelGestureStore";

import createSectionBaseMapPreview from "../js/createSectionBaseMapPreview";
import createSectionBaseMapService from "../services/createSectionBaseMapService";
import { createGeometryBaseMap } from "../services/getHydratedBaseMap";
import {
  getSectionBaseMapOffsets,
  getSectionBaseMapPlacement,
  resetSectionBaseMapSession,
  setSectionBaseMapOffsets,
  setSectionBaseMapPlacement,
} from "../services/sectionBaseMapPlacementStore";
import computeSectionBaseMapPlacement from "../utils/computeSectionBaseMapPlacement";
import useSectionBaseMapListing from "./useSectionBaseMapListing";

// Reject rays nearly parallel to the section plane (plane seen edge-on).
const MIN_RAY_PLANE_DOT = 0.05;
// An existing base map shown for the preview loads asynchronously: its group
// is re-posed until it is there.
const GROUP_RETRY_MS = 300;
const GROUP_RETRY_MAX = 20;

const liveVersions = (baseMapId) =>
  db.baseMapVersions.where("baseMapId").equals(baseMapId).toArray();

const isEditableTarget = (target) => {
  const tag = target?.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    Boolean(target?.isContentEditable) ||
    Boolean(target?.closest?.('[role="listbox"], [role="menu"]'))
  );
};

/**
 * « + fond de plan » placement of a section mark, in the 3D editor (see
 * sectionBaseMapPlacementSlice). While the mode is on:
 *
 * - preview: the page (blank page of the helper's format, or the picked
 *   vertical base map — its real group is posed live) inside a fluo green
 *   frame, in the vertical plane through the mark
 *   (computeSectionBaseMapPlacement);
 * - drag and drop on the page slides it in that plane (along the mark and in
 *   altitude) — the plane itself never moves. Camera controls are disabled
 *   for the gesture only; anywhere else the camera stays free;
 * - Space / Enter (outside a field) validate: createSectionBaseMapService
 *   creates the page, locates the mark on it and poses it, then the new base
 *   map is selected. Escape cancels.
 *
 * Pointer ownership mirrors useRevolutionAxisHandleDragHandlers:
 * capture-phase pointerdown on the canvas, mesh3dLabelGestureStore flag so
 * MainThreedEditor's pointerup pick stands down, window-level move / up.
 */
export default function useSectionBaseMapPlacement({ rendererIsReady }) {
  const dispatch = useDispatch();
  const store = useStore();

  // strings

  const nameRequiredS = "Donnez un nom au fond de plan";
  const pickBaseMapS = "Choisissez un fond de plan vertical";
  const failedS = "Le fond de plan n'a pas pu être créé";

  // data

  const {
    active,
    sourceAnnotationId,
    mode,
    name,
    format,
    size,
    scale,
    existingBaseMapId,
  } = useSelector(selectSectionBaseMapPlacement);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );
  const baseMapsUpdatedAt = useSelector((s) => s.baseMaps.baseMapsUpdatedAt);
  const { listing } = useSectionBaseMapListing();
  const createBaseMapFromImage = useCreateBaseMapFromImage();
  const createAnnotation = useCreateAnnotation();

  const isExisting = mode === SECTION_BASE_MAP_MODES.EXISTING;

  // World ends of the mark (same altitude: the plan's).
  const anchors = useLiveQuery(async () => {
    if (!active || !sourceAnnotationId) return null;
    const source = await db.annotations.get(sourceAnnotationId);
    if (!source || source.deletedAt || source.points?.length !== 2) return null;
    const [p1, p2] = await db.points.bulkGet(source.points.map((p) => p.id));
    const record = await db.baseMaps.get(source.baseMapId);
    if (!p1 || !p2 || !record || record.deletedAt) return null;
    const planBaseMap = createGeometryBaseMap(
      record,
      await liveVersions(record.id)
    );
    const A = baseMapNormalizedToWorld(p1, planBaseMap);
    const B = baseMapNormalizedToWorld(p2, planBaseMap);
    if (!A || !B) return null;
    return {
      A: { x: A.x, y: A.y, z: A.z },
      B: { x: B.x, y: B.y, z: B.z },
    };
  }, [active, sourceAnnotationId, annotationsUpdatedAt, baseMapsUpdatedAt]);

  // Reference frame + scale of the picked existing base map.
  const existingSpec = useLiveQuery(async () => {
    if (!active || !isExisting || !existingBaseMapId) return null;
    const record = await db.baseMaps.get(existingBaseMapId);
    if (!record || record.deletedAt) return null;
    const baseMap = createGeometryBaseMap(
      record,
      await liveVersions(record.id)
    );
    const imageSize = baseMap.getImageSize?.();
    const meterByPx = baseMap.getMeterByPx?.();
    if (!imageSize?.width || !imageSize?.height || !(meterByPx > 0))
      return null;
    return {
      baseMapId: record.id,
      size: { width: imageSize.width, height: imageSize.height },
      meterByPx,
    };
  }, [active, isExisting, existingBaseMapId]);

  // helpers

  // Page to preview: { size (px), meterByPx, baseMapId? } or null.
  const pageSpec = useMemo(() => {
    if (!active) return null;
    if (isExisting) {
      return existingSpec?.baseMapId === existingBaseMapId
        ? existingSpec
        : null;
    }
    const { pixelWidth, pixelHeight, meterByPx } = getBlankBaseMapGeometry({
      format,
      size,
      scale,
    });
    return { size: { width: pixelWidth, height: pixelHeight }, meterByPx };
  }, [
    active,
    isExisting,
    existingSpec,
    existingBaseMapId,
    format,
    size,
    scale,
  ]);

  // Latest values for the key handler (it must not re-attach per keystroke
  // in the name field).
  const commitParamsRef = useRef(null);
  commitParamsRef.current = {
    sourceAnnotationId,
    mode,
    blank: { name, format, size, scale, listing },
    existingBaseMapId,
    projectId,
    scopeId,
    ready: Boolean(anchors && pageSpec),
  };
  const createBaseMapFromImageRef = useRef(createBaseMapFromImage);
  createBaseMapFromImageRef.current = createBaseMapFromImage;
  const createAnnotationRef = useRef(createAnnotation);
  createAnnotationRef.current = createAnnotation;
  const committingRef = useRef(false);

  // effects — session

  useEffect(() => {
    if (active) resetSectionBaseMapSession();
  }, [active, sourceAnnotationId]);

  // An existing base map hidden in 3D is shown, so its image is what the
  // frame carries.
  useEffect(() => {
    if (!active || !isExisting || !existingBaseMapId) return;
    const state = store.getState();
    const isMain = state.mapEditor.selectedBaseMapId === existingBaseMapId;
    const isVisible =
      state.threedEditor.visibleBaseMapIdsIn3d.includes(existingBaseMapId);
    if (!isMain && !isVisible) {
      dispatch(toggleBaseMapVisibleIn3d(existingBaseMapId));
    }
  }, [active, isExisting, existingBaseMapId, store, dispatch]);

  // effects — preview + drag

  useEffect(() => {
    if (!active || !rendererIsReady || !anchors || !pageSpec) return;
    const editor = getActiveThreedEditor();
    const sceneManager = editor?.sceneManager;
    const dom = sceneManager?.renderer?.domElement;
    const camera = sceneManager?.camera;
    const scene = sceneManager?.scene;
    if (!dom || !camera || !scene) return;

    const { A, B } = anchors;
    const posedBaseMapId = pageSpec.baseMapId ?? null;
    const preview = createSectionBaseMapPreview({ scene, domElement: dom });
    let retryTimer = null;
    let retries = 0;

    function refresh() {
      const placement = computeSectionBaseMapPlacement({
        A,
        B,
        size: pageSpec.size,
        meterByPx: pageSpec.meterByPx,
        ...getSectionBaseMapOffsets(),
      });
      if (!placement) return;
      setSectionBaseMapPlacement(placement);
      preview.update({ placement, veil: Boolean(posedBaseMapId) });
      if (posedBaseMapId) {
        const group = sceneManager.imagesManager?.getGroup(posedBaseMapId);
        if (group) {
          editor.applyBaseMapPlacement({
            id: posedBaseMapId,
            orientation: "VERTICAL",
            angleDeg: placement.angleDeg,
            position: placement.position,
          });
        } else if (retries < GROUP_RETRY_MAX && !retryTimer) {
          retryTimer = setTimeout(() => {
            retryTimer = null;
            retries += 1;
            refresh();
          }, GROUP_RETRY_MS);
        }
      }
      editor.renderScene?.();
    }
    refresh();

    // --- drag in the section plane ---

    const length = Math.hypot(B.x - A.x, B.z - A.z);
    const u = new Vector3((B.x - A.x) / length, 0, (B.z - A.z) / length);
    const plane = new Plane().setFromNormalAndCoplanarPoint(
      new Vector3(-u.z, 0, u.x),
      new Vector3(A.x, A.y, A.z)
    );
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    let drag = null;

    function setRayFromEvent(e) {
      const rect = dom.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      return true;
    }

    function pickOnPlane(e) {
      if (!setRayFromEvent(e)) return null;
      if (
        Math.abs(raycaster.ray.direction.dot(plane.normal)) < MIN_RAY_PLANE_DOT
      )
        return null;
      return raycaster.ray.intersectPlane(plane, new Vector3());
    }

    function isOverPage(e) {
      if (!setRayFromEvent(e)) return false;
      return raycaster.intersectObject(preview.fill, false).length > 0;
    }

    function endDrag() {
      if (!drag) return;
      const controls = sceneManager.controlsManager?.orbitControls;
      if (controls && drag.prevControlsEnabled) controls.enabled = true;
      drag = null;
      dom.style.cursor = "";
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerUp);
      setMesh3dLabelGestureActive(false);
    }

    function onWindowPointerMove(e) {
      if (!drag) return;
      const hit = pickOnPlane(e);
      if (!hit) return;
      const delta = hit.sub(drag.startHit);
      setSectionBaseMapOffsets({
        alongM: drag.startOffsets.alongM + delta.dot(u),
        upM: drag.startOffsets.upM + delta.y,
      });
      refresh();
    }

    function onWindowPointerUp() {
      endDrag();
    }

    function onPointerDown(e) {
      if (e.button !== 0 || drag) return;
      if (!isOverPage(e)) return;
      const startHit = pickOnPlane(e);
      if (!startHit) return;
      // The gesture owns the pointer: no camera move, no selection pick.
      setMesh3dLabelGestureActive(true);
      const controls = sceneManager.controlsManager?.orbitControls;
      const prevControlsEnabled = controls?.enabled ?? true;
      if (controls) controls.enabled = false;
      drag = {
        startHit,
        startOffsets: { ...getSectionBaseMapOffsets() },
        prevControlsEnabled,
      };
      dom.style.cursor = "grabbing";
      window.addEventListener("pointermove", onWindowPointerMove);
      window.addEventListener("pointerup", onWindowPointerUp);
      window.addEventListener("pointercancel", onWindowPointerUp);
      e.preventDefault();
      e.stopImmediatePropagation();
    }

    function onHoverMove(e) {
      if (drag) return;
      dom.style.cursor = isOverPage(e) ? "grab" : "";
    }

    dom.addEventListener("pointerdown", onPointerDown, true);
    dom.addEventListener("pointermove", onHoverMove);

    return () => {
      dom.removeEventListener("pointerdown", onPointerDown, true);
      dom.removeEventListener("pointermove", onHoverMove);
      endDrag();
      dom.style.cursor = "";
      if (retryTimer) clearTimeout(retryTimer);
      preview.dispose();
      setSectionBaseMapPlacement(null);
      // The posed group goes back to its stored pose — after a validation
      // that is the pose just written, after a cancel the previous one.
      if (posedBaseMapId) {
        db.baseMaps.get(posedBaseMapId).then((record) => {
          if (record) editor.applyBaseMapPlacement(record);
          editor.renderScene?.();
        });
      } else {
        editor.renderScene?.();
      }
    };
  }, [active, rendererIsReady, anchors, pageSpec]);

  // effects — keys

  useEffect(() => {
    if (!active) return;

    async function commit() {
      if (committingRef.current) return;
      const params = commitParamsRef.current;
      const placement = getSectionBaseMapPlacement();
      if (!params?.ready || !placement) {
        if (params?.mode === SECTION_BASE_MAP_MODES.EXISTING) {
          dispatch(setToaster({ message: pickBaseMapS, severity: "warning" }));
        }
        return;
      }
      if (
        params.mode !== SECTION_BASE_MAP_MODES.EXISTING &&
        !String(params.blank.name ?? "").trim()
      ) {
        dispatch(setToaster({ message: nameRequiredS, severity: "warning" }));
        return;
      }
      committingRef.current = true;
      try {
        const created = await createSectionBaseMapService({
          sourceAnnotationId: params.sourceAnnotationId,
          mode: params.mode,
          blank: params.blank,
          existingBaseMapId: params.existingBaseMapId,
          cloneNorm: placement.cloneNorm,
          projectId: params.projectId,
          scopeId: params.scopeId,
          createBaseMapFromImageFn: createBaseMapFromImageRef.current,
          createAnnotationFn: createAnnotationRef.current,
          dispatch,
        });
        if (!created) {
          dispatch(setToaster({ message: failedS, severity: "error" }));
          return;
        }
        // The new base map becomes the main one, selected like a base map
        // just created from the Fonds de plan panel.
        const isBaseMapsModule =
          store.getState().viewers.selectedViewerKey === "BASE_MAPS";
        dispatch(stopSectionBaseMapPlacement());
        dispatch(clearSelection());
        dispatch(setSelectedMainBaseMapId(created.baseMapId));
        if (created.listingId) {
          dispatch(setSelectedBaseMapsListingId(created.listingId));
        }
        if (isBaseMapsModule) {
          dispatch(
            setSelectedItem({
              id: created.baseMapId,
              type: "BASE_MAP",
              listingId: created.listingId,
            })
          );
        }
      } catch (err) {
        console.error("[sectionBaseMapPlacement] commit failed", err);
        dispatch(setToaster({ message: failedS, severity: "error" }));
      } finally {
        committingRef.current = false;
      }
    }

    function onKeyDown(e) {
      if (e.key !== "Escape" && e.key !== " " && e.key !== "Enter") return;
      // A field / an open menu of the helper keeps its keys.
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === "Escape") {
        dispatch(stopSectionBaseMapPlacement());
        return;
      }
      // The button just clicked would be activated by the keyup otherwise.
      if (document.activeElement?.tagName === "BUTTON") {
        document.activeElement.blur();
      }
      commit();
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
    // strings are constants; the latest params are read through refs
  }, [active, dispatch, store]);
}
