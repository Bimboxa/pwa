import {
  CanvasTexture,
  Group,
  LinearFilter,
  Plane,
  Raycaster,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

import splitMesh3dService from "./splitMesh3dService";
import { setMeshingOverlay } from "./meshingOverlayStore";
import computePlaneBasis from "../utils/computePlaneBasis";
import {
  projectPointTo2d,
  projectLoopTo2d,
  liftPointTo3d,
} from "../utils/planeProjection";
import splitFacePolygon from "../utils/splitFacePolygon";
import pointInPolygon2d from "../utils/pointInPolygon2d";
import { polygonCentroid2d } from "../utils/computeFaceArea";
import formatSurfaceM2 from "../utils/formatSurfaceM2";
import { MESH3D_SNAP_PX } from "../utils/mesh3dConstants";

const CUT_COLOR = 0xd32f2f;
const LINEWIDTH = 2.5;
const LINEWIDTH_SNAPPED = 4.5;
// Draft geometry is drawn slightly off the face plane (the maille shell is
// already 5 mm thick) so the red line never z-fights with the shell.
const DRAFT_LIFT_M = 0.012;
const RING_SCREEN_SIZE = 0.028;

// Red ring marker (reference / guide vertex), constant on-screen size.
function createRingSprite() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.strokeStyle = "#d32f2f";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 6, 0, 2 * Math.PI);
  ctx.stroke();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;

  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: false,
  });
  const sprite = new Sprite(material);
  sprite.scale.set(RING_SCREEN_SIZE, RING_SCREEN_SIZE, 1);
  sprite.renderOrder = 1004;
  sprite.raycast = () => {};
  sprite.userData.dispose = () => {
    texture.dispose();
    material.dispose();
  };
  return sprite;
}

