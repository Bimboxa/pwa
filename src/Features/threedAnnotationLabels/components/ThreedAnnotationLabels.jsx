import { useEffect, useMemo, useRef } from "react";

import { useSelector } from "react-redux";
import { Group } from "three";

import getAnnotationLabelPropsFromAnnotation from "Features/annotations/utils/getAnnotationLabelPropsFromAnnotation";
import { selectSelectedItems } from "Features/selection/selectionSlice";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import pixelToWorld from "Features/threedEditor/js/utilsAnnotationsManager/pixelToWorld";
import createMesh3dLabelLeader from "Features/threedMesh/services/createMesh3dLabelLeader";
import createMesh3dLabelTargetHandle from "Features/threedMesh/services/createMesh3dLabelTargetHandle";

import createAnnotationLabelSprite from "../services/createAnnotationLabelSprite";
import createAnnotationLabelAnchorSprite from "../services/createAnnotationLabelAnchorSprite";
import { setAnnotationLabelObjects } from "../services/annotationLabelObjectsStore";

// Lift of the label objects off the annotation surface (meters) — keeps the
// leader visible above the basemap texture / a flat annotation.
const LABEL_LIFT_M = 0.05;

// Vertical placement of the label plane, in basemap-local meters: the
// annotation's own elevation, NOT the basemap plane (same model as
// createMeshCellLabelSprite / extrudePolylineWall — a point's vertical span is
// [offsetZ + offsetBottom, offsetZ + height + offsetTop], so the band mid is
// offsetZ + height/2 + mean((offsetBottom + offsetTop) / 2)). Flat annotations
// (height 0) keep the small lift so the leader hovers above the surface.
function getAnnotationLabelZ(annotation) {
  const height = Number(annotation.height) || 0;
  const pts = annotation.points || [];
  let bandMid = 0;
  if (pts.length > 0) {
    let sum = 0;
    for (const p of pts) sum += ((p.offsetBottom ?? 0) + (p.offsetTop ?? 0)) / 2;
    bandMid = sum / pts.length;
  }
  return (
    (Number(annotation.offsetZ) || 0) +
    height / 2 +
    bandMid +
    (height > 0 ? 0 : LABEL_LIFT_M)
  );
}

// Types without the labelDelta sub-label model (mirrors the Etiquette tab
// filter in PanelAnnotationProperties).
const TYPES_WITHOUT_LABEL = ["COTE", "TEXT", "LABEL"];

function disposeObject(obj) {
  if (!obj) return;
  obj.traverse?.((child) => {
    child.userData?.dispose?.();
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((m) => m.dispose?.());
    } else {
      child.material?.dispose?.();
    }
  });
}

