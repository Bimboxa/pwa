import { createContext, useRef, useCallback, useContext, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setRectXBuffer as setRectXBufferAction,
  setRectYBuffer as setRectYBufferAction,
  appendToRectXBuffer,
  appendToRectYBuffer,
  deleteLastRectXBuffer,
  deleteLastRectYBuffer,
  toggleRectXBufferSign,
  toggleRectYBufferSign,
  setRectCurrentAxis as setRectCurrentAxisAction,
  setRectHasFirstPoint as setRectHasFirstPointAction,
  clearRectDims,
  appendToConstraintBuffer,
  deleteLastConstraintBuffer,
  clearConstraintBuffer,
  setMetricInputField as setMetricInputFieldAction,
  appendToMetricInputBuffer as appendToMetricInputBufferAction,
  deleteLastMetricInputBuffer as deleteLastMetricInputBufferAction,
  clearMetricInput as clearMetricInputAction,
} from "Features/mapEditor/mapEditorSlice";
import segmentLengthPxRef from "Features/mapEditor/state/segmentLengthPxRef";

const DrawingMetricsContext = createContext(null);

function parseBuffer(buf) {
  if (!buf) return null;
  const normalized = buf.replace(",", ".");
  if (normalized === "-" || normalized === "." || normalized === "-.")
    return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function DrawingMetricsProvider({ children }) {
  const dispatch = useDispatch();

  // Segment-length live ref — module-level singleton so the bottom bar
  // (outside this provider) can read it via requestAnimationFrame.

  // Segment-length constraint buffer — Redux-backed so the bottom bar
  // can subscribe via useSelector.
  const constraintBuffer = useSelector((s) => s.mapEditor.constraintBuffer);

  const appendToBuffer = useCallback(
    (char) => {
      dispatch(appendToConstraintBuffer(char));
    },
    [dispatch]
  );

  const deleteFromBuffer = useCallback(() => {
    dispatch(deleteLastConstraintBuffer());
  }, [dispatch]);

  const clearBuffer = useCallback(() => {
    dispatch(clearConstraintBuffer());
  }, [dispatch]);

  // Rectangle typed X/Y dimensions — also Redux-backed.
  const rectXBuffer = useSelector((s) => s.mapEditor.rectXBuffer);
  const rectYBuffer = useSelector((s) => s.mapEditor.rectYBuffer);
  const rectCurrentAxis = useSelector((s) => s.mapEditor.rectCurrentAxis);
  const rectHasFirstPoint = useSelector((s) => s.mapEditor.rectHasFirstPoint);

  // Typed thickness / height entry (E / H) — also Redux-backed.
  const metricInputField = useSelector((s) => s.mapEditor.metricInputField);
  const metricInputBuffer = useSelector((s) => s.mapEditor.metricInputBuffer);

  // Refs mirror Redux state so the keydown handler (registered once with
  // empty deps in InteractionLayer) can read the latest values synchronously.
  const rectCurrentAxisRef = useRef(rectCurrentAxis);
  rectCurrentAxisRef.current = rectCurrentAxis;

  const metricInputFieldRef = useRef(metricInputField);
  metricInputFieldRef.current = metricInputField;
  const metricInputBufferRef = useRef(metricInputBuffer);
  metricInputBufferRef.current = metricInputBuffer;

  const setRectAxis = useCallback(
    (axis) => {
      rectCurrentAxisRef.current = axis;
      dispatch(setRectCurrentAxisAction(axis));
      if (axis === "x") dispatch(setRectXBufferAction(""));
      else if (axis === "y") dispatch(setRectYBufferAction(""));
      // Mutual exclusivity: entering an axis cancels any active E/H capture so
      // digit keys only ever feed one buffer.
      if (metricInputFieldRef.current) {
        metricInputFieldRef.current = null;
        metricInputBufferRef.current = "";
        dispatch(clearMetricInputAction());
      }
    },
    [dispatch]
  );

  const appendToRectBuffer = useCallback(
    (char) => {
      const axis = rectCurrentAxisRef.current;
      if (axis === "x") dispatch(appendToRectXBuffer(char));
      else if (axis === "y") dispatch(appendToRectYBuffer(char));
    },
    [dispatch]
  );

  const toggleRectBufferSign = useCallback(() => {
    const axis = rectCurrentAxisRef.current;
    if (axis === "x") dispatch(toggleRectXBufferSign());
    else if (axis === "y") dispatch(toggleRectYBufferSign());
  }, [dispatch]);

  const deleteFromRectBuffer = useCallback(() => {
    const axis = rectCurrentAxisRef.current;
    if (axis === "x") dispatch(deleteLastRectXBuffer());
    else if (axis === "y") dispatch(deleteLastRectYBuffer());
  }, [dispatch]);

  const clearRectBuffers = useCallback(() => {
    rectCurrentAxisRef.current = null;
    dispatch(clearRectDims());
  }, [dispatch]);

  const setRectHasFirstPoint = useCallback(
    (v) => {
      dispatch(setRectHasFirstPointAction(v));
    },
    [dispatch]
  );

  const rectX = useMemo(() => parseBuffer(rectXBuffer), [rectXBuffer]);
  const rectY = useMemo(() => parseBuffer(rectYBuffer), [rectYBuffer]);

  const rectMetricsRef = useRef({ rectX, rectY });
  rectMetricsRef.current = { rectX, rectY };

  // Typed thickness / height entry (E / H) API. Mirrors the rect helpers but the
  // append/delete helpers RETURN the freshly parsed value so the keydown handler
  // can live-patch newAnnotation synchronously (Redux/ref updates only on the
  // next render).
  const setMetricField = useCallback(
    (field) => {
      metricInputFieldRef.current = field;
      metricInputBufferRef.current = "";
      dispatch(setMetricInputFieldAction(field));
      // Mutual exclusivity: leaving any rect axis so digits feed the metric.
      if (rectCurrentAxisRef.current) {
        rectCurrentAxisRef.current = null;
        dispatch(setRectCurrentAxisAction(null));
      }
    },
    [dispatch]
  );

  const appendToMetricBuffer = useCallback(
    (char) => {
      if (!metricInputFieldRef.current) return null;
      const next = metricInputBufferRef.current + char;
      metricInputBufferRef.current = next;
      dispatch(appendToMetricInputBufferAction(char));
      return parseBuffer(next);
    },
    [dispatch]
  );

  const deleteFromMetricBuffer = useCallback(() => {
    if (!metricInputFieldRef.current) return null;
    const next = metricInputBufferRef.current.slice(0, -1);
    metricInputBufferRef.current = next;
    dispatch(deleteLastMetricInputBufferAction());
    return parseBuffer(next);
  }, [dispatch]);

  const clearMetricInput = useCallback(() => {
    metricInputFieldRef.current = null;
    metricInputBufferRef.current = "";
    dispatch(clearMetricInputAction());
  }, [dispatch]);

  return (
    <DrawingMetricsContext.Provider
      value={{
        // Segment-length live metrics (singleton ref + Redux buffer)
        segmentLengthPxRef,
        constraintBuffer,
        appendToBuffer,
        deleteFromBuffer,
        clearBuffer,
        // Rectangle X/Y typed-dimensions API
        rectXBuffer,
        rectYBuffer,
        rectCurrentAxis,
        rectHasFirstPoint,
        rectX,
        rectY,
        rectMetricsRef,
        rectCurrentAxisRef,
        setRectHasFirstPoint,
        setRectAxis,
        appendToRectBuffer,
        toggleRectBufferSign,
        deleteFromRectBuffer,
        clearRectBuffers,
        // Typed thickness / height entry (E / H)
        metricInputField,
        metricInputBuffer,
        metricInputFieldRef,
        setMetricField,
        appendToMetricBuffer,
        deleteFromMetricBuffer,
        clearMetricInput,
      }}
    >
      {children}
    </DrawingMetricsContext.Provider>
  );
}

export const useDrawingMetrics = () => useContext(DrawingMetricsContext);
