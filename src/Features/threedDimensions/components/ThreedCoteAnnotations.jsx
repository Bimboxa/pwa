import { useEffect, useMemo, useRef } from "react";

import { useSelector } from "react-redux";
import { Group, Vector2, Vector3 } from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

import getCoteDisplayValue from "Features/annotations/utils/getCoteDisplayValue";
import { selectSelectedItems } from "Features/selection/selectionSlice";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import createDimensionLabelSprite from "../services/createDimensionLabelSprite";
import { setDimensionObjects } from "../services/dimensionObjectsStore";
import computeCoteGeometry3d from "../utils/computeCoteGeometry3d";

const LINEWIDTH = 2.5;
const LINEWIDTH_SELECTED = 4;

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

  // Id of the currently-selected cote (to highlight it). Read as a primitive
  // so the effect only re-runs when the selected cote actually changes.
  const coteIdsKey = useMemo(() => cotes.map((c) => c.id).join(","), [cotes]);
  const selectedCoteId = useSelector((s) => {
    const items = selectSelectedItems(s);
    if (items.length !== 1) return null;
    const it = items[0];
    if (it?.type !== "NODE" || it?.nodeType !== "ANNOTATION") return null;
    return coteIdsKey.split(",").includes(it.nodeId) ? it.nodeId : null;
  });

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
      setDimensionObjects([]);
    };
    clear();

    const sprites = [];
    const resolution = getCanvasResolution(editor);

    cotes.forEach((cote) => {
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

      const isSelected = cote.id === selectedCoteId;
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
        linewidth: isSelected ? LINEWIDTH_SELECTED : LINEWIDTH,
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
            linewidth: 1.5,
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
          unit: cote.unit ?? "CM",
          decimals: cote.decimals ?? 0,
          showUnitLabel: cote.showUnitLabel ?? false,
          deltaZMeters: geom.deltaZMeters,
        }),
        coteId: cote.id,
        color,
        selected: isSelected,
      });
      sprite.userData.annotationId = cote.id;
      sprite.userData.annotationType = "COTE";
      sprite.userData.listingId = cote.listingId;
      sprite.userData.annotationTemplateId = cote.annotationTemplateId;
      sprite.position.set(geom.mid.x, geom.mid.y, geom.mid.z);
      group.add(sprite);
      sprites.push(sprite);

      // Live-drag handles (useCoteLabelDragHandlers updates them imperatively).
      group.userData.coteObjects = { line, extensions, sprite };

      parentGroup.add(group);
      groupsRef.current.push(group);
    });

    setDimensionObjects(sprites);
    editor.sceneManager.renderScene?.();

    return clear;
  }, [cotes, selectedCoteId]);

  return null;
}
