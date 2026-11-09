import { useEffect, useMemo, useRef } from "react";

import { useSelector } from "react-redux";
import { Group } from "three";

import {
  selectImagesDisplayMode,
  selectImagesLinkStyle,
} from "Features/popperImages/popperImagesSlice";
import getImageAnnotationsDisplayIndex from "Features/popperImages/utils/getImageAnnotationsDisplayIndex";

import getAnnotationLabelPropsFromAnnotation from "Features/annotations/utils/getAnnotationLabelPropsFromAnnotation";
import { getSelectedAnnotationIds } from "Features/annotations/utils/annotationLabelSelection";
import { selectSelectedItems } from "Features/selection/selectionSlice";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import pixelToWorld from "Features/threedEditor/js/utilsAnnotationsManager/pixelToWorld";
import createMesh3dLabelLeader from "Features/threedMesh/services/createMesh3dLabelLeader";
import createMesh3dLabelTargetHandle from "Features/threedMesh/services/createMesh3dLabelTargetHandle";

import createAnnotationLabelSprite from "../services/createAnnotationLabelSprite";
import createAnnotationLabelAnchorSprite from "../services/createAnnotationLabelAnchorSprite";
import createAnnotationNumberBadgeSprite from "../services/createAnnotationNumberBadgeSprite";
import { setAnnotationLabelObjects } from "../services/annotationLabelObjectsStore";
import getAnnotationLabelLiftM from "../utils/getAnnotationLabelLiftM";
import getAnnotationVerticalLift from "Features/threedEditor/js/utilsAnnotationsManager/getAnnotationVerticalLift";
import createImageAnnotationCard from "Features/imageAnnotations/services/createImageAnnotationCard";
import {
  getImageAnchorPoint,
  getImageCardLift,
} from "Features/imageAnnotations/utils/imageConnector";

// Lift of the label objects off the annotation surface (meters) — keeps the
// leader visible above the basemap texture / a flat annotation.
const LABEL_LIFT_M = 0.05;

// Vertical placement of the label plane, in basemap-local meters: the
// annotation's own elevation, NOT the basemap plane (same model as
// createMeshCellLabelSprite / extrudePolylineWall — a point's vertical span is
// [offsetZ + offsetBottom, offsetZ + height + offsetTop], so the band mid is
// offsetZ + height/2 + mean((offsetBottom + offsetTop) / 2)). Flat annotations
// (height 0) keep the small lift so the leader hovers above the surface.
// `options`: the 3D build options (the « Delta offset 3D » of a POLYGON only
// lifts the label while the anti-aliasing toggle is on, like its mesh).
function getAnnotationLabelZ(annotation, options) {
  const height = Number(annotation.height) || 0;
  const pts = annotation.points || [];
  let bandMid = 0;
  if (pts.length > 0) {
    let sum = 0;
    for (const p of pts)
      sum += ((p.offsetBottom ?? 0) + (p.offsetTop ?? 0)) / 2;
    bandMid = sum / pts.length;
  }
  return (
    getAnnotationVerticalLift(annotation, options) +
    height / 2 +
    bandMid +
    (height > 0 ? 0 : LABEL_LIFT_M)
  );
}