// Cut-tools machinery of the 3D meshing mode. One controller instance lives
// per meshing-mode activation (created by useMeshingPointerHandlers): it owns
// a draft Group in the scene (red cut line + vertex rings) and the DOM chips
// (areas, offset), and commits splits through splitMesh3dService.
export function createMeshingCutController({
  editor,
  sceneManager,
  dom,
  getTool,
  getOffset,
  getCutSide,
  getMesh3dById,
  getAllMeshes3d,
}) {
  let draftGroup = null;
  const planeRaycaster = new Raycaster();

  // Last valid axis-cut hover: everything needed to commit on click.
  let hoverCut = null;

  // Free-cut state: first committed edge point.
  // { world:{x,y,z}, candidates:[{mesh3dId, faceIndex}] }
  let firstPoint = null;
  // Last snapped edge point under the cursor (free cut).
  let freeSnap = null;
  // Last crossed candidate while dragging the free segment.
  let freeCrossed = null;

  // --- three helpers -------------------------------------------------------

  function ensureDraftGroup() {
    if (draftGroup) return draftGroup;
    draftGroup = new Group();
    draftGroup.name = "MeshingDraft";
    sceneManager.scene.add(draftGroup);
    return draftGroup;
  }

  function clearDraft() {
    if (!draftGroup) return;
    while (draftGroup.children.length) {
      const child = draftGroup.children[0];
      draftGroup.remove(child);
      child.userData?.dispose?.();
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    }
  }

  function renderScene() {
    editor.renderScene?.();
  }

  function getResolution() {
    return new Vector2(dom.clientWidth, dom.clientHeight);
  }

  function drawSegment(p1, p2, { snapped = false } = {}) {
    const material = new LineMaterial({
      color: CUT_COLOR,
      linewidth: snapped ? LINEWIDTH_SNAPPED : LINEWIDTH,
      resolution: getResolution(),
      worldUnits: false,
      transparent: true,
      depthTest: false,
    });
    const geometry = new LineGeometry();
    geometry.setPositions([p1.x, p1.y, p1.z, p2.x, p2.y, p2.z]);
    const line = new Line2(geometry, material);
    line.computeLineDistances();
    line.renderOrder = 1002;
    line.raycast = () => {};
    ensureDraftGroup().add(line);
  }

  function drawRing(p) {
    const ring = createRingSprite();
    ring.position.set(p.x, p.y, p.z);
    ensureDraftGroup().add(ring);
  }

  function worldToScreen(p, rect) {
    const v = new Vector3(p.x, p.y, p.z).project(sceneManager.camera);
    return {
      x: ((v.x + 1) / 2) * rect.width,
      y: ((1 - v.y) / 2) * rect.height,
    };
  }

  function screenDist(pA, pB, rect) {
    const a = worldToScreen(pA, rect);
    const b = worldToScreen(pB, rect);
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  // --- face context --------------------------------------------------------

  function getFaceContext(mesh3dId, faceIndex) {
    const mesh3d = getMesh3dById(mesh3dId);
    const face = mesh3d?.faces?.[faceIndex];
    if (!face || face.contour.length < 3) return null;
    const basis = computePlaneBasis(face.normal, face.contour[0]);
    return {
      mesh3d,
      face,
      faceIndex,
      basis,
      contour2d: projectLoopTo2d(face.contour, basis),
      holes2d: (face.holes || []).map((hole) => projectLoopTo2d(hole, basis)),
    };
  }

  // Lift a 2D plane point off the face by DRAFT_LIFT_M along the normal.
  function liftDraft(p2, ctx) {
    const p = liftPointTo3d(p2, ctx.basis);
    const n = ctx.basis.n;
    return {
      x: p.x + n.x * DRAFT_LIFT_M,
      y: p.y + n.y * DRAFT_LIFT_M,
      z: p.z + n.z * DRAFT_LIFT_M,
    };
  }

  function resetHover() {
    hoverCut = null;
    freeSnap = null;
    freeCrossed = null;
    clearDraft();
    setMeshingOverlay({ areaChips: [], offsetChip: null, cursor: null });
    renderScene();
  }

  // --- axis cuts (CUT_VERTICAL / CUT_HORIZONTAL) ---------------------------

  // axis = "x": vertical tool (cut line at constant u, running along v).
  // axis = "y": horizontal tool.
  function onHoverAxisCut(e, pick, axis) {
    if (pick?.kind !== "MESH3D") {
      resetHover();
      return;
    }
    const ctx = getFaceContext(pick.mesh3dId, pick.faceIndex);
    if (!ctx) {
      resetHover();
      return;
    }
    const rect = pick.rect;
    const other = axis === "x" ? "y" : "x";
    const hitPoint = pick.intersect.point;
    const hit2d = projectPointTo2d(
      { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z },
      ctx.basis
    );

    // Reference vertex: the near-side (mouse proximity along `other`) corner,
    // on the min side of `axis` by default ("LEFT"), flipped with S.
    const others = ctx.contour2d.map((p) => p[other]);
    const midOther = (Math.min(...others) + Math.max(...others)) / 2;
    const nearSet = ctx.contour2d.filter((p) =>
      hit2d[other] < midOther ? p[other] < midOther : p[other] >= midOther
    );
    const candidates = nearSet.length ? nearSet : ctx.contour2d;
    const side = getCutSide();
    const ref = candidates.reduce((best, p) => {
      if (!best) return p;
      if (side === "LEFT") return p[axis] < best[axis] ? p : best;
      return p[axis] > best[axis] ? p : best;
    }, null);

    // Guide vertex at "Décalage" from the reference, toward the polygon.
    const offset = getOffset();
    const dir = side === "LEFT" ? 1 : -1;
    const guide =
      offset > 0 ? { ...ref, [axis]: ref[axis] + dir * offset } : null;

    // Cut position, snapped to the guide vertex when close on screen.
    let cutPos = hit2d[axis];
    let snapped = false;
    if (guide) {
      const pCut = liftPointTo3d({ ...hit2d, [axis]: cutPos }, ctx.basis);
      const pGuide = liftPointTo3d(
        { ...hit2d, [axis]: guide[axis] },
        ctx.basis
      );
      if (screenDist(pCut, pGuide, rect) < MESH3D_SNAP_PX) {
        cutPos = guide[axis];
        snapped = true;
      }
    }

    // Clip the cut line to the contour.
    const ts = [];
    const n = ctx.contour2d.length;
    for (let i = 0; i < n; i++) {
      const p = ctx.contour2d[i];
      const q = ctx.contour2d[(i + 1) % n];
      const d = q[axis] - p[axis];
      if (Math.abs(d) < 1e-12) continue;
      const t = (cutPos - p[axis]) / d;
      if (t >= 0 && t <= 1) ts.push(p[other] + t * (q[other] - p[other]));
    }
    if (ts.length < 2) {
      resetHover();
      return;
    }
    const a2 = { [axis]: cutPos, [other]: Math.min(...ts) };
    const b2 = { [axis]: cutPos, [other]: Math.max(...ts) };

    // Would-be pieces → area chips at their centroids.
    const pieces = splitFacePolygon({
      contour: ctx.contour2d,
      holes: ctx.holes2d,
      a: a2,
      b: b2,
    });
    const areaChips = (pieces || []).map((piece) => {
      const c = worldToScreen(
        liftPointTo3d(polygonCentroid2d(piece.contour), ctx.basis),
        rect
      );
      return { x: c.x, y: c.y, text: formatSurfaceM2(piece.area) };
    });

    const offsetChip = guide
      ? (() => {
          const mid = worldToScreen(
            liftPointTo3d(
              {
                x: (ref.x + guide.x) / 2,
                y: (ref.y + guide.y) / 2,
              },
              ctx.basis
            ),
            rect
          );
          return {
            x: mid.x,
            y: mid.y + 18,
            text: `${offset.toLocaleString("fr-FR")}m`,
          };
        })()
      : null;

    clearDraft();
    drawSegment(liftDraft(a2, ctx), liftDraft(b2, ctx), { snapped });
    drawRing(liftDraft(ref, ctx));
    if (guide) drawRing(liftDraft(guide, ctx));
    setMeshingOverlay({ areaChips, offsetChip, cursor: null });
    renderScene();

    hoverCut = pieces
      ? { mesh3d: ctx.mesh3d, faceIndex: ctx.faceIndex, a: a2, b: b2 }
      : null;
  }

  async function onClickAxisCut() {
    if (!hoverCut) return;
    const committed = hoverCut;
    hoverCut = null;
    try {
      await splitMesh3dService({
        mesh3d: committed.mesh3d,
        faceIndex: committed.faceIndex,
        a: committed.a,
        b: committed.b,
      });
    } catch (err) {
      console.error("[threedMesh] split failed", err);
    }
    clearDraft();
    setMeshingOverlay({ areaChips: [], offsetChip: null });
    renderScene();
  }

  // --- free cut (CUT_FREE) --------------------------------------------------

  // Nearest maille contour-edge point to the cursor (screen space). Also
  // collects every (mesh3d, face) with an edge within the snap radius — at a
  // shared edge/corner the cut maille is resolved by the SECOND click (the
  // one whose polygon the final segment crosses).
  function findEdgeSnap(e, rect) {
    const cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    let best = null;
    const candidates = [];

    for (const mesh3d of getAllMeshes3d()) {
      (mesh3d.faces || []).forEach((face, faceIndex) => {
        if (!face?.contour || face.contour.length < 3) return;
        const nPts = face.contour.length;
        let faceBest = null;
        for (let i = 0; i < nPts; i++) {
          const p3 = face.contour[i];
          const q3 = face.contour[(i + 1) % nPts];
          const p = worldToScreen(p3, rect);
          const q = worldToScreen(q3, rect);
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const lenSq = dx * dx + dy * dy;
          if (lenSq === 0) continue;
          let t = ((cursor.x - p.x) * dx + (cursor.y - p.y) * dy) / lenSq;
          t = Math.max(0, Math.min(1, t));
          const sx = p.x + t * dx;
          const sy = p.y + t * dy;
          const dist = Math.hypot(cursor.x - sx, cursor.y - sy);
          if (dist > MESH3D_SNAP_PX) continue;
          const world = {
            x: p3.x + t * (q3.x - p3.x),
            y: p3.y + t * (q3.y - p3.y),
            z: p3.z + t * (q3.z - p3.z),
          };
          const hit = { dist, world, mesh3dId: mesh3d.id, faceIndex };
          if (!faceBest || dist < faceBest.dist) faceBest = hit;
          if (!best || dist < best.dist) best = hit;
        }
        if (faceBest) {
          candidates.push({ mesh3dId: mesh3d.id, faceIndex });
        }
      });
    }
    return best ? { ...best, candidates } : null;
  }

  // Among the first-click candidates, the maille actually cut by the segment
  // (endpoints in its face plane, midpoint strictly inside the polygon).
  function findCrossedCandidate(aWorld, bWorld, candidates) {
    for (const candidate of candidates || []) {
      const ctx = getFaceContext(candidate.mesh3dId, candidate.faceIndex);
      if (!ctx) continue;
      const a2 = projectPointTo2d(aWorld, ctx.basis);
      const b2 = projectPointTo2d(bWorld, ctx.basis);
      const mid = { x: (a2.x + b2.x) / 2, y: (a2.y + b2.y) / 2 };
      if (!pointInPolygon2d(mid, ctx.contour2d)) continue;
      if (ctx.holes2d.some((hole) => pointInPolygon2d(mid, hole))) continue;
      return { ctx, a2, b2 };
    }
    return null;
  }

  function onHoverFreeCut(e, pick) {
    const rect =
      pick?.rect ||
      (() => {
        const r = dom.getBoundingClientRect();
        return r.width && r.height ? r : null;
      })();
    if (!rect) return;

    freeSnap = findEdgeSnap(e, rect);
    freeCrossed = null;

    clearDraft();
    const areaChips = [];

    if (freeSnap) drawRing(freeSnap.world);

    if (firstPoint) {
      // Moving endpoint: the snapped edge point, else the cursor projected on
      // the plane of the first candidate face (pure visual feedback).
      let endWorld = freeSnap?.world || null;
      if (!endWorld) {
        const ctx0 = getFaceContext(
          firstPoint.candidates[0]?.mesh3dId,
          firstPoint.candidates[0]?.faceIndex
        );
        if (ctx0) {
          const plane = new Plane().setFromNormalAndCoplanarPoint(
            new Vector3(ctx0.basis.n.x, ctx0.basis.n.y, ctx0.basis.n.z),
            new Vector3(
              ctx0.basis.origin.x,
              ctx0.basis.origin.y,
              ctx0.basis.origin.z
            )
          );
          const ndc = new Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
          );
          const target = new Vector3();
          planeRaycaster.setFromCamera(ndc, sceneManager.camera);
          if (planeRaycaster.ray.intersectPlane(plane, target)) {
            endWorld = { x: target.x, y: target.y, z: target.z };
          }
        }
      }

      if (endWorld) {
        const snapped = !!freeSnap;
        drawSegment(firstPoint.world, endWorld, { snapped });

        if (freeSnap) {
          const crossed = findCrossedCandidate(
            firstPoint.world,
            endWorld,
            firstPoint.candidates
          );
          if (crossed) {
            freeCrossed = crossed;
            const pieces = splitFacePolygon({
              contour: crossed.ctx.contour2d,
              holes: crossed.ctx.holes2d,
              a: crossed.a2,
              b: crossed.b2,
              clampToSegment: true,
            });
            (pieces || []).forEach((piece) => {
              const c = worldToScreen(
                liftPointTo3d(
                  polygonCentroid2d(piece.contour),
                  crossed.ctx.basis
                ),
                rect
              );
              areaChips.push({
                x: c.x,
                y: c.y,
                text: formatSurfaceM2(piece.area),
              });
            });
          }
        }
      }
    }

    setMeshingOverlay({ areaChips, offsetChip: null, cursor: null });
    renderScene();
  }

  async function onClickFreeCut() {
    if (!freeSnap) return;

    if (!firstPoint) {
      firstPoint = {
        world: freeSnap.world,
        candidates: freeSnap.candidates,
      };
      return;
    }

    if (!freeCrossed) return;
    const { ctx, a2, b2 } = freeCrossed;
    firstPoint = null;
    freeSnap = null;
    freeCrossed = null;
    try {
      await splitMesh3dService({
        mesh3d: ctx.mesh3d,
        faceIndex: ctx.faceIndex,
        a: a2,
        b: b2,
        clampToSegment: true,
      });
    } catch (err) {
      console.error("[threedMesh] free split failed", err);
    }
    clearDraft();
    setMeshingOverlay({ areaChips: [], offsetChip: null });
    renderScene();
  }

  // --- public API -----------------------------------------------------------

  return {
    onHover(e, pick) {
      const tool = getTool();
      if (tool === "CUT_VERTICAL") onHoverAxisCut(e, pick, "x");
      else if (tool === "CUT_HORIZONTAL") onHoverAxisCut(e, pick, "y");
      else if (tool === "CUT_FREE") onHoverFreeCut(e, pick);
    },
    onClick() {
      const tool = getTool();
      if (tool === "CUT_VERTICAL" || tool === "CUT_HORIZONTAL") {
        onClickAxisCut();
      } else if (tool === "CUT_FREE") {
        onClickFreeCut();
      }
    },
    onLeave() {
      resetHover();
    },
    onEscape() {
      firstPoint = null;
      resetHover();
    },
    dispose() {
      resetHover();
      if (draftGroup) {
        sceneManager.scene.remove(draftGroup);
        draftGroup = null;
      }
    },
  };
}
