import { useEffect, useRef } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { Raycaster, Vector2 } from "three";

import {
  bumpSnapIndexEpoch,
  setMergeFacesModeActive,
  setMergeFacesSeed,
} from "Features/threedEditor/threedEditorSlice";
import { setSelectedNode } from "Features/mapEditor/mapEditorSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setToaster } from "Features/layout/layoutSlice";

import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";
import useAnnotationPermissions from "Features/mapEditor/hooks/useAnnotationPermissions";
import useReadOnlyScope from "Features/scopes/hooks/useReadOnlyScope";
import getDisplayedMesh3d from "Features/annotationMesh3d/services/getDisplayedMesh3d";
import locateHitFaceOnMesh3d from "Features/annotationMesh3d/services/locateHitFaceOnMesh3d";
import selectMesh3dPart from "Features/annotationMesh3d/services/selectMesh3dPart";
import { getMesh3dFacePartId } from "Features/annotationMesh3d/utils/mesh3dPartIds";
import { isForeignFootprintId } from "Features/annotations/constants/foreignFootprint";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import {
  getActiveClippingPlane,
  filterIntersectionsByClipping,
} from "Features/threedEditor/js/utilsAnnotationsManager/clippingPick";
import { filterIntersectionsByVisibility } from "Features/threedEditor/js/utilsAnnotationsManager/visibilityPick";
import {
  getFaceRegion,
  buildFaceHoverOverlay,
  disposeFaceHoverOverlay,
} from "Features/threedEditor/js/utilsAnnotationsManager/faceHoverHighlight";
import { resolveAnnotationFace } from "Features/threedFaceCut/utils/resolveFaceCutLockedFace";

import mergeAnnotationMeshesService from "../services/mergeAnnotationMeshesService";
import { buildMergeFacesSeed } from "../utils/activateMergeFacesTool";
import {
  MERGE_FACES_DONE_MESSAGE,
  MERGE_FACES_READ_ONLY_MESSAGE,
  MERGE_FACES_REASONS,
  MERGE_FACES_SEED_MESSAGE,
  getMergeFacesRefusedMessage,
} from "../utils/mergeFacesMessages";

// Mirrors useIsolateFacePointerHandlers: a pointer travelling farther is a
// camera orbit, not a click.
const DRAG_THRESHOLD_PX = 4;

// Coplanarity of a clicked face with the seed plane — a pre-check for the
// toaster only, the exact test is the merge itself on the un-shrunk meshes:
// parallel within 1° WHATEVER the orientation (an open mesh keeps the raw
// winding of its builder, possibly inside out), plane offset within 15 mm
// (both planes are read on the DISPLAYED geometry: a regular annotation is
// shrunk by « Réduire le crénelage » — 10 mm lateral, 5 mm top — while a
// mesh annotation, the seed after a first merge for instance, is not).
const COPLANAR_COS = Math.cos((1 * Math.PI) / 180);
const COPLANAR_OFFSET_M = 0.015;

function isCoplanarWithSeed(seedPlane, planeLocal) {
  if (!seedPlane?.normal || !planeLocal?.normal) return false;
  const [nx, ny, nz] = seedPlane.normal;
  const [px, py, pz] = seedPlane.point;
  const n = planeLocal.normal;
  const p = planeLocal.point;
  const cos = nx * n.x + ny * n.y + nz * n.z;
  if (Math.abs(cos) < COPLANAR_COS) return false;
  const offset = nx * (p.x - px) + ny * (p.y - py) + nz * (p.z - pz);
  return Math.abs(offset) <= COPLANAR_OFFSET_M;
}

