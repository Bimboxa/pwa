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
import attachFatLineRaycast from "Features/threedEditor/js/utilsAnnotationsManager/attachFatLineRaycast";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import createDimensionLabelSprite from "../services/createDimensionLabelSprite";
import {
  setDimensionGroups,
  setDimensionObjects,
} from "../services/dimensionObjectsStore";
import { applyPendingDimensionPatch } from "../services/dimensionPendingPatchStore";
import computeRulerGeometry3d from "../utils/computeRulerGeometry3d";
import createDimensionSnapAnchors from "../utils/createDimensionSnapAnchors";
import {
  DIMENSION_LABEL_PART_TYPE,
  getDimensionLabelPartId,
} from "../utils/dimensionLabelPart";

// Thin ink (screen px): a dimension line reads as precise, not as a stroke.
const LINEWIDTH = 1;
const LINEWIDTH_SELECTED = 2;
// Dashed extension / graduation lines, thinner still.
const LINEWIDTH_EXTENSION = 0.75;

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
// excludeDimensionsHiddenIn3d): only rulers whose template has showIn3d, or
// drawn from 3D (isDrawnIn3d), reach this component.
//
// Renders every RULER annotation (dimension chain) of the 3D editor's
// annotations array: the alignment line, the dashed extension lines and one
// value card sprite per segment. Sibling of ThreedCoteAnnotations, same
// lifecycle — each ruler Group is attached to its basemap's group so basemap
// transforms propagate for free, and carries the ANNOTATION userData contract
// so the generic annotation raycast branch of MainThreedEditor selects it.
//
// Picking: the alignment lines get the shared fat-line raycast (a ghost zone
// around the 1 px ink, attachFatLineRaycast); the value cards are published
// to dimensionObjectsStore under "RULER" so the sprite pre-pass selects the
// ruler from any card, then sub-selects the clicked card of the selected
// ruler (DIMENSION_LABEL part: the line and the other cards drop their
// selection style, the card alone is emphasized). A card sits at `seg.mid + rulerLabelOffsets[key]`
// (base-map-local metres, per segment key) with a dashed leader back to its
// default position when displaced — dragging one card moves every card of
// the ruler by the same vector (useRulerLabelDragHandlers, through
// `group.userData.rulerSegments`).
export default function ThreedRulerAnnotations({ annotations }) {
  const rulers = useMemo(
    () => (annotations || []).filter((a) => a?.type === "RULER"),
    [annotations]
  );

  const rulerIdsKey = useMemo(
    () => rulers.map((r) => r.id).join(","),
    [rulers]
  );
  // Selected rulers (one, or several after a lasso), read as a primitive so
  // the effect only re-runs when the selection actually changes.
  const selectedRulerIdsKey = useSelector((s) => {
    const ids = rulerIdsKey ? rulerIdsKey.split(",") : [];
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
  const selectedRulerIds = useMemo(
    () => new Set(selectedRulerIdsKey ? selectedRulerIdsKey.split(",") : []),
    [selectedRulerIdsKey]
  );
  // The sub-selected value card of the selected ruler, if any.
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
  // before the parent loader hooks create them.
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
      setDimensionObjects("RULER", []);
      setDimensionGroups("RULER", []);
    };
    clear();

    const sprites = [];
    const resolution = getCanvasResolution(editor);

    rulers.forEach((rulerRow) => {
      // Fields just written by a drag win over the row until the live query
      // delivers the updated row (no snap-back frame).
      const ruler = applyPendingDimensionPatch(rulerRow);
      const baseMap = imagesManager.baseMapsMap?.[ruler.baseMapId];
      const parentGroup = imagesManager.getGroup?.(ruler.baseMapId);
      // Annotations reload after maps load, so a missing group self-heals on
      // the next run of this effect.
      if (!baseMap || !parentGroup) return;

      // Annotation pixel coords are resolved in the REFERENCE frame
      // (mirrors AnnotationsManager's baseMapForRender).
      const refSize = baseMap.getImageSize?.() || baseMap.image?.imageSize;
      const meterByPx = baseMap.meterByPx || 0.01;

      const geom = computeRulerGeometry3d({
        points: ruler.points,
        offsetZ: ruler.offsetZ,
        extensionOffset: ruler.extensionOffset ?? 8,
        extensionOffsetUnit: ruler.extensionOffsetUnit ?? "PX",
        imageWidth: refSize?.width || 1,
        imageHeight: refSize?.height || 1,
        meterByPx,
      });
      if (!geom || !geom.segments.length) return;

      const isSelected = selectedRulerIds.has(ruler.id);
      // Selection styles: the ruler itself → bold line only; one of its
      // cards (2nd click on it) → thin line, that card drawn as an inverted
      // chip.
      const isLabelSelected =
        isSelected &&
        geom.segments.some(
          (seg) => getDimensionLabelPartId(ruler.id, seg.key) === selectedPartId
        );
      const color = ruler.strokeColor || "#000000";
      const linewidth =
        isSelected && !isLabelSelected ? LINEWIDTH_SELECTED : LINEWIDTH;
      const labelOffsets = ruler.rulerLabelOffsets || {};

      const group = new Group();
      group.name = `Ruler-${ruler.id}`;
      group.userData = {
        nodeId: ruler.id,
        nodeType: "ANNOTATION",
        annotationType: "RULER",
        listingId: ruler.listingId,
        annotationTemplateId: ruler.annotationTemplateId,
        baseMapId: ruler.baseMapId,
        rulerGeom: { isPlaneParallel: geom.isPlaneParallel },
        // Live-drag handles (useRulerLabelDragHandlers), one per segment.
        rulerSegments: [],
        // Lasso hit-test points (parent-group local): measured points,
        // alignment-line vertices, then one entry per value card (pushed
        // below). The 3D lasso selects the ruler when any falls inside.
        lassoPoints: [
          ...geom.P.map((p) => new Vector3(p.x, p.y, p.z)),
          ...geom.D.map((d) => new Vector3(d.x, d.y, d.z)),
        ],
      };

      // Alignment line — one Line2 per segment (a single polyline would need a
      // flat position buffer anyway, and per-segment keeps the geometry aligned
      // with the labels). The fat-line raycast gives it a pick zone wider
      // than its ink.
      geom.segments.forEach((seg) => {
        const line = makeLine({
          positions: [
            seg.D1.x,
            seg.D1.y,
            seg.D1.z,
            seg.D2.x,
            seg.D2.y,
            seg.D2.z,
          ],
          color,
          linewidth,
          resolution,
        });
        attachFatLineRaycast(line, [
          new Vector3(seg.D1.x, seg.D1.y, seg.D1.z),
          new Vector3(seg.D2.x, seg.D2.y, seg.D2.z),
        ]);
        group.add(line);
      });

      // Dashed extension lines: measured point → alignment line.
      if (geom.hasOffset) {
        geom.P.forEach((p, i) => {
          const d = geom.D[i];
          const ext = makeLine({
            positions: [p.x, p.y, p.z, d.x, d.y, d.z],
            color,
            linewidth: LINEWIDTH_EXTENSION,
            resolution,
            dashed: true,
          });
          ext.raycast = () => {}; // never picked
          group.add(ext);
        });
      }

      // One value card per segment, at the middle of its offset segment plus
      // its own displacement, with a dashed leader back to that middle (built
      // for every card so the drag never creates geometry mid-gesture).
      geom.segments.forEach((seg) => {
        const offset = labelOffsets[seg.key];
        const displaced = !isZeroLabelOffset(offset);
        const card = {
          x: seg.mid.x + (displaced ? offset.x || 0 : 0),
          y: seg.mid.y + (displaced ? offset.y || 0 : 0),
          z: seg.mid.z + (displaced ? offset.z || 0 : 0),
        };
        const partId = getDimensionLabelPartId(ruler.id, seg.key);
        const sprite = createDimensionLabelSprite({
          text: getCoteDisplayValue({
            p1: geom.pixelPoints[seg.index],
            p2: geom.pixelPoints[seg.index + 1],
            meterByPx,
            unit: ruler.unit ?? DEFAULT_COTE_UNIT,
            decimals: ruler.decimals ?? DEFAULT_COTE_DECIMALS,
            showUnitLabel: ruler.showUnitLabel ?? true,
            deltaZMeters: seg.deltaZMeters,
          }),
          coteId: `${ruler.id}::${seg.key}`,
          color,
          emphasis: isLabelSelected && selectedPartId === partId,
          card: ruler.showValueCard ?? true,
          fontSize: ruler.fontSize,
        });
        sprite.userData.annotationId = ruler.id;
        sprite.userData.annotationType = "RULER";
        sprite.userData.listingId = ruler.listingId;
        sprite.userData.annotationTemplateId = ruler.annotationTemplateId;
        sprite.userData.segmentKey = seg.key;
        sprite.position.set(card.x, card.y, card.z);
        group.add(sprite);
        sprites.push(sprite);
        group.userData.lassoPoints.push(new Vector3(card.x, card.y, card.z));

        const leader = makeLine({
          positions: [seg.mid.x, seg.mid.y, seg.mid.z, card.x, card.y, card.z],
          color,
          linewidth: LINEWIDTH_EXTENSION,
          resolution,
          dashed: true,
        });
        leader.raycast = () => {}; // never picked
        leader.visible = displaced;
        group.add(leader);

        group.userData.rulerSegments.push({
          key: seg.key,
          midLocal: new Vector3(seg.mid.x, seg.mid.y, seg.mid.z),
          sprite,
          leader,
        });
      });

      // The measured chain points are 3D snap targets (2D parity: the
      // offset alignment line and the cards never snap).
      const anchors = createDimensionSnapAnchors(geom.P);
      if (anchors) group.add(anchors);

      parentGroup.add(group);
      groupsRef.current.push(group);
    });

    setDimensionObjects("RULER", sprites);
    setDimensionGroups("RULER", groupsRef.current);
    editor.sceneManager.renderScene?.();

    return clear;
  }, [rulers, selectedRulerIds, selectedPartId, annotationsLoadTick]);

  return null;
}
