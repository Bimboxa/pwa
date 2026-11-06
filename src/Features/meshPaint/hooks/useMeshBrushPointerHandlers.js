import { useEffect, useMemo, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";
import { Vector3 } from "three";

import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setToaster } from "Features/layout/layoutSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import { selectLinkedListingSourceForSelectedScope } from "Features/listings/selectors/listingsSelectors";
import {
  selectMeshBrushPartType,
  selectMeshBrushTemplateId,
} from "Features/meshPaint/utils/meshBrushSelectors";

import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMeshPaints from "Features/meshPaint/hooks/useMeshPaints";
import useReadOnlyScope from "Features/scopes/hooks/useReadOnlyScope";

import { OwnershipError } from "App/db/ownership";
import { buildMesh3dEdgeLines } from "Features/annotationMesh3d/services/pickMesh3dEdge";
import {
  BRUSH_DRAG_PX,
  MESH_PAINT_PART_TYPES,
  PAINT_EDGE_WIDTH_PX,
  PAINT_FACE_LIFT_M,
} from "Features/meshPaint/constants/meshPaintConstants";
import {
  clearMeshBrushOverlay,
  setMeshBrushOverlay,
} from "Features/meshPaint/js/meshBrushOverlayStore";
import { subscribeMeshPaintObjects } from "Features/meshPaint/js/meshPaintObjectsStore";
import commitMeshBrushAllPartsService from "Features/meshPaint/services/commitMeshBrushAllPartsService";
import commitMeshBrushTargetService from "Features/meshPaint/services/commitMeshBrushTargetService";
import { isShrinkableAnnotation } from "Features/meshPaint/services/ensureUnshrunkHostObject";
import getMeshBrushAllPartsPlan from "Features/meshPaint/services/getMeshBrushAllPartsPlan";
import { createMeshBrushPicker } from "Features/meshPaint/services/meshBrushPick";
import classifyMeshBrushLocalPart, {
  BRUSH_2D_KIND,
} from "Features/meshPaint/utils/classifyMeshBrushLocalPart";
import clipPaintGeometry from "Features/meshPaint/utils/clipPaintGeometry";
import findMeshPaintMatches from "Features/meshPaint/utils/findMeshPaintMatches";
import getMeshPaintColor from "Features/meshPaint/utils/getMeshPaintColor";
import getMeshPaintMetrics from "Features/meshPaint/utils/getMeshPaintMetrics";
import {
  PAINT_REFUSAL,
  getPaintRefusalLabel,
} from "Features/meshPaint/utils/getPaintHostRefusal";
import { canTemplatePaint } from "Features/meshPaint/utils/meshBrushTools";
import { paintGeometryToLocal } from "Features/meshPaint/utils/meshPaintFrame";
import planPaintToggle from "Features/meshPaint/utils/planPaintToggle";
import triangulatePaintFace from "Features/meshPaint/utils/triangulatePaintFace";
import { buildStippleOverlayFromPositions } from "Features/threedEditor/js/utilsAnnotationsManager/faceHoverHighlight";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

// Preview of the part a click paints: the template colour ("Retirer": grey),
// a stipple for a face (above an existing paint: 2 × its lift), a thick line
// for an edge.
const REMOVE_COLOR = "#9e9e9e";
const FACE_PREVIEW_STYLE = {
  baseAlpha: 0.35,
  dotAlpha: 0.9,
  gridOffsetPx: 0,
  toneMapped: false,
  renderOrder: 998,
};
const PREVIEW_FACE_LIFT_M = 2 * PAINT_FACE_LIFT_M;
const PREVIEW_EDGE_WIDTH_PX = PAINT_EDGE_WIDTH_PX + 2;

const isLive = (row) => Boolean(row) && !row.deletedAt;

// Same guard as the other 3D tools: never steal keystrokes from a field.
const isEditableTarget = (el) => {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
};