// « Fusionner des faces » (3D editor of the Dessin module,
// threedEditor.mergeFacesMode): the face under the cursor is stippled; the
// first click (no seed yet) picks the seed face, every next click on a face
// of ANOTHER annotation coplanar with the seed plane merges that annotation's
// mesh into the seed one (mergeAnnotationMeshesService). The tool stays
// armed; Escape leaves it. `annotations`: the resolved list loaded in the 3D
// editor (permissions).
export default function useMergeFacesPointerHandlers({ annotations }) {
  const dispatch = useDispatch();
  const store = useStore();

  // data

  const active = useSelector((s) => s.threedEditor.mergeFacesMode.active);
  const moduleKey = useSelector((s) => s.viewers.selectedViewerKey);
  const faceSelectionAngleDeg = useSelector(
    (s) => s.threedEditor.faceSelectionAngleDeg
  );
  const deleteAnnotations = useDeleteAnnotations();
  const { isReadOnly: isReadOnlyScope } = useReadOnlyScope();
  const { canEditAnnotation } = useAnnotationPermissions({ annotations });

  // state — refs so the pointer effect never re-attaches mid-gesture

  const faceSelectionAngleDegRef = useRef(faceSelectionAngleDeg);
  faceSelectionAngleDegRef.current = faceSelectionAngleDeg;
  const isReadOnlyScopeRef = useRef(isReadOnlyScope);
  isReadOnlyScopeRef.current = isReadOnlyScope;
  const deleteAnnotationsRef = useRef(deleteAnnotations);
  deleteAnnotationsRef.current = deleteAnnotations;

  // MAP-module-only mode: force-deactivate on module switch.
  useEffect(() => {
    if (active && moduleKey !== "MAP") {
      dispatch(setMergeFacesModeActive(false));
    }
  }, [active, moduleKey, dispatch]);

  useEffect(() => {
    if (!active) return undefined;
    const editor = getActiveThreedEditor();
    const sceneManager = editor?.sceneManager;
    const dom = sceneManager?.renderer?.domElement;
    if (!dom) return undefined;

    const raycaster = new Raycaster();
    const mouse = new Vector2();
    const hover = { overlay: null, key: null };
    let downPos = null;
    let dragging = false;
    let lastEvent = null;
    let rafId = null;
    let busy = false;
    let disposed = false;

    const toast = (message, isError = true) =>
      dispatch(setToaster({ message, isError }));

    // The annotation face under the pointer: { nodeId, object (root),
    // hitObject, intersect } or null.
    function pickScene(e) {
      const rect = dom.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, sceneManager.camera);
      const clippingPlane = getActiveClippingPlane(sceneManager);

      const targets = [];
      sceneManager.scene.traverse((obj) => {
        if (obj.isMesh && !obj.isLine2 && !obj.isLineSegments2) {
          targets.push(obj);
        }
      });
      const intersects = filterIntersectionsByVisibility(
        filterIntersectionsByClipping(
          raycaster.intersectObjects(targets, false),
          clippingPlane
        )
      );

      for (const intersect of intersects) {
        if (intersect.object.userData?.isHoverOverlay) continue;
        let object = intersect.object;
        while (object) {
          if (object.userData?.nodeId) {
            const { nodeId, nodeType } = object.userData;
            if (nodeType !== "ANNOTATION" || isForeignFootprintId(nodeId)) {
              return null;
            }
            return { nodeId, object, hitObject: intersect.object, intersect };
          }
          object = object.parent;
        }
        return null;
      }
      return null;
    }

    // The clicked face of the picked annotation, resolved against the scene
    // (resolveAnnotationFace: plane + loops, base map local frame) or null.
    function resolveClickedFace(pick) {
      let faceIndex = -1;
      if (pick.object.userData?.isAnnotationMesh3d) {
        const index = pick.hitObject.userData?.mesh3dFaceIndex;
        faceIndex = index === undefined ? -1 : index;
      } else {
        const displayed = getDisplayedMesh3d(editor, pick.nodeId, {
          allowSingleFace: true,
        });
        faceIndex = displayed
          ? locateHitFaceOnMesh3d(
              displayed,
              pick.intersect,
              sceneManager.camera
            )
          : -1;
      }
      if (!(faceIndex >= 0)) return null;
      return resolveAnnotationFace(editor, {
        annotationId: pick.nodeId,
        faceIndex,
      });
    }

    function clearStipple() {
      if (!hover.overlay) return;
      disposeFaceHoverOverlay(hover.overlay);
      hover.overlay = null;
      hover.key = null;
      sceneManager.renderScene?.();
    }

    // Same stipple as the selection-mode hover, so the face about to be
    // merged is obvious before clicking.
    function applyStipple(object, faceIndex) {
      const angleDeg = faceSelectionAngleDegRef.current;
      const region = getFaceRegion(object.geometry, faceIndex, {
        plane: !!object.userData?.hasSubtraction,
        angleDeg,
      });
      const key = region
        ? `${object.uuid}:${angleDeg}:${region.regionId}`
        : null;
      if (key === hover.key) return;
      disposeFaceHoverOverlay(hover.overlay);
      hover.overlay = null;
      if (region) {
        const overlay = buildFaceHoverOverlay(object, region.tris);
        if (overlay) {
          object.add(overlay);
          hover.overlay = overlay;
        }
      }
      hover.key = key;
      sceneManager.renderScene?.();
    }

    function runHover() {
      rafId = null;
      const e = lastEvent;
      if (!e || disposed) return;
      const pick = pickScene(e);
      if (pick) {
        applyStipple(pick.hitObject, pick.intersect.faceIndex);
        dom.style.cursor = "pointer";
      } else {
        clearStipple();
        dom.style.cursor = "default";
      }
    }

    function selectAnnotation(annotationId) {
      const source =
        sceneManager.annotationsManager?.getAnnotationSource?.(annotationId);
      const node = {
        id: annotationId,
        nodeId: annotationId,
        nodeType: "ANNOTATION",
        annotationType: source?.type,
        listingId: source?.listingId,
      };
      dispatch(setSelectedNode(node));
      dispatch(
        setSelectedItem({
          ...node,
          type: "NODE",
          annotationTemplateId: source?.annotationTemplateId,
        })
      );
    }

    // First click: the seed face. Selected (annotation + face part) so the
    // green stipple of the selection shows which face the merge starts from.
    function pickSeed(pick, face) {
      const seed = buildMergeFacesSeed(face);
      if (!seed) return;
      dispatch(setMergeFacesSeed(seed));
      selectAnnotation(pick.nodeId);
      selectMesh3dPart({
        dispatch,
        getState: store.getState,
        partId: getMesh3dFacePartId(pick.nodeId, face.faceIndex),
      });
      clearStipple();
      toast(MERGE_FACES_SEED_MESSAGE, false);
    }

    async function mergeAt(pick, face, seed) {
      if (busy) return;
      if (pick.nodeId === seed.annotationId) {
        toast(getMergeFacesRefusedMessage(MERGE_FACES_REASONS.SAME_ANNOTATION));
        return;
      }
      if (!isCoplanarWithSeed(seed.plane, face.planeLocal)) {
        toast(getMergeFacesRefusedMessage(MERGE_FACES_REASONS.NOT_COPLANAR));
        return;
      }
      if (isReadOnlyScopeRef.current) {
        toast(MERGE_FACES_READ_ONLY_MESSAGE);
        return;
      }
      // Both self-toasting.
      if (!canEditAnnotation(seed.annotationId)) return;
      if (!canEditAnnotation(pick.nodeId)) return;

      busy = true;
      try {
        const [px, py, pz] = seed.plane.point;
        const [nx, ny, nz] = seed.plane.normal;
        const result = await mergeAnnotationMeshesService({
          seedAnnotationId: seed.annotationId,
          otherAnnotationId: pick.nodeId,
          seedPlane: {
            point: { x: px, y: py, z: pz },
            normal: { x: nx, y: ny, z: nz },
          },
          clickedNormal: face.planeLocal.normal,
          editor,
          dispatch,
          deleteAnnotationsFn: deleteAnnotationsRef.current,
        });
        if (disposed) return;
        if (result.status !== "done") {
          toast(getMergeFacesRefusedMessage(result.reason));
          return;
        }
        clearStipple();
        dispatch(bumpSnapIndexEpoch());
        // The merged annotation stays the seed (same id, same plane): the
        // next clicks keep merging into it. Whole-annotation selection: the
        // face indices were renumbered by the write.
        selectAnnotation(seed.annotationId);
        toast(MERGE_FACES_DONE_MESSAGE, false);
      } catch (err) {
        console.error("[threedMergeFaces] merge failed", err);
        toast(getMergeFacesRefusedMessage(MERGE_FACES_REASONS.FAILED));
      } finally {
        busy = false;
      }
    }

    function onPointerDown(e) {
      if (e.button !== 0) return;
      downPos = { x: e.clientX, y: e.clientY };
      dragging = false;
    }

    function onPointerMove(e) {
      lastEvent = e;
      if (rafId == null) rafId = requestAnimationFrame(runHover);
      if (!downPos) return;
      const dx = Math.abs(e.clientX - downPos.x);
      const dy = Math.abs(e.clientY - downPos.y);
      if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) dragging = true;
    }

    function onPointerUp(e) {
      if (e.button !== 0) return;
      const wasDrag = dragging;
      downPos = null;
      dragging = false;
      if (wasDrag) return; // camera orbit, not a click
      const pick = pickScene(e);
      if (!pick) return;
      const face = resolveClickedFace(pick);
      if (!face) {
        toast(getMergeFacesRefusedMessage(MERGE_FACES_REASONS.NO_FACE));
        return;
      }
      const seed = store.getState().threedEditor.mergeFacesMode.seed;
      if (!seed) pickSeed(pick, face);
      else mergeAt(pick, face, seed);
    }

    function onPointerCancel() {
      downPos = null;
      dragging = false;
    }

    function onPointerLeave() {
      lastEvent = null;
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      clearStipple();
    }

    function onKeyDown(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") dispatch(setMergeFacesModeActive(false));
    }

    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerCancel);
    dom.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("keydown", onKeyDown, true);

    return () => {
      disposed = true;
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerCancel);
      dom.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("keydown", onKeyDown, true);
      if (rafId != null) cancelAnimationFrame(rafId);
      clearStipple();
      dom.style.cursor = "default";
    };
  }, [active, dispatch, store, canEditAnnotation]);
}
