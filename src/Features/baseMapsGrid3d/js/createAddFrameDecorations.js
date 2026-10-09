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

import { ADD_SHEET_ID } from "Features/baseMapsGrid/constants/baseMapsGridConstants";

import createLabelSprite from "../services/createLabelSprite";
import createTextButtonSprite from "../services/createTextButtonSprite";

// The "new base map" frame closing the 3D base maps grid — the counterpart
// of the "+" frame of the 2D grid (AddBaseMapSheetSvg). It belongs to no
// base map: a Group of its own, posed by the manager on the table like a
// sheet (local frame: origin at the top-left corner, +X right, -Y down,
// metres), holding:
//   - outline: dashed rectangle (screen-space fat line; grey, orange hovered)
//   - hitPlane: invisible plane over the frame — hover / click target
//   - label: "Nouveau fond de plan", above the middle
//   - button: "+ créer" pill, below the middle, constant on-screen size
// Everything is tagged `userData.isGridPlaceholder` (ignored by the export,
// the snap index and the clipping).

const OUTLINE_IDLE_COLOR = 0xbdbdbd;
const OUTLINE_HOVER_COLOR = 0xe85426; // theme secondary.main
const OUTLINE_IDLE_WIDTH = 1; // px (screen-space)
const OUTLINE_HOVER_WIDTH = 2;
// dash length, share of the smaller side (world units)
const DASH_RATIO = 0.015;
const GAP_RATIO = 0.75; // of the dash length
// label box, as shares of the frame size
const LABEL_MAX_WIDTH_RATIO = 0.7;
const LABEL_MAX_HEIGHT_RATIO = 0.09;
// label / button offsets from the middle, share of the height
const LABEL_OFFSET_RATIO = 0.08;
const BUTTON_OFFSET_RATIO = 0.1;
const BUTTON_CSS_HEIGHT = 28;

const LABEL_TEXT = "Nouveau fond de plan";
const BUTTON_TEXT = "+ créer";

// width / height: frame size in metres. resolution: canvas size (px), kept
// current through setResolution (crisp screen-space lines).
// Returns { group, hitPlane, buttonSprite, setHovered, setResolution,
// dispose }.
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

  // outline (dashed)
  const dashSize = Math.min(width, height) * DASH_RATIO;
  const common = {
    resolution: new Vector2().copy(resolution ?? new Vector2(1, 1)),
    worldUnits: false,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    dashed: true,
    dashSize,
    gapSize: dashSize * GAP_RATIO,
  };
  const materials = {
    idle: new LineMaterial({
      ...common,
      color: OUTLINE_IDLE_COLOR,
      linewidth: OUTLINE_IDLE_WIDTH,
    }),
    hover: new LineMaterial({
      ...common,
      color: OUTLINE_HOVER_COLOR,
      linewidth: OUTLINE_HOVER_WIDTH,
    }),
  };
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
  const outline = new Line2(outlineGeometry, materials.idle);
  outline.computeLineDistances();
  outline.renderOrder = 1001;
  outline.frustumCulled = false;
  // never picked (three's screen-space fat line raycast is fragile)
  outline.raycast = () => {};
  outline.userData = { ...userData };

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

  // label
  const label = createLabelSprite(LABEL_TEXT);
  const labelHeight = Math.min(
    height * LABEL_MAX_HEIGHT_RATIO,
    (width * LABEL_MAX_WIDTH_RATIO) / label.aspect
  );
  label.sprite.scale.set(labelHeight * label.aspect, labelHeight, 1);
  label.sprite.position.set(centerX, centerY + height * LABEL_OFFSET_RATIO, 0);
  label.sprite.renderOrder = 1002;
  label.sprite.raycast = () => {};
  label.sprite.userData = { ...userData };

  // "+ créer" button
  const button = createTextButtonSprite({
    text: BUTTON_TEXT,
    cssHeight: BUTTON_CSS_HEIGHT,
  });
  button.sprite.position.set(
    centerX,
    centerY - height * BUTTON_OFFSET_RATIO,
    0
  );
  button.sprite.renderOrder = 1004;
  button.sprite.userData = { ...userData, gridAddButton: true };

  group.add(outline, hitPlane, label.sprite, button.sprite);

  return {
    group,
    hitPlane,
    buttonSprite: button.sprite,
    setHovered: (hovered) => {
      outline.material = hovered ? materials.hover : materials.idle;
    },
    setResolution: (nextResolution) => {
      materials.idle.resolution.copy(nextResolution);
      materials.hover.resolution.copy(nextResolution);
    },
    dispose: () => {
      group.parent?.remove(group);
      outlineGeometry.dispose();
      materials.idle.dispose();
      materials.hover.dispose();
      hitGeometry.dispose();
      hitMaterial.dispose();
      label.dispose();
      button.dispose();
    },
  };
}
