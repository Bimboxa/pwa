import {
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector2,
} from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";

import { ADD_SHEET_ID } from "Features/baseMapsGrid/constants/baseMapsGridConstants";

// The "new base map" frame closing the 3D base maps grid — the counterpart
// of the "+" frame of the 2D grid (AddBaseMapSheetSvg), as light as it is:
// a thin dashed frame with a "+" in the middle, nothing else (the name of
// the action is the hover tooltip, like the 2D <title>). It belongs to no
// base map: a Group of its own, posed by the manager on the table like a
// sheet (local frame: origin at the top-left corner, +X right, -Y down,
// metres), holding:
//   - outline: dashed rectangle (screen-space fat line; grey, dark hovered)
//   - plus: the "+" (screen-space fat segments; grey, dark hovered)
//   - hitPlane: invisible plane over the frame — hover / click target
// Everything is tagged `userData.isGridPlaceholder` (ignored by the export,
// the snap index and the clipping).

const REST_COLOR = 0xbdbdbd; // theme grey[400] (2D frame at rest)
const HOVER_COLOR = 0x424242; // theme text.primary (2D frame hovered)
const OUTLINE_WIDTH = 1; // px (screen-space)
const PLUS_WIDTH = 2;
// dash length, share of the smaller side (world units)
const DASH_RATIO = 0.015;
const GAP_RATIO = 0.75; // of the dash length
// "+" arm length, share of the smaller side (56 pt on the 2D A3 frame)
const PLUS_RATIO = 56 / 842;

// width / height: frame size in metres. resolution: canvas size (px), kept
// current through setResolution (crisp screen-space lines).
// Returns { group, hitPlane, setHovered, setResolution, dispose }.
export default function createAddFrameDecorations({
  width,
  height,
  resolution,
}) {
  const centerX = width / 2;
  const centerY = -height / 2;
  const userData = { isGridPlaceholder: true, baseMapId: ADD_SHEET_ID };

  const group = new Group();
  group.name = "baseMapsGridAddFrame";
  group.userData = { ...userData, gridAddFrame: true };

  // materials (outline dashed, "+" solid)
  const dashSize = Math.min(width, height) * DASH_RATIO;
  const common = {
    resolution: new Vector2().copy(resolution ?? new Vector2(1, 1)),
    worldUnits: false,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  };
  const dashed = {
    ...common,
    dashed: true,
    dashSize,
    gapSize: dashSize * GAP_RATIO,
  };
  const materials = {
    outlineIdle: new LineMaterial({
      ...dashed,
      color: REST_COLOR,
      linewidth: OUTLINE_WIDTH,
    }),
    outlineHover: new LineMaterial({
      ...dashed,
      color: HOVER_COLOR,
      linewidth: OUTLINE_WIDTH,
    }),
    plusIdle: new LineMaterial({
      ...common,
      color: REST_COLOR,
      linewidth: PLUS_WIDTH,
    }),
    plusHover: new LineMaterial({
      ...common,
      color: HOVER_COLOR,
      linewidth: PLUS_WIDTH,
    }),
  };
  const allMaterials = Object.values(materials);

  // outline (dashed)
  const outlineGeometry = new LineGeometry();
  outlineGeometry.setPositions([
    0,
    0,
    0,
    width,
    0,
    0,
    width,
    -height,
    0,
    0,
    -height,
    0,
    0,
    0,
    0,
  ]);
  const outline = new Line2(outlineGeometry, materials.outlineIdle);
  outline.computeLineDistances();
  outline.renderOrder = 1001;
  outline.frustumCulled = false;
  // never picked (three's screen-space fat line raycast is fragile)
  outline.raycast = () => {};
  outline.userData = { ...userData };

  // "+" in the middle
  const arm = (Math.min(width, height) * PLUS_RATIO) / 2;
  const plusGeometry = new LineSegmentsGeometry();
  plusGeometry.setPositions([
    centerX - arm,
    centerY,
    0,
    centerX + arm,
    centerY,
    0,
    centerX,
    centerY - arm,
    0,
    centerX,
    centerY + arm,
    0,
  ]);
  const plus = new LineSegments2(plusGeometry, materials.plusIdle);
  plus.renderOrder = 1002;
  plus.frustumCulled = false;
  plus.raycast = () => {};
  plus.userData = { ...userData };

  // hit plane
  const hitGeometry = new PlaneGeometry(width, height);
  hitGeometry.translate(centerX, centerY, 0);
  // Fully see-through material: the orbit-pivot raycast skips it.
  const hitMaterial = new MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: DoubleSide,
  });
  const hitPlane = new Mesh(hitGeometry, hitMaterial);
  // Not rendered — three's Raycaster does not look at `visible`, the grid
  // picks it explicitly (BaseMapsGridManager.pick).
  hitPlane.visible = false;
  hitPlane.userData = { ...userData, gridAddFrameHit: true };

  group.add(outline, plus, hitPlane);

  return {
    group,
    hitPlane,
    setHovered: (hovered) => {
      outline.material = hovered
        ? materials.outlineHover
        : materials.outlineIdle;
      plus.material = hovered ? materials.plusHover : materials.plusIdle;
    },
    setResolution: (nextResolution) => {
      allMaterials.forEach((material) =>
        material.resolution.copy(nextResolution)
      );
    },
    dispose: () => {
      group.parent?.remove(group);
      outlineGeometry.dispose();
      plusGeometry.dispose();
      allMaterials.forEach((material) => material.dispose());
      hitGeometry.dispose();
      hitMaterial.dispose();
    },
  };
}
