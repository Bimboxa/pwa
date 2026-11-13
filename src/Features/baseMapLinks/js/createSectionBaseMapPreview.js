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

import {
  BASE_MAP_ROTATION_ORDER,
  getBaseMapEuler,
} from "Features/baseMaps/js/getBaseMapTransform";

// 3D preview of the « + fond de plan » placement of a section mark: a
// vertical sheet inside a fluo green frame, posed like the base map it
// stands for (world group, same YXZ euler as createBaseMapGroup).
//
// - `fill`: the sheet itself — an opaque-ish white page for a new blank
//   page, a faint green veil over the real image for an existing base map.
//   It is also the pick surface of the drag (raycast by the placement hook).
// - `outline`: the frame, drawn over everything (no depth test), never
//   picked.
//
// Transient scene decoration: tagged `isHoverOverlay` (skipped by the scene
// export) and `isSectionBaseMapPreview`.
const FRAME_COLOR = 0x39ff14;
const FRAME_WIDTH_PX = 3;
const BLINK_PERIOD_MS = 800;

export default function createSectionBaseMapPreview({ scene, domElement }) {
  const group = new Group();
  group.rotation.order = BASE_MAP_ROTATION_ORDER;
  group.userData.isSectionBaseMapPreview = true;
  group.userData.isHoverOverlay = true;

  const fillMaterial = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
    side: DoubleSide,
    depthWrite: false,
    toneMapped: false,
  });
  const fill = new Mesh(new PlaneGeometry(1, 1), fillMaterial);
  fill.userData.isSectionBaseMapPreview = true;
  fill.userData.isHoverOverlay = true;
  group.add(fill);

  const outlineMaterial = new LineMaterial({
    color: FRAME_COLOR,
    linewidth: FRAME_WIDTH_PX,
    resolution: new Vector2(1, 1),
    worldUnits: false,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const outline = new Line2(new LineGeometry(), outlineMaterial);
  outline.renderOrder = 1002;
  outline.frustumCulled = false;
  outline.raycast = () => {};
  outline.userData.isSectionBaseMapPreview = true;
  outline.userData.isHoverOverlay = true;
  group.add(outline);

  scene.add(group);

  let blinkRafId = null;
  let lastWidth = null;
  let lastHeight = null;

  return {
    fill,
    // `veil`: the real base map image shows through (existing base map).
    update({ placement, veil }) {
      const { widthM, heightM, position, angleDeg } = placement;
      if (widthM !== lastWidth || heightM !== lastHeight) {
        lastWidth = widthM;
        lastHeight = heightM;
        fill.geometry.dispose();
        fill.geometry = new PlaneGeometry(widthM, heightM);
        const hw = widthM / 2;
        const hh = heightM / 2;
        outline.geometry.dispose();
        outline.geometry = new LineGeometry();
        outline.geometry.setPositions([
          -hw,
          hh,
          0,
          hw,
          hh,
          0,
          hw,
          -hh,
          0,
          -hw,
          -hh,
          0,
          -hw,
          hh,
          0,
        ]);
        outline.computeLineDistances();
      }
      fillMaterial.color.set(veil ? FRAME_COLOR : 0xffffff);
      fillMaterial.opacity = veil ? 0.08 : 0.85;
      outlineMaterial.resolution.set(
        domElement?.clientWidth || 1,
        domElement?.clientHeight || 1
      );
      const euler = getBaseMapEuler({ orientation: "VERTICAL", angleDeg });
      group.position.set(position.x, position.y, position.z);
      group.rotation.set(euler.x, euler.y, euler.z);
      group.updateMatrixWorld(true);
    },
    // The frame blinks like the candidates waiting for Space (cut planes,
    // automatic detection): same period and opacity range as
    // CutPlaneOverlayThreed. The scene renders on demand, so the blink owns
    // a rAF loop — `render` is the editor's renderScene.
    startBlink(render) {
      if (blinkRafId) return;
      const tick = (now) => {
        const phase =
          0.5 + 0.5 * Math.sin((2 * Math.PI * now) / BLINK_PERIOD_MS);
        outlineMaterial.opacity = 0.25 + 0.75 * phase;
        render?.();
        blinkRafId = requestAnimationFrame(tick);
      };
      blinkRafId = requestAnimationFrame(tick);
    },
    dispose() {
      if (blinkRafId) cancelAnimationFrame(blinkRafId);
      blinkRafId = null;
      scene.remove(group);
      fill.geometry.dispose();
      fillMaterial.dispose();
      outline.geometry.dispose();
      outlineMaterial.dispose();
    },
  };
}
