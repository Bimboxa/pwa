import { useEffect, useMemo, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";
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
import { collectHalfViewHosts } from "Features/threedEditor/js/utilsAnnotationsManager/revolutionHalfView";
import { bumpSnapIndexEpoch } from "Features/threedEditor/threedEditorSlice";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import {
  CUT_LINE_DASH_M,
  CUT_LINE_END_MARKER_PX,
  CUT_LINE_GAP_M,
  CUT_LINE_HIDDEN_HALF_DASH_M,
  CUT_LINE_HIDDEN_HALF_GAP_M,
  CUT_LINE_MARKER_PX,
  CUT_LINE_SELECTED_MARKER_PX,
  CUT_LINE_WIDTH_PX,
  CUT_LINE_WIDTH_SELECTED_PX,
} from "../constants/cutLineStyle";
import { setCutLineObjects } from "../services/cutLineObjectsStore";
import computeCutLineGeometry3d from "../utils/computeCutLineGeometry3d";
import splitCutLineSegmentByHalfView from "../utils/splitCutLineSegmentByHalfView";

const DEFAULT_COLOR = theme.palette.secondary.fluo ?? "#ff6a00";
// Former default (red-orange), stored as strokeColor on the cut lines drawn
// before the switch to neon orange: rendered with the current default.
const LEGACY_DEFAULT_COLOR = "#ff4d00";
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

function makeCutLineSegment({
  a,
  b,
  color,
  linewidth,
  resolution,
  dashed,
  dashSize = CUT_LINE_DASH_M,
  gapSize = CUT_LINE_GAP_M,
}) {
  const mat = new LineMaterial({
    color,
    linewidth,
    resolution,
    worldUnits: false,
    transparent: true,
    // Depth-tested (a line wrapping a solid is hidden behind it); the
    // polygon offset pulls it just in front of the face it lies on.
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    ...(dashed ? { dashed: true, dashSize, gapSize } : {}),
  });
  const geom = new LineGeometry();
  geom.setPositions([a.x, a.y, a.z, b.x, b.y, b.z]);
  const line = new Line2(geom, mat);
  line.computeLineDistances();
  line.renderOrder = 1002;
  // Drawing snaps (useVertexSnap buildIndex): a fat line's own geometry is
  // the instanced segment template, never indexed — the snap index reads the
  // source points instead (same convention as buildView3dEdgeLines): both
  // ends become snap vertices, the segment a snap edge.
  line.userData.isSnapLine = true;
  line.userData.exportLine = { positions: [a.x, a.y, a.z, b.x, b.y, b.z] };
  return line;
}

// Geometry signature of the rendered cut lines: the drawing snap index is
// rebuilt only when it changes (not on a mere selection change, which also
// rebuilds the groups).
function getCutLinesSnapSignature(cutLines) {
  return cutLines
    .map(
      (c) =>
        `${c.id}:${c.offsetZ ?? 0}:${(c.points || [])
          .map(
            (p) =>
              `${p.id}|${p.x}|${p.y}|${p.offsetBottom ?? 0}|${p.stop ? 1 : 0}`
          )
          .join(";")}`
    )
    .join("\n");
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
// strokeColor), the part beyond a « Stop » point not drawn (selected or
// not: the line ends there). Selected: thicker, the segments the extension
// added dashed, a marker on every visible vertex (bigger at the two ends,
// the sub-selected vertex in the selection colour). Selected or not, the
// part lying on the hidden half of a revolution shown as a display-only half
// (« demi-vue ») is dashed with its own, shorter dash.
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
  const snapSignatureRef = useRef(null);
  const dispatch = useDispatch();

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
    // Hidden halves of the revolutions shown as a display-only half (world
    // space). The displayed side follows the camera: a flip rebuilds the
    // annotation objects, which bumps annotationsLoadTick.
    const halfViewHosts = cutLines.length
      ? collectHalfViewHosts(editor.sceneManager.annotationsManager)
      : [];
    const entries = [];
    const patched = [];

    cutLines.forEach((row) => {
      const cutLine = applyPendingDimensionPatch(row);
      patched.push(cutLine);
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
      const storedColor = cutLine.strokeColor;
      const color =
        !storedColor || storedColor.toLowerCase() === LEGACY_DEFAULT_COLOR
          ? DEFAULT_COLOR
          : storedColor;

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
      parentGroup.updateWorldMatrix(true, false);
      const toParentWorld = (p) =>
        new Vector3(p.x, p.y, p.z).applyMatrix4(parentGroup.matrixWorld);
      // The part beyond a « Stop » point is never drawn (selected or not):
      // the line simply ends there.
      geom.segments.forEach((seg) => {
        if (seg.hidden) {
          group.userData.cutLineSegments.push({ index: seg.index, line: null });
          return;
        }
        // The part lying on the hidden half of a « demi-vue » revolution is
        // drawn dashed: one Line2 per piece (a segment crossing the
        // boundary plane gives two).
        const pieces = halfViewHosts.length
          ? splitCutLineSegmentByHalfView(
              toParentWorld(seg.a),
              toParentWorld(seg.b),
              halfViewHosts
            )
          : [{ t0: 0, t1: 1, hiddenHalf: false }];
        const at = (t) => ({
          x: seg.a.x + (seg.b.x - seg.a.x) * t,
          y: seg.a.y + (seg.b.y - seg.a.y) * t,
          z: seg.a.z + (seg.b.z - seg.a.z) * t,
        });
        const pieceLines = pieces.map((piece) => {
          const a = piece.t0 <= 0 ? seg.a : at(piece.t0);
          const b = piece.t1 >= 1 ? seg.b : at(piece.t1);
          const line = makeCutLineSegment({
            a,
            b,
            color,
            linewidth: isSelected
              ? CUT_LINE_WIDTH_SELECTED_PX
              : CUT_LINE_WIDTH_PX,
            resolution,
            dashed: piece.hiddenHalf || (isSelected && seg.derived),
            ...(piece.hiddenHalf
              ? {
                  dashSize: CUT_LINE_HIDDEN_HALF_DASH_M,
                  gapSize: CUT_LINE_HIDDEN_HALF_GAP_M,
                }
              : {}),
          });
          line.userData.annotationId = cutLine.id;
          line.userData.segmentIndex = seg.index;
          line.userData.isOnHiddenHalf = piece.hiddenHalf;
          attachFatLineRaycast(line, [
            new Vector3(a.x, a.y, a.z),
            new Vector3(b.x, b.y, b.z),
          ]);
          lines.push(line);
          group.add(line);
          return line;
        });
        // `line` holds the segment's start, `lastLine` its end (the same
        // Line2 unless the segment is split).
        group.userData.cutLineSegments.push({
          index: seg.index,
          line: pieceLines[0],
          lastLine: pieceLines[pieceLines.length - 1],
        });
      });

      // Vertex markers of the selected line (visible run only): the two
      // ends bigger, the sub-selected vertex in the selection colour on top.
      if (isSelected) {
        const ends = [];
        const inner = [];
        const picked = [];
        geom.P.forEach((p) => {
          if (p.index < geom.startIndex || p.index > geom.endIndex) return;
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

    // New / moved / re-extended / stopped line: the drawing snaps must see
    // the new segments (the commit's own bump may run before this render).
    const signature = getCutLinesSnapSignature(patched);
    if (signature !== snapSignatureRef.current) {
      snapSignatureRef.current = signature;
      dispatch(bumpSnapIndexEpoch());
    }

    return clear;
  }, [cutLines, selectedIds, selectedPointIds, annotationsLoadTick, dispatch]);

  return null;
}
