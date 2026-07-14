import { useCallback, useEffect, useRef, useState } from "react";

import { useSelector } from "react-redux";

import getAnnotationLabelPropsFromAnnotation from "Features/annotations/utils/getAnnotationLabelPropsFromAnnotation";
import getImageModeLabelsLayout from "Features/annotations/utils/getImageModeLabelsLayout";
import getCaptureRectBounds from "Features/mapEditor/utils/getCaptureRectBounds";

// Screen-px layout constants (converted to image px at compute time).
const BAND_MARGIN = 60; // chip outer edge inset from the capture rect border
const CHIP_GAP = 8; // minimal spacing between chips
const CAMERA_DEBOUNCE_MS = 250;
const MEASURE_RETRY_MS = 120;
const MEASURE_MAX_ATTEMPTS = 3;

/**
 * Display-only auto-layout of annotation labels while the "Export rapide"
 * (imageMode) is active. Computes per-annotation overrides consumed by
 * NodeAnnotationStatic (via StaticMapContent) — nothing is persisted, and
 * returning null restores the original positions instantly.
 *
 * Override shapes (both in image-pixel space):
 * - standalone LABEL annotations → { labelPoint }
 * - marker/polyline/polygon/strip sub-labels → { labelDelta } (target part
 *   untouched, so the dot never moves)
 */