// Renders the label (Etiquette) of every annotation with `showLabel` as a
// camera-facing card sprite + leader line + target handle, on the annotation's
// basemap plane. Card and target positions come from the SAME `labelDelta`
// image-px deltas as the 2D chip (NodeLabelStatic), so dragging in either
// editor moves the same label. Groups are attached to the basemap group so
// its transforms propagate for free (same as ThreedCoteAnnotations). Sprites
// and handles are published to annotationLabelObjectsStore for the drag hook
// (useAnnotationLabelDragHandlers).
export default function ThreedAnnotationLabels({ annotations }) {
  const labelAnnotations = useMemo(
    () =>
      (annotations || []).filter(
        (a) =>
          a?.showLabel &&
          !a.hidden &&
          !a.isMeshCell &&
          !a.isBaseMapAnnotation &&
          !TYPES_WITHOUT_LABEL.includes(a.type)
      ),
    [annotations]
  );

  // Id of the currently-selected labelled annotation (target handle + card
  // highlight). Read as a primitive so the effect only re-runs on change.
  const idsKey = useMemo(
    () => labelAnnotations.map((a) => a.id).join(","),
    [labelAnnotations]
  );
  const selectedAnnotationId = useSelector((s) => {
    const items = selectSelectedItems(s);
    if (items.length !== 1) return null;
    const it = items[0];
    if (it?.type !== "NODE" || it?.nodeType !== "ANNOTATION") return null;
    return idsKey.split(",").includes(it.nodeId) ? it.nodeId : null;
  });

  // Re-run once loadAnnotations has ensured the basemap groups exist — on a
  // fresh page load landing directly on 3D, the first run below happens
  // before the parent loader hooks create them, and nothing else re-runs it.
  const annotationsLoadTick = useSelector(
    (s) => s.threedEditor.annotationsLoadTick
  );

  const groupsRef = useRef([]);

  useEffect(() => {
    const editor = getActiveThreedEditor();
    const imagesManager = editor?.sceneManager?.imagesManager;
    if (!imagesManager) return;

    const clear = () => {
      groupsRef.current.forEach((group) => {
        group.parent?.remove(group);
        disposeObject(group);
      });
      groupsRef.current = [];
      setAnnotationLabelObjects({});
    };
    clear();

    const sprites = [];
    const targetHandles = [];

    labelAnnotations.forEach((annotation) => {
      const baseMap = imagesManager.baseMapsMap?.[annotation.baseMapId];
      const parentGroup = imagesManager.getGroup?.(annotation.baseMapId);
      // Annotations reload after maps load, so a missing group self-heals on
      // the next run of this effect.
      if (!baseMap || !parentGroup) return;

      const labelProps = getAnnotationLabelPropsFromAnnotation(annotation);
      if (!labelProps?.lines?.length) return;

      // Annotation pixel coords are resolved in the REFERENCE frame (mirrors
      // AnnotationsManager's baseMapForRender).
      const refSize = baseMap.getImageSize?.() || baseMap.image?.imageSize;
      const baseMapForRender = {
        imageWidth: refSize?.width || 1,
        imageHeight: refSize?.height || 1,
        meterByPx: baseMap.meterByPx || 0.01,
      };

      const label2 = pixelToWorld(labelProps.labelPoint, baseMapForRender);
      const target2 = pixelToWorld(labelProps.targetPoint, baseMapForRender);
      const labelZ = getAnnotationLabelZ(annotation);
      const labelLocal = { x: label2.x, y: label2.y, z: labelZ };
      const targetLocal = { x: target2.x, y: target2.y, z: labelZ };

      const isSelected = annotation.id === selectedAnnotationId;
      // Visible-color rule shared with the 2D chip (labelProps.fillColor).
      const color = labelProps.fillColor || "#2196f3";

      const sprite = createAnnotationLabelSprite({
        lines: labelProps.lines,
        annotationId: annotation.id,
        color,
        fontSizePreset: annotation.labelFontSize ?? "M",
        labelWidth: labelProps.width ?? null,
        selected: isSelected,
      });
      if (!sprite) return;

      const group = new Group();
      group.name = `AnnotationLabel-${annotation.id}`;
      group.userData = {
        isAnnotationLabelGroup: true,
        annotationId: annotation.id,
      };

      sprite.position.set(labelLocal.x, labelLocal.y, labelLocal.z);
      Object.assign(sprite.userData, {
        annotationType: annotation.type,
        listingId: annotation.listingId,
        annotationTemplateId: annotation.annotationTemplateId,
        meterByPx: baseMapForRender.meterByPx,
        labelLocal,
        targetLocal,
        leader: null,
      });

      // Leader only when the two ends are apart (the drag hook adds a
      // temporary one as soon as a drag separates them).
      const apart =
        Math.hypot(labelLocal.x - targetLocal.x, labelLocal.y - targetLocal.y) >
        1e-6;
      if (apart) {
        const leader = createMesh3dLabelLeader({
          from: targetLocal,
          to: labelLocal,
          depthTest: true,
        });
        sprite.userData.leader = leader;
        group.add(leader);
      }

      // Fixed-size anchor marker at the leader's pointed end (always shown,
      // never raycast — the drag grip is the selected-only target handle).
      const anchorDot = createAnnotationLabelAnchorSprite({
        annotationId: annotation.id,
      });
      anchorDot.position.set(targetLocal.x, targetLocal.y, targetLocal.z);
      sprite.userData.anchorDot = anchorDot;
      group.add(anchorDot);

      // Target handle on the selected annotation only. Not for MARKER: in 2D
      // a TARGET drag moves the marker's point itself — out of scope in 3D.
      if (isSelected && annotation.type !== "MARKER") {
        const handle = createMesh3dLabelTargetHandle({
          mesh3dId: annotation.id,
          color,
        });
        handle.position.set(targetLocal.x, targetLocal.y, targetLocal.z);
        Object.assign(handle.userData, {
          annotationId: annotation.id,
          isAnnotationLabelTargetHandle: true,
          labelSprite: sprite,
        });
        group.add(handle);
        targetHandles.push(handle);
      }

      group.add(sprite);
      parentGroup.add(group);
      groupsRef.current.push(group);
      sprites.push(sprite);
    });

    setAnnotationLabelObjects({ sprites, targetHandles });
    editor.sceneManager.renderScene?.();

    return clear;
  }, [labelAnnotations, selectedAnnotationId, annotationsLoadTick]);

  return null;
}
