import findOverlappingAnnotations from "../utils/findOverlappingAnnotations";

// Worker entry of the duplicates detection — one message in, one out:
//   in:  { type: "DETECT", runId, annotations, options }
//   out: { type: "RESULT", runId, result } | { type: "ERROR", runId, message }
self.onmessage = ({ data }) => {
  if (data?.type !== "DETECT") return;
  const { runId, annotations, options } = data;
  try {
    const result = findOverlappingAnnotations(annotations, options);
    self.postMessage({ type: "RESULT", runId, result });
  } catch (error) {
    self.postMessage({
      type: "ERROR",
      runId,
      message: error?.message || "Duplicates detection failed",
    });
  }
};
