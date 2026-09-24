import { describeAiTaskSource } from "../../aiTasks/utils/aiTaskSource.js";

// A missing/unavailable PDF must not block requests that only need context.
// Keep its kind even if metadata is incomplete, preventing raster fallback.
export function chatPlanSource(baseMap) {
  if (baseMap?.createdFrom?.type !== "PDF_PAGE") return { planKind: "image" };
  try {
    const source = describeAiTaskSource(baseMap);
    return {
      planKind: "pdf",
      sourceFrame: source.frame,
      planPdf: {
        sourceImageSize: source.sourceImageSize,
        transform: source.transform,
      },
    };
  } catch {
    return { planKind: "pdf" };
  }
}
