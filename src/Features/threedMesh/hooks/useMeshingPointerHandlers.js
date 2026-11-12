import { useEffect, useRef } from "react";

import { useDispatch, useSelector, useStore } from "react-redux";
import { Raycaster, Vector2, Vector3 } from "three";

import db from "App/db/db";
import {
  handleDimensionCardClick,
  pickDimensionCard,
} from "Features/threedDimensions/services/dimensionCardClick";
import {
  handleCutLineClick,
  pickCutLine,
  pickVisibleCutLine,
} from "Features/threedCutLines/js/pickCutLine";
import { CUT_LINE_LABEL } from "Features/threedCutLines/constants/cutLineStyle";
import {
  getCutLineGrabHover,
  isCutLineDragging,
} from "Features/threedCutLines/services/cutLineHoverStore";
import getSingleSelectedAnnotationId from "Features/threedDimensions/utils/getSingleSelectedAnnotationId";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import {
  appendToMeshingSurfaceBuffer,
  armMeshingSurfaceInput,
  clearMeshingSurfaceBuffer,
  deleteLastMeshingSurfaceBuffer,
  setMeshingModeActive,
  setMeshingNumberingNext,
  setMeshingTool,
} from "Features/threedEditor/threedEditorSlice";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import {
  selectSelectedItems,
  setSelectedItem,
  toggleItemSelection,
} from "Features/selection/selectionSlice";
import {
  buildFaceHoverOverlay,
  disposeFaceHoverOverlay,
} from "Features/threedEditor/js/utilsAnnotationsManager/faceHoverHighlight";
import {
  getActiveClippingPlane,
  filterIntersectionsByClipping,
} from "Features/threedEditor/js/utilsAnnotationsManager/clippingPick";
import { filterIntersectionsByVisibility } from "Features/threedEditor/js/utilsAnnotationsManager/visibilityPick";
import getUserAxesWorldDirections from "Features/threedEditor/utils/getUserAxesWorldDirections";
import { MESH3D_PART_HOVER_COLOR } from "Features/annotationMesh3d/constants/mesh3dPartColors";
import parseRectBuffer from "Features/mapEditor/utils/parseRectBuffer";

import useMeshes3d from "./useMeshes3d";
import createMesh3dService from "../services/createMesh3dService";
import {
  setMeshingOverlay,
  clearMeshingOverlay,
} from "../services/meshingOverlayStore";
import { isMesh3dLabelGestureActive } from "../services/mesh3dLabelGestureStore";
import buildFixedAreaMaille, {
  prepareFixedAreaAtlas,
} from "../utils/buildFixedAreaMaille";
import {
  buildMeshDataFromWorldSoup,
  buildWorldSoup,
} from "../utils/buildMeshDataFromRegion";
import { computeMesh3dSurface } from "../utils/computeFaceArea";
import formatSurfaceM2 from "../utils/formatSurfaceM2";
import getAnnotationFaceRegion from "../utils/getAnnotationFaceRegion";
import { MESH3D_SNAP_PX } from "../utils/mesh3dConstants";
import buildPiecesStippleOverlay from "Features/threedCutLines/js/buildPiecesStippleOverlay";
import {
  getCutLinesVersion,
  getCutLinesWorldPolylines,
} from "Features/threedCutLines/services/cutLineObjectsStore";
import buildMeshDataFromPieces from "Features/threedCutLines/utils/buildMeshDataFromPieces";
import clipRegionByCutLines from "Features/threedCutLines/utils/clipRegionByCutLines";
import { MESHING_SURFACE_BUFFER_CHAR_RE } from "../utils/meshingSurfaceBufferCharRe";

// Mirrors useDrawingPointerHandlers.
const DRAG_THRESHOLD_PX = 4;

// Pre-drawn maille of the CREATE tool with a target surface: fluo green wash
// + dots (not tone mapped: the realistic modes' ACES would dull it), over the
// hover stipple; orange when the free cell is smaller than the target.
const FIXED_AREA_STIPPLE = {
  color: MESH3D_PART_HOVER_COLOR,
  baseAlpha: 0.45,
  dotAlpha: 0.95,
  gridOffsetPx: 3,
  toneMapped: false,
  renderOrder: 999,
};
const FIXED_AREA_INSUFFICIENT_STIPPLE = {
  ...FIXED_AREA_STIPPLE,
  color: "#ff5722",
};