export default function useImageModeLabelsLayout({
  enabled,
  annotations,
  basePose,
  getCameraMatrix,
  viewportBounds,
  hostKey = "MAP",
}) {
  const autoLayout = useSelector((s) => s.mapEditor.imageModeLabelsAutoLayout);
  const inMargin = useSelector((s) => s.mapEditor.imageModeLabelsInMargin);
  const aspectRatio = useSelector((s) => s.mapEditor.imageModeAspectRatio);

  // Same inset logic as ImageModeOverlay: the right panel floats over the
  // viewport, the capture rect is centered within the visible zone.
  const panelOpen = useSelector((s) =>
    Boolean(s.rightPanel.selectedMenuItemKey)
  );
  const panelWidth = useSelector((s) => s.rightPanel.width);
  const rightInset = panelOpen ? panelWidth : 0;

  const [labelOverridesById, setLabelOverridesById] = useState(null);

  // Camera changes (zoom/pan) → debounced recompute tick.
  const [cameraTick, setCameraTick] = useState(0);
  const cameraTimerRef = useRef(null);
  const notifyCameraChange = useCallback(() => {
    if (cameraTimerRef.current) clearTimeout(cameraTimerRef.current);
    cameraTimerRef.current = setTimeout(() => {
      cameraTimerRef.current = null;
      setCameraTick((t) => t + 1);
    }, CAMERA_DEBOUNCE_MS);
  }, []);
  useEffect(
    () => () => {
      if (cameraTimerRef.current) clearTimeout(cameraTimerRef.current);
    },
    []
  );

  const active = Boolean(enabled && autoLayout);

  useEffect(() => {
    if (!active) {
      setLabelOverridesById(null);
      return;
    }

    let cancelled = false;
    let retryTimer = null;
    let attempt = 0;

    const compute = () => {
      if (cancelled) return;

      const cam = getCameraMatrix?.() || { x: 0, y: 0, k: 1 };
      const poseK = basePose?.k || 1;
      const poseX = basePose?.x || 0;
      const poseY = basePose?.y || 0;
      const screenToImage = 1 / ((cam.k || 1) * poseK);

      const host = document.querySelector(
        `[data-image-capture-host="${hostKey}"]`
      );
      if (!host || !viewportBounds?.width || !viewportBounds?.height) {
        setLabelOverridesById(null);
        return;
      }
      // --- 1. candidates (original, non-overridden positions) ---
      const candidates = [];
      (annotations ?? []).forEach((a) => {
        if (!a) return;
        if (a.type === "LABEL") {
          if (!a.targetPoint || !a.labelPoint) return;
          candidates.push({
            annotationId: a.id,
            domId: a.id,
            kind: "LABEL",
            targetPoint: a.targetPoint,
            labelPoint: {
              x: a.labelPoint.x ?? a.targetPoint.x,
              y: a.labelPoint.y ?? a.targetPoint.y,
            },
            labelDelta: null,
          });
        } else if (a.showLabel) {
          const labelProps = getAnnotationLabelPropsFromAnnotation(a);
          if (!labelProps) return;
          candidates.push({
            annotationId: a.id,
            domId: labelProps.id, // "label::<id>"
            kind: "SUB_LABEL",
            targetPoint: labelProps.targetPoint,
            labelPoint: labelProps.labelPoint,
            labelDelta: a.labelDelta,
          });
        }
      });

      if (candidates.length === 0) {
        setLabelOverridesById(null);
        return;
      }

      // --- 2. measure chips from the DOM (screen px → image px) ---
      const items = [];
      let missing = 0;
      candidates.forEach((c) => {
        const chip = host.querySelector(
          `g[data-node-id="${CSS.escape(c.domId)}"] div[data-part-type="LABEL_BOX"]`
        );
        if (!chip) {
          missing += 1;
          return;
        }
        const rect = chip.getBoundingClientRect();
        if (!(rect.width > 0) || !(rect.height > 0)) {
          missing += 1;
          return;
        }
        items.push({
          id: c.annotationId,
          targetPoint: c.targetPoint,
          labelPoint: c.labelPoint,
          width: rect.width * screenToImage,
          height: rect.height * screenToImage,
        });
      });

      // Chips may not be mounted/measured yet right after enabling: retry.
      if (missing > 0 && items.length === 0 && attempt < MEASURE_MAX_ATTEMPTS) {
        attempt += 1;
        retryTimer = setTimeout(compute, MEASURE_RETRY_MS);
        return;
      }
      if (items.length === 0) {
        setLabelOverridesById(null);
        return;
      }

      // --- 3. capture rect → image px ---
      const rect = getCaptureRectBounds(
        viewportBounds.width,
        viewportBounds.height,
        aspectRatio,
        { rightInset }
      );
      const toImage = (vx, vy) => ({
        x: ((vx - cam.x) / (cam.k || 1) - poseX) / poseK,
        y: ((vy - cam.y) / (cam.k || 1) - poseY) / poseK,
      });
      const p0 = toImage(rect.left, rect.top);
      const p1 = toImage(rect.left + rect.width, rect.top + rect.height);
      const captureRect = { x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y };

      // --- 4. layout ---
      const layout = getImageModeLabelsLayout({
        items,
        captureRect,
        mode: inMargin ? "MARGIN_BAND" : "ANTI_OVERLAP",
        margin: BAND_MARGIN * screenToImage,
        gap: CHIP_GAP * screenToImage,
      });

      // --- 5. overrides keyed by parent annotation id ---
      const byCandidateId = new Map(candidates.map((c) => [c.annotationId, c]));
      const overrides = {};
      Object.entries(layout).forEach(([id, { labelPoint }]) => {
        const c = byCandidateId.get(id);
        if (!c) return;
        if (c.kind === "LABEL") {
          overrides[id] = { labelPoint };
        } else {
          // newDelta = oldDelta + (newLabelPoint - oldLabelPoint), so the
          // barycenter never needs recomputing and the target part is kept.
          const oldDelta = c.labelDelta?.label ?? { x: 0, y: 0 };
          overrides[id] = {
            labelDelta: {
              target: c.labelDelta?.target ?? { x: 0, y: 0 },
              label: {
                x: oldDelta.x + (labelPoint.x - c.labelPoint.x),
                y: oldDelta.y + (labelPoint.y - c.labelPoint.y),
              },
            },
          };
        }
      });

      setLabelOverridesById((prev) =>
        areOverridesEqual(prev, overrides) ? prev : overrides
      );
    };

    compute();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [
    active,
    inMargin,
    aspectRatio,
    rightInset,
    annotations,
    basePose?.x,
    basePose?.y,
    basePose?.k,
    viewportBounds?.width,
    viewportBounds?.height,
    cameraTick,
    // getCameraMatrix is a ref accessor: intentionally not a dep (its
    // identity changes every parent render, but never its semantics).
    hostKey,
  ]);

  return {
    labelOverridesById: active ? labelOverridesById : null,
    notifyCameraChange,
  };
}

function areOverridesEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => {
    const oa = a[k];
    const ob = b[k];
    if (!ob) return false;
    const pa = oa.labelPoint ?? oa.labelDelta?.label;
    const pb = ob.labelPoint ?? ob.labelDelta?.label;
    return pa && pb && pa.x === pb.x && pa.y === pb.y;
  });
}
