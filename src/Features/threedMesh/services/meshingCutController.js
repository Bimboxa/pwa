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
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";

import splitMesh3dService from "./splitMesh3dService";
import { setMeshingOverlay } from "./meshingOverlayStore";
import computePlaneBasis from "../utils/computePlaneBasis";
import cutShellByPlane from "../utils/cutShellByPlane";
import getShellCentroid from "../utils/getShellCentroid";
import {
  projectPointTo2d,
  projectLoopTo2d,
  liftPointTo3d,
} from "../utils/planeProjection";
import splitFacePolygon from "../utils/splitFacePolygon";
import pointInPolygon2d from "../utils/pointInPolygon2d";
import getAngularCutPath, {
  getAngularCutLine,
  supportsAngularCut,
} from "../utils/getAngularCutPath";
import { polygonCentroid2d } from "../utils/computeFaceArea";
import formatSurfaceM2 from "../utils/formatSurfaceM2";
import { MESH3D_SNAP_PX } from "../utils/mesh3dConstants";

const CUT_COLOR = 0xd32f2f;
const LINEWIDTH = 2.5;
const LINEWIDTH_SNAPPED = 4.5;
// Offset guide on a shell: a hairline dotted contour, dash length in meters.
const GUIDE_LINEWIDTH = 1;
const GUIDE_DASH_M = 0.03;
// Draft geometry is drawn slightly off the face plane so the red line never
// z-fights with the maille surface (which sits 1 mm off the source face).
const DRAFT_LIFT_M = 0.012;
const RING_SCREEN_SIZE = 0.028;

