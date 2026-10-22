import { useEffect, useMemo, useRef } from "react";

import { useSelector } from "react-redux";
import { Group, Vector2, Vector3 } from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

import getCoteDisplayValue from "Features/annotations/utils/getCoteDisplayValue";
import {
  DEFAULT_COTE_DECIMALS,
  DEFAULT_COTE_UNIT,
} from "Features/annotations/constants/coteDisplayDefaults";
import { isZeroLabelOffset } from "Features/annotations/utils/getRulerSegmentKey";
import { selectSelectedItems } from "Features/selection/selectionSlice";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import createDimensionLabelSprite from "../services/createDimensionLabelSprite";
import {
  setDimensionGroups,
  setDimensionObjects,
} from "../services/dimensionObjectsStore";
import { applyPendingDimensionPatch } from "../services/dimensionPendingPatchStore";
import {
  COTE_LABEL_SEGMENT_KEY,
  DIMENSION_LABEL_PART_TYPE,
  getDimensionLabelPartId,
} from "../utils/dimensionLabelPart";
import computeCoteGeometry3d from "../utils/computeCoteGeometry3d";
import createDimensionSnapAnchors from "../utils/createDimensionSnapAnchors";

// Thin ink (screen px): a dimension line reads as precise, not as a stroke.
const LINEWIDTH = 1;
const LINEWIDTH_SELECTED = 2;
// Dashed extension / graduation lines, thinner still.
const LINEWIDTH_EXTENSION = 0.75;

// Picking tolerance for the dimension line — same distance-scaled model as
// the POINT trait raycast of createAnnotationObject3D.
const LINE_PICK_ANGULAR = 0.008;
const LINE_PICK_MIN_M = 0.02;

const _rcA = new Vector3();
const _rcB = new Vector3();
const _rcOnRay = new Vector3();
const _rcOnSeg = new Vector3();

// Custom world-space segment raycast — three's screen-space LineSegments2
// raycast is fragile (needs material.resolution + Line2 threshold params and
// historically threw on stale prebundles, breaking all scene picking). Pushes
// a Mesh-shaped intersection so the `.isMesh` click filter keeps it (Line2
// extends Mesh); the click handler then walks up to the group's userData.
function attachSegmentRaycast(line, localStart, localEnd) {
  line.raycast = function (raycaster, intersects) {
    const ray = raycaster.ray;
    _rcA.copy(localStart).applyMatrix4(this.matrixWorld);
    _rcB.copy(localEnd).applyMatrix4(this.matrixWorld);
    const distSq = ray.distanceSqToSegment(_rcA, _rcB, _rcOnRay, _rcOnSeg);
    const dist = ray.origin.distanceTo(_rcOnSeg);
    const threshold = Math.max(LINE_PICK_MIN_M, LINE_PICK_ANGULAR * dist);
    if (distSq <= threshold * threshold) {
      intersects.push({
        distance: dist,
        point: _rcOnSeg.clone(),
        object: this,
      });
    }
  };
}

function getCanvasResolution(editor) {
  const dom = editor?.sceneManager?.renderer?.domElement;
  if (!dom) return new Vector2(1, 1);
  return new Vector2(dom.clientWidth, dom.clientHeight);
}

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

function makeLine({ positions, color, linewidth, resolution, dashed }) {
  const mat = new LineMaterial({
    color,
    linewidth,
    resolution,
    worldUnits: false,
    transparent: true,
    depthTest: false,
    ...(dashed ? { dashed: true, dashSize: 0.05, gapSize: 0.05 } : {}),
  });
  const geom = new LineGeometry();
  geom.setPositions(positions);
  const line = new Line2(geom, mat);
  line.computeLineDistances();
  line.renderOrder = 1001;
  return line;
}

