import { useEffect, useRef } from "react";

import { useSelector } from "react-redux";
import { Group, Vector2, Vector3 } from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { selectSelectedItems } from "Features/selection/selectionSlice";

import useDimensions3d from "../hooks/useDimensions3d";
import createDimensionLabelSprite from "../services/createDimensionLabelSprite";
import { setDimensionObjects } from "../services/dimensionObjectsStore";
import formatCoteLength from "../utils/formatCoteLength";
import { DEFAULT_COTE_COLOR } from "../utils/coteConstants";

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

// Renders persistent 3D dimensions ("cotes") read from db.dimensions3d for the
// current project + scope. Each cote = a screen-space-thick Line2 trait + a
// clickable label Sprite at the midpoint. Sprites are published to
// dimensionObjectsStore so MainThreedEditor's click handler can pick them.
export default function ThreedDimensions() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  const cotes = useDimensions3d({ projectId, scopeId });

  // Id of the currently-selected cote (to highlight it). Read as a primitive so
  // the effect only re-runs when the selected cote actually changes.
  const selectedCoteId = useSelector((s) => {
    const items = selectSelectedItems(s);
    if (items.length !== 1) return null;
    const it = items[0];
    return it?.type === "NODE" && it?.nodeType === "DIMENSION"
      ? it.nodeId
      : null;
  });

  const rootRef = useRef(null);

  // mount / unmount root group
  useEffect(() => {
    const editor = getActiveThreedEditor();
    const scene = editor?.sceneManager?.scene;
    if (!scene) return;

    const root = new Group();
    root.name = "ThreedDimensions";
    scene.add(root);
    rootRef.current = root;

    return () => {
      scene.remove(root);
      disposeObject(root);
      rootRef.current = null;
      setDimensionObjects([]);
      editor.sceneManager.renderScene?.();
    };
  }, []);

  // rebuild children on data / selection change
  useEffect(() => {
    const editor = getActiveThreedEditor();
    const root = rootRef.current;
    if (!editor || !root) return;

    // Clear previous objects.
    while (root.children.length) {
      const child = root.children[0];
      root.remove(child);
      disposeObject(child);
    }

    const sprites = [];
    const resolution = getCanvasResolution(editor);

    (cotes || []).forEach((cote) => {
      if (!cote?.a || !cote?.b) return;
      const isSelected = cote.id === selectedCoteId;
      const color = cote.color || DEFAULT_COTE_COLOR;

      // Trait line.
      const mat = new LineMaterial({
        color,
        linewidth: isSelected ? LINEWIDTH_SELECTED : LINEWIDTH,
        resolution,
        worldUnits: false,
        transparent: true,
        depthTest: false,
      });
      const geom = new LineGeometry();
      geom.setPositions([
        cote.a.x,
        cote.a.y,
        cote.a.z,
        cote.b.x,
        cote.b.y,
        cote.b.z,
      ]);
      const line = new Line2(geom, mat);
      line.computeLineDistances();
      line.renderOrder = 1001;
      root.add(line);

      // Label sprite at the midpoint.
      const sprite = createDimensionLabelSprite({
        text: formatCoteLength({
          meters: cote.length,
          unit: cote.unit,
          decimals: cote.decimals,
        }),
        coteId: cote.id,
        color,
        selected: isSelected,
      });
      const mid = new Vector3(
        (cote.a.x + cote.b.x) / 2,
        (cote.a.y + cote.b.y) / 2,
        (cote.a.z + cote.b.z) / 2
      );
      sprite.position.copy(mid);
      root.add(sprite);
      sprites.push(sprite);
    });

    setDimensionObjects(sprites);
    editor.sceneManager.renderScene?.();
  }, [cotes, selectedCoteId]);

  return null;
}