// Types without the labelDelta sub-label model (mirrors the Etiquette tab
// filter in PanelAnnotationProperties).
const TYPES_WITHOUT_LABEL = [
  "COTE",
  "RULER",
  "TEXT",
  "LABEL",
  "FREE_TEXT",
  "DETAIL",
  "BASE_MAP_LINK",
];

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
          (a?.showLabel || a?.type === "IMAGE") &&
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
    const id = getSelectedAnnotationIds(items)[0];
    if (!id) return null;
    return idsKey.split(",").includes(id) ? id : null;
  });

  // Re-run once loadAnnotations has ensured the basemap groups exist — on a
  // fresh page load landing directly on 3D, the first run below happens
  // before the parent loader hooks create them, and nothing else re-runs it.
  const annotationsLoadTick = useSelector(
    (s) => s.threedEditor.annotationsLoadTick
  );
  // « Séparer les surfaces en contact »: the labels follow the POLYGON
  // « Delta offset 3D » lift of their mesh (getAnnotationLabelZ).
  const antiAliasingShrink = useSelector(
    (s) => s.threedEditor.antiAliasingShrink
  );

  // Photos (IMAGE): PopperImages display mode / link style, display numbers
  // (badge on the card, or on the anchor in ex situ + "Numéro"), and the
  // veil rule — the selected annotation is an image → the others fade.
  const imagesDisplayMode = useSelector(selectImagesDisplayMode);
  const imagesLinkStyle = useSelector(selectImagesLinkStyle);
  const imageIndexById = useMemo(
    () => getImageAnnotationsDisplayIndex(labelAnnotations).indexById,
    [labelAnnotations]
  );
  const selectedIsImage = useMemo(
    () =>
      Boolean(selectedAnnotationId) &&
      labelAnnotations.some(
        (a) => a.id === selectedAnnotationId && a.type === "IMAGE"
      ),
    [labelAnnotations, selectedAnnotationId]
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
    const imageAnchorsById = {};

    labelAnnotations.forEach((annotation) => {
      const baseMap = imagesManager.baseMapsMap?.[annotation.baseMapId];
      const parentGroup = imagesManager.getGroup?.(annotation.baseMapId);
      // Annotations reload after maps load, so a missing group self-heals on
      // the next run of this effect.
      if (!baseMap || !parentGroup) return;

      const isImage = annotation.type === "IMAGE";
      const b = annotation.bbox;
      if (isImage && (!b || !annotation.image)) return;
      const labelProps = isImage
        ? {
            labelPoint: { x: b.x + b.width / 2, y: b.y + b.height / 2 },
            targetPoint: getImageAnchorPoint(annotation),
          }
        : getAnnotationLabelPropsFromAnnotation(annotation);
      if (!isImage && !labelProps?.lines?.length) return;

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
      const labelZ = isImage
        ? (Number(annotation.offsetZ) || 0) + 0.01
        : getAnnotationLabelZ(annotation, { antiAliasingShrink });
      // Card lift above the anchor (default 1 m, see getAnnotationLabelLiftM).
      const liftM = isImage
        ? getImageCardLift(annotation)
        : getAnnotationLabelLiftM(annotation);
      const labelLocal = { x: label2.x, y: label2.y, z: labelZ + liftM };
      const targetLocal = { x: target2.x, y: target2.y, z: labelZ };

      const isSelected = annotation.id === selectedAnnotationId;
      // Visible-color rule shared with the 2D chip (labelProps.fillColor).
      const color = labelProps.fillColor || "#2196f3";
      // Photo display (PopperImages): ex situ → no card, no leader, the
      // anchor only (+ number badge in "Numéro" style); veiled → faded.
      const exSitu = isImage && imagesDisplayMode === "EX_SITU";
      const veiled = isImage && selectedIsImage && !isSelected;
      const badgeNumber = isImage
        ? (imageIndexById[annotation.id] ?? null)
        : null;

      let sprite;
      if (isImage && exSitu) {
        // Invisible stand-in for the card: carries the userData the drag
        // hook reads through the target handle (TARGET drag → targetPoint).
        sprite = new Group();
        sprite.raycast = () => {};
        sprite.userData = {
          annotationId: annotation.id,
          isImageAnnotationCard: true,
          isImageCardProxy: true,
          imageOrientation3d:
            annotation.imageOrientation3d === "HORIZONTAL"
              ? "HORIZONTAL"
              : "VERTICAL",
          noVertexSnap: true,
        };
      } else if (isImage) {
        sprite = createImageAnnotationCard(annotation, {
          selected: isSelected,
          meterByPx: baseMapForRender.meterByPx,
          onLoaded: () => editor.sceneManager.renderScene?.(),
          badgeNumber,
          veiled,
        });
      } else {
        sprite = createAnnotationLabelSprite({
          lines: labelProps.lines,
          annotationId: annotation.id,
          color,
          fontSizePreset: annotation.labelFontSize ?? "M",
          labelWidth: labelProps.width ?? null,
          selected: isSelected,
        });
      }
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
        liftM,
        leader: null,
        imageSize: refSize,
        // Ex situ: no leader ever (the proxy has no card to point at).
        hasConnector: exSitu
          ? false
          : !isImage || Boolean(annotation.hasConnector),
      });

      // Leader anchor → card, only when the two ends are apart (the default
      // lift keeps them apart; a card dragged down onto its anchor has none
      // — the drag hook then adds a temporary one as soon as they separate).
      const apart =
        Math.hypot(
          labelLocal.x - targetLocal.x,
          labelLocal.y - targetLocal.y,
          labelLocal.z - targetLocal.z
        ) > 1e-6;
      if (apart && sprite.userData.hasConnector) {
        const leader = createMesh3dLabelLeader({
          from: targetLocal,
          to: labelLocal,
          depthTest: true,
          dimmed: veiled,
        });
        sprite.userData.leader = leader;
        group.add(leader);
      }

      // Fixed-size anchor marker at the leader's pointed end (always shown,
      // never raycast — the drag grip is the selected-only target handle).
      // Ex situ photos always get it: the anchor is their only in-scene
      // trace, and the tile → anchor leaders of PopperImages aim at it.
      if (sprite.userData.hasConnector || exSitu) {
        const anchorDot = createAnnotationLabelAnchorSprite({
          annotationId: annotation.id,
          dimmed: veiled,
        });
        anchorDot.position.set(targetLocal.x, targetLocal.y, targetLocal.z);
        sprite.userData.anchorDot = anchorDot;
        group.add(anchorDot);
        if (isImage) imageAnchorsById[annotation.id] = anchorDot;

        if (exSitu && imagesLinkStyle === "NUMBER" && badgeNumber != null) {
          const badge = createAnnotationNumberBadgeSprite({
            annotationId: annotation.id,
            number: badgeNumber,
            dimmed: veiled,
          });
          badge.position.set(targetLocal.x, targetLocal.y, targetLocal.z);
          group.add(badge);
        }

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
      }

      group.add(sprite);
      // IMAGE's empty managed root carries all visibility / solo filters.
      // Keep its card underneath it rather than bypassing those filters.
      const imageRoot = isImage
        ? editor.sceneManager.annotationsManager?.annotationsObjectsMap?.[
            annotation.id
          ]
        : null;
      if (isImage && !imageRoot) {
        disposeObject(group);
        return;
      }
      (imageRoot ?? parentGroup).add(group);
      groupsRef.current.push(group);
      // The ex-situ proxy is never picked as a card.
      if (!sprite.userData.isImageCardProxy) sprites.push(sprite);
    });

    setAnnotationLabelObjects({ sprites, targetHandles, imageAnchorsById });
    editor.sceneManager.renderScene?.();

    return clear;
  }, [
    labelAnnotations,
    selectedAnnotationId,
    annotationsLoadTick,
    antiAliasingShrink,
    imagesDisplayMode,
    imagesLinkStyle,
    imageIndexById,
    selectedIsImage,
  ]);

  return null;
}
