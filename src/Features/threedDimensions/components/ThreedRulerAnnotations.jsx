import { useEffect, useMemo, useRef } from "react";

import { useSelector } from "react-redux";
import { Group, Vector2 } from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

import getCoteDisplayValue from "Features/annotations/utils/getCoteDisplayValue";
import { selectSelectedItems } from "Features/selection/selectionSlice";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import createDimensionLabelSprite from "../services/createDimensionLabelSprite";
import computeRulerGeometry3d from "../utils/computeRulerGeometry3d";

const LINEWIDTH = 2.5;
const LINEWIDTH_SELECTED = 4;

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

// Renders every RULER annotation (dimension chain) of the 3D editor's
// annotations array: the alignment line, the dashed extension lines and one
// value card sprite per segment. Sibling of ThreedCoteAnnotations, same
// lifecycle — each ruler Group is attached to its basemap's group so basemap
// transforms propagate for free, and carries the ANNOTATION userData contract
// so the generic annotation raycast branch of MainThreedEditor selects it.
//
// Display only for now: no label drag, no dimensionObjectsStore publication —
// rulers are edited in 2D.
export default function ThreedRulerAnnotations({ annotations }) {
  const rulers = useMemo(
    () => (annotations || []).filter((a) => a?.type === "RULER"),
    [annotations]
  );

  const rulerIdsKey = useMemo(
    () => rulers.map((r) => r.id).join(","),
    [rulers]
  );
  const selectedRulerId = useSelector((s) => {
    const items = selectSelectedItems(s);
    if (items.length !== 1) return null;
    const it = items[0];
    if (it?.type !== "NODE" || it?.nodeType !== "ANNOTATION") return null;
    return rulerIdsKey.split(",").includes(it.nodeId) ? it.nodeId : null;
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
    };
    clear();

    const resolution = getCanvasResolution(editor);

    rulers.forEach((ruler) => {
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

      const isSelected = ruler.id === selectedRulerId;
      const color = ruler.strokeColor || "#000000";
      const linewidth = isSelected ? LINEWIDTH_SELECTED : LINEWIDTH;

      const group = new Group();
      group.name = `Ruler-${ruler.id}`;
      group.userData = {
        nodeId: ruler.id,
        nodeType: "ANNOTATION",
        annotationType: "RULER",
        listingId: ruler.listingId,
        annotationTemplateId: ruler.annotationTemplateId,
        baseMapId: ruler.baseMapId,
      };

      // Alignment line — one Line2 per segment (a single polyline would need a
      // flat position buffer anyway, and per-segment keeps the geometry aligned
      // with the labels).
      geom.segments.forEach((seg) => {
        group.add(
          makeLine({
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
          })
        );
      });

      // Dashed extension lines: measured point → alignment line.
      if (geom.hasOffset) {
        geom.P.forEach((p, i) => {
          const d = geom.D[i];
          const ext = makeLine({
            positions: [p.x, p.y, p.z, d.x, d.y, d.z],
            color,
            linewidth: 1.5,
            resolution,
            dashed: true,
          });
          ext.raycast = () => {}; // never picked
          group.add(ext);
        });
      }

      // One value card per segment, at the middle of its offset segment.
      geom.segments.forEach((seg) => {
        const sprite = createDimensionLabelSprite({
          text: getCoteDisplayValue({
            p1: ruler.points[seg.index],
            p2: ruler.points[seg.index + 1],
            meterByPx,
            unit: ruler.unit ?? "CM",
            decimals: ruler.decimals ?? 0,
            showUnitLabel: ruler.showUnitLabel ?? true,
            deltaZMeters: seg.deltaZMeters,
          }),
          coteId: `${ruler.id}::${seg.index}`,
          color,
          selected: isSelected,
        });
        sprite.userData.annotationId = ruler.id;
        sprite.userData.annotationType = "RULER";
        sprite.userData.listingId = ruler.listingId;
        sprite.userData.annotationTemplateId = ruler.annotationTemplateId;
        sprite.position.set(seg.mid.x, seg.mid.y, seg.mid.z);
        group.add(sprite);
      });

      parentGroup.add(group);
      groupsRef.current.push(group);
    });

    editor.sceneManager.renderScene?.();

    return clear;
  }, [rulers, selectedRulerId, annotationsLoadTick]);

  return null;
}
