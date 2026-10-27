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
  const [error, setError] = useState(null);
  const workerRef = useRef(null),
    sequenceRef = useRef(0),
    overlayRef = useRef(null);
  const queryKey = frame ? JSON.stringify([frame.rows, lower, upper]) : "";
  const workerEnabled = Boolean(view && active && !inspect && !hidden);
  const result = output?.view === view ? output.result : null;
  const current = Boolean(result && output.key === queryKey);

  useEffect(() => {
    setOutput(null);
    setSelection(null);
    setClip(false);
  }, [view]);

  useEffect(() => {
    if (!workerEnabled) return;
    let worker;
    try {
      worker = new Worker(
        new URL("../workers/projectLocalScan.worker.js", import.meta.url),
        { type: "module" }
      );
      workerRef.current = worker;
      worker.postMessage({
        type: "INIT",
        source: { positions: view.data.positions, colors: view.data.colors },
      });
      worker.onerror = () => {
        if (workerRef.current !== worker) return;
        setError(
          "La projection a échoué. Fermez puis rouvrez le modèle pour réessayer."
        );
        worker.terminate();
        workerRef.current = null;
      };
    } catch {
      setError("Impossible de préparer la projection de ce scan.");
    }
    return () => {
      sequenceRef.current++;
      worker?.terminate();
      workerRef.current = null;
    };
  }, [view, workerEnabled]);

  useEffect(() => {
    const worker = workerRef.current;
    if (!workerEnabled || !worker) return;
    const id = ++sequenceRef.current;
    worker.postMessage({ type: "CANCEL", id });
    setError(null);
    worker.onmessage = ({ data }) => {
      if (data.id !== sequenceRef.current || workerRef.current !== worker)
        return;
      if (data.error) setError(data.error);
      else {
        setError(null);
        setOutput({ view, key: queryKey, result: data.result });
      }
    };
    const timer = setTimeout(
      () =>
        worker.postMessage({
          type: "PROJECT",
          id,
          query: { frame, lower, upper },
        }),
      250
    );
    return () => {
      clearTimeout(timer);
      sequenceRef.current++;
      worker.postMessage({ type: "CANCEL", id: sequenceRef.current });
    };
  }, [view, workerEnabled, frame, lower, upper, queryKey]);

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
  }, [frame, lower, upper, showBounds, hidden]);
  useEffect(() => {
    if (!view) return;
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
    pending: active && !current && !error,
    error,
    changeRange: (values) => setSelection({ key: verticalKey, values }),
  };
}
