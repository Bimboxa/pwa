import { Vector2, Vector3 } from "three";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

import quantizeVertex from "Features/threedDrawing/utils/quantizeVertex";
import {
  clearSectionContourAdjacency,
  setSectionContourAdjacency,
} from "Features/threedDimensions/services/sectionContourSnapStore";

import computePlaneSectionSegments from "./utilsClipping/computePlaneSectionSegments";

const CONTOUR_COLOR = 0xffaa00; // matches the orange clipping-plane helper
const CONTOUR_LINEWIDTH = 2.5; // px (screen-space)

// Draws the contour where the clipping plane cuts the annotation shapes, and
// publishes that contour's vertex/edge adjacency to the dimension snap store
// so the "cote" tool can snap onto the cut.
//
// Lives on the three.js side and is driven by ClippingManager:
//   - subscribes to ClippingManager._notify (plane drag / axis / flip /
//     distance / reset) → update()
//   - ClippingManager.setEnabled / reapply call setEnabled / update directly
// The contour line itself carries clippingPlanes = null so it is never sliced
// by its own plane.
export default class SectionContourManager {
  constructor({ sceneManager }) {
    this.sceneManager = sceneManager;
    this.enabled = false;
    this.line = null;
    this.geometry = null;
    this.material = null;
    this._unsubscribe = null;
  }

  init() {
    if (this.line) return;

    this.geometry = new LineSegmentsGeometry();
    this.material = new LineMaterial({
      color: CONTOUR_COLOR,
      linewidth: CONTOUR_LINEWIDTH,
      resolution: this._resolution(),
      worldUnits: false,
      transparent: true,
      // Draw the whole section outline on top, like an X-ray. The contour lies
      // ON the cut plane, so on curved/closed shapes large parts of it fall
      // BEHIND nearer faces of the very same mesh; with depth testing those
      // parts get culled and only the silhouette edge survives (the bug: a flat
      // wall's contour shows, a revolution/extrusion's mostly disappears).
      // depthTest:false + a high renderOrder keeps the full imprint visible.
      depthTest: false,
    });

    this.line = new LineSegments2(this.geometry, this.material);
    this.line.userData.isSectionContour = true; // skip material walks / exports
    this.line.renderOrder = 1000;
    this.line.visible = false;
    this.line.frustumCulled = false;
    this.sceneManager.scene.add(this.line);

    const clippingManager = this.sceneManager.clippingManager;
    if (clippingManager?.subscribe) {
      this._unsubscribe = clippingManager.subscribe(() => this.update());
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.line) this.line.visible = enabled;
    if (enabled) {
      this.update();
    } else {
      clearSectionContourAdjacency();
      this.sceneManager.renderScene();
    }
  }

  // Recompute the section against the current plane + meshes, refresh the line
  // geometry, and republish the snap adjacency. No-op while disabled.
  update() {
    if (!this.enabled || !this.line) return;
    const clippingManager = this.sceneManager.clippingManager;
    const plane = clippingManager?.plane;
    if (!plane) return;

    const meshes = this._collectAnnotationMeshes();
    const { positions, segments } = computePlaneSectionSegments(plane, meshes);

    // Opt-in diagnostic: `window.__DEBUG_SECTION__ = true` then move the plane.
    // Logs each scanned mesh and how many section segments it contributed, so a
    // missing contour part shows up as either a missing mesh (collection bug) or
    // a present mesh yielding 0 segments (geometry/topology bug).
    if (typeof window !== "undefined" && window.__DEBUG_SECTION__) {
      const perMesh = meshes.map((m) => ({
        name: m.name || m.parent?.userData?.annotationType || m.type,
        tris: m.geometry?.index
          ? m.geometry.index.count / 3
          : (m.geometry?.attributes?.position?.count ?? 0) / 3,
        segs: computePlaneSectionSegments(plane, [m]).segments.length,
      }));
      console.log(
        `[SectionContour] meshes=${meshes.length} totalSegments=${segments.length}`,
        perMesh
      );
    }

    if (positions.length > 0) {
      this.geometry.setPositions(positions);
      this.line.computeLineDistances();
      this.line.visible = true;
    } else {
      this.line.visible = false;
    }
    this.material.resolution.copy(this._resolution());

    setSectionContourAdjacency(buildContourAdjacency(segments));
    this.sceneManager.renderScene();
  }

  // Keep the screen-space line crisp after a canvas resize.
  onResize() {
    if (!this.material) return;
    this.material.resolution.copy(this._resolution());
  }

  dispose() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    if (this.line) {
      this.sceneManager.scene.remove(this.line);
    }
    this.geometry?.dispose?.();
    this.material?.dispose?.();
    this.line = null;
    this.geometry = null;
    this.material = null;
    clearSectionContourAdjacency();
  }

  ///////////   INTERNAL   ///////////

  _resolution() {
    const dom = this.sceneManager.renderer?.domElement;
    if (!dom) return new Vector2(1, 1);
    return new Vector2(dom.clientWidth || 1, dom.clientHeight || 1);
  }

  // Every renderable Mesh of every annotation object (a single annotation can
  // hold several meshes: multi-segment POLYLINE walls, REVOLUTION runs, …).
  // Basemap image planes are intentionally excluded — slicing the flat image
  // yields a meaningless line, not a shape contour.
  _collectAnnotationMeshes() {
    const meshes = [];
    const map =
      this.sceneManager.annotationsManager?.annotationsObjectsMap || {};
    Object.values(map).forEach((object) => {
      object?.traverse?.((child) => {
        if (child.isMesh && child.geometry) meshes.push(child);
      });
    });
    return meshes;
  }
}

// Build a Map<key,{position,neighbors}> from contour segments, quantizing
// endpoints so coincident segment ends (the common case along a contour)
// collapse onto the same node — same key scheme as the mesh snap graph.
function buildContourAdjacency(segments) {
  const adjacency = new Map();
  if (!segments || segments.length === 0) return adjacency;

  const ensureNode = (key, position) => {
    let entry = adjacency.get(key);
    if (!entry) {
      entry = { position: new Vector3(position.x, position.y, position.z), neighbors: new Set() };
      adjacency.set(key, entry);
    }
    return entry;
  };

  for (const { a, b } of segments) {
    const ka = quantizeVertex(a);
    const kb = quantizeVertex(b);
    if (ka === kb) continue;
    ensureNode(ka, a).neighbors.add(kb);
    ensureNode(kb, b).neighbors.add(ka);
  }
  return adjacency;
}