// Pointer interactions of the 3D meshing mode. Owns the pointer while
// meshingMode.active (MainThreedEditor's hover/click paths short-circuit):
//
// - SELECT tool: clicking an existing maille selects it (shift+click
//   toggles); empty click deselects. Never creates.
// - CREATE tool: hovering an annotation face shows the face stipple (the
//   region grown over the WHOLE annotation up to the "Sélection de face"
//   angle, see getAnnotationFaceRegion) + a "+ nouvelle maille" cursor
//   helper; a click creates a maille from the hovered face. Escape returns
//   to SELECT. With a target surface typed (S then digits →
//   meshingMode.surfaceBuffer, « Ajouter une maille »), the hover pre-draws
//   in fluo green a rectangle of that NET surface, aligned on the user axes,
//   leaning on the nearest borders of the hovered piece (face edges, cut
//   lines, existing mailles — openings are spanned and kept as holes, a
//   curved sheet is unfolded: buildFixedAreaMaille), and the click creates
//   that maille.
// - NUMBER tool: clicking a maille gives it the next number
//   (meshingMode.numberingNext), then +1. Escape returns to SELECT.
// `tooltipApiRef`: MainThreedEditor's hover tooltip (ThreedHoverTooltip) —
// while meshing, this hook owns it: an annotation face hovered with the
// SELECT / CREATE tools shows the annotation and the surface of the hovered
// piece (clipped by the cut lines), like the Dessin module's face hover.
// `rendererIsReady`: MainThreedEditor's flag — on a page load landing in the
// Maillage module, meshing is armed before the renderer exists; the effect
// below must run again once it does.
export default function useMeshingPointerHandlers({
  tooltipApiRef,
  rendererIsReady = true,
} = {}) {
  const dispatch = useDispatch();
  const store = useStore();

  const active = useSelector((s) => s.threedEditor.meshingMode.active);
  const tool = useSelector((s) => s.threedEditor.meshingMode.tool);
  const numberingNext = useSelector(
    (s) => s.threedEditor.meshingMode.numberingNext
  );
  const faceSelectionAngleDeg = useSelector(
    (s) => s.threedEditor.faceSelectionAngleDeg
  );
  const surfaceBuffer = useSelector(
    (s) => s.threedEditor.meshingMode.surfaceBuffer
  );
  const surfaceInputArmed = useSelector(
    (s) => s.threedEditor.meshingMode.surfaceInputArmed
  );
  const yawDeg = useSelector((s) => s.threedEditor.axesSettings.yawDeg);
  const isMeshesViewer = useSelector(selectEffectiveViewerKey) === "MESHES";
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  const meshes3d = useMeshes3d({ projectId, scopeId });

  // Values read inside the (stable-per-activation) listeners.
  // Set by the listeners effect: redraws the hover without a mouse move.
  const refreshHoverRef = useRef(null);
  const numberingNextRef = useRef(numberingNext);
  useEffect(() => {
    numberingNextRef.current = numberingNext;
  }, [numberingNext]);
  const faceSelectionAngleDegRef = useRef(faceSelectionAngleDeg);
  useEffect(() => {
    faceSelectionAngleDegRef.current = faceSelectionAngleDeg;
  }, [faceSelectionAngleDeg]);
  const isMeshesViewerRef = useRef(isMeshesViewer);
  useEffect(() => {
    isMeshesViewerRef.current = isMeshesViewer;
  }, [isMeshesViewer]);
  const idsRef = useRef({ projectId, scopeId });
  useEffect(() => {
    idsRef.current = { projectId, scopeId };
  }, [projectId, scopeId]);
  const mesh3dByIdRef = useRef({});
  // Bumped with the mailles: invalidates the free region of the fixed
  // surface preview.
  const meshesVersionRef = useRef(0);
  useEffect(() => {
    const byId = {};
    (meshes3d || []).forEach((m) => {
      byId[m.id] = m;
    });
    mesh3dByIdRef.current = byId;
    meshesVersionRef.current += 1;
    // A maille was created / removed: redraw the preview against it.
    refreshHoverRef.current?.();
  }, [meshes3d]);
  // Target surface of the CREATE tool (m², null when none is typed).
  const surfaceBufferRef = useRef(surfaceBuffer);
  const surfaceInputArmedRef = useRef(surfaceInputArmed);
  const fixedSurfaceRef = useRef(null);
  useEffect(() => {
    surfaceBufferRef.current = surfaceBuffer;
    surfaceInputArmedRef.current = surfaceInputArmed;
    const parsed = parseRectBuffer(surfaceBuffer);
    fixedSurfaceRef.current = parsed > 0 ? parsed : null;
  }, [surfaceBuffer, surfaceInputArmed]);
  const yawDegRef = useRef(yawDeg);
  useEffect(() => {
    yawDegRef.current = yawDeg;
  }, [yawDeg]);

  useEffect(() => {
    if (!active || !rendererIsReady) return;
    const editor = getActiveThreedEditor();
    const sceneManager = editor?.sceneManager;
    const dom = sceneManager?.renderer?.domElement;
    if (!sceneManager || !dom) return;

    const raycaster = new Raycaster();
    const mouse = new Vector2();
    let rafId = null;
    let lastEvent = null;
    let downPos = null;
    let dragging = false;

    // Face hover state (SELECT / CREATE tools).
    const hover = {
      overlay: null,
      key: null,
      // Cut lines clip of the hovered region (CREATE on an annotation):
      // `regionClip` is the raw clip (kept even when no line cuts the
      // region — the fixed surface preview needs its pieces and crease
      // joins), `clip` the same one when a line does cut it, `located` the
      // piece / group under the cursor.
      clipKey: null,
      regionClip: null,
      clip: null,
      located: null,
      faceData: null,
      groupKey: null,
      group: null,
      groupOverlay: null,
      // Fixed surface preview (CREATE with a target surface).
      fixedAtlasKey: null,
      fixedAtlas: null,
      fixedKey: null,
      fixed: null,
      fixedOverlay: null,
    };

    dom.style.cursor = tool === "CREATE" ? "crosshair" : "default";

    function clearStipple() {
      if (hover.overlay || hover.groupOverlay || hover.fixedOverlay) {
        disposeFaceHoverOverlay(hover.overlay);
        disposeFaceHoverOverlay(hover.groupOverlay);
        disposeFaceHoverOverlay(hover.fixedOverlay);
        hover.overlay = null;
        hover.groupOverlay = null;
        hover.fixedOverlay = null;
        editor.renderScene?.();
      }
      hover.key = null;
      hover.clipKey = null;
      hover.regionClip = null;
      hover.clip = null;
      hover.located = null;
      hover.faceData = null;
      hover.groupKey = null;
      hover.group = null;
      hover.fixedAtlasKey = null;
      hover.fixedAtlas = null;
      hover.fixedKey = null;
      hover.fixed = null;
    }

    // Raycast the scene at the event position. Returns the first maille or
    // annotation hit (mesh hits only, clipping-aware).
    //
    // Targets are collected explicitly instead of intersectObjects(scene,
    // recursive): the recursive walk raycasts EVERY object, and fat lines
    // (Line2/LineSegments2 — which extend Mesh) have a raycast that throws on
    // an empty/stale LineGeometry (see attachFatLineRaycast history in
    // createAnnotationObject3D.js), which would break all meshing picks. Fat
    // lines are irrelevant here anyway — meshing only targets faces.
    function pickScene(e) {
      const rect = dom.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, sceneManager.camera);
      const clippingPlane = getActiveClippingPlane(sceneManager);

      const targets = [];
      sceneManager.scene.traverse((obj) => {
        if (obj.isMesh && !obj.isLine2 && !obj.isLineSegments2) {
          targets.push(obj);
        }
      });

      const intersects = filterIntersectionsByVisibility(
        filterIntersectionsByClipping(
          raycaster.intersectObjects(targets, false),
          clippingPlane
        )
      );

      for (const intersect of intersects) {
        let object = intersect.object;
        while (object) {
          if (object.userData?.isMesh3d && object.userData?.mesh3dId) {
            return {
              kind: "MESH3D",
              mesh3dId: object.userData.mesh3dId,
              faceIndex: intersect.object.userData?.faceIndex ?? 0,
              intersect,
              rect,
            };
          }
          if (object.userData?.nodeId) {
            return {
              kind: "ANNOTATION",
              nodeId: object.userData.nodeId,
              hitObject: intersect.object,
              intersect,
              rect,
            };
          }
          object = object.parent;
        }
      }
      return { kind: null, rect };
    }

    // Stipple the face under the cursor (same overlay as the selection-mode
    // annotation hover). Works on annotation meshes AND maille face meshes —
    // a hovered maille gets the same highlight. On an annotation the region spans every mesh of the annotation
    // (getAnnotationFaceRegion); the overlay then lives under the annotation
    // root, in its local coordinates.
    function applyStipple(object, faceIndex) {
      const angleDeg = faceSelectionAngleDegRef.current;
      const region = getAnnotationFaceRegion(object, faceIndex, { angleDeg });
      const key = region?.key ?? null;
      if (key !== hover.key) {
        disposeFaceHoverOverlay(hover.overlay);
        disposeFaceHoverOverlay(hover.groupOverlay);
        disposeFaceHoverOverlay(hover.fixedOverlay);
        hover.overlay = null;
        hover.groupOverlay = null;
        hover.fixedOverlay = null;
        hover.groupKey = null;
        hover.group = null;
        hover.fixedKey = null;
        hover.fixed = null;
        if (region) {
          const overlay = buildFaceHoverOverlay(
            { geometry: region.geometry },
            region.tris
          );
          if (overlay) {
            region.host.add(overlay);
            hover.overlay = overlay;
          }
        }
        hover.key = key;
        editor.renderScene?.();
      }
      return region;
    }

    // CREATE on an annotation face: the region (planar or faceted) is cut by
    // the cut lines lying on it (Features/threedCutLines,
    // clipRegionByCutLines: facet by facet, the pieces joined back across
    // the creases) — only the GROUP of pieces under the cursor is stippled,
    // and the click creates that group. The region's clip is cached per
    // region + cut lines version; the group under the cursor is looked up on
    // every move. Returns the hovered group ({ pieces, area }) or null (whole
    // region: no line crosses it).
    function applyCutLinePieceStipple(object, faceIndex, hitPoint) {
      const region = applyStipple(object, faceIndex);
      if (!region) return null;
      const cutLinesVersion = getCutLinesVersion();
      // The fixed surface preview needs the pieces of the region even when
      // no cut line exists.
      const wantsPieces = fixedSurfaceRef.current > 0;
      const clipKey = `${hover.key}:${cutLinesVersion}:${wantsPieces ? 1 : 0}`;
      if (hover.clipKey !== clipKey) {
        hover.clipKey = clipKey;
        hover.regionClip = null;
        hover.clip = null;
        hover.faceData = null;
        const cutLines = getCutLinesWorldPolylines().map((l) => l.points);
        region.host.updateWorldMatrix(true, false);
        const soup = buildWorldSoup(
          region.geometry,
          region.host.matrixWorld,
          region.tris
        );
        hover.faceData = buildMeshDataFromWorldSoup(soup);
        if (soup && (cutLines.length || wantsPieces)) {
          const clip = clipRegionByCutLines({
            positions: soup.positions,
            tris: soup.tris,
            cutLines,
          });
          hover.regionClip = clip;
          // No line crosses the region: the whole region stands.
          hover.clip = clip?.groups?.some((g) => g.cut) ? clip : null;
        }
      }
      const located = hover.regionClip
        ? hover.regionClip.locate(
            region.tris.indexOf(region.triIndex),
            hitPoint
          )
        : null;
      hover.located = located;
      const group =
        hover.clip && located ? hover.clip.groups[located.groupIndex] : null;
      const groupKey = group ? `${clipKey}:${located.groupIndex}` : null;
      if (groupKey !== hover.groupKey) {
        disposeFaceHoverOverlay(hover.groupOverlay);
        hover.groupOverlay = null;
        hover.group = null;
        if (group) {
          const pieces = group.pieceIndices.map((i) => hover.clip.pieces[i]);
          hover.group = { pieces, area: group.area };
          const overlay = buildPiecesStippleOverlay(pieces);
          if (overlay) {
            sceneManager.scene.add(overlay);
            hover.groupOverlay = overlay;
          }
        }
        // The whole-region stipple stands in while no group is hovered.
        if (hover.overlay) hover.overlay.visible = !group;
        hover.groupKey = groupKey;
        editor.renderScene?.();
      }
      return hover.group;
    }

    // Snap distance of the fixed surface preview: MESH3D_SNAP_PX along `u`,
    // in metres at the hovered point.
    function getSnapToleranceM(point, u, rect) {
      const toScreen = (p) => {
        const v = new Vector3(p.x, p.y, p.z).project(sceneManager.camera);
        return {
          x: ((v.x + 1) / 2) * rect.width,
          y: ((1 - v.y) / 2) * rect.height,
        };
      };
      const a = toScreen(point);
      const b = toScreen({
        x: point.x + u.x,
        y: point.y + u.y,
        z: point.z + u.z,
      });
      const pxPerMeter = Math.hypot(a.x - b.x, a.y - b.y);
      return pxPerMeter > 1e-6 ? MESH3D_SNAP_PX / pxPerMeter : 0;
    }

    // CREATE with a target surface (meshingMode.surfaceBuffer): pre-draws the
    // maille of that net surface on the hovered group of pieces —
    // buildFixedAreaMaille: a rectangle aligned on the user axes, leaning on
    // the nearest borders (face edges, cut lines, existing mailles), the
    // group unfolded across its creases. The atlas (unfolded group + free
    // region) is cached per region clip, group, mailles and frame; the
    // rectangle is placed on every move. Runs after applyCutLinePieceStipple
    // (hover.regionClip / hover.located). Returns hover.fixed ({ pieces,
    // meshData, area, fits, target }) or null.
    function applyFixedAreaPreview(pick) {
      const target = fixedSurfaceRef.current;
      const clip = hover.regionClip;
      const located = hover.located;
      let fixed = null;
      let fixedKey = null;
      if (target > 0 && clip && located && pick?.intersect?.point) {
        const point = pick.intersect.point;
        const cursorWorld = { x: point.x, y: point.y, z: point.z };
        const yaw = yawDegRef.current;
        const prepare = (atlasKey) => {
          hover.fixedAtlasKey = atlasKey;
          hover.fixedAtlas = prepareFixedAreaAtlas({
            pieces: clip.pieces,
            joins: clip.joins,
            pieceIndices: clip.groups[located.groupIndex].pieceIndices,
            rootPieceIndex: located.pieceIndex,
            rootPoint: cursorWorld,
            axesDirs: getUserAxesWorldDirections(yaw).map((axis) => ({
              key: axis.key,
              dir: { x: axis.dir.x, y: axis.dir.y, z: axis.dir.z },
            })),
            meshes3d: Object.values(mesh3dByIdRef.current),
          });
        };
        const atlasKey = `${hover.clipKey}:${located.groupIndex}:${meshesVersionRef.current}:${yaw}`;
        let result = null;
        try {
          if (hover.fixedAtlasKey !== atlasKey) prepare(atlasKey);
          // A piece the unfolding did not reach (very large group): unfold
          // again from it.
          if (
            hover.fixedAtlas &&
            !hover.fixedAtlas.nodes.has(located.pieceIndex)
          )
            prepare(atlasKey);
          const atlas = hover.fixedAtlas;
          result = atlas
            ? buildFixedAreaMaille({
                atlas,
                pieceIndex: located.pieceIndex,
                cursorWorld,
                targetArea: target,
                snapToleranceM: getSnapToleranceM(
                  cursorWorld,
                  atlas.frame.u,
                  pick.rect
                ),
              })
            : null;
        } catch (err) {
          // Never break the hover loop on a degenerate region.
          console.error("[threedMesh] fixed surface preview failed", err);
          hover.fixedAtlas = null;
        }
        if (result) {
          const { rect } = result.placement;
          const r = (value) => Math.round(value * 1e6);
          fixedKey = `${atlasKey}:${located.pieceIndex}:${target}:${r(rect.xMin)}:${r(rect.yMin)}:${r(rect.xMax)}:${r(rect.yMax)}`;
          fixed =
            fixedKey === hover.fixedKey
              ? hover.fixed
              : {
                  pieces: result.pieces,
                  meshData: result.meshData,
                  area: result.area,
                  fits: result.fits,
                  target,
                };
        }
      }
      if (fixedKey !== hover.fixedKey) {
        disposeFaceHoverOverlay(hover.fixedOverlay);
        hover.fixedOverlay = null;
        if (fixed) {
          const overlay = buildPiecesStippleOverlay(
            fixed.pieces,
            fixed.fits ? FIXED_AREA_STIPPLE : FIXED_AREA_INSUFFICIENT_STIPPLE
          );
          if (overlay) {
            sceneManager.scene.add(overlay);
            hover.fixedOverlay = overlay;
          }
        }
        hover.fixedKey = fixedKey;
        hover.fixed = fixed;
        editor.renderScene?.();
      }
      // The preview stands in for the region / group stipple.
      const regionVisible = !hover.group && !hover.fixed;
      const groupVisible = !hover.fixed;
      if (
        (hover.overlay && hover.overlay.visible !== regionVisible) ||
        (hover.groupOverlay && hover.groupOverlay.visible !== groupVisible)
      ) {
        if (hover.overlay) hover.overlay.visible = regionVisible;
        if (hover.groupOverlay) hover.groupOverlay.visible = groupVisible;
        editor.renderScene?.();
      }
      return hover.fixed;
    }

    // Surface of the hovered region (CREATE): the pre-drawn maille's, the
    // group's, else the whole planar / curved region's.
    function getHoveredSurface() {
      if (hover.fixed) return hover.fixed.area;
      if (hover.group) return hover.group.area;
      const data = hover.faceData;
      if (!data) return null;
      if (data.shell) return data.shell.surface ?? null;
      if (data.faces?.length) return computeMesh3dSurface(data.faces);
      return null;
    }

    function updateCreateHover(e, pick) {
      if (pick?.kind === "ANNOTATION") {
        const x = e.clientX - pick.rect.left;
        const y = e.clientY - pick.rect.top;
        // The surface of what the click would create (the piece cut by the
        // cut lines, or the whole face) is in the hover tooltip; the chip
        // only stands in when no tooltip is wired.
        const surface = tooltipApiRef?.current ? null : getHoveredSurface();
        const target = fixedSurfaceRef.current;
        // Free cell smaller than the target surface: said next to the
        // cursor, whatever the tooltip shows.
        const insufficient = hover.fixed && !hover.fixed.fits;
        setMeshingOverlay({
          cursor: {
            x,
            y,
            label:
              target > 0
                ? `+ maille ${formatSurfaceM2(target, 2)}`
                : "+ nouvelle maille",
          },
          areaChips: insufficient
            ? [
                {
                  x,
                  y: y + 22,
                  text: `${formatSurfaceM2(hover.fixed.area, 2)} — surface insuffisante`,
                },
              ]
            : Number.isFinite(surface)
              ? [{ x, y: y + 22, text: formatSurfaceM2(surface) }]
              : [],
        });
        dom.style.cursor = "crosshair";
      } else {
        setMeshingOverlay({ cursor: null, areaChips: [] });
        dom.style.cursor = pick?.kind === "MESH3D" ? "pointer" : "crosshair";
      }
    }

    function runHover() {
      rafId = null;
      const e = lastEvent;
      if (!e) return;
      // A vertex / segment of the selected cut line is being dragged
      // (Features/threedCutLines): that gesture owns the cursor.
      if (isCutLineDragging()) return;
      const pick = pickScene(e);

      // Cut line under the cursor (SELECT): fat lines are invisible to
      // pickScene — the raycaster is still set from this event. Hidden
      // behind the first face hit, it does not answer.
      const cutLineHover =
        tool === "SELECT" && pick
          ? pickVisibleCutLine(raycaster, sceneManager, {
              clippingPlane: getActiveClippingPlane(sceneManager),
              occluderDistance: pick.intersect?.distance ?? Infinity,
            })
          : null;

      // Face highlight: mailles in every tool, annotations in SELECT /
      // CREATE (the piece delimited by the cut lines, with the tooltip).
      const annotationHover =
        (tool === "CREATE" || tool === "SELECT") && pick?.kind === "ANNOTATION";
      if (cutLineHover) {
        // « Ligne de coupe » tooltip — not on the line selected alone (its
        // edit toolbar says it, and its segments show the hand instead).
        clearStipple();
        const selectedAlone =
          getSingleSelectedAnnotationId(
            selectSelectedItems(store.getState())
          ) === cutLineHover.annotationId;
        if (selectedAlone) {
          clearTooltip();
        } else {
          tooltipApiRef?.current?.setText(
            CUT_LINE_LABEL,
            e.clientX - pick.rect.left + 15,
            e.clientY - pick.rect.top + 15
          );
        }
      } else if (pick?.kind === "MESH3D") {
        applyStipple(pick.intersect.object, pick.intersect.faceIndex);
        clearTooltip();
      } else if (annotationHover) {
        applyCutLinePieceStipple(
          pick.hitObject,
          pick.intersect.faceIndex,
          pick.intersect.point
        );
        applyFixedAreaPreview(tool === "CREATE" ? pick : null);
        updateTooltip(e, pick);
      } else {
        clearStipple();
        clearTooltip();
      }

      if (tool === "CREATE") {
        updateCreateHover(e, pick);
      } else {
        setMeshingOverlay({ cursor: null });
        // The hand over a grabbable part of the selected cut line
        // (cutLineHoverStore) wins over the pick cursors.
        dom.style.cursor = getCutLineGrabHover()
          ? "grab"
          : cutLineHover || pick?.kind === "MESH3D"
            ? "pointer"
            : "default";
      }
    }

    // Hover tooltip of the hovered annotation face (ThreedHoverTooltip, the
    // Dessin module's look): the annotation's template / label and the
    // surface of the hovered piece as "Quantités de la face".
    function updateTooltip(e, pick) {
      const api = tooltipApiRef?.current;
      if (!api) return;
      let root = pick.hitObject;
      while (root && root.userData?.nodeType !== "ANNOTATION") {
        root = root.parent;
      }
      if (!root) {
        api.clear();
        return;
      }
      const { nodeId, nodeType, annotationType, listingId } = root.userData;
      const surface = getHoveredSurface();
      api.set(
        {
          nodeId,
          nodeType,
          annotationType,
          listingId,
          partQties: Number.isFinite(surface) ? { surface } : null,
          partType: Number.isFinite(surface) ? "FACE" : null,
        },
        e.clientX - pick.rect.left + 15,
        e.clientY - pick.rect.top + 15
      );
    }

    function clearTooltip() {
      tooltipApiRef?.current?.clear();
    }

    // NUMBER tool: assign the typed number to the clicked maille, then +1.
    // Duplicates are allowed; the label override is cleared so the new
    // prefix + number becomes visible.
    async function handleNumberClick(pick) {
      if (pick?.kind !== "MESH3D") return;
      const number = Math.round(numberingNextRef.current);
      if (!Number.isFinite(number) || number < 1) return;
      try {
        await db.meshes3d.update(pick.mesh3dId, { number, label: null });
        dispatch(setMeshingNumberingNext(number + 1));
      } catch (err) {
        console.error("[threedMesh] numbering failed", err);
      }
    }

    function handleSelectClick(e, pick) {
      if (pick?.kind === "MESH3D") {
        const item = {
          id: pick.mesh3dId,
          nodeId: pick.mesh3dId,
          type: "NODE",
          nodeType: "MESH3D",
        };
        if (e.shiftKey) dispatch(toggleItemSelection(item));
        else dispatch(setSelectedItem(item));
        return;
      }

      // Annotation or empty click: plain deselects, shift preserves.
      if (!e.shiftKey) dispatch(setSelectedItem(null));
    }

    async function handleCreateClick(e, pick) {
      if (pick?.kind === "ANNOTATION") {
        // A group of pieces cut by the cut lines is hovered
        // (applyCutLinePieceStipple ran on the move that led here): the
        // maille is that group — one planar face when its pieces are
        // coplanar, a shell otherwise (buildMeshDataFromPieces).
        const group = applyCutLinePieceStipple(
          pick.hitObject,
          pick.intersect.faceIndex,
          pick.intersect.point
        );
        // A target surface is typed: the maille is the pre-drawn one (even
        // smaller than the target when the free cell is — user decision),
        // never the whole piece.
        if (fixedSurfaceRef.current > 0) {
          const fixed = applyFixedAreaPreview(pick);
          if (!fixed?.meshData) return;
          const { projectId: pId, scopeId: sId } = idsRef.current;
          try {
            const annotation = await db.annotations.get(pick.nodeId);
            const baseColor =
              annotation?.fillColor || annotation?.strokeColor || null;
            await createMesh3dService({
              projectId: pId,
              scopeId: sId,
              faces: fixed.meshData.faces,
              shell: fixed.meshData.shell,
              baseColor,
              sourceInfo: {
                annotationId: pick.nodeId,
                fixedSurface: fixed.target,
                ...(group ? { fromCutLines: true } : {}),
              },
            });
          } catch (err) {
            console.error("[threedMesh] create fixed surface failed", err);
          }
          clearStipple();
          return;
        }
        if (group) {
          const meshData = buildMeshDataFromPieces(group.pieces);
          if (!meshData) return;
          const { projectId: pId, scopeId: sId } = idsRef.current;
          try {
            const annotation = await db.annotations.get(pick.nodeId);
            const baseColor =
              annotation?.fillColor || annotation?.strokeColor || null;
            await createMesh3dService({
              projectId: pId,
              scopeId: sId,
              faces: meshData.faces,
              shell: meshData.shell,
              baseColor,
              sourceInfo: { annotationId: pick.nodeId, fromCutLines: true },
            });
          } catch (err) {
            console.error("[threedMesh] create from cut piece failed", err);
          }
          clearStipple();
          return;
        }
        // Same region as applyStipple: the created maille covers exactly the
        // highlighted region. Planar region → polygon faces; curved one
        // (revolution, swept profile) → triangulated shell.
        const region = getAnnotationFaceRegion(
          pick.hitObject,
          pick.intersect.faceIndex,
          { angleDeg: faceSelectionAngleDegRef.current }
        );
        let meshData = null;
        if (region) {
          region.host.updateWorldMatrix(true, false);
          meshData = buildMeshDataFromWorldSoup(
            buildWorldSoup(
              region.geometry,
              region.host.matrixWorld,
              region.tris
            )
          );
        }
        if (meshData) {
          const { projectId: pId, scopeId: sId } = idsRef.current;
          try {
            // The maille takes the source annotation's hue (lightened fill +
            // raw-color edges) — see createMesh3dService.
            const annotation = await db.annotations.get(pick.nodeId);
            const baseColor =
              annotation?.fillColor || annotation?.strokeColor || null;
            await createMesh3dService({
              projectId: pId,
              scopeId: sId,
              faces: meshData.faces,
              shell: meshData.shell,
              baseColor,
              sourceInfo: { annotationId: pick.nodeId },
            });
          } catch (err) {
            console.error("[threedMesh] create failed", err);
          }
          clearStipple();
        }
      }
    }

    function onPointerDown(e) {
      if (e.button !== 0) return;
      // A maille label card owns this gesture (select + in-plane drag).
      if (isMesh3dLabelGestureActive()) return;
      downPos = { x: e.clientX, y: e.clientY };
      dragging = false;
    }

    function onPointerMove(e) {
      lastEvent = e;
      if (rafId == null) rafId = requestAnimationFrame(runHover);
      if (!downPos) return;
      const dx = Math.abs(e.clientX - downPos.x);
      const dy = Math.abs(e.clientY - downPos.y);
      if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) dragging = true;
    }

    function onPointerUp(e) {
      if (e.button !== 0) return;
      // Label drag in progress: the sprite is invisible to pickScene, acting
      // on this pointerup would select/deselect the geometry behind the card.
      if (isMesh3dLabelGestureActive()) return;
      const wasDrag = dragging;
      downPos = null;
      dragging = false;
      if (wasDrag) return;

      // Cote / ruler value cards first (the Maillage module draws cotes):
      // the sprites are invisible to pickScene — select the annotation from
      // its card, or sub-select the card of the selected one.
      if (tool === "SELECT") {
        const rect = dom.getBoundingClientRect();
        if (rect.width && rect.height) {
          mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(mouse, sceneManager.camera);
          const cardSprite = pickDimensionCard(
            raycaster,
            getActiveClippingPlane(sceneManager)
          );
          if (cardSprite) {
            handleDimensionCardClick({
              dispatch,
              selectedItems: selectSelectedItems(store.getState()),
              sprite: cardSprite,
              event: e,
            });
            return;
          }
          // Cut lines (Features/threedCutLines): fat lines, invisible to
          // pickScene too.
          const cutLineHit = pickCutLine(
            raycaster,
            getActiveClippingPlane(sceneManager)
          );
          if (cutLineHit) {
            handleCutLineClick({
              dispatch,
              selectedItems: selectSelectedItems(store.getState()),
              hit: cutLineHit,
              event: e,
            });
            return;
          }
        }
      }
      const pick = pickScene(e);
      if (tool === "SELECT") {
        handleSelectClick(e, pick);
      } else if (tool === "CREATE") {
        handleCreateClick(e, pick);
      } else if (tool === "NUMBER") {
        handleNumberClick(pick);
      }
    }

    function onPointerCancel() {
      downPos = null;
      dragging = false;
    }

    function onPointerLeave() {
      lastEvent = null;
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      clearStipple();
      clearTooltip();
      clearMeshingOverlay();
    }

    function onKeyDown(e) {
      if (e.key === "Escape") {
        if (tool === "SELECT") {
          // In the Maillage module meshing mode is permanent — nothing to exit.
          if (!isMeshesViewerRef.current) dispatch(setMeshingModeActive(false));
        } else {
          dispatch(setMeshingTool("SELECT"));
        }
      }
    }

    // Target surface of the CREATE tool (« Ajouter une maille »): S arms the
    // input, the digits typed then feed meshingMode.surfaceBuffer, Enter
    // validates (the surface stays fixed), Escape drops the surface first
    // (the next Escape returns to SELECT). Capture phase so the digits reach
    // the buffer before the window-scoped shortcuts of the other features
    // see them.
    function onKeyDownSurface(e) {
      if (tool !== "CREATE") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      const consume = () => {
        e.preventDefault();
        e.stopImmediatePropagation();
      };

      if (e.key === "s" || e.key === "S") {
        consume();
        if (!e.repeat) dispatch(armMeshingSurfaceInput(true));
        return;
      }
      if (e.key === "Escape") {
        if (!surfaceInputArmedRef.current && surfaceBufferRef.current === "")
          return;
        consume();
        dispatch(clearMeshingSurfaceBuffer());
        return;
      }
      if (!surfaceInputArmedRef.current) return;
      if (e.key === "Enter") {
        consume();
        dispatch(armMeshingSurfaceInput(false));
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        if (surfaceBufferRef.current === "") return;
        consume();
        dispatch(deleteLastMeshingSurfaceBuffer());
        return;
      }
      if (MESHING_SURFACE_BUFFER_CHAR_RE.test(e.key)) {
        consume();
        dispatch(appendToMeshingSurfaceBuffer(e.key === "," ? "." : e.key));
      }
    }

    refreshHoverRef.current = () => {
      if (lastEvent && rafId == null) rafId = requestAnimationFrame(runHover);
    };

    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerCancel);
    dom.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keydown", onKeyDownSurface, true);

    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerCancel);
      dom.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keydown", onKeyDownSurface, true);
      refreshHoverRef.current = null;
      if (rafId != null) cancelAnimationFrame(rafId);
      clearStipple();
      clearTooltip();
      clearMeshingOverlay();
      dom.style.cursor = "";
    };
  }, [active, tool, rendererIsReady, dispatch, store]);

  // Typed target surface / rotated frame → redraw the pre-drawn maille in
  // place.
  useEffect(() => {
    if (!active || tool !== "CREATE") return;
    refreshHoverRef.current?.();
  }, [active, tool, surfaceBuffer, yawDeg]);
}

// Same guard as the other keyboard-buffer features: never swallow keystrokes
// aimed at a real field.
function isEditableTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}
