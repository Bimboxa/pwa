import { DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry } from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";

import createIconSprite, { ICON_PATHS } from "../services/createIconSprite";
import createLabelSprite from "../services/createLabelSprite";
import { getSheetLocalCorners } from "../utils/computeBaseMapsGrid3dPoses";

// Decorations of one sheet of the 3D base maps grid. They are CHILDREN of the
// base map group (local metres), so they follow its flight for free:
//   - outline: print zone frame (screen-space fat line; grey, orange hovered)
//   - hitPlane: invisible plane over the print zone — hover / click target,
//     also for the sheets that have no image mesh
//   - label: base map name in the middle, shown while the image is hidden
//   - eye: round button at the bottom-left, the image eye of the base map
//     (same state as the layer icon of the base map chips)
//   - nav: round button at the bottom-right, leaves the grid around this
//     sheet (it stays where it is on screen)
// Everything is tagged `userData.isGridPlaceholder` (ignored by the export,
// the snap index and the clipping).

// label box, as shares of the sheet size
const LABEL_MAX_WIDTH_RATIO = 0.7;
const LABEL_MAX_HEIGHT_RATIO = 0.09;
// buttons inset from the bottom corners, share of the smaller side
const BUTTON_INSET_RATIO = 0.06;
const BUTTON_CSS_SIZE = 28;

// sheet: see buildBaseMapsGrid3dSheets. meterByPx: the EFFECTIVE scale of the
// sheet (see computeBaseMapsGrid3dPoses). materials: { idle, hover } shared
// LineMaterials owned by the manager.
export default function createSheetDecorations({
  sheet,
  meterByPx,
  materials,
  imageOn,
}) {
  const [topLeft, topRight, , bottomLeft] = getSheetLocalCorners(
    sheet,
    meterByPx
  );
  const width = topRight.x - topLeft.x;
  const height = topLeft.y - bottomLeft.y;
  const centerX = topLeft.x + width / 2;
  const centerY = topLeft.y - height / 2;
  const userData = { isGridPlaceholder: true, baseMapId: sheet.id };

  // outline
  const outlineGeometry = new LineGeometry();
  outlineGeometry.setPositions([
    topLeft.x,
    topLeft.y,
    0,
    topRight.x,
    topRight.y,
    0,
    topRight.x,
    bottomLeft.y,
    0,
    bottomLeft.x,
    bottomLeft.y,
    0,
    topLeft.x,
    topLeft.y,
    0,
  ]);
  const outline = new Line2(outlineGeometry, materials.idle);
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
  hitPlane.userData = { ...userData, gridSheetHit: true };

  // label
  const label = createLabelSprite(sheet.name || "—");
  const labelHeight = Math.min(
    height * LABEL_MAX_HEIGHT_RATIO,
    (width * LABEL_MAX_WIDTH_RATIO) / label.aspect
  );
  label.sprite.scale.set(labelHeight * label.aspect, labelHeight, 1);
  label.sprite.position.set(centerX, centerY, 0);
  label.sprite.renderOrder = 1002;
  label.sprite.raycast = () => {};
  label.sprite.userData = { ...userData };
  label.sprite.visible = !imageOn;

  // eye button
  const eye = createIconSprite({
    iconPath: imageOn ? ICON_PATHS.VISIBILITY : ICON_PATHS.VISIBILITY_OFF,
    cssSize: BUTTON_CSS_SIZE,
  });
  const inset = Math.min(width, height) * BUTTON_INSET_RATIO;
  eye.sprite.position.set(bottomLeft.x + inset, bottomLeft.y + inset, 0);
  eye.sprite.renderOrder = 1004;
  eye.sprite.userData = { ...userData, gridEyeButton: true };

  // navigation button
  const nav = createIconSprite({
    iconPath: ICON_PATHS.NEAR_ME,
    cssSize: BUTTON_CSS_SIZE,
  });
  nav.sprite.position.set(topRight.x - inset, bottomLeft.y + inset, 0);
  nav.sprite.renderOrder = 1004;
  nav.sprite.userData = { ...userData, gridNavButton: true };

  const objects = [outline, hitPlane, label.sprite, eye.sprite, nav.sprite];

  return {
    objects,
    hitPlane,
    eyeSprite: eye.sprite,
    navSprite: nav.sprite,
    setHovered: (hovered) => {
      outline.material = hovered ? materials.hover : materials.idle;
    },
    setImageOn: (visible) => {
      label.sprite.visible = !visible;
      eye.setIcon(visible ? ICON_PATHS.VISIBILITY : ICON_PATHS.VISIBILITY_OFF);
    },
    dispose: () => {
      objects.forEach((object) => object.parent?.remove(object));
      outlineGeometry.dispose();
      hitGeometry.dispose();
      hitMaterial.dispose();
      label.dispose();
      eye.dispose();
      nav.dispose();
    },
  };
}
