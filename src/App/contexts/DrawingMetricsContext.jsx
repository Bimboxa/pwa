import { createContext, useRef, useState, useCallback, useContext } from "react";

const DrawingMetricsContext = createContext(null);

export function DrawingMetricsProvider({ children }) {
  const segmentLengthPxRef = useRef(0);

  // Keyboard-driven constraint buffer (e.g. "1.5")
  const [constraintBuffer, setConstraintBuffer] = useState("");

  const appendToBuffer = useCallback((char) => {
    setConstraintBuffer((prev) => prev + char);
  }, []);

  const deleteFromBuffer = useCallback(() => {
    setConstraintBuffer((prev) => prev.slice(0, -1));
  }, []);

  const clearBuffer = useCallback(() => {
    setConstraintBuffer("");
  }, []);

  return (
    <DrawingMetricsContext.Provider
      value={{
        segmentLengthPxRef,
        constraintBuffer,
        appendToBuffer,
        deleteFromBuffer,
        clearBuffer,
      }}
    >
      {children}
    </DrawingMetricsContext.Provider>
  );
}

export const useDrawingMetrics = () => useContext(DrawingMetricsContext);
