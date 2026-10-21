import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";

import {
  CanvasTexture,
  Group,
  LinearFilter,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
} from "three";

import { selectSelectedItems } from "Features/selection/selectionSlice";

import { getSelectedAnnotationIds } from "Features/annotations/utils/annotationLabelSelection";
import { CUT_AXIS_OVERSHOOT } from "Features/annotations/utils/revolutionAxisGlyph";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";
import getAnnotationVerticalLift from "Features/threedEditor/js/utilsAnnotationsManager/getAnnotationVerticalLift";
import pixelToWorld from "Features/threedEditor/js/utilsAnnotationsManager/pixelToWorld";
import sizeSpriteInCssPx from "Features/threedAnnotationLabels/services/sizeSpriteInCssPx";
import {
  disposeObject,
  getCanvasResolution,
  makeLineMaterial,
  buildConnectedPolyline,
} from "Features/threedDrawing/utils/drawingOverlayLines";
import { setRevolutionAxisHandles } from "Features/revolutionAxes/services/revolutionAxisHandlesStore";
import getRevolutionAxisCutTheta from "Features/revolutionAxes/utils/getRevolutionAxisCutTheta";

// Same blue as the 2D cut axis (NodeRevolutionAxisStatic).
const BLUE = "#1976d2";
const HANDLE_CSS_PX = 12;
const CUT_AXIS_LINEWIDTH_PX = 1;
// Just above the base circle (1 mm above the plan) so the blue diameter
// never z-fights it.
const CUT_AXIS_LIFT_M = 0.002;
const CANVAS_PX = 64;

// White disc with a blue ring + blue dot: the 3D counterpart of the 2D
// rotation handle. Screen-constant (sizeSpriteInCssPx), always on top.
function createHandleSprite() {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;
  const ctx = canvas.getContext("2d");
  const c = CANVAS_PX / 2;
  ctx.beginPath();
  ctx.arc(c, c, c - 6, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = BLUE;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c, c, c / 5, 0, Math.PI * 2);
  ctx.fillStyle = BLUE;
  ctx.fill();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: false,
  });
  const sprite = new Sprite(material);
  sizeSpriteInCssPx(sprite, { cssHeight: HANDLE_CSS_PX });
  sprite.renderOrder = 1005;
  sprite.userData.dispose = () => {
    texture.dispose();
    material.dispose();
  };
  return sprite;
}

/**
 * Cut-axis rotation handles of the selected plan REVOLUTION_AXIS in the 3D
 * editor: two blue handles at the ends of the cut diameter (overshooting
 * the base circle like the 2D glyph) joined by a thin blue line, built in
 * the axis's base map group (local metres, at the axis altitude). Dragging
 * a handle turns `directionDeg` — see useRevolutionAxisHandleDragHandlers.
 * Shown only while the axis's "Demi-vue 3D" is on (no cut, no handles),
 * same rule as the 2D node.
 *
 * `annotations`: the resolved annotations loaded in 3D (point in px).
 */
export default function ThreedRevolutionAxisHandles({ annotations }) {
  const selectedItems = useSelector(selectSelectedItems);
  const selectedId =
    selectedItems.length === 1
      ? (getSelectedAnnotationIds(selectedItems)[0] ?? null)
      : null;
  const axis =
    (selectedId &&
      (annotations || []).find(
        (a) => a.id === selectedId && a.type === "REVOLUTION_AXIS"
      )) ||
    null;
  const hasCutAxis = Boolean(axis) && axis.halfViewIn3d !== false;

  // Primitive key so the effect only re-runs when the drawn geometry changes.
  const axisKey = hasCutAxis
    ? [
        axis.id,
        axis.baseMapId,
        axis.point?.x,
        axis.point?.y,
        axis.radiusM,
        axis.directionDeg,
        axis.invertHalf ? 1 : 0,
        axis.offsetZ,
      ].join(":")
    : "";
  const axisRef = useRef(axis);
  axisRef.current = axis;

  // Re-run once loadAnnotations has ensured the base map groups exist.
  const annotationsLoadTick = useSelector(
    (s) => s.threedEditor.annotationsLoadTick
  );
  const antiAliasingShrink = useSelector(
    (s) => s.threedEditor.antiAliasingShrink
  );

  const groupRef = useRef(null);

  useEffect(() => {
    const editor = getActiveThreedEditor();
    const sceneManager = editor?.sceneManager;
    const imagesManager = sceneManager?.imagesManager;
    if (!imagesManager) return;

    const clear = () => {
      const group = groupRef.current;
      if (group) {
        group.parent?.remove(group);
        disposeObject(group);
      }
      groupRef.current = null;
      setRevolutionAxisHandles([]);
    };
    clear();

    const a = axisRef.current;
    if (!axisKey || !a?.point) return;
    const baseMapEntry = imagesManager.baseMapsMap?.[a.baseMapId];
    const parentGroup = imagesManager.getGroup?.(a.baseMapId);
    if (!baseMapEntry || !parentGroup) return;
    const metrics = getBaseMapForRender(baseMapEntry);
    if (!metrics) return;

    const r = Number(a.radiusM) || 0;
    if (!(r > 0)) return;
    const center = pixelToWorld(a.point, metrics);
    const buildOptions = sceneManager.annotationsManager?.getBuildOptions?.();
    const z = getAnnotationVerticalLift(a, buildOptions) + CUT_AXIS_LIFT_M;
    const theta = getRevolutionAxisCutTheta(a);
    const reach = CUT_AXIS_OVERSHOOT * r;
    const ends = [1, -1].map(
      (sign) =>
        new Vector3(
          center.x + sign * reach * Math.cos(theta),
          center.y + sign * reach * Math.sin(theta),
          z
        )
    );

    const group = new Group();
    group.userData.isRevolutionAxisHandlesGroup = true;

    // The cut diameter: display only (never picked — a click on it must not
    // reach MainThreedEditor's annotation climb and deselect the axis).
    const line = buildConnectedPolyline(
      ends,
      makeLineMaterial({
        color: BLUE,
        linewidth: CUT_AXIS_LINEWIDTH_PX,
        resolution: getCanvasResolution(editor),
      })
    );
    if (line) {
      line.raycast = () => {};
      line.userData.isHoverOverlay = true;
      group.add(line);
    }

    const handles = ends.map((p, i) => {
      const sprite = createHandleSprite();
      sprite.position.copy(p);
      Object.assign(sprite.userData, {
        isRevolutionAxisHandle: true,
        isHoverOverlay: true,
        annotationId: a.id,
        baseMapId: a.baseMapId,
        // +1 = the +theta end, -1 = the antipode (applyDeltaPosToAnnotation's
        // ROTATE0 / ROTATE1).
        sign: i === 0 ? 1 : -1,
        center: { x: center.x, y: center.y },
      });
      group.add(sprite);
      return sprite;
    });

    parentGroup.add(group);
    groupRef.current = group;
    setRevolutionAxisHandles(handles);
    sceneManager.renderScene?.();

    return clear;
  }, [axisKey, annotationsLoadTick, antiAliasingShrink]);

  return null;
}
