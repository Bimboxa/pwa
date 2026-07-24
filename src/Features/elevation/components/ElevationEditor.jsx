import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setEditedProfileIndex,
  setShowHeightLabels,
} from "Features/elevation/elevationSlice";

import {
  Box,
  Button,
  FormControlLabel,
  Switch,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";

import MapEditorViewport from "Features/mapEditorGeneric/components/MapEditorViewport";
import ElevationProfileSvg from "./ElevationProfileSvg";
import ElevationProfileSectionSvg from "./ElevationProfileSectionSvg";
import ElevationZAxisOverlay from "./ElevationZAxisOverlay";
import ButtonChooseProfileSource from "./ButtonChooseProfileSource";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useElevationProfile from "Features/elevation/hooks/useElevationProfile";
import useElevationZAxis from "Features/elevation/hooks/useElevationZAxis";
import useElevationPointDrag from "Features/elevation/hooks/useElevationPointDrag";
import useDeleteIsoHeightLine from "Features/annotations/hooks/useDeleteIsoHeightLine";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { expandArcsInPath } from "Features/geometry/utils/arcSampling";
import buildProfileSectionGeometry, {
  getProfileAxis,
} from "Features/elevation/utils/buildProfileSectionGeometry";
import getInlineExtrusionSetup from "Features/annotations/utils/getInlineExtrusionSetup";
import commitElevationOffsetService from "Features/elevation/services/commitElevationOffsetService";
import commitElevationOffsetsService from "Features/elevation/services/commitElevationOffsetsService";
import commitIsoHeightLineHeightService from "Features/elevation/services/commitIsoHeightLineHeightService";
import createIsoHeightLineService from "Features/elevation/services/createIsoHeightLineService";
import setAnnotationOffsetZService from "Features/elevation/services/setAnnotationOffsetZService";
import setAnnotationHeightService from "Features/elevation/services/setAnnotationHeightService";
import setElevationGuideService from "Features/elevation/services/setElevationGuideService";
import updateProfileVertexHeightService from "Features/elevation/services/updateProfileVertexHeightService";
import applyProfileFromAnnotationService from "Features/elevation/services/applyProfileFromAnnotationService";
import insertProfileVertexService from "Features/elevation/services/insertProfileVertexService";
import deleteProfileVertexService from "Features/elevation/services/deleteProfileVertexService";
import toggleProfileVertexTypeService from "Features/elevation/services/toggleProfileVertexTypeService";

// Picks the segment whose projected X-band contains `x` (smallest band wins on
// overlap from fold-backs); falls back to the nearest band. Returns the
// original segment index (the band owner's `segIndex`, which maps an arc's
// sampled sub-bands back to their parent segment) or null.
function pickSegmentAtX(x, vertices) {
  if (!vertices || vertices.length < 2) return null;
  let best = null;
  let bestWidth = Infinity;
  let nearest = null;
  let nearestDist = Infinity;
  for (let j = 0; j < vertices.length - 1; j++) {
    const a = vertices[j];
    const b = vertices[j + 1];
    const lo = Math.min(a.x, b.x);
    const hi = Math.max(a.x, b.x);
    if (x >= lo && x <= hi) {
      const w = hi - lo;
      if (w < bestWidth) {
        bestWidth = w;
        best = a.segIndex;
      }
    } else {
      const d = x < lo ? lo - x : x - hi;
      if (d < nearestDist) {
        nearestDist = d;
        nearest = a.segIndex;
      }
    }
  }
  return best != null ? best : nearest;
}

// Pan/zoom elevation editor. Reuses MapEditorViewport (SVG camera, same model
// as MainMapEditorV3). Segment hover/selection is hit-tested via the viewport's
// world callbacks (so panning keeps working); the profile SVG only renders the
// feedback.
export default function ElevationEditor({
  annotationId,
  points,
  closeLine = false,
  selectedSegmentIndices,
  seedSegmentIndex,
  editedSegmentIndex,
  observationSign,
  meterByPx,
  height,
  offsetZ,
  color,
  isoLines = null,
  // POLYGON surface: top profile only (no quads/bottom/recap) — see
  // ElevationProfileSvg.
  surfaceMode = false,
  // Guide image config ({ baseMapId, x?, y? }) — a VERTICAL baseMap drawn
  // under the profile as a background guide for the isoHeight points.
  elevationGuide = null,
  // Shell profile section mode: resolved profileLines + the edited index
  // (null = silhouette / wall mode). When active, the editor shows ONE
  // profile's developed section (x = curvilinear distance) instead of the
  // projected silhouette.
  profileLines = [],
  editedProfileIndex = null,
  onSelectSegment,
}) {
  const viewportRef = useRef(null);
  const dispatch = useDispatch();

  const showHeightLabels = useSelector((s) => s.elevation.showHeightLabels);

  const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState(null);
  // Screen-fixed Z axis (zoom + side + world x from the live camera) is set up
  // by useElevationZAxis below, once bbox / guideTrait are known.

  const handleCommitOffset = useCallback(
    (pointIndex, edge, value) => {
      commitElevationOffsetService({
        annotationId,
        pointIndex,
        edge,
        value,
        dispatch,
      });
    },
    [annotationId, dispatch]
  );

  const handleCommitOffsetZ = useCallback(
    (value) => {
      setAnnotationOffsetZService({ annotationId, offsetZ: value, dispatch });
    },
    [annotationId, dispatch]
  );

  const handleCommitHeight = useCallback(
    (value) => {
      setAnnotationHeightService({ annotationId, height: value, dispatch });
    },
    [annotationId, dispatch]
  );

  const handleCommitIsoHeight = useCallback(
    (index, value) => {
      commitIsoHeightLineHeightService({
        annotationId,
        index,
        height: value,
        dispatch,
      });
    },
    [annotationId, dispatch]
  );

  // Extremity field: same batch write as the extremity handle drag.
  const handleCommitExtremityOffset = useCallback(
    (pointIndexes, value) => {
      commitElevationOffsetsService({
        annotationId,
        pointIndexes,
        edge: "TOP",
        value,
        dispatch,
      });
    },
    [annotationId, dispatch]
  );

  // data

  const {
    vertices,
    bbox: profileBbox,
    isoMarkers,
    basis,
  } = useElevationProfile({
    points,
    selectedSegmentIndices,
    seedSegmentIndex,
    observationSign,
    meterByPx,
    height,
    offsetZ,
    isoLines,
  });

  // Shell / extrusion profile section (x = curvilinear distance along the
  // profile). POLYGON shells: section z includes the annotation height
  // (offsetTop semantics) and endpoints are continuity-locked. POLYLINE
  // extrusions: absolute cross-section (z = offsetZ + h), free endpoints.
  const sectionProfile =
    editedProfileIndex != null ? profileLines?.[editedProfileIndex] : null;
  const sectionHeight = surfaceMode ? height : 0;
  const sectionGeometry = useMemo(
    () =>
      sectionProfile
        ? buildProfileSectionGeometry({
            profilePoints: sectionProfile.points,
            meterByPx,
            height: surfaceMode ? height : 0,
            offsetZ,
            lockEndpoints: surfaceMode,
          })
        : null,
    [sectionProfile, meterByPx, height, offsetZ, surfaceMode]
  );
  const profileSectionMode = !!sectionGeometry;
  const bbox = profileSectionMode ? sectionGeometry.bbox : profileBbox;

  // POLYLINE extrusion: reference "trait" = the guide segment crossed by the
  // profile, projected onto the section plane; its extremities are snap
  // targets and the registration origin of the 3D sweep. The guide is
  // arc-expanded EXACTLY like the band / 3D callers so all three agree on
  // the crossed segment and its extremities.
  const guideTrait = useMemo(() => {
    if (!profileSectionMode || surfaceMode || !sectionProfile) return null;
    const expandedGuide = expandArcsInPath(
      (points || []).filter(
        (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
      ),
      6,
      !!closeLine
    );
    const setup = getInlineExtrusionSetup({
      guidePoints: expandedGuide,
      profilePoints: sectionProfile.points,
      closeLine,
    });
    if (!setup) return null;
    const pxPerMeter = meterByPx > 0 ? 1 / meterByPx : 1;
    const traitY =
      -((setup.extremities[setup.anchorExtremityIndex]?.z ?? 0) + offsetZ) *
      pxPerMeter;
    return {
      extremities: setup.extremities.map((e) => ({
        s: e.s,
        y: -(e.z + offsetZ) * pxPerMeter,
      })),
      anchorExtremityIndex: setup.anchorExtremityIndex,
      // FULL polyline footprint projected on the section plane — the trait
      // spans the whole guide, not just the crossed segment.
      footprint: {
        s1: setup.footprint.sMin,
        s2: setup.footprint.sMax,
        y: traitY,
      },
      // Median axis (circle center projected on the profile axis) — section
      // X = s, so the vertical axis sits at x = medianS.
      medianS: setup.medianS,
    };
  }, [
    profileSectionMode,
    surfaceMode,
    sectionProfile,
    points,
    meterByPx,
    closeLine,
    offsetZ,
  ]);

  // Screen-fixed Z axis: side (profile vs annotation median axis) + world x
  // from the live camera. Shared by the section and surface renderers so the
  // Z = 0 line reaches the axis and the Offset field sits beside it.
  const { zoom, zAxisSide, zAxisWorldX, onCameraChange, rootRef } =
    useElevationZAxis({ viewportRef, bbox, medianS: guideTrait?.medianS });

  // Z axis / hide-labels UI: section profiles AND POLYGON iso surfaces.
  const showZAxisUi = profileSectionMode || surfaceMode;

  // --- guide image (background elevation drawing) ---

  const { value: baseMaps = [] } = useBaseMaps({});
  const [guideSelected, setGuideSelected] = useState(false);
  // live position override during a drag ({ x, y } in world coords)
  const [guidePos, setGuidePos] = useState(null);
  const guideDragRef = useRef(null);

  // Reset the local selection/drag state when the guide changes.
  useEffect(() => {
    setGuideSelected(false);
    setGuidePos(null);
  }, [elevationGuide?.baseMapId, annotationId]);

  const guideImage = useMemo(() => {
    const baseMapId = elevationGuide?.baseMapId;
    if (!baseMapId) return null;
    const bm = baseMaps.find((b) => b?.id === baseMapId);
    if (!bm) return null;
    // baseMaps records can be plain objects or instances — read via getters
    // with plain-field fallbacks.
    const url = bm.getUrl?.() ?? bm.imageUrl ?? bm.image?.imageUrl;
    const size = bm.getImageSize?.() ?? bm.image?.imageSize;
    if (!url || !size?.width || !size?.height) return null;
    // Scale the elevation image so its meters match the profile's vertical
    // meters (profile world px = plan-baseMap px).
    const elevMeterByPx = bm.getMeterByPx?.() ?? bm.meterByPx ?? null;
    const k = elevMeterByPx && meterByPx ? elevMeterByPx / meterByPx : 1;
    const width = size.width * k;
    const height = size.height * k;
    // Default placement: bottom-left corner on the Z = 0 line, at the left of
    // the profile.
    const x = elevationGuide?.x ?? (bbox ? bbox.minX : 0);
    const y = elevationGuide?.y ?? -height;
    return { url, width, height, x, y };
  }, [elevationGuide, baseMaps, meterByPx, bbox]);

  const guideX = guidePos?.x ?? guideImage?.x ?? 0;
  const guideY = guidePos?.y ?? guideImage?.y ?? 0;

  const handleGuideMove = useCallback(
    (e) => {
      const drag = guideDragRef.current;
      if (!drag || !viewportRef.current) return;
      const world = viewportRef.current.screenToWorld(e.clientX, e.clientY);
      const dx = world.x - drag.startWorld.x;
      const dy = world.y - drag.startWorld.y;
      if (Math.hypot(dx, dy) > 0.5) drag.moved = true;
      setGuidePos({ x: drag.origin.x + dx, y: drag.origin.y + dy });
    },
    [viewportRef]
  );

  const handleGuideUp = useCallback(
    (e) => {
      window.removeEventListener("mousemove", handleGuideMove);
      window.removeEventListener("mouseup", handleGuideUp);
      const drag = guideDragRef.current;
      guideDragRef.current = null;
      if (!drag || !viewportRef.current) return;
      if (!drag.moved) return; // plain click → handled by onClick (toggle)
      const world = viewportRef.current.screenToWorld(e.clientX, e.clientY);
      const x = drag.origin.x + (world.x - drag.startWorld.x);
      const y = drag.origin.y + (world.y - drag.startWorld.y);
      drag.committed = true;
      setElevationGuideService({
        annotationId,
        guide: { ...elevationGuide, x, y },
        dispatch,
      });
    },
    [handleGuideMove, viewportRef, annotationId, elevationGuide, dispatch]
  );

  // Screen position of the mousedown on the image — used by the click handler
  // to tell a real click from a pan that started on the image (the browser
  // still fires a click on mouse up after a pan).
  const guideDownPosRef = useRef(null);

  const handleGuideMouseDown = useCallback(
    (e) => {
      guideDownPosRef.current = { x: e.clientX, y: e.clientY };
      if (!guideSelected || !viewportRef.current) return;
      e.stopPropagation();
      e.preventDefault();
      guideDragRef.current = {
        startWorld: viewportRef.current.screenToWorld(e.clientX, e.clientY),
        origin: { x: guideX, y: guideY },
        moved: false,
      };
      window.addEventListener("mousemove", handleGuideMove);
      window.addEventListener("mouseup", handleGuideUp);
    },
    [guideSelected, viewportRef, guideX, guideY, handleGuideMove, handleGuideUp]
  );

  const guideJustDraggedRef = useRef(false);
  const handleGuideClick = useCallback((e) => {
    e.stopPropagation();
    if (guideJustDraggedRef.current) {
      guideJustDraggedRef.current = false;
      return;
    }
    // Pan started on the image: the cursor moved between mousedown and the
    // click event → not a selection click.
    const down = guideDownPosRef.current;
    guideDownPosRef.current = null;
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 3) {
      return;
    }
    setGuideSelected((s) => !s);
  }, []);

  // Flag the click that follows a real drag so it doesn't toggle selection.
  useEffect(() => {
    const markDrag = () => {
      if (guideDragRef.current?.moved) guideJustDraggedRef.current = true;
    };
    window.addEventListener("mouseup", markDrag, true);
    return () => window.removeEventListener("mouseup", markDrag, true);
  }, []);

  const {
    startHandleDrag,
    startIsoHandleDrag,
    startExtremityDrag,
    startProfileVertexDrag,
    dragPreview,
    clearDragPreview,
  } = useElevationPointDrag({
    viewportRef,
    meterByPx,
    height,
    offsetZ,
    annotationId,
    basis,
  });

  // On commit, the profile-vertex preview is FROZEN at its final position
  // (committed) instead of cleared, so the vertex doesn't flash back to its
  // pre-drag position during the async Dexie round-trip. Once the resolved
  // section reflects the move (sectionProfile gets a fresh reference), drop
  // the frozen preview. Read the current preview via a ref so this effect
  // fires on the DATA change only, not on setting the committed preview.
  const dragPreviewRef = useRef(dragPreview);
  dragPreviewRef.current = dragPreview;
  useEffect(() => {
    if (dragPreviewRef.current?.committed) clearDragPreview();
  }, [sectionProfile, clearDragPreview]);

  // --- shell profile section mode: vertex selection / edit / insert ---

  const [selectedProfileVertexIndex, setSelectedProfileVertexIndex] =
    useState(null);

  useEffect(() => {
    setSelectedProfileVertexIndex(null);
  }, [annotationId, editedProfileIndex]);

  // Free 2-axis drag: Y = height, X = abscissa.
  //   - POLYLINE extrusion (free cross-section): X = SIGNED abscissa on the
  //     cut axis, completely unconstrained — a vertex may fold back past its
  //     neighbors (Z / U profiles). The plan position is the abscissa mapped
  //     onto the axis line, so the plan chain stays a segment.
  //   - POLYGON shell: X slides along the profile path in plan (curvilinear),
  //     clamped strictly between neighbors, endpoints continuity-locked.
  const handleProfileVertexMouseDown = useCallback(
    (e, { vertexIndex }) => {
      const pts = (sectionProfile?.points ?? []).filter(
        (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
      );
      if (pts.length < 2) return;
      const last = pts.length - 1;
      const isEndpoint = vertexIndex === 0 || vertexIndex === last;
      // POLYGON endpoints are continuity-locked (no drag at all).
      if (isEndpoint && surfaceMode) return;
      if (vertexIndex < 0 || vertexIndex > last) return;

      if (!surfaceMode) {
        const axis = getProfileAxis(pts);
        if (!axis) return;
        const planAt = (s) => ({
          x: axis.ox + axis.ux * s,
          y: axis.oy + axis.uy * s,
        });
        startProfileVertexDrag(e, {
          profileIndex: editedProfileIndex,
          vertexIndex,
          sMin: -1e9,
          sMax: 1e9,
          planAt,
          sectionHeight,
          // Snap targets (world coords of the section view): the reference
          // trait's extremities (registration on the guide) + the trait's
          // own footprint ends.
          snapTargets: guideTrait
            ? [
                ...guideTrait.extremities.map((t) => ({ x: t.s, y: t.y })),
                ...(guideTrait.footprint
                  ? [
                      {
                        x: guideTrait.footprint.s1,
                        y: guideTrait.footprint.y,
                      },
                      {
                        x: guideTrait.footprint.s2,
                        y: guideTrait.footprint.y,
                      },
                    ]
                  : []),
              ]
            : null,
          // Vertical snap lines (world X): the median axis (circle center).
          snapLinesX:
            guideTrait && Number.isFinite(guideTrait.medianS)
              ? [guideTrait.medianS]
              : null,
        });
        return;
      }

      const cum = [0];
      for (let i = 1; i < pts.length; i += 1) {
        cum.push(
          cum[i - 1] +
            Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
        );
      }
      const total = cum[last];
      // Extrapolates beyond the chain ends along the end-segment directions,
      // so endpoints can EXTEND the profile.
      const planAt = (s) => {
        if (s < 0) {
          const len = Math.max(cum[1], 1e-9);
          const ux = (pts[1].x - pts[0].x) / len;
          const uy = (pts[1].y - pts[0].y) / len;
          return { x: pts[0].x + ux * s, y: pts[0].y + uy * s };
        }
        if (s > total) {
          const len = Math.max(total - cum[last - 1], 1e-9);
          const ux = (pts[last].x - pts[last - 1].x) / len;
          const uy = (pts[last].y - pts[last - 1].y) / len;
          return {
            x: pts[last].x + ux * (s - total),
            y: pts[last].y + uy * (s - total),
          };
        }
        for (let i = 0; i < pts.length - 1; i += 1) {
          if (s <= cum[i + 1] || i === pts.length - 2) {
            const span = Math.max(cum[i + 1] - cum[i], 1e-9);
            const t = Math.max(0, Math.min(1, (s - cum[i]) / span));
            return {
              x: pts[i].x + (pts[i + 1].x - pts[i].x) * t,
              y: pts[i].y + (pts[i + 1].y - pts[i].y) * t,
            };
          }
        }
        return { x: pts[0].x, y: pts[0].y };
      };
      // Keep a small margin so the vertex never lands ON a neighbor
      // (degenerate segment). Endpoints may extend outward up to the profile
      // length.
      const EXT = Math.max(total, 1);
      const margin =
        vertexIndex === 0
          ? Math.max(cum[1], 1e-6) * 0.02
          : vertexIndex === last
            ? Math.max(total - cum[last - 1], 1e-6) * 0.02
            : Math.max(cum[vertexIndex + 1] - cum[vertexIndex - 1], 1e-6) *
              0.02;
      const sMin = vertexIndex === 0 ? -EXT : cum[vertexIndex - 1] + margin;
      const sMax =
        vertexIndex === last ? total + EXT : cum[vertexIndex + 1] - margin;
      startProfileVertexDrag(e, {
        profileIndex: editedProfileIndex,
        vertexIndex,
        sMin,
        sMax,
        planAt,
        sectionHeight,
        // Snap targets (world coords of the section view): the reference
        // trait's extremities (registration on the guide) + the trait's own
        // footprint ends (the small vertices at the grey line extremities).
        snapTargets: guideTrait
          ? [
              ...guideTrait.extremities.map((t) => ({ x: t.s, y: t.y })),
              ...(guideTrait.footprint
                ? [
                    { x: guideTrait.footprint.s1, y: guideTrait.footprint.y },
                    { x: guideTrait.footprint.s2, y: guideTrait.footprint.y },
                  ]
                : []),
            ]
          : null,
        // Vertical snap lines (world X): the median axis (circle center) — a
        // dragged vertex X snaps onto it while its height stays free.
        snapLinesX:
          guideTrait && Number.isFinite(guideTrait.medianS)
            ? [guideTrait.medianS]
            : null,
      });
    },
    [
      startProfileVertexDrag,
      editedProfileIndex,
      sectionProfile,
      surfaceMode,
      sectionHeight,
      guideTrait,
    ]
  );

  // Re-click on the already-selected vertex toggles its type square ↔ circle
  // (arc control point of the vertical section curve).
  const handleToggleProfileVertexType = useCallback(
    (vertexIndex) => {
      toggleProfileVertexTypeService({
        annotationId,
        profileIndex: editedProfileIndex,
        vertexIndex,
        dispatch,
      });
    },
    [annotationId, editedProfileIndex, dispatch]
  );

  const handleCommitProfileVertexHeight = useCallback(
    (vertexIndex, value) => {
      updateProfileVertexHeightService({
        annotationId,
        profileIndex: editedProfileIndex,
        vertexIndex,
        height: value,
        dispatch,
      });
    },
    [annotationId, editedProfileIndex, dispatch]
  );

  const handleInsertProfileVertex = useCallback(
    ({ segIndex, t, height: vertexHeight }) => {
      insertProfileVertexService({
        annotationId,
        profileIndex: editedProfileIndex,
        segIndex,
        t,
        height: vertexHeight,
        dispatch,
      });
    },
    [annotationId, editedProfileIndex, dispatch]
  );

  // Delete/Backspace removes the selected profile vertex (interior only).
  // Capture phase + stopPropagation, like the iso-line delete above.
  useEffect(() => {
    if (!profileSectionMode || selectedProfileVertexIndex == null) return;
    const onKey = async (e) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      e.stopPropagation();
      await deleteProfileVertexService({
        annotationId,
        profileIndex: editedProfileIndex,
        vertexIndex: selectedProfileVertexIndex,
        dispatch,
      });
      setSelectedProfileVertexIndex(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [
    profileSectionMode,
    selectedProfileVertexIndex,
    annotationId,
    editedProfileIndex,
    dispatch,
  ]);

  // --- iso point selection (click a diamond → select; Delete removes) ---

  const [selectedIsoIndex, setSelectedIsoIndex] = useState(null);
  const deleteIsoHeightLine = useDeleteIsoHeightLine();

  useEffect(() => {
    setSelectedIsoIndex(null);
  }, [annotationId]);

  // Delete/Backspace removes the selected iso line. Capture phase +
  // stopPropagation so the map editor's window-level Delete handler (which
  // would open the delete-annotation dialog) never sees the event.
  useEffect(() => {
    if (selectedIsoIndex == null) return;
    const onKey = async (e) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      e.stopPropagation();
      await deleteIsoHeightLine({ annotationId, index: selectedIsoIndex });
      setSelectedIsoIndex(null);
      dispatch(triggerAnnotationsUpdate());
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [selectedIsoIndex, annotationId, deleteIsoHeightLine, dispatch]);

  // --- add-point snap helper (surface mode) ---

  const [hoverWorldPos, setHoverWorldPos] = useState(null);

  // Creates a new iso line at the clicked profile position: the PLAN chord is
  // the section of the ring at that x (line perpendicular to the projection
  // axis), its height comes from the clicked y.
  const handleAddIsoPoint = useCallback(
    (profileX, worldY) => {
      if (!basis || !points?.length) return;
      const { originX, originY, ux, uy, sign, minRawX } = basis;
      const c = sign * (profileX + minRawX);
      const nx = -uy;
      const ny = ux;
      const ring = expandArcsInPath(points, 16, true).filter(
        (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
      );
      if (ring.length < 3) return;
      const hits = [];
      for (let i = 0; i < ring.length; i++) {
        const A = ring[i];
        const B = ring[(i + 1) % ring.length];
        const da = (A.x - originX) * ux + (A.y - originY) * uy;
        const db = (B.x - originX) * ux + (B.y - originY) * uy;
        const denom = db - da;
        if (Math.abs(denom) < 1e-9) continue;
        const s = (c - da) / denom;
        if (s < 0 || s >= 1) continue;
        const P = { x: A.x + (B.x - A.x) * s, y: A.y + (B.y - A.y) * s };
        hits.push({ P, t: (P.x - originX) * nx + (P.y - originY) * ny });
      }
      if (hits.length < 2) return;
      hits.sort((a, b) => a.t - b.t);
      const first = hits[0].P;
      const last = hits[hits.length - 1].P;
      createIsoHeightLineService({
        annotationId,
        planPoints: [first, last],
        height: -worldY * meterByPx - height - offsetZ,
        dispatch,
      });
    },
    [basis, points, annotationId, meterByPx, height, offsetZ, dispatch]
  );

  // handlers - hover / select segment bands via the viewport

  // Surface mode has no per-segment bands: heights are edited through the
  // iso-line helpers; the mouse position feeds the add-point snap helper.
  const handleWorldMouseMove = useCallback(
    ({ worldPos, isPanning }) => {
      if (isPanning) {
        if (surfaceMode || profileSectionMode) setHoverWorldPos(null);
        return;
      }
      if (surfaceMode || profileSectionMode) {
        setHoverWorldPos(worldPos);
        return;
      }
      const seg = pickSegmentAtX(worldPos.x, vertices);
      setHoveredSegmentIndex((prev) => (prev === seg ? prev : seg));
    },
    [vertices, surfaceMode, profileSectionMode]
  );

  const handleWorldClick = useCallback(
    ({ worldPos }) => {
      // Clicking outside the guide image / iso points deselects them (their
      // own clicks are stopped before reaching the viewport).
      setGuideSelected(false);
      setSelectedIsoIndex(null);
      setSelectedProfileVertexIndex(null);
      if (surfaceMode || profileSectionMode) return;
      const seg = pickSegmentAtX(worldPos.x, vertices);
      if (seg != null) onSelectSegment?.(seg);
    },
    [vertices, onSelectSegment, surfaceMode, profileSectionMode]
  );

  // helper - fit-contain camera (refit when the projection/seed changes, so the
  // selected segment is laid out horizontal; not on every edit). Also exposed
  // through the "Centrer" button.

  const fitKey = `${annotationId}:${seedSegmentIndex}:${observationSign}:${
    editedProfileIndex ?? "-"
  }:${(selectedSegmentIndices ?? []).join(",")}`;

  const fitToContent = useCallback(() => {
    if (!bbox || !viewportRef.current) return;
    const fit = () => {
      const vp = viewportRef.current;
      if (!vp) return;
      const { width: vw, height: vh } = vp.getViewportSize();
      if (!vw || !vh) {
        requestAnimationFrame(fit);
        return;
      }
      // Margins are proportional to the developed width (meterByPx-independent)
      // so the framing stays equally aerated whatever the map scale. The recap
      // gap/margins themselves are now screen-fixed (see ElevationProfileSvg);
      // this upward headroom is a generous allowance that comfortably contains
      // them at the fitted zoom.
      const profileW = Math.max(bbox.maxX - bbox.minX, 1);
      // Surface / profile-section modes have no "vue de dessus" recap above
      // the profile — a small headroom is enough. Section mode fits the
      // PROFILE bbox only, so opening the panel lands centered on the profile
      // even when the polyline footprint extends far beyond.
      const fitMinY =
        bbox.minY -
        profileW * (surfaceMode || profileSectionMode ? 0.15 : 0.8) -
        16;
      // down to the baseMap reference plane (worldY = 0)
      const fitMaxY = Math.max(bbox.maxY, 0) + profileW * 0.12 + 16;
      // Section mode: the Offset field + Z axis are SCREEN-fixed overlays (no
      // world-space element off to the left), so center the profile with
      // symmetric margins. Other modes keep the extra left margin for the
      // world-space Offset field left of the baseMap line.
      const fitMinX = profileSectionMode
        ? bbox.minX - profileW * 0.12 - 16
        : bbox.minX - profileW * 0.22 - 40;
      const fitMaxX = profileSectionMode
        ? bbox.maxX + profileW * 0.12 + 16
        : bbox.maxX + profileW * 0.05 + 10;

      const bw = Math.max(fitMaxX - fitMinX, 1);
      const bh = Math.max(fitMaxY - fitMinY, 1);
      const pad = 16;
      const k = Math.min((vw - pad * 2) / bw, (vh - pad * 2) / bh) || 1;
      const cx = (fitMinX + fitMaxX) / 2;
      const cy = (fitMinY + fitMaxY) / 2;
      vp.setCameraMatrix({ x: vw / 2 - cx * k, y: vh / 2 - cy * k, k });
    };
    fit();
  }, [bbox, surfaceMode, profileSectionMode]);

  // Refit on projection changes ONLY (fitKey), not on every bbox edit — read
  // the latest fit through a ref so the effect deps stay honest.
  const fitToContentRef = useRef(fitToContent);
  fitToContentRef.current = fitToContent;
  useEffect(() => {
    fitToContentRef.current();
  }, [fitKey]);

  // --- profile from a source annotation ("Choisir un profil" / Actualiser) ---

  // Refit once the freshly applied profile is resolved (fitKey may not change
  // when the profile is REPLACED at the same index).
  const pendingFitRef = useRef(false);
  useEffect(() => {
    if (pendingFitRef.current && sectionGeometry) {
      pendingFitRef.current = false;
      fitToContent();
    }
  }, [sectionGeometry, fitToContent]);

  // Target the applied profile once its RESOLVED data lands: when the applied
  // line is the annotation's first profile, the panel resets the edited index
  // (no resolved section yet during the Dexie round-trip) — re-select it as
  // soon as the resolved profileLines carry it.
  const pendingProfileIndexRef = useRef(null);
  useEffect(() => {
    const idx = pendingProfileIndexRef.current;
    if (idx == null) return;
    if ((profileLines?.[idx]?.points?.length ?? 0) >= 2) {
      pendingProfileIndexRef.current = null;
      dispatch(setEditedProfileIndex(idx));
    }
  }, [profileLines, dispatch]);

  const handleApplyProfileFromSource = useCallback(
    async (sourceAnnotationId, { invert = false } = {}) => {
      const idx = await applyProfileFromAnnotationService({
        annotationId,
        sourceAnnotationId,
        profileIndex: editedProfileIndex,
        seedSegmentIndex,
        invert,
        dispatch,
      });
      if (Number.isInteger(idx)) {
        pendingFitRef.current = true;
        pendingProfileIndexRef.current = idx;
        dispatch(setEditedProfileIndex(idx));
      }
    },
    [annotationId, editedProfileIndex, seedSegmentIndex, dispatch]
  );

  // helpers

  const shouldDisablePan = (e) =>
    Boolean(e.target?.dataset?.elevHandle) ||
    (guideSelected && Boolean(e.target?.dataset?.elevGuide));

  // render

  if (!profileSectionMode && (!vertices || vertices.length < 2)) {
    return (
      <Box
        sx={{
          flexGrow: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Sélectionnez un segment dans l'aperçu pour voir son élévation.
        </Typography>
      </Box>
    );
  }

  return (
    <Box ref={rootRef} sx={{ flexGrow: 1, minHeight: 0, position: "relative" }}>
      <MapEditorViewport
        ref={viewportRef}
        shouldDisablePan={shouldDisablePan}
        onWorldMouseMove={handleWorldMouseMove}
        onWorldClick={handleWorldClick}
        onCameraChange={onCameraChange}
      >
        {/* Guide image (elevation drawing) under the profile. Click toggles
            selection; when selected it can be dragged to reposition. */}
        {guideImage && (
          <g>
            <image
              href={guideImage.url}
              x={guideX}
              y={guideY}
              width={guideImage.width}
              height={guideImage.height}
              opacity={0.85}
              preserveAspectRatio="none"
              data-elev-guide="1"
              style={{ cursor: guideSelected ? "move" : "pointer" }}
              onMouseDown={handleGuideMouseDown}
              onClick={handleGuideClick}
            />
            {guideSelected && (
              <rect
                x={guideX}
                y={guideY}
                width={guideImage.width}
                height={guideImage.height}
                fill="none"
                stroke="#2196f3"
                strokeWidth={2}
                strokeDasharray="6 4"
                vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: "none" }}
              />
            )}
          </g>
        )}
        {profileSectionMode && (
          <ElevationProfileSectionSvg
            vertices={sectionGeometry.vertices}
            meterByPx={meterByPx}
            height={sectionHeight}
            offsetZ={offsetZ}
            color={color}
            zoom={zoom}
            guideTrait={guideTrait}
            dragPreview={dragPreview}
            showLabels={showHeightLabels}
            zAxisWorldX={zAxisWorldX}
            zAxisSide={zAxisSide}
            closeLine={Boolean(sectionProfile?.closeLine)}
            selectedVertexIndex={selectedProfileVertexIndex}
            onVertexMouseDown={handleProfileVertexMouseDown}
            onSelectVertex={setSelectedProfileVertexIndex}
            onToggleVertexType={handleToggleProfileVertexType}
            onCommitVertexHeight={handleCommitProfileVertexHeight}
            onCommitOffsetZ={handleCommitOffsetZ}
            hoverWorldPos={hoverWorldPos}
            onInsertVertex={handleInsertProfileVertex}
          />
        )}
        {!profileSectionMode && (
          <ElevationProfileSvg
            vertices={vertices}
            editedSegmentIndex={editedSegmentIndex}
            hoveredSegmentIndex={hoveredSegmentIndex}
            height={height}
            meterByPx={meterByPx}
            offsetZ={offsetZ}
            color={color}
            zoom={zoom}
            dragPreview={dragPreview}
            onHandleMouseDown={startHandleDrag}
            onCommitOffset={handleCommitOffset}
            onCommitOffsetZ={handleCommitOffsetZ}
            onCommitHeight={handleCommitHeight}
            isoMarkers={isoMarkers}
            onIsoHandleMouseDown={startIsoHandleDrag}
            onCommitIsoHeight={handleCommitIsoHeight}
            selectedIsoIndex={selectedIsoIndex}
            onSelectIso={setSelectedIsoIndex}
            onExtremityMouseDown={startExtremityDrag}
            onCommitExtremityOffset={handleCommitExtremityOffset}
            hoverWorldPos={hoverWorldPos}
            onAddIsoPoint={handleAddIsoPoint}
            surfaceMode={surfaceMode}
            showLabels={showHeightLabels}
            zAxisWorldX={zAxisWorldX}
            zAxisSide={zAxisSide}
          />
        )}
      </MapEditorViewport>

      {/* bottom action bar: profile source picker (POLYLINE extrusions) +
          re-center */}
      <Box
        sx={{
          position: "absolute",
          bottom: 8,
          left: 8,
          right: 8,
          display: "flex",
          alignItems: "center",
          gap: 1,
          pointerEvents: "none",
          "& > *": { pointerEvents: "auto" },
        }}
      >
        {!surfaceMode && (
          <ButtonChooseProfileSource
            annotationId={annotationId}
            onSelectSource={handleApplyProfileFromSource}
          />
        )}
        {!surfaceMode && sectionProfile?.sourceAnnotationId && (
          <>
            <Button
              size="small"
              variant="contained"
              color="inherit"
              startIcon={<RefreshIcon />}
              sx={{ bgcolor: "background.paper", textTransform: "none" }}
              onClick={() =>
                handleApplyProfileFromSource(
                  sectionProfile.sourceAnnotationId,
                  { invert: Boolean(sectionProfile.sourceInvert) }
                )
              }
            >
              Actualiser
            </Button>
            <Button
              size="small"
              variant="contained"
              color="inherit"
              startIcon={<SwapHorizIcon />}
              sx={{ bgcolor: "background.paper", textTransform: "none" }}
              onClick={() =>
                handleApplyProfileFromSource(
                  sectionProfile.sourceAnnotationId,
                  { invert: !sectionProfile.sourceInvert }
                )
              }
            >
              Inverser
            </Button>
          </>
        )}
        <Box sx={{ flexGrow: 1 }} />
        {showZAxisUi && (
          <FormControlLabel
            sx={{
              m: 0,
              pl: 1,
              pr: 0.5,
              borderRadius: 1,
              bgcolor: "background.paper",
            }}
            control={
              <Switch
                size="small"
                checked={showHeightLabels}
                onChange={(e) =>
                  dispatch(setShowHeightLabels(e.target.checked))
                }
              />
            }
            label={<Typography variant="caption">Hauteurs</Typography>}
          />
        )}
        <Button
          size="small"
          variant="contained"
          color="inherit"
          startIcon={<CenterFocusStrongIcon />}
          sx={{ bgcolor: "background.paper", textTransform: "none" }}
          onClick={fitToContent}
        >
          Centrer
        </Button>
      </Box>

      {/* Z axis — SCREEN-fixed vertical reference (outside the camera group),
          on the side chosen by useElevationZAxis. Shown for section profiles
          AND POLYGON iso surfaces. */}
      {showZAxisUi && <ElevationZAxisOverlay side={zAxisSide} />}
    </Box>
  );
}