// The annotations array is already filtered upstream (useAnnotationsV2,
// excludeDimensionsHiddenIn3d): only cotes whose template has showIn3d, or
// rows drawn from 3D (isDrawnIn3d), reach this component.
//
// Renders every COTE annotation of the 3D editor's annotations array as a
// screen-space-thick dimension line + dashed extension lines + a clickable
// value card sprite. Each cote Group is attached to its basemap's group so
// basemap transforms propagate for free (same as AnnotationsManager), and
// carries the ANNOTATION userData contract so the generic annotation raycast
// branch of MainThreedEditor selects it with no extra code. Sprites are
// published to dimensionObjectsStore for the click pre-pass and the label
// drag handler (useCoteLabelDragHandlers).
export default function ThreedCoteAnnotations({ annotations }) {
  const cotes = useMemo(
    () => (annotations || []).filter((a) => a?.type === "COTE"),
    [annotations]
  );

  // Selected cotes (one, or several after a lasso), read as a primitive so
  // the effect only re-runs when the selection actually changes.
  const coteIdsKey = useMemo(() => cotes.map((c) => c.id).join(","), [cotes]);
  const selectedCoteIdsKey = useSelector((s) => {
    const ids = coteIdsKey ? coteIdsKey.split(",") : [];
    return selectSelectedItems(s)
      .filter(
        (it) =>
          it?.type === "NODE" &&
          it?.nodeType === "ANNOTATION" &&
          ids.includes(it.nodeId)
      )
      .map((it) => it.nodeId)
      .join(",");
  });
  const selectedCoteIds = useMemo(
    () => new Set(selectedCoteIdsKey ? selectedCoteIdsKey.split(",") : []),
    [selectedCoteIdsKey]
  );
  // The sub-selected value card of the selected cote, if any.
  const selectedPartId = useSelector((s) => {
    const items = selectSelectedItems(s);
    if (items.length !== 1) return null;
    const it = items[0];
    return it?.partType === DIMENSION_LABEL_PART_TYPE
      ? (it.partId ?? null)
      : null;
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
      setDimensionObjects("COTE", []);
      setDimensionGroups("COTE", []);
    };
    clear();

    const sprites = [];
    const resolution = getCanvasResolution(editor);

    cotes.forEach((coteRow) => {
      // Fields just written by a drag win over the row until the live query
      // delivers the updated row (no snap-back frame).
      const cote = applyPendingDimensionPatch(coteRow);
      const baseMap = imagesManager.baseMapsMap?.[cote.baseMapId];
      const parentGroup = imagesManager.getGroup?.(cote.baseMapId);
      // Annotations reload after maps load, so a missing group self-heals on
      // the next run of this effect.
      if (!baseMap || !parentGroup) return;

      // Annotation pixel coords are resolved in the REFERENCE frame
      // (mirrors AnnotationsManager's baseMapForRender).
      const refSize = baseMap.getImageSize?.() || baseMap.image?.imageSize;
      const meterByPx = baseMap.meterByPx || 0.01;

      const geom = computeCoteGeometry3d({
        points: cote.points,
        offsetZ: cote.offsetZ,
        extensionOffset: cote.extensionOffset ?? 8,
        extensionOffsetUnit: cote.extensionOffsetUnit ?? "PX",
        offset3d: cote.offset3d,
        imageWidth: refSize?.width || 1,
        imageHeight: refSize?.height || 1,
        meterByPx,
      });
      if (!geom) return;

      const isSelected = selectedCoteIds.has(cote.id);
      // Selection styles: the cote itself → bold line only; its card (2nd
      // click on it) → thin line, the card drawn as an inverted chip.
      const isLabelSelected =
        isSelected && selectedPartId === getDimensionLabelPartId(cote.id);
      // The card's own displacement from the dimension-line midpoint
      // (dragged while the card is the selection, useCoteLabelDragHandlers).
      const labelOffset = cote.coteLabelOffset;
      const displaced = !isZeroLabelOffset(labelOffset);
      const card = {
        x: geom.mid.x + (displaced ? labelOffset.x || 0 : 0),
        y: geom.mid.y + (displaced ? labelOffset.y || 0 : 0),
        z: geom.mid.z + (displaced ? labelOffset.z || 0 : 0),
      };
      const color = cote.strokeColor || "#000000";

      const group = new Group();
      group.name = `Cote-${cote.id}`;
      group.userData = {
        nodeId: cote.id,
        nodeType: "ANNOTATION",
        annotationType: "COTE",
        listingId: cote.listingId,
        annotationTemplateId: cote.annotationTemplateId,
        baseMapId: cote.baseMapId,
        // Lasso hit-test points (parent-group local): measured points,
        // dimension-line ends and the value card. The 3D lasso selects the
        // cote when any falls inside.
        lassoPoints: [geom.P1, geom.P2, geom.D1, geom.D2, card].map(
          (p) => new Vector3(p.x, p.y, p.z)
        ),
        // Consumed by useCoteLabelDragHandlers for the live offset drag.
        coteGeom: {
          ...geom,
          meterByPx,
          extensionOffsetUnit: cote.extensionOffsetUnit ?? "PX",
        },
      };

      // Main dimension line D1 → D2.
      const line = makeLine({
        positions: [
          geom.D1.x,
          geom.D1.y,
          geom.D1.z,
          geom.D2.x,
          geom.D2.y,
          geom.D2.z,
        ],
        color,
        linewidth:
          isSelected && !isLabelSelected ? LINEWIDTH_SELECTED : LINEWIDTH,
        resolution,
      });
      attachSegmentRaycast(
        line,
        new Vector3(geom.D1.x, geom.D1.y, geom.D1.z),
        new Vector3(geom.D2.x, geom.D2.y, geom.D2.z)
      );
      group.add(line);

      // Dashed extension lines: measured point → dimension line endpoint.
      const offsetLen = Math.hypot(geom.V.x, geom.V.y, geom.V.z);
      const extensions = [];
      if (offsetLen > 1e-4) {
        [
          [geom.P1, geom.D1],
          [geom.P2, geom.D2],
        ].forEach(([p, d]) => {
          const ext = makeLine({
            positions: [p.x, p.y, p.z, d.x, d.y, d.z],
            color,
            linewidth: LINEWIDTH_EXTENSION,
            resolution,
            dashed: true,
          });
          ext.raycast = () => {}; // never picked
          group.add(ext);
          extensions.push(ext);
        });
      }

      // Value card sprite at the dimension-line midpoint. Z-aware value
      // shared with the 2D renderer (NodeCoteStatic).
      const sprite = createDimensionLabelSprite({
        text: getCoteDisplayValue({
          p1: cote.points[0],
          p2: cote.points[1],
          meterByPx,
          unit: cote.unit ?? DEFAULT_COTE_UNIT,
          decimals: cote.decimals ?? DEFAULT_COTE_DECIMALS,
          showUnitLabel: cote.showUnitLabel ?? true,
          deltaZMeters: geom.deltaZMeters,
        }),
        coteId: cote.id,
        color,
        emphasis: isLabelSelected,
        card: cote.showValueCard ?? true,
        fontSize: cote.fontSize,
      });
      sprite.userData.annotationId = cote.id;
      sprite.userData.annotationType = "COTE";
      sprite.userData.segmentKey = COTE_LABEL_SEGMENT_KEY;
      sprite.userData.listingId = cote.listingId;
      sprite.userData.annotationTemplateId = cote.annotationTemplateId;
      sprite.position.set(card.x, card.y, card.z);
      group.add(sprite);
      sprites.push(sprite);

      // Dashed leader from the dimension-line midpoint to a displaced card
      // (always built so the drag never creates geometry mid-gesture).
      const leader = makeLine({
        positions: [geom.mid.x, geom.mid.y, geom.mid.z, card.x, card.y, card.z],
        color,
        linewidth: LINEWIDTH_EXTENSION,
        resolution,
        dashed: true,
      });
      leader.raycast = () => {}; // never picked
      leader.visible = displaced;
      group.add(leader);

      // Live-drag handles (useCoteLabelDragHandlers updates them imperatively).
      group.userData.coteObjects = { line, extensions, sprite, leader };

      // The two measured points are 3D snap targets (2D parity: the
      // dimension line and the card never snap).
      const anchors = createDimensionSnapAnchors([geom.P1, geom.P2]);
      if (anchors) group.add(anchors);

      parentGroup.add(group);
      groupsRef.current.push(group);
    });

    setDimensionObjects("COTE", sprites);
    setDimensionGroups("COTE", groupsRef.current);
    editor.sceneManager.renderScene?.();

    return clear;
  }, [cotes, selectedCoteIds, selectedPartId, annotationsLoadTick]);

  return null;
}
