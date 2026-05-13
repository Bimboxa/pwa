import {
  createContext,
  useRef,
  useCallback,
  useContext,
  useMemo,
} from "react";
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

  // Refs mirror Redux state so the keydown handler (registered once with
  // empty deps in InteractionLayer) can read the latest values synchronously.
  const rectCurrentAxisRef = useRef(rectCurrentAxis);
  rectCurrentAxisRef.current = rectCurrentAxis;

  const setRectAxis = useCallback(
    (axis) => {
      rectCurrentAxisRef.current = axis;
      dispatch(setRectCurrentAxisAction(axis));
      if (axis === "x") dispatch(setRectXBufferAction(""));
      else if (axis === "y") dispatch(setRectYBufferAction(""));
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
      }}
    >
      {children}
    </DrawingMetricsContext.Provider>
  );
}

export const useDrawingMetrics = () => useContext(DrawingMetricsContext);