// Red marker with a constant on-screen size: "RING" for the reference /
// guide vertices, "SQUARE" for the mid-edge snap point.
function createMarkerSprite(shape = "RING") {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.strokeStyle = "#d32f2f";
  ctx.lineWidth = 7;
  ctx.beginPath();
  if (shape === "SQUARE") {
    ctx.rect(8, 8, size - 16, size - 16);
  } else {
    ctx.arc(size / 2, size / 2, size / 2 - 6, 0, 2 * Math.PI);
  }
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
  getAngleDeg,
  clearAngleBuffer,
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
  // Last snapped edge point under the cursor (free cut / polyline cut).
  let freeSnap = null;
  // Last crossed candidate while dragging the free segment.
  let freeCrossed = null;

  // Polyline-cut state: committed points (world coords), the candidate faces
  // of the starting boundary point, the current cursor endpoint and the
  // resolved commit context (set on hover when ending on a boundary point
  // actually splits a candidate face).
  let polyPoints = [];
  let polyCandidates = null;
  let polyEndWorld = null;
  let polyCommit = null;

  // Angular-cut state: A (reference extremity, on a maille face), O (angle
  // vertex, in the horizontal plane of A) and the resolved commit context set
  // on hover once the V path actually splits the face.
  // angA: { world, mesh3dId, faceIndex }, angO: { world }
  let angA = null;
  let angO = null;
  let angHoverA = null;
  let angCommit = null;

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

  // Same red line as drawSegment, but for the many short segments of a shell
  // cut (plane ∩ shell): one LineSegments2 instead of N Line2 objects, which
  // would allocate a material + geometry per facet on every hover frame.
  //
  // `dashed`: thin dotted variant used for the offset guide — on a faceted
  // shell the guide is a whole contour around the mesh, where a single marker
  // point would be unreadable.
  function drawSegments(segments, { snapped = false, dashed = false } = {}) {
    if (!segments?.length) return;
    const positions = [];
    for (const [p, q] of segments) {
      positions.push(p.x, p.y, p.z, q.x, q.y, q.z);
    }
    const material = new LineMaterial({
      color: CUT_COLOR,
      linewidth: dashed
        ? GUIDE_LINEWIDTH
        : snapped
          ? LINEWIDTH_SNAPPED
          : LINEWIDTH,
      resolution: getResolution(),
      worldUnits: false,
      transparent: true,
      depthTest: false,
      dashed,
      dashSize: GUIDE_DASH_M,
      gapSize: GUIDE_DASH_M,
    });
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(positions);
    const lines = new LineSegments2(geometry, material);
    // Dashes are laid out along the accumulated distance, so the pattern runs
    // continuously around the contour instead of restarting per facet.
    if (dashed) lines.computeLineDistances();
    lines.renderOrder = 1002;
    lines.raycast = () => {};
    ensureDraftGroup().add(lines);
  }

  function drawRing(p) {
    const ring = createMarkerSprite("RING");
    ring.position.set(p.x, p.y, p.z);
    ensureDraftGroup().add(ring);
  }

  function drawSquare(p) {
    const square = createMarkerSprite("SQUARE");
    square.position.set(p.x, p.y, p.z);
    ensureDraftGroup().add(square);
  }

  // 2D point-to-segment distance (plane coords).
  function distToSegment2d(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
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
    polyEndWorld = null;
    polyCommit = null;
    angHoverA = null;
    angCommit = null;
    clearDraft();
    setMeshingOverlay({
      areaChips: [],
      offsetChip: null,
      angleChip: null,
      cursor: null,
    });
    renderScene();
  }

  function resetPolyline() {
    polyPoints = [];
    polyCandidates = null;
    polyEndWorld = null;
    polyCommit = null;
  }

  function resetAngular() {
    angA = null;
    angO = null;
    angHoverA = null;
    angCommit = null;
    clearAngleBuffer?.();
  }

  // --- shell axis cuts (curved mailles) ------------------------------------

  // Cut plane of a curved maille, in WORLD space:
  // - horizontal tool: the plane normal is world up (+Y).
  // - vertical tool: a vertical plane holding the camera→hit axis — a knife
  //   held facing you. Its normal is horizontal and perpendicular to the line
  //   of sight (up × viewDir), so it never depends on the shell's own shape
  //   (a swept profile has no revolution axis to key off).
  function getShellCutNormal(hit, axis) {
    if (axis === "y") return { x: 0, y: 1, z: 0 };
    const cam = sceneManager.camera.position;
    const dx = hit.x - cam.x;
    const dz = hit.z - cam.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) return null; // looking straight down: no horizontal axis
    return { x: dz / len, y: 0, z: -dx / len };
  }

  const planeDist = (n, p) => n.x * p.x + n.y * p.y + n.z * p.z;

  // Lift a world point toward the camera so the red line never z-fights with
  // the maille surface it runs on.
  function liftToCamera(p) {
    const cam = sceneManager.camera.position;
    const d = new Vector3(cam.x - p.x, cam.y - p.y, cam.z - p.z);
    const len = d.length();
    if (len === 0) return { ...p };
    d.multiplyScalar(DRAFT_LIFT_M / len);
    return { x: p.x + d.x, y: p.y + d.y, z: p.z + d.z };
  }

  function onHoverShellCut(e, pick, mesh3d, axis) {
    const hit = pick.intersect.point;
    const normal = getShellCutNormal(hit, axis);
    if (!normal) {
      resetHover();
      return;
    }
    const rect = pick.rect;

    // Reference = the shell boundary vertex furthest along the cut axis, on
    // the cursor's side (flipped by S / cutSide); "Décalage" then moves the
    // plane inwards from it. Offset 0 → plane through the hovered point.
    const boundaryPoints = (mesh3d.shell.boundaries || []).flat();
    if (boundaryPoints.length < 2) {
      resetHover();
      return;
    }
    const side = getCutSide();
    const dir = side === "LEFT" ? 1 : -1;
    const ref = boundaryPoints.reduce((best, p) =>
      dir * planeDist(normal, p) < dir * planeDist(normal, best) ? p : best
    );

    const offset = getOffset();
    const refDist = planeDist(normal, ref);
    const guideDist = offset > 0 ? refDist + dir * offset : null;

    // Snap the cut to the guide plane when it is within the screen radius.
    let constant = planeDist(normal, hit);
    let snapped = false;
    if (guideDist !== null) {
      const onGuide = {
        x: hit.x + normal.x * (guideDist - constant),
        y: hit.y + normal.y * (guideDist - constant),
        z: hit.z + normal.z * (guideDist - constant),
      };
      if (screenDist(hit, onGuide, rect) < MESH3D_SNAP_PX) {
        constant = guideDist;
        snapped = true;
      }
    }

    const plane = { normal, constant };
    const { positive, negative, segments } = cutShellByPlane({
      positions: mesh3d.shell.positions,
      plane,
    });
    if (!positive || !negative || !segments.length) {
      resetHover();
      return;
    }

    const areaChips = [positive, negative]
      .map((sideShell) => {
        const info = getShellCentroid(sideShell.positions);
        if (!info) return null;
        const c = worldToScreen(info.centroid, rect);
        return { x: c.x, y: c.y, text: formatSurfaceM2(sideShell.surface) };
      })
      .filter(Boolean);

    // The guide is shown as the dotted contour where its plane meets the
    // shell (a marker point on a faceted surface reads as noise); it is
    // dropped once the cut has snapped onto it, since the solid red line then
    // sits exactly there.
    const guideSegments =
      guideDist !== null && !snapped
        ? cutShellByPlane({
            positions: mesh3d.shell.positions,
            plane: { normal, constant: guideDist },
          }).segments
        : [];

    const guidePoint =
      guideDist !== null
        ? {
            x: ref.x + normal.x * (guideDist - refDist),
            y: ref.y + normal.y * (guideDist - refDist),
            z: ref.z + normal.z * (guideDist - refDist),
          }
        : null;
    const offsetChip = guidePoint
      ? (() => {
          const mid = worldToScreen(
            {
              x: (ref.x + guidePoint.x) / 2,
              y: (ref.y + guidePoint.y) / 2,
              z: (ref.z + guidePoint.z) / 2,
            },
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
    drawSegments(
      segments.map(([p, q]) => [liftToCamera(p), liftToCamera(q)]),
      { snapped }
    );
    drawSegments(
      guideSegments.map(([p, q]) => [liftToCamera(p), liftToCamera(q)]),
      { dashed: true }
    );
    setMeshingOverlay({ areaChips, offsetChip, cursor: null });
    renderScene();

    hoverCut = { mesh3d, plane };
  }

  // --- axis cuts (CUT_VERTICAL / CUT_HORIZONTAL) ---------------------------

  // axis = "x": vertical tool (cut line at constant u, running along v).
  // axis = "y": horizontal tool.
  function onHoverAxisCut(e, pick, axis) {
    if (pick?.kind !== "MESH3D") {
      resetHover();
      return;
    }
    const picked = getMesh3dById(pick.mesh3dId);
    if (picked?.shell?.positions?.length) {
      onHoverShellCut(e, pick, picked, axis);
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

    // Mid-edge snap point (square marker): midpoint of the contour edge
    // nearest to the mouse that runs ALONG the cut axis (a horizontal edge
    // for a vertical cut) — cutting through it halves that edge.
    let edgeMid = null;
    let edgeMidDist = Infinity;
    const nPts = ctx.contour2d.length;
    for (let i = 0; i < nPts; i++) {
      const p = ctx.contour2d[i];
      const q = ctx.contour2d[(i + 1) % nPts];
      if (Math.abs(q[axis] - p[axis]) <= Math.abs(q[other] - p[other]))
        continue;
      const dist = distToSegment2d(hit2d, p, q);
      if (dist < edgeMidDist) {
        edgeMidDist = dist;
        edgeMid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
      }
    }

    // Cut position, snapped to the closest on-screen snap target: the guide
    // vertex (ring) or the mid-edge point (square).
    let cutPos = hit2d[axis];
    let snapped = false;
    const snapTargets = [];
    if (guide) snapTargets.push(guide[axis]);
    if (edgeMid) snapTargets.push(edgeMid[axis]);
    let bestSnapDist = MESH3D_SNAP_PX;
    for (const target of snapTargets) {
      const pCut = liftPointTo3d(hit2d, ctx.basis);
      const pTarget = liftPointTo3d({ ...hit2d, [axis]: target }, ctx.basis);
      const dist = screenDist(pCut, pTarget, rect);
      if (dist < bestSnapDist) {
        bestSnapDist = dist;
        cutPos = target;
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
    if (edgeMid) drawSquare(liftDraft(edgeMid, ctx));
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
        plane: committed.plane,
      });
    } catch (err) {
      console.error("[threedMesh] split failed", err);
    }
    clearDraft();
    setMeshingOverlay({ areaChips: [], offsetChip: null });
    renderScene();
  }

  // --- free cut (CUT_FREE) / polyline cut (CUT_POLYLINE) --------------------

  // Nearest maille boundary point to the cursor (screen space), scanning the
  // contour AND the hole (opening) loops of every face; a loop vertex within
  // the snap radius wins over a plain edge point. Also collects every
  // (mesh3d, face) with a boundary within the snap radius — at a shared
  // edge/corner the cut maille is resolved by the LAST click (the one whose
  // polygon the built path crosses).
  function findEdgeSnap(e, rect) {
    const cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    let bestEdge = null;
    let bestVertex = null;
    const candidates = [];

    for (const mesh3d of getAllMeshes3d()) {
      (mesh3d.faces || []).forEach((face, faceIndex) => {
        if (!face?.contour || face.contour.length < 3) return;
        const loops = [
          face.contour,
          ...(face.holes || []).filter((hole) => hole?.length >= 3),
        ];
        let faceHit = false;
        for (const loop of loops) {
          const nPts = loop.length;
          for (let i = 0; i < nPts; i++) {
            const p3 = loop[i];
            const q3 = loop[(i + 1) % nPts];
            const p = worldToScreen(p3, rect);
            const q = worldToScreen(q3, rect);

            const vDist = Math.hypot(cursor.x - p.x, cursor.y - p.y);
            if (vDist <= MESH3D_SNAP_PX) {
              faceHit = true;
              if (!bestVertex || vDist < bestVertex.dist) {
                bestVertex = {
                  dist: vDist,
                  world: { x: p3.x, y: p3.y, z: p3.z },
                  mesh3dId: mesh3d.id,
                  faceIndex,
                };
              }
            }

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
            faceHit = true;
            const world = {
              x: p3.x + t * (q3.x - p3.x),
              y: p3.y + t * (q3.y - p3.y),
              z: p3.z + t * (q3.z - p3.z),
            };
            const hit = { dist, world, mesh3dId: mesh3d.id, faceIndex };
            if (!bestEdge || dist < bestEdge.dist) bestEdge = hit;
          }
        }
        if (faceHit) {
          candidates.push({ mesh3dId: mesh3d.id, faceIndex });
        }
      });
    }
    const best = bestVertex || bestEdge;
    return best ? { ...best, candidates } : null;
  }

  // Among the first-click candidates, the maille actually cut by the path
  // (world points): all points projected in its face plane, with at least one
  // segment midpoint strictly inside the polygon (holes excluded).
  function findCrossedCandidate(worldPoints, candidates) {
    for (const candidate of candidates || []) {
      const ctx = getFaceContext(candidate.mesh3dId, candidate.faceIndex);
      if (!ctx) continue;
      const path2d = worldPoints.map((w) => projectPointTo2d(w, ctx.basis));
      const crossesFace = path2d.some((p, i) => {
        if (i === 0) return false;
        const q = path2d[i - 1];
        const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
        if (!pointInPolygon2d(mid, ctx.contour2d)) return false;
        return !ctx.holes2d.some((hole) => pointInPolygon2d(mid, hole));
      });
      if (!crossesFace) continue;
      return { ctx, path2d };
    }
    return null;
  }

  // Cursor projected on the face plane of the first path candidate (pure
  // visual feedback / intermediate polyline points).
  function projectCursorToCandidatePlane(e, rect, candidates) {
    const ctx0 = getFaceContext(
      candidates?.[0]?.mesh3dId,
      candidates?.[0]?.faceIndex
    );
    if (!ctx0) return null;
    const plane = new Plane().setFromNormalAndCoplanarPoint(
      new Vector3(ctx0.basis.n.x, ctx0.basis.n.y, ctx0.basis.n.z),
      new Vector3(ctx0.basis.origin.x, ctx0.basis.origin.y, ctx0.basis.origin.z)
    );
    const ndc = new Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const target = new Vector3();
    planeRaycaster.setFromCamera(ndc, sceneManager.camera);
    if (!planeRaycaster.ray.intersectPlane(plane, target)) return null;
    return { x: target.x, y: target.y, z: target.z };
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
      const endWorld =
        freeSnap?.world ||
        projectCursorToCandidatePlane(e, rect, firstPoint.candidates);

      if (endWorld) {
        const snapped = !!freeSnap;
        drawSegment(firstPoint.world, endWorld, { snapped });

        if (freeSnap) {
          const crossed = findCrossedCandidate(
            [firstPoint.world, endWorld],
            firstPoint.candidates
          );
          if (crossed) {
            freeCrossed = crossed;
            const pieces = splitFacePolygon({
              contour: crossed.ctx.contour2d,
              holes: crossed.ctx.holes2d,
              path: crossed.path2d,
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
    const { ctx, path2d } = freeCrossed;
    firstPoint = null;
    freeSnap = null;
    freeCrossed = null;
    try {
      await splitMesh3dService({
        mesh3d: ctx.mesh3d,
        faceIndex: ctx.faceIndex,
        path: path2d,
      });
    } catch (err) {
      console.error("[threedMesh] free split failed", err);
    }
    clearDraft();
    setMeshingOverlay({ areaChips: [], offsetChip: null });
    renderScene();
  }

  // --- polyline cut (CUT_POLYLINE) ------------------------------------------

  // Same flow as the free cut with intermediate points: the polyline starts
  // on a maille boundary (contour or opening), grows with each click (points
  // snap to boundaries within radius, else land on the face plane), and
  // commits when a click on a boundary point actually splits the maille.
  function onHoverPolylineCut(e, pick) {
    const rect =
      pick?.rect ||
      (() => {
        const r = dom.getBoundingClientRect();
        return r.width && r.height ? r : null;
      })();
    if (!rect) return;

    freeSnap = findEdgeSnap(e, rect);
    polyCommit = null;
    polyEndWorld = null;

    clearDraft();
    const areaChips = [];

    if (freeSnap) drawRing(freeSnap.world);

    if (polyPoints.length) {
      polyEndWorld =
        freeSnap?.world ||
        projectCursorToCandidatePlane(e, rect, polyCandidates);

      polyPoints.forEach((p) => drawRing(p));
      const chain = polyEndWorld ? [...polyPoints, polyEndWorld] : polyPoints;
      for (let i = 1; i < chain.length; i++) {
        drawSegment(chain[i - 1], chain[i], {
          snapped: !!freeSnap && i === chain.length - 1,
        });
      }

      if (freeSnap && chain.length >= 2) {
        const crossed = findCrossedCandidate(chain, polyCandidates);
        if (crossed) {
          const pieces = splitFacePolygon({
            contour: crossed.ctx.contour2d,
            holes: crossed.ctx.holes2d,
            path: crossed.path2d,
          });
          if (pieces) {
            polyCommit = crossed;
            pieces.forEach((piece) => {
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

  async function onClickPolylineCut() {
    if (!polyPoints.length) {
      // Starting point: must be on a maille boundary.
      if (!freeSnap) return;
      polyPoints = [freeSnap.world];
      polyCandidates = freeSnap.candidates;
      return;
    }

    // Ending click: a boundary point whose path splits the maille commits.
    if (freeSnap && polyCommit) {
      const { ctx, path2d } = polyCommit;
      resetPolyline();
      freeSnap = null;
      try {
        await splitMesh3dService({
          mesh3d: ctx.mesh3d,
          faceIndex: ctx.faceIndex,
          path: path2d,
        });
      } catch (err) {
        console.error("[threedMesh] polyline split failed", err);
      }
      clearDraft();
      setMeshingOverlay({ areaChips: [], offsetChip: null });
      renderScene();
      return;
    }

    // Intermediate point (snapped to a boundary when within radius).
    const point = freeSnap?.world || polyEndWorld;
    if (point) polyPoints = [...polyPoints, point];
  }

  // --- angular cut (CUT_ANGULAR) --------------------------------------------

  // 3 clicks: A (reference extremity, picked on a maille face), O (angle
  // vertex, constrained to the horizontal plane of A) and B (second
  // extremity). Both branches of the cut live in VERTICAL planes crossing on
  // the vertical line through O, which pierces the face at the V vertex — see
  // getAngularCutPath. Typing digits constrains the opening angle; the mouse
  // then only picks the side it opens to.

  // Cursor projected on the horizontal plane at altitude `y`.
  function projectCursorToHorizontalPlane(e, rect, y) {
    const plane = new Plane(new Vector3(0, 1, 0), -y);
    const ndc = new Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const target = new Vector3();
    planeRaycaster.setFromCamera(ndc, sceneManager.camera);
    if (!planeRaycaster.ray.intersectPlane(plane, target)) return null;
    return { x: target.x, y: target.y, z: target.z };
  }

  // Candidate A under the cursor: the hit point on a maille face, snapped to
  // that face's boundary when one runs within the snap radius.
  function getAngularPointA(e, pick) {
    if (pick?.kind !== "MESH3D") return null;
    // Curved (shell) mailles have no face polygon, vertical faces no angular
    // cut at all: neither can be armed.
    const ctx = getFaceContext(pick.mesh3dId, pick.faceIndex);
    if (!ctx || !supportsAngularCut(ctx.basis)) return null;
    const point = pick.intersect.point;
    const snap = findEdgeSnap(e, pick.rect);
    const world =
      snap &&
      snap.mesh3dId === pick.mesh3dId &&
      snap.faceIndex === pick.faceIndex
        ? snap.world
        : { x: point.x, y: point.y, z: point.z };
    return { world, mesh3dId: pick.mesh3dId, faceIndex: pick.faceIndex };
  }

  // Screen anchor of the angle chip: a short step along the bisector of the V,
  // so the value reads inside the angle instead of on top of its vertex.
  function getAngleChipPosition(cut, ctx, rect) {
    const bisector = {
      x: cut.dirA2d.x + cut.dirB2d.x,
      y: cut.dirA2d.y + cut.dirB2d.y,
    };
    const len = Math.hypot(bisector.x, bisector.y);
    // Flat angle: no bisector, fall back to the vertex itself.
    const step = 0.25 * Math.min(cut.endA2d.length, cut.endB2d.length);
    const p2 =
      len < 1e-6
        ? cut.v2d
        : {
            x: cut.v2d.x + (bisector.x / len) * step,
            y: cut.v2d.y + (bisector.y / len) * step,
          };
    return worldToScreen(liftPointTo3d(p2, ctx.basis), rect);
  }

  function onHoverAngularCut(e, pick) {
    const rect =
      pick?.rect ||
      (() => {
        const r = dom.getBoundingClientRect();
        return r.width && r.height ? r : null;
      })();
    if (!rect) return;

    // Phase 1: pick A on a maille face.
    if (!angA) {
      angHoverA = getAngularPointA(e, pick);
      clearDraft();
      if (angHoverA) drawRing(angHoverA.world);
      setMeshingOverlay({
        areaChips: [],
        offsetChip: null,
        angleChip: null,
        cursor: null,
      });
      renderScene();
      return;
    }

    const ctx = getFaceContext(angA.mesh3dId, angA.faceIndex);
    const point = projectCursorToHorizontalPlane(e, rect, angA.world.y);
    if (!ctx || !point) {
      resetHover();
      return;
    }

    // Phase 2: O follows the cursor, the reference plane cuts the face.
    if (!angO) {
      const line = getAngularCutLine({
        basis: ctx.basis,
        contour2d: ctx.contour2d,
        a: angA.world,
        o: point,
      });
      clearDraft();
      drawRing(angA.world);
      if (line) {
        drawSegment(
          liftDraft(line.line2d[0], ctx),
          liftDraft(line.line2d[1], ctx)
        );
        drawRing(liftDraft(line.v2d, ctx));
      }
      setMeshingOverlay({
        areaChips: [],
        offsetChip: null,
        angleChip: null,
        cursor: null,
      });
      renderScene();
      return;
    }

    // Phase 3: B follows the cursor, the V path splits the face.
    angCommit = null;
    const typedAngle = getAngleDeg?.();
    const cut = getAngularCutPath({
      basis: ctx.basis,
      contour2d: ctx.contour2d,
      holes2d: ctx.holes2d,
      a: angA.world,
      o: angO.world,
      b: point,
      angleDeg: typedAngle,
    });

    clearDraft();
    drawRing(angA.world);
    const areaChips = [];
    let angleChip = null;

    if (cut) {
      // A constrained (typed) angle draws as the thicker "snapped" line.
      const snapped = typedAngle != null;
      drawSegment(liftDraft(cut.endA2d, ctx), liftDraft(cut.v2d, ctx), {
        snapped,
      });
      drawSegment(liftDraft(cut.v2d, ctx), liftDraft(cut.endB2d, ctx), {
        snapped,
      });
      drawRing(liftDraft(cut.v2d, ctx));

      const chipPos = getAngleChipPosition(cut, ctx, rect);
      angleChip = {
        x: chipPos.x,
        y: chipPos.y,
        typed: typedAngle != null,
        text: `${cut.angleDeg.toLocaleString("fr-FR", {
          maximumFractionDigits: 1,
        })}°`,
      };

      const pieces = splitFacePolygon({
        contour: ctx.contour2d,
        holes: ctx.holes2d,
        path: cut.path2d,
      });
      if (pieces) {
        angCommit = { ctx, path2d: cut.path2d };
        pieces.forEach((piece) => {
          const c = worldToScreen(
            liftPointTo3d(polygonCentroid2d(piece.contour), ctx.basis),
            rect
          );
          areaChips.push({ x: c.x, y: c.y, text: formatSurfaceM2(piece.area) });
        });
      }
    }

    setMeshingOverlay({ areaChips, offsetChip: null, angleChip, cursor: null });
    renderScene();
  }

  async function onClickAngularCut(e, pick) {
    if (!angA) {
      const a = angHoverA || getAngularPointA(e, pick);
      if (a) angA = a;
      return;
    }

    if (!angO) {
      const rect = pick?.rect || dom.getBoundingClientRect();
      const point = projectCursorToHorizontalPlane(e, rect, angA.world.y);
      // O must define an azimuth: a click on A's own vertical is meaningless.
      if (!point) return;
      const dx = point.x - angA.world.x;
      const dz = point.z - angA.world.z;
      if (Math.hypot(dx, dz) < 1e-6) return;
      angO = { world: point };
      return;
    }

    if (!angCommit) return;
    const { ctx, path2d } = angCommit;
    resetAngular();
    try {
      await splitMesh3dService({
        mesh3d: ctx.mesh3d,
        faceIndex: ctx.faceIndex,
        path: path2d,
      });
    } catch (err) {
      console.error("[threedMesh] angular split failed", err);
    }
    clearDraft();
    setMeshingOverlay({ areaChips: [], offsetChip: null, angleChip: null });
    renderScene();
  }

  // --- public API -----------------------------------------------------------

  return {
    onHover(e, pick) {
      const tool = getTool();
      if (tool === "CUT_VERTICAL") onHoverAxisCut(e, pick, "x");
      else if (tool === "CUT_HORIZONTAL") onHoverAxisCut(e, pick, "y");
      else if (tool === "CUT_FREE") onHoverFreeCut(e, pick);
      else if (tool === "CUT_POLYLINE") onHoverPolylineCut(e, pick);
      else if (tool === "CUT_ANGULAR") onHoverAngularCut(e, pick);
    },
    onClick(e, pick) {
      const tool = getTool();
      if (tool === "CUT_VERTICAL" || tool === "CUT_HORIZONTAL") {
        onClickAxisCut();
      } else if (tool === "CUT_FREE") {
        onClickFreeCut();
      } else if (tool === "CUT_POLYLINE") {
        onClickPolylineCut();
      } else if (tool === "CUT_ANGULAR") {
        onClickAngularCut(e, pick);
      }
    },
    onLeave() {
      resetHover();
    },
    onEscape() {
      firstPoint = null;
      resetPolyline();
      resetAngular();
      resetHover();
    },
    // A change of the typed angle must redraw the V without a mouse move.
    isAngularArmed() {
      return !!angO;
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
