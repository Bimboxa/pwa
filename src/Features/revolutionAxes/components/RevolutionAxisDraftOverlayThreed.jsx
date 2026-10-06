import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { Group, Vector2, Vector3 } from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import intersectBaseMapPlane from "Features/threedBaseMapMove/utils/intersectBaseMapPlane";
import buildDrawingVertexMarkers from "Features/threedDrawing/utils/buildDrawingVertexMarkers";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import getAnnotationColor from "Features/annotations/utils/getAnnotationColor";

import {
  revolutionAxisDraftThreedRef,
  setLastRevolutionAxisHit,
} from "../state/lastRevolutionAxisHitStore";

import theme from "Styles/theme";

// Live overlay of the 3D revolution axis draw: a fixed-pixel SVG marker on
// the hovered HORIZONTAL base map plane; once the centre is placed, a dot on
// it plus a preview of the axis glyph following the cursor — the circle in
// the plane and the diameter through the cursor — in the draft's colour.
// Publishes the hit (lastRevolutionAxisHitStore) for the click handler and
// the live radius for the bottom bar. Mirrors DimensionDraftOverlayThreed.
const CIRCLE_SEGMENTS = 64;
const LINEWIDTH_PREVIEW = 2.5;
const SNAP_CIRCLE_RADIUS_PX = 6;
const SNAP_CIRCLE_STROKE_PX = 2;

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

function getCanvasResolution(editor) {
  const dom = editor?.sceneManager?.renderer?.domElement;
  if (!dom) return new Vector2(1, 1);
  return new Vector2(dom.clientWidth, dom.clientHeight);
}

function colorHex(c) {
  if (typeof c === "string") return parseInt(c.replace("#", ""), 16);
  return c;
}

function buildLine(positions, mat) {
  const geom = new LineGeometry();
  geom.setPositions(positions);
  const line = new Line2(geom, mat);
  line.computeLineDistances();
  line.renderOrder = 1002;
  return line;
}

