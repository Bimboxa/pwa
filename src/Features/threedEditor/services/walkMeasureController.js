import { Group, Vector2, Vector3 } from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";

import buildDrawingVertexMarkers from "Features/threedDrawing/utils/buildDrawingVertexMarkers";
import createDimensionLabelSprite from "Features/threedDimensions/services/createDimensionLabelSprite";
import formatCoteLength from "Features/threedDimensions/utils/formatCoteLength";

// Walk-mode laser meter: dimensions shot from the crosshair. shoot(point)
// twice = one measure (world-space Line2 + endpoint dots + a length card
// sprite at the midpoint). The caller persists it as a COTE annotation and
// removes the ephemeral copy (removeLast); a measure that could not be
// persisted stays in the scene until clearAll() / dispose() (walk exit). Between the two shots, updatePreview(point)
// draws a dashed segment from the first point to the aimed point and
// returns its live length. Nothing is persisted and nothing is pickable:
// every object has a neutralised raycast, so the aim ray (pickWorldHitAtNdc,
// meshes only anyway) and the annotation click pre-pass ignore them.
//
// Same visual language as the COTE draft (DimensionDraftOverlayThreed) and
// the persisted cotes (ThreedCoteAnnotations), in a distinct colour so a
// measure never reads as a saved cote.

const MEASURE_COLOR = 0xe65100;
const MEASURE_COLOR_HEX = "#e65100";
const LINEWIDTH = 2.5;
const LINEWIDTH_PREVIEW = 3;
// Segments shorter than this are ignored (double shot on the same spot).
const MIN_LENGTH_M = 0.001;

function getCanvasResolution(sceneManager) {
  const dom = sceneManager?.renderer?.domElement;
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
      // The vertex-marker disc texture is shared (buildDrawingVertexMarkers):
      // material.dispose() does not touch it.
      child.material?.dispose?.();
    }
  });
}

const noRaycast = () => {};

function makeSolidLine({ a, b, resolution }) {
  const mat = new LineMaterial({
    color: MEASURE_COLOR,
    linewidth: LINEWIDTH,
    resolution,
    worldUnits: false,
    transparent: true,
    depthTest: false,
  });
  const geom = new LineGeometry();
  geom.setPositions([a.x, a.y, a.z, b.x, b.y, b.z]);
  const line = new Line2(geom, mat);
  line.computeLineDistances();
  line.renderOrder = 1001;
  line.raycast = noRaycast;
  return line;
}

function makeDashedLine({ a, b, resolution, camera }) {
  // Dashes grow with the viewing distance (5 cm up close): a fixed 5 cm
  // dash is sub-pixel at the scale of a site.
  const dashSize = Math.max(0.05, camera.position.distanceTo(b) * 0.008);
  const mat = new LineMaterial({
    color: MEASURE_COLOR,
    linewidth: LINEWIDTH_PREVIEW,
    resolution,
    dashed: true,
    dashSize,
    gapSize: dashSize,
    worldUnits: false,
    transparent: true,
    depthTest: false,
  });
  const geom = new LineSegmentsGeometry();
  geom.setPositions([a.x, a.y, a.z, b.x, b.y, b.z]);
  const line = new LineSegments2(geom, mat);
  line.computeLineDistances();
  line.renderOrder = 1002;
  line.raycast = noRaycast;
  return line;
}

function makeMarkers(points) {
  const markers = buildDrawingVertexMarkers(points, MEASURE_COLOR);
  if (markers) markers.renderOrder = 1003;
  return markers;
}

function makeLabel({ lengthM, position }) {
  const sprite = createDimensionLabelSprite({
    text: formatCoteLength({ meters: lengthM }),
    coteId: null,
    color: MEASURE_COLOR_HEX,
  });
  // Not a cote: the click pre-pass of MainThreedEditor must not pick it.
  sprite.userData.isDimensionLabel = false;
  sprite.raycast = noRaycast;
  sprite.position.copy(position);
  return sprite;
}

