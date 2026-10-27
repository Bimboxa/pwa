import { useEffect, useMemo, useRef, useState } from "react";
import getLocalScanSliceFrame from "../utils/getLocalScanSliceFrame";
import getUsefulScanHeight from "../utils/getUsefulScanHeight";
import { getSliceDomain } from "../utils/slicePreviewGeometry";
import createLocalScanSliceOverlay from "../services/createLocalScanSliceOverlay";

export default function useScanProjection({
  editor,
  view,
  placementKey,
  axesYaw,
  active,
  inspect,
  showBounds,
  hidden,
}) {
  const frame = useMemo(() => {
    if (!view) return null;
    view.root.updateMatrixWorld(true);
    return getLocalScanSliceFrame(
      view.data.bounds,
      view.root.matrixWorld.elements,
      axesYaw
    );
    // placementKey tracks a mutable Three.js transform.
  }, [view, placementKey, axesYaw]);
  const verticalKey = frame
    ? JSON.stringify(frame.rows.slice(8).map((n) => +n.toFixed(9)))
    : "";
  const usefulHeight = useMemo(() => {
    if (!frame || !view) return { min: 0, max: 1 };
    return getUsefulScanHeight(view.data.positions, frame.rows.slice(8), {
      min: frame.min[2],
      max: frame.max[2],
    });
  }, [frame, view]);
  const domain = frame
    ? getSliceDomain(usefulHeight.min, usefulHeight.max)
    : { min: 0, max: 1 };
  const middle = (domain.min + domain.max) / 2;
  const [selection, setSelection] = useState(null);
  const lower =
    selection?.key === verticalKey
      ? Math.max(domain.min, Math.min(domain.max, selection.values[0]))
      : Math.max(domain.min, middle - 0.5);
  const upper =
    selection?.key === verticalKey
      ? Math.max(domain.min, Math.min(domain.max, selection.values[1]))
      : Math.min(domain.max, middle + 0.5);
  const [clip, setClip] = useState(false);
  const [mode, setMode] = useState("density");
  const [previewOrientation, setPreviewOrientation] = useState("LANDSCAPE");
  const [output, setOutput] = useState(null);
  const [request, setRequest] = useState(null);
  const [error, setError] = useState(null);
  const sequenceRef = useRef(0),
    overlayRef = useRef(null);
  const queryKey = frame ? JSON.stringify([frame.rows, lower, upper]) : "";
  const result = output?.view === view ? output.result : null;
  const requested = Boolean(
    request && request.view === view && request.key === queryKey
  );
  const current = Boolean(result && requested && output.request === request);
  const pending = requested && !current && !error && !inspect && !hidden;

  useEffect(() => {
    setOutput(null);
    setRequest(null);
    setSelection(null);
    setClip(false);
    setError(null);
  }, [view]);

  // Cancel invalidated work, without automatically restarting when a range,
  // placement, tab or inspection state changes back.
  useEffect(() => {
    if (request && (!requested || ((inspect || hidden) && !current))) {
      setRequest(null);
    }
  }, [request, requested, inspect, hidden, current]);

  useEffect(() => {
    if (!requested || current || inspect || hidden) return;
    let worker;
    let alive = true;
    try {
      worker = new Worker(
        new URL("../workers/projectLocalScan.worker.js", import.meta.url),
        { type: "module" }
      );
      worker.onmessage = ({ data }) => {
        if (!alive || data.id !== request.id) return;
        if (data.error) setError(data.error);
        else {
          setError(null);
          setOutput({ view, key: request.key, request, result: data.result });
        }
        worker.terminate();
      };
      worker.onerror = () => {
        if (!alive) return;
        setError(
          "La projection a échoué. Cliquez sur Calculer pour réessayer."
        );
        worker.terminate();
      };
      worker.postMessage({
        type: "INIT",
        source: { positions: view.data.positions, colors: view.data.colors },
      });
      worker.postMessage({
        type: "PROJECT",
        id: request.id,
        query: request.query,
      });
    } catch {
      worker?.terminate();
      setError("Impossible de préparer la projection de ce scan.");
    }
    return () => {
      alive = false;
      // Release the cloned source after completion or cancellation.
      worker?.terminate();
    };
  }, [request, requested, current, view, inspect, hidden]);

  useEffect(() => {
    if (!view || !frame || !showBounds || hidden) return;
    const overlay = createLocalScanSliceOverlay(editor, view, frame);
    overlayRef.current = overlay;
    return () => {
      overlayRef.current = null;
      overlay.dispose();
    };
  }, [editor, view, frame, showBounds, hidden]);
  useEffect(() => {
    overlayRef.current?.setRange(lower, upper, 0.02);
    overlayRef.current?.setHighlight(true);
  }, [frame, lower, upper, showBounds, hidden]);
  useEffect(() => {
    if (!view) return;
    // Live: the 3D hides the points outside the current Z bounds as soon as
    // the switch is on, whether or not the image is calculated.
    view.setSliceClip(clip && active ? { lower, upper } : null);
    return () => view.setSliceClip(null);
  }, [view, active, clip, lower, upper]);

  return {
    frame,
    verticalKey,
    domain,
    lower,
    upper,
    clip,
    setClip,
    mode,
    setMode,
    previewOrientation,
    setPreviewOrientation,
    result,
    current,
    pending,
    canCalculate: Boolean(view && active && !inspect && !hidden && !pending),
    calculate: () => {
      if (!view || !frame || inspect || hidden || pending) return;
      setError(null);
      setRequest({
        id: ++sequenceRef.current,
        view,
        key: queryKey,
        query: { frame, lower, upper },
      });
    },
    error,
    changeRange: (values) => {
      if (values[0] === lower && values[1] === upper) return;
      // Keep GPU boundary highlights live; invalidate only the image calculation.
      setRequest(null);
      setError(null);
      setSelection({ key: verticalKey, values });
    },
  };
}