function disposeObject(object) {
  if (!object) return;
  object.parent?.remove(object);
  object.traverse?.((child) => {
    child.geometry?.dispose?.();
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    materials.forEach((material) => material?.dispose?.());
  });
}

// Pointer interactions of the « Pinceau » (MESH_BRUSH) in the 3D editor,
// active while selectMeshBrushPartType (Dessin module in 3D, Surface / Ligne
// template armed with the brush). useTemplateFaceDrawBridge keeps
// drawingMode.active on meanwhile, so MainThreedEditor's selection / lasso
// paths stand aside; its hover raycast bails on the brush too.
//
// - hover (rAF): meshBrushPick target → preview (template colour stipple /
//   line, grey for « Retirer ») + cursor helper (« Peindre », « Retirer »,
//   « Remplacer « X » » or the refusal reason, `not-allowed` cursor);
// - click (pointer up within BRUSH_DRAG_PX of the press, no Ctrl / Cmd): the
//   target is committed (commitMeshBrushTargetService), commits queued in
//   click order; a drag is an orbit and never paints;
// - « Créer une annotation » (mapEditor
//   .meshBrushCreateAnnotation): a bare part (nothing to remove / replace)
//   the plan can hold becomes a 2D annotation of the armed template instead
//   of a paint row — the helper then reads « Annotation 2D » — and a facet
//   the plan cannot hold becomes an annotation mesh (« Annotation mesh
//   3D »); a thick wall facet without a floor polygon at its foot gets a
//   toaster, nothing else, and so does a part whose annotation already
//   exists (same template at the same place: no duplicate, no paint either);
// - host too dense for the part index (an imported heavy model,
//   target.dense): its facets ALWAYS become an annotation, whatever the
//   switch; « Peindre toutes les faces » is refused on it (TOO_DENSE);
// - GLB scene of a scan base map (target.sceneHost, no host annotation):
//   same as a dense host — its facets always become an annotation of the
//   base map, one by one (SCENE_ONE_BY_ONE), no edges (SCENE_FACES_ONLY);
// - « Peindre toutes les faces de l'annotation » / « Peindre toutes les
//   arêtes de l'annotation » (mapEditor.meshBrushPaintAllFaces /
//   .meshBrushPaintAllEdges, the switch of the brush's part type): the click
//   paints every bare part of that type of the host at once
//   (getMeshBrushAllPartsPlan: one side per face, parts already painted left
//   alone) — « Peindre tout », the preview covers them all — and a click on
//   a part of the armed template removes all its parts of that type on that
//   host (« Retirer tout »); committed by commitMeshBrushAllPartsService in
//   one undo step;
// - the orbit pivot follows the cursor on press (like the selection mode);
// - Escape (outside fields) leaves the brush.
export default function useMeshBrushPointerHandlers() {
  const dispatch = useDispatch();

  // data

  const partType = useSelector(selectMeshBrushPartType);
  const templateId = useSelector(selectMeshBrushTemplateId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  // « Sélection de face »: below this fold, neighboring facets are one
  // (curved) surface and neighboring edges one curve.
  const smoothAngleDeg = useSelector(
    (s) => s.threedEditor.faceSelectionAngleDeg
  );
  const linkedListingSourceByListingId = useSelector(
    selectLinkedListingSourceForSelectedScope
  );
  const { isReadOnly } = useReadOnlyScope();
  const { rows, hostById } = useMeshPaints();
  const annotationTemplates = useAnnotationTemplates();
  // 2D annotation preference (drawing helper switch) + what the 2D commit
  // needs: the armed draft (template style), the resolved base maps (host of
  // the commit) and the regular creation path (rels, auto-number, triggers).
  const createAsAnnotation = useSelector(
    (s) => s.mapEditor.meshBrushCreateAnnotation
  );
  // « Peindre toutes les faces / arêtes de l'annotation » (drawing helper
  // switch of the brush's part type).
  const paintAllParts = useSelector((s) =>
    partType === MESH_PAINT_PART_TYPES.EDGE
      ? s.mapEditor.meshBrushPaintAllEdges
      : s.mapEditor.meshBrushPaintAllFaces
  );
  const templateProps = useSelector((s) => s.annotations.newAnnotation);
  const baseMaps = useBaseMaps()?.value;
  const createAnnotation = useCreateAnnotation();

  const templateById = useMemo(() => {
    const byId = {};
    (annotationTemplates || []).forEach((template) => {
      if (template?.id) byId[template.id] = template;
    });
    return byId;
  }, [annotationTemplates]);

  const armedTemplate = templateId ? (templateById[templateId] ?? null) : null;

  // The paints a click toggles / replaces: paintMeshPartService's matching
  // set (same scope, host and template live, not provisional).
  const matchRows = useMemo(
    () =>
      rows.filter((row) => {
        if (!isLive(row) || row.sync?.provisional) return false;
        if ((row.scopeId ?? null) !== (scopeId ?? null)) return false;
        if (!isLive(hostById[row.hostAnnotationId])) return false;
        const template = templateById[row.annotationTemplateId];
        return isLive(template) && canTemplatePaint(template);
      }),
    [rows, hostById, templateById, scopeId]
  );
  const rowsById = useMemo(
    () => new Map(rows.map((row) => [row.id, row])),
    [rows]
  );

  const armedListingId = armedTemplate?.listingId ?? null;
  const contextRefusal = isReadOnly
    ? PAINT_REFUSAL.READ_ONLY
    : armedListingId &&
        Object.prototype.hasOwnProperty.call(
          linkedListingSourceByListingId || {},
          armedListingId
        )
      ? PAINT_REFUSAL.LINKED_LISTING
      : null;

  // state

  // Values read by the (stable-per-activation) listeners.
  const dataRef = useRef({});
  const refreshRef = useRef(null);

  // effects

  useEffect(() => {
    dataRef.current = {
      projectId,
      scopeId,
      armedTemplate,
      templateById,
      matchRows,
      rowsById,
      contextRefusal,
      smoothAngleDeg,
      createAsAnnotation,
      paintAllParts,
      templateProps,
      baseMaps,
      createAnnotation,
    };
  }, [
    projectId,
    scopeId,
    armedTemplate,
    templateById,
    matchRows,
    rowsById,
    contextRefusal,
    smoothAngleDeg,
    createAsAnnotation,
    paintAllParts,
    templateProps,
    baseMaps,
    createAnnotation,
  ]);

  // Paints / template / context changed: the helper and the preview follow
  // (a click just painted the part: « Peindre » becomes « Retirer »).
  useEffect(() => {
    refreshRef.current?.();
  }, [
    matchRows,
    contextRefusal,
    armedTemplate,
    smoothAngleDeg,
    createAsAnnotation,
    paintAllParts,
  ]);

  useEffect(() => {
    if (!partType || !templateId) return;
    const editor = getActiveThreedEditor();
    const sceneManager = editor?.sceneManager;
    const dom = sceneManager?.renderer?.domElement;
    if (!sceneManager?.scene || !dom) return;

    const picker = createMeshBrushPicker(sceneManager);
    let rafId = null;
    let lastEvent = null;
    let downPos = null;
    let dragging = false;
    let disposed = false;
    let queue = Promise.resolve();
    const preview = { object: null, key: null };
    // Last « toutes les faces » plan (one entry: the hovered face), valid
    // for the same target, paints and settings; `generation` keys the
    // preview.
    const allPartsCache = { key: null, rows: null, plan: null, generation: 0 };

    dom.style.cursor = "crosshair";

    const requestRender = () => sceneManager.requestRender?.();

    function scheduleHover() {
      if (disposed || rafId != null || !lastEvent) return;
      rafId = requestAnimationFrame(runHover);
    }
    refreshRef.current = scheduleHover;

    function disposePreview() {
      if (preview.object) {
        disposeObject(preview.object);
        preview.object = null;
        requestRender();
      }
      preview.key = null;
    }

    // « Peindre toutes les faces / arêtes de l'annotation »: what a click
    // on this target does on every part of its type of the host (null: the
    // plain click stands).
    function getAllPartsPlan(target) {
      const data = dataRef.current;
      const key = `${target.previewKey}|${data.smoothAngleDeg}`;
      const rows = data.matchRows ?? [];
      if (allPartsCache.key !== key || allPartsCache.rows !== rows) {
        allPartsCache.key = key;
        allPartsCache.rows = rows;
        allPartsCache.generation += 1;
        allPartsCache.plan = getMeshBrushAllPartsPlan({
          sceneManager,
          partType: target.partType,
          hostId: target.row?.hostAnnotationId ?? target.hostId,
          baseMapId: target.baseMapId,
          clickedPart: target.localGeometry,
          viewDir: target.viewDir ?? null,
          rows,
          templateId,
          smoothAngleDeg: data.smoothAngleDeg,
        });
      }
      const plan = allPartsCache.plan;
      return plan ? { ...plan, generation: allPartsCache.generation } : null;
    }

    // Picked target + what a click does on it (action of the toggle).
    function resolveTarget(e) {
      const picked = picker.pick(e, {
        partType,
        armedTemplateId: templateId,
        smoothAngleDeg: dataRef.current.smoothAngleDeg,
      });
      if (!picked || picked.kind === "REFUSED") return picked;
      const data = dataRef.current;
      if (data.contextRefusal) {
        return {
          kind: "REFUSED",
          reason: data.contextRefusal,
          previewKey: `R:${data.contextRefusal}`,
        };
      }

      let target = picked;
      let candidate = picked.candidate;
      let metrics = picked.metrics;
      if (picked.kind === "PAINT") {
        const row = data.rowsById?.get(picked.paintId);
        if (!row) return null;
        metrics = getMeshPaintMetrics(
          sceneManager.imagesManager?.baseMapsMap?.[row.baseMapId]
        );
        if (!metrics) {
          return {
            kind: "REFUSED",
            reason: PAINT_REFUSAL.NO_SCALE,
            previewKey: `R:${PAINT_REFUSAL.NO_SCALE}`,
          };
        }
        candidate = {
          partType: row.partType,
          hostAnnotationId: row.hostAnnotationId,
          baseMapId: row.baseMapId,
          geometry: row.geometry,
        };
        target = { ...picked, row };
      }

      const matches = findMeshPaintMatches({
        candidate,
        rows: data.matchRows ?? [],
        metrics,
      });
      // A GLB scene facet has no paint to toggle: always a new annotation.
      const { action } = target.sceneHost
        ? { action: "ADDED" }
        : planPaintToggle({ matches, templateId });
      const replacedTemplateId = matches.find(
        (match) => match.annotationTemplateId !== templateId
      )?.annotationTemplateId;
      const replacedLabel = replacedTemplateId
        ? (data.templateById?.[replacedTemplateId]?.label ?? null)
        : null;

      // A dense host has no part index: nothing lists all its parts.
      if (target.dense && data.paintAllParts) {
        const reason = target.sceneHost
          ? PAINT_REFUSAL.SCENE_ONE_BY_ONE
          : PAINT_REFUSAL.TOO_DENSE;
        return { kind: "REFUSED", reason, previewKey: `R:${reason}` };
      }

      // Every face / edge of the host at once.
      const allParts = data.paintAllParts ? getAllPartsPlan(target) : null;
      if (allParts?.tooMany) {
        return {
          kind: "REFUSED",
          reason: PAINT_REFUSAL.TOO_MANY_PARTS,
          previewKey: `R:${PAINT_REFUSAL.TOO_MANY_PARTS}`,
        };
      }
      if (allParts?.action) {
        return {
          ...target,
          action: allParts.action,
          allParts,
          creates: null,
          replacedLabel,
        };
      }

      // A bare host part becomes an annotation (always on a dense host):
      // "2D" when the plan can hold it (optimistic — a thick wall facet looks
      // for its floor at the click, a face may still have no plan encoding),
      // else "MESH" for a facet; an edge without plan encoding is painted.
      let creates = null;
      if (
        (Boolean(data.createAsAnnotation) || Boolean(target.dense)) &&
        target.kind === "HOST" &&
        action === "ADDED"
      ) {
        const is2d =
          classifyMeshBrushLocalPart(target.partType, target.localGeometry, {
            isThickWallHost: isShrinkableAnnotation(
              sceneManager.annotationsManager?.getAnnotationSource?.(
                target.hostId
              )
            ),
          }).kind !== BRUSH_2D_KIND.PAINT;
        if (is2d) creates = "2D";
        else if (target.partType === MESH_PAINT_PART_TYPES.FACE)
          creates = "MESH";
      }
      return {
        ...target,
        action,
        creates,
        replacedLabel,
      };
    }

    // Local parts the preview shows: the picked part, or — « toutes les
    // faces / arêtes » — every part a click paints / every paint it removes.
    function getPreviewParts(target) {
      const allParts = target.allParts;
      if (!allParts) return [target.localGeometry];
      if (allParts.action !== "REMOVED") {
        return allParts.add.map((item) => item.localGeometry);
      }
      return allParts.removeRows
        .map((row) =>
          paintGeometryToLocal(row.partType, row.geometry, allParts.metrics)
        )
        .filter(Boolean);
    }

    function buildPreview(target, color) {
      const group = sceneManager.imagesManager?.getGroup?.(target.baseMapId);
      if (!group) return null;
      group.updateWorldMatrix(true, false);
      const matrix = group.matrixWorld;

      if (target.partType === MESH_PAINT_PART_TYPES.FACE) {
        // One stipple over every previewed face.
        const world = [];
        const v = new Vector3();
        for (const face of getPreviewParts(target)) {
          // Only the displayed side of a part of a half-view revolution.
          const shown = clipPaintGeometry(
            MESH_PAINT_PART_TYPES.FACE,
            face,
            target.clip
          );
          const positions = shown
            ? triangulatePaintFace(shown, { lift: PREVIEW_FACE_LIFT_M })
                .positions
            : null;
          if (!(positions?.length >= 9)) continue;
          for (let i = 0; i < positions.length; i += 3) {
            v.set(
              positions[i],
              positions[i + 1],
              positions[i + 2]
            ).applyMatrix4(matrix);
            world.push(v.x, v.y, v.z);
          }
        }
        if (world.length < 9) return null;
        return buildStippleOverlayFromPositions(Float32Array.from(world), {
          ...FACE_PREVIEW_STYLE,
          color,
        });
      }

      // One line segment per segment of every previewed edge (a curve has
      // several).
      const positions = [];
      const v = new Vector3();
      for (const edge of getPreviewParts(target)) {
        // Only the displayed side of a part of a half-view revolution.
        const displayed = clipPaintGeometry(
          MESH_PAINT_PART_TYPES.EDGE,
          edge,
          target.clip
        );
        for (const segment of displayed?.segments ?? []) {
          for (const p of segment) {
            v.set(p.x, p.y, p.z).applyMatrix4(matrix);
            positions.push(v.x, v.y, v.z);
          }
        }
      }
      if (positions.length < 6) return null;
      const line = buildMesh3dEdgeLines(positions, {
        color,
        linewidth: PREVIEW_EDGE_WIDTH_PX,
        domElement: dom,
      });
      const clippingManager = sceneManager.clippingManager;
      line.material.clippingPlanes =
        clippingManager?.enabled && clippingManager.planes?.length
          ? clippingManager.planes
          : null;
      return line;
    }

    function applyPreview(target) {
      const actionable = target && target.kind !== "REFUSED";
      const color = actionable
        ? target.action === "REMOVED"
          ? REMOVE_COLOR
          : getMeshPaintColor(dataRef.current.armedTemplate, partType)
        : null;
      const key = actionable
        ? `${target.previewKey}|${target.action}|${target.creates ?? ""}|${
            target.allParts ? `ALL${target.allParts.generation}` : ""
          }|${color}`
        : null;
      if (key === preview.key) return;
      disposePreview();
      preview.key = key;
      if (!key) return;
      const object = buildPreview(target, color);
      if (object) {
        sceneManager.scene.add(object);
        preview.object = object;
      }
      requestRender();
    }

    function applyCursor(e, target) {
      if (!target) {
        clearMeshBrushOverlay();
        dom.style.cursor = "crosshair";
        return;
      }
      let label;
      let tone;
      if (target.kind === "REFUSED") {
        label = getPaintRefusalLabel(target.reason);
        tone = "REFUSED";
      } else if (target.action === "REMOVED") {
        label = target.allParts ? "Retirer tout" : "Retirer";
        tone = "REMOVE";
      } else if (target.action === "REPLACED") {
        label = `Remplacer « ${target.replacedLabel || "autre modèle"} »${
          target.allParts ? " et peindre tout" : ""
        }`;
        tone = "REPLACE";
      } else if (target.creates) {
        label =
          target.creates === "MESH" ? "Annotation mesh 3D" : "Annotation 2D";
        tone = "CREATE_2D";
      } else {
        label = target.allParts ? "Peindre tout" : "Peindre";
        tone = "PAINT";
      }
      const rect = dom.getBoundingClientRect();
      setMeshBrushOverlay({
        cursor: {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          label,
          tone,
        },
      });
      dom.style.cursor = tone === "REFUSED" ? "not-allowed" : "crosshair";
    }

    function runHover() {
      rafId = null;
      const e = lastEvent;
      if (!e || disposed) return;
      // Orbit in progress: the camera moves, the helper would lie.
      if (dragging) {
        clearMeshBrushOverlay();
        return;
      }
      let target = null;
      try {
        target = resolveTarget(e);
      } catch (error) {
        console.error("[meshBrush] pick failed", error);
      }
      applyPreview(target);
      applyCursor(e, target);
    }

    function commit(target) {
      const data = dataRef.current;
      const template = data.armedTemplate;
      if (!template) return;
      queue = queue.then(async () => {
        try {
          if (target.allParts) {
            const noun =
              target.partType === MESH_PAINT_PART_TYPES.EDGE ? "arête" : "face";
            const result = await commitMeshBrushAllPartsService({
              editor,
              target,
              template,
              projectId: data.projectId,
              scopeId: data.scopeId,
              smoothAngleDeg: data.smoothAngleDeg,
              createAsAnnotation: Boolean(data.createAsAnnotation),
              templateProps: data.templateProps,
              baseMaps: data.baseMaps || [],
              createAnnotationFn: data.createAnnotation,
            });
            if (!result?.action && result?.reason === "TOO_MANY_PARTS") {
              dispatch(
                setToaster({
                  message: `Trop de ${noun}s à peindre d'un coup : augmentez l'angle « Sélection de face » ou peignez ${noun} par ${noun}`,
                  severity: "warning",
                })
              );
            } else if (!result?.action && result?.reason) {
              console.warn("[meshBrush] paint all refused", result.reason);
            } else if (result?.skippedCount > 0) {
              const n = result.skippedCount;
              dispatch(
                setToaster({
                  message: `${n} ${noun}${n > 1 ? "s" : ""} non peinte${
                    n > 1 ? "s" : ""
                  } : pas de sol au pied, ou annotation de ce modèle déjà en place`,
                  severity: "warning",
                })
              );
            }
            scheduleHover();
            return;
          }
          const result = await commitMeshBrushTargetService({
            editor,
            target,
            template,
            projectId: data.projectId,
            scopeId: data.scopeId,
            // Only a bare part becomes an annotation: a click that removes
            // or replaces a paint keeps the paint semantics.
            createAsAnnotation:
              Boolean(data.createAsAnnotation) && target.action === "ADDED",
            templateProps: data.templateProps,
            baseMaps: data.baseMaps || [],
            createAnnotationFn: data.createAnnotation,
          });
          if (!result?.action && result?.reason === "NO_GROUND") {
            dispatch(
              setToaster({
                message:
                  "L'annotation doit être posée sur un sol pour être peinte",
                severity: "warning",
              })
            );
          } else if (!result?.action && result?.reason === "DUPLICATE") {
            dispatch(
              setToaster({
                message:
                  "Annotation non créée pour éviter un doublon : une annotation de ce modèle existe déjà à cet endroit",
                isError: true,
              })
            );
          } else if (!result?.action && result?.reason) {
            console.warn("[meshBrush] paint refused", result.reason);
          }
        } catch (error) {
          console.error("[meshBrush] paint failed", error);
          dispatch(
            setToaster({
              message:
                error instanceof OwnershipError
                  ? error.message
                  : "Échec de la peinture",
              isError: true,
            })
          );
        }
        scheduleHover();
      });
    }

    function onPointerDown(e) {
      // Orbit around the point under the cursor (the selection mode's
      // handlePointerDown, which stands aside while drawing).
      const controlsManager = sceneManager.controlsManager;
      if (controlsManager?.isPivotGesture?.(e)) {
        controlsManager.updateRotationPivotFromEvent?.(e);
      }
      if (e.button !== 0) return;
      downPos = { x: e.clientX, y: e.clientY };
      dragging = false;
    }

    function onPointerMove(e) {
      lastEvent = e;
      if (downPos && !dragging) {
        const dx = Math.abs(e.clientX - downPos.x);
        const dy = Math.abs(e.clientY - downPos.y);
        if (dx > BRUSH_DRAG_PX || dy > BRUSH_DRAG_PX) dragging = true;
      }
      scheduleHover();
    }

    function onPointerUp(e) {
      if (e.button !== 0) return;
      const wasPressed = Boolean(downPos);
      const wasDrag = dragging;
      downPos = null;
      dragging = false;
      lastEvent = e;
      if (!wasPressed || wasDrag || e.ctrlKey || e.metaKey) {
        scheduleHover();
        return;
      }
      let target = null;
      try {
        target = resolveTarget(e);
      } catch (error) {
        console.error("[meshBrush] pick failed", error);
      }
      if (!target || target.kind === "REFUSED") return;
      commit(target);
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
      disposePreview();
      clearMeshBrushOverlay();
    }

    function onKeyDown(e) {
      if (e.key !== "Escape" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      dispatch(setEnabledDrawingMode(null));
      dispatch(setNewAnnotation({}));
    }

    // Paints rebuilt (a commit landed) or a host rebuilt (un-shrunk, carved):
    // refresh the target under the still cursor.
    const unsubscribePaints = subscribeMeshPaintObjects(() => scheduleHover());
    const unsubscribeReady =
      sceneManager.annotationsManager?.subscribeAnnotationReady?.(() => {
        // The faces of the rebuilt host are read again.
        allPartsCache.key = null;
        scheduleHover();
      }) ?? null;

    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerCancel);
    dom.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("keydown", onKeyDown, true);

    return () => {
      disposed = true;
      refreshRef.current = null;
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerCancel);
      dom.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("keydown", onKeyDown, true);
      unsubscribePaints?.();
      unsubscribeReady?.();
      if (rafId != null) cancelAnimationFrame(rafId);
      disposePreview();
      clearMeshBrushOverlay();
      dom.style.cursor = "";
    };
  }, [partType, templateId, dispatch]);
}