export function createWalkMeasureController({ sceneManager, editor }) {
  const scene = sceneManager.scene;
  const camera = sceneManager.camera;

  const root = new Group();
  root.name = "walkMeasures";
  root.raycast = noRaycast;
  scene.add(root);

  const measures = []; // [{ a, b, lengthM, group }]
  let startPoint = null; // Vector3 | null
  let startMarker = null;
  let previewLine = null;
  let previewTarget = null; // Vector3 | null, last preview end point

  function render() {
    editor?.renderScene?.();
  }

  function dropPreview() {
    if (!previewLine) return;
    root.remove(previewLine);
    disposeObject(previewLine);
    previewLine = null;
    previewTarget = null;
  }

  function dropStart() {
    dropPreview();
    if (startMarker) {
      root.remove(startMarker);
      disposeObject(startMarker);
      startMarker = null;
    }
    startPoint = null;
  }

  function commit(a, b) {
    const lengthM = a.distanceTo(b);
    const group = new Group();
    group.raycast = noRaycast;
    group.add(
      makeSolidLine({ a, b, resolution: getCanvasResolution(sceneManager) })
    );
    const markers = makeMarkers([a, b]);
    if (markers) group.add(markers);
    group.add(
      makeLabel({
        lengthM,
        position: new Vector3().addVectors(a, b).multiplyScalar(0.5),
      })
    );
    root.add(group);
    measures.push({ a, b, lengthM, group });
  }

  // First call: arms the start point (returns null). Second call: commits
  // the measure and returns its {a, b, lengthM} (world Vector3s) — the
  // caller may persist it as a COTE annotation and drop the ephemeral copy
  // with removeLast().
  function shoot(point) {
    if (!point) return null;
    const p = point.clone();
    if (!startPoint) {
      startPoint = p;
      startMarker = makeMarkers([p]);
      if (startMarker) root.add(startMarker);
      render();
      return null;
    }
    if (startPoint.distanceTo(p) < MIN_LENGTH_M) return null;
    const a = startPoint;
    dropStart();
    commit(a, p);
    render();
    const last = measures[measures.length - 1];
    return { a: last.a, b: last.b, lengthM: last.lengthM };
  }

  // Drop the most recent committed measure (persisted elsewhere).
  function removeLast() {
    const last = measures.pop();
    if (!last) return;
    root.remove(last.group);
    disposeObject(last.group);
    render();
  }

  // Dashed segment from the armed start point to the aimed point (null =
  // aiming the void). Returns the live length in meters, or null.
  function updatePreview(point) {
    if (!startPoint) return null;
    if (!point) {
      if (previewLine) {
        dropPreview();
        render();
      }
      return null;
    }
    // 10 Hz poll: skip the rebuild while the aim doesn't move.
    if (previewTarget && previewTarget.distanceToSquared(point) < 1e-8) {
      return startPoint.distanceTo(previewTarget);
    }
    dropPreview();
    previewTarget = point.clone();
    previewLine = makeDashedLine({
      a: startPoint,
      b: previewTarget,
      resolution: getCanvasResolution(sceneManager),
      camera,
    });
    root.add(previewLine);
    render();
    return startPoint.distanceTo(previewTarget);
  }

  // Drop the pending first point (tool switch).
  function cancelStart() {
    if (!startPoint) return;
    dropStart();
    render();
  }

  function clearAll() {
    dropStart();
    measures.forEach(({ group }) => {
      root.remove(group);
      disposeObject(group);
    });
    measures.length = 0;
    render();
  }

  function dispose() {
    clearAll();
    scene.remove(root);
  }

  function getState() {
    return {
      startPoint,
      measures: measures.map(({ a, b, lengthM }) => ({ a, b, lengthM })),
    };
  }

  return {
    shoot,
    removeLast,
    updatePreview,
    cancelStart,
    clearAll,
    dispose,
    getState,
  };
}
