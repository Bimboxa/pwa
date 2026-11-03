import { useEffect, useMemo, useRef } from "react";

import { useSelector } from "react-redux";
import { Group, Vector2, Vector3 } from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

import theme from "Styles/theme";

import {
  selectSelectedItems,
  selectSelectedPointIds,
} from "Features/selection/selectionSlice";
import { setDimensionGroups } from "Features/threedDimensions/services/dimensionObjectsStore";
import { applyPendingDimensionPatch } from "Features/threedDimensions/services/dimensionPendingPatchStore";
import buildDrawingVertexMarkers from "Features/threedDrawing/utils/buildDrawingVertexMarkers";
import attachFatLineRaycast from "Features/threedEditor/js/utilsAnnotationsManager/attachFatLineRaycast";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import {
  CUT_LINE_DASH_M,
  CUT_LINE_END_MARKER_PX,
  CUT_LINE_GAP_M,
  CUT_LINE_HIDDEN_COLOR,
  CUT_LINE_MARKER_PX,
  CUT_LINE_SELECTED_MARKER_PX,
  CUT_LINE_WIDTH_HIDDEN_PX,
  CUT_LINE_WIDTH_PX,
  CUT_LINE_WIDTH_SELECTED_PX,
} from "../constants/cutLineStyle";
import { setCutLineObjects } from "../services/cutLineObjectsStore";
import computeCutLineGeometry3d from "../utils/computeCutLineGeometry3d";

const DEFAULT_COLOR = theme.palette.secondary.fluo ?? "#ff4d00";
const SELECTED_VERTEX_COLOR = theme.palette.annotation?.selected ?? "#39FF14";

function getCanvasResolution(editor) {
  const dom = editor?.sceneManager?.renderer?.domElement;
  if (!dom) return new Vector2(1, 1);
  return new Vector2(dom.clientWidth, dom.clientHeight);
}

function disposeObject(obj) {
  if (!obj) return;
  obj.traverse?.((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((m) => m.dispose?.());
    } else {
      child.material?.dispose?.();
    }
  });
}

function makeCutLineSegment({ a, b, color, linewidth, resolution, dashed }) {
  const mat = new LineMaterial({
    color,
    linewidth,
    resolution,
    worldUnits: false,
    transparent: true,
    depthTest: false,
    ...(dashed
      ? { dashed: true, dashSize: CUT_LINE_DASH_M, gapSize: CUT_LINE_GAP_M }
      : {}),
  });
  const geom = new LineGeometry();
  geom.setPositions([a.x, a.y, a.z, b.x, b.y, b.z]);
  const line = new Line2(geom, mat);
  line.computeLineDistances();
  line.renderOrder = 1002;
  return line;
}