export default function RevolutionAxisDraftOverlayThreed() {
  const active = useSelector(
    (s) => s.threedEditor.revolutionAxisDrawMode.active
  );
  const centerPoint = useSelector(
    (s) => s.threedEditor.revolutionAxisDrawMode.centerPoint
  );
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const mainBaseMapId = useMainBaseMap()?.id;
  const { value: baseMaps } = useBaseMaps({ includeDetails: true });

  const color =
    getAnnotationColor(newAnnotation) ?? theme.palette.secondary.main;

  const rootRef = useRef(null);
  const previewRef = useRef(null);
  const centerMarkerRef = useRef(null);
  const snapCircleRef = useRef(null);
  const baseMapsRef = useRef(baseMaps);
  useEffect(() => {
    baseMapsRef.current = baseMaps;
  }, [baseMaps]);

  // mount / unmount root group
  useEffect(() => {
    if (!active) return;
    const editor = getActiveThreedEditor();
    const scene = editor?.sceneManager?.scene;
    if (!scene) return;

    const root = new Group();
    root.name = "RevolutionAxisDraftOverlayThreed";
    scene.add(root);
    rootRef.current = root;
    editor.sceneManager.renderScene?.();

    return () => {
      scene.remove(root);
      disposeObject(root);
      rootRef.current = null;
      previewRef.current = null;
      centerMarkerRef.current = null;
      setLastRevolutionAxisHit(null);
      revolutionAxisDraftThreedRef.radiusM = 0;
      editor.sceneManager.renderScene?.();
    };
  }, [active]);

  // dot on the placed centre — the feedback of the first click
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (centerMarkerRef.current) {
      root.remove(centerMarkerRef.current);
      disposeObject(centerMarkerRef.current);
      centerMarkerRef.current = null;
    }
    const marker = centerPoint
      ? buildDrawingVertexMarkers([centerPoint], colorHex(color))
      : null;
    if (marker) {
      marker.renderOrder = 1003;
      root.add(marker);
      centerMarkerRef.current = marker;
    }
    if (!centerPoint) revolutionAxisDraftThreedRef.radiusM = 0;
    getActiveThreedEditor()?.sceneManager?.renderScene?.();
  }, [centerPoint, active, color]);

  // pointer-move: plane hit + hover marker + glyph preview + live radius
  useEffect(() => {
    if (!active) return;
    const editor = getActiveThreedEditor();
    const dom = editor?.sceneManager?.renderer?.domElement;
    const camera = editor?.sceneManager?.camera;
    if (!dom || !camera) return;

    const ndc = new Vector2();

    function isHorizontal(baseMapId) {
      const bm = (baseMapsRef.current ?? []).find((b) => b.id === baseMapId);
      return (bm?.orientation ?? "HORIZONTAL") !== "VERTICAL";
    }

    function updateSnapCircle(hit, rect) {
      const circle = snapCircleRef.current;
      if (!circle) return;
      if (!hit?.position) {
        circle.style.display = "none";
        return;
      }
      const projected = hit.position.clone().project(camera);
      if (projected.z < -1 || projected.z > 1) {
        circle.style.display = "none";
        return;
      }
      circle.setAttribute("cx", ((projected.x + 1) / 2) * rect.width);
      circle.setAttribute("cy", ((1 - projected.y) / 2) * rect.height);
      circle.style.display = "block";
    }

    function clearPreview() {
      if (!previewRef.current) return;
      rootRef.current?.remove(previewRef.current);
      disposeObject(previewRef.current);
      previewRef.current = null;
    }

    // Circle through the cursor around the centre, in the plane of the
    // centre's base map (group local frame = base map local metres), plus
    // the diameter through the cursor.
    function updatePreview(hit) {
      const root = rootRef.current;
      clearPreview();
      if (!root || !hit?.position || !centerPoint || !hit.group) return;

      const group = hit.group;
      group.updateWorldMatrix(true, false);
      const cLocal = group.worldToLocal(
        new Vector3(centerPoint.x, centerPoint.y, centerPoint.z)
      );
      const eLocal = group.worldToLocal(hit.position.clone());
      const dx = eLocal.x - cLocal.x;
      const dy = eLocal.y - cLocal.y;
      const r = Math.hypot(dx, dy);
      revolutionAxisDraftThreedRef.radiusM = r;
      if (r < 1e-4) return;

      const mat = new LineMaterial({
        color: colorHex(color),
        linewidth: LINEWIDTH_PREVIEW,
        resolution: getCanvasResolution(editor),
        worldUnits: false,
        transparent: true,
        depthTest: false,
      });
      const z = cLocal.z;
      const circle = [];
      for (let i = 0; i <= CIRCLE_SEGMENTS; i++) {
        const a = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
        const w = group.localToWorld(
          new Vector3(cLocal.x + r * Math.cos(a), cLocal.y + r * Math.sin(a), z)
        );
        circle.push(w.x, w.y, w.z);
      }
      const dA = group.localToWorld(new Vector3(eLocal.x, eLocal.y, z));
      const dB = group.localToWorld(
        new Vector3(cLocal.x - dx, cLocal.y - dy, z)
      );
      const preview = new Group();
      preview.add(buildLine(circle, mat));
      preview.add(buildLine([dA.x, dA.y, dA.z, dB.x, dB.y, dB.z], mat));
      root.add(preview);
      previewRef.current = preview;
    }

    function onPointerMove(e) {
      const rect = dom.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      // Second click stays on the centre's plane; the first prefers the 2D
      // main base map among stacked (coplanar) planes.
      let hit = intersectBaseMapPlane(
        editor,
        ndc,
        camera,
        centerPoint
          ? { onlyBaseMapId: centerPoint.baseMapId }
          : { preferredBaseMapId: mainBaseMapId }
      );
      // An axis is authored on a plan: vertical base maps are not targets.
      if (hit && !isHorizontal(hit.baseMapId)) hit = null;
      setLastRevolutionAxisHit(hit);
      updateSnapCircle(hit, rect);
      updatePreview(hit);
      editor.sceneManager.renderScene?.();
    }

    function onPointerLeave() {
      setLastRevolutionAxisHit(null);
      if (snapCircleRef.current) snapCircleRef.current.style.display = "none";
      clearPreview();
      editor.sceneManager.renderScene?.();
    }

    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerleave", onPointerLeave);
    return () => {
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [active, centerPoint, mainBaseMapId, color]);

  if (!active) return null;
  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      <circle
        ref={snapCircleRef}
        r={SNAP_CIRCLE_RADIUS_PX}
        strokeWidth={SNAP_CIRCLE_STROKE_PX}
        stroke={color}
        fill="none"
        style={{ display: "none" }}
      />
    </svg>
  );
}