// Renders every CUT_LINE annotation (Features/threedCutLines) of the 3D
// editor's annotations array, in every 3D-family editor. Sibling of
// ThreedRulerAnnotations, same lifecycle — one Group per line attached to its
// base map group (base map transforms propagate for free), carrying the
// ANNOTATION userData contract + `lassoPoints` (published to the dimension
// groups store for the 3D lasso) — and the same no-snap-back trick on drags
// (applyPendingDimensionPatch).
//
// Unselected: one continuous fluo line (theme secondary.fluo, the row's
// strokeColor), the part beyond a « Stop » point not drawn. Selected: thicker,
// the segments the extension added dashed, a marker on every vertex (bigger
// at the two visible ends, the sub-selected vertex in the selection colour),
// the hidden part in thin grey dashes.
//
// Picking: every visible segment is a Line2 with the shared fat-line raycast,
// published to cutLineObjectsStore for the click pre-passes (pickCutLine);
// the vertex markers never raycast — useCutLineVertexHandlers grabs them by
// screen distance from the vertices published alongside.
export default function ThreedCutLineAnnotations({ annotations }) {
  const cutLines = useMemo(
    () => (annotations || []).filter((a) => a?.type === "CUT_LINE"),
    [annotations]
  );
  const idsKey = useMemo(() => cutLines.map((c) => c.id).join(","), [cutLines]);

  const selectedIdsKey = useSelector((s) => {
    const ids = idsKey ? idsKey.split(",") : [];
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
  const selectedIds = useMemo(
    () => new Set(selectedIdsKey ? selectedIdsKey.split(",") : []),
    [selectedIdsKey]
  );
  // The sub-selected vertex of the selected line (click on a marker).
  const selectedPointIdsKey = useSelector((s) => {
    const items = selectSelectedItems(s);
    if (items.length !== 1) return "";
    const fromItem = items[0]?.pointId ? [items[0].pointId] : [];
    return [...fromItem, ...(selectSelectedPointIds(s) || [])].join(",");
  });
  const selectedPointIds = useMemo(
    () => new Set(selectedPointIdsKey ? selectedPointIdsKey.split(",") : []),
    [selectedPointIdsKey]
  );

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
      setDimensionGroups("CUT_LINE", []);
      setCutLineObjects([]);
    };
    clear();

    const resolution = getCanvasResolution(editor);
    const entries = [];

    cutLines.forEach((row) => {
      const cutLine = applyPendingDimensionPatch(row);
      const baseMap = imagesManager.baseMapsMap?.[cutLine.baseMapId];
      const parentGroup = imagesManager.getGroup?.(cutLine.baseMapId);
      if (!baseMap || !parentGroup) return;

      const refSize = baseMap.getImageSize?.() || baseMap.image?.imageSize;
      const meterByPx = baseMap.meterByPx || 0.01;
      const geom = computeCutLineGeometry3d({
        points: cutLine.points,
        offsetZ: cutLine.offsetZ,
        imageWidth: refSize?.width || 1,
        imageHeight: refSize?.height || 1,
        meterByPx,
      });
      if (!geom) return;

      const isSelected = selectedIds.has(cutLine.id);
      const color = cutLine.strokeColor || DEFAULT_COLOR;

      const group = new Group();
      group.name = `CutLine-${cutLine.id}`;
      group.userData = {
        nodeId: cutLine.id,
        nodeType: "ANNOTATION",
        annotationType: "CUT_LINE",
        listingId: cutLine.listingId ?? null,
        annotationTemplateId: null,
        baseMapId: cutLine.baseMapId,
        lassoPoints: geom.P.filter(
          (p) => p.index >= geom.startIndex && p.index <= geom.endIndex
        ).map((p) => new Vector3(p.x, p.y, p.z)),
        // Live-drag handles (useCutLineVertexHandlers): one Line2 per
        // segment, in segment order.
        cutLineSegments: [],
      };

      const lines = [];
      geom.segments.forEach((seg) => {
        if (seg.hidden && !isSelected) {
          group.userData.cutLineSegments.push({ index: seg.index, line: null });
          return;
        }
        const line = makeCutLineSegment({
          a: seg.a,
          b: seg.b,
          color: seg.hidden ? CUT_LINE_HIDDEN_COLOR : color,
          linewidth: seg.hidden
            ? CUT_LINE_WIDTH_HIDDEN_PX
            : isSelected
              ? CUT_LINE_WIDTH_SELECTED_PX
              : CUT_LINE_WIDTH_PX,
          resolution,
          dashed: isSelected && (seg.derived || seg.hidden),
        });
        line.userData.annotationId = cutLine.id;
        line.userData.segmentIndex = seg.index;
        if (seg.hidden) {
          line.raycast = () => {}; // never picked
        } else {
          attachFatLineRaycast(line, [
            new Vector3(seg.a.x, seg.a.y, seg.a.z),
            new Vector3(seg.b.x, seg.b.y, seg.b.z),
          ]);
          lines.push(line);
        }
        group.add(line);
        group.userData.cutLineSegments.push({ index: seg.index, line });
      });

      // Vertex markers of the selected line: the two visible ends bigger,
      // the sub-selected vertex in the selection colour on top.
      if (isSelected) {
        const ends = [];
        const inner = [];
        const picked = [];
        geom.P.forEach((p) => {
          if (p.id && selectedPointIds.has(p.id)) {
            picked.push(p);
            return;
          }
          if (p.index === geom.startIndex || p.index === geom.endIndex) {
            ends.push(p);
          } else {
            inner.push(p);
          }
        });
        const innerMarkers = buildDrawingVertexMarkers(inner, color, {
          size: CUT_LINE_MARKER_PX,
        });
        if (innerMarkers) group.add(innerMarkers);
        const endMarkers = buildDrawingVertexMarkers(ends, color, {
          size: CUT_LINE_END_MARKER_PX,
        });
        if (endMarkers) group.add(endMarkers);
        const pickedMarkers = buildDrawingVertexMarkers(
          picked,
          SELECTED_VERTEX_COLOR,
          { size: CUT_LINE_SELECTED_MARKER_PX }
        );
        if (pickedMarkers) {
          pickedMarkers.renderOrder = 1003;
          group.add(pickedMarkers);
        }
      }

      parentGroup.add(group);
      group.updateMatrixWorld(true);
      groupsRef.current.push(group);

      const toWorld = (p) => group.localToWorld(new Vector3(p.x, p.y, p.z));
      entries.push({
        annotationId: cutLine.id,
        group,
        lines,
        vertices: geom.P.map((p) => ({
          pointId: p.id,
          index: p.index,
          world: toWorld(p),
          derived: p.derived,
          stop: p.stop,
          hidden: p.index < geom.startIndex || p.index > geom.endIndex,
        })),
        worldPolyline: geom.P.filter(
          (p) => p.index >= geom.startIndex && p.index <= geom.endIndex
        ).map((p) => {
          const w = toWorld(p);
          return { x: w.x, y: w.y, z: w.z };
        }),
        // Resolved px points of the row (the vertex drag re-encodes the
        // other vertices from them).
        resolvedPoints: cutLine.points,
      });
    });

    setDimensionGroups("CUT_LINE", groupsRef.current);
    setCutLineObjects(entries);
    editor.sceneManager.renderScene?.();

    return clear;
  }, [cutLines, selectedIds, selectedPointIds, annotationsLoadTick]);

  return null;
}
