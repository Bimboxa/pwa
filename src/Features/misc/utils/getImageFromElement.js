import html2canvas from "html2canvas";

export default async function getImageFromElement(element) {
  let url;
  let width;
  let height;

  if (!element) return;

  const bbox = element.getBoundingClientRect();
  const devicePixelRatio = Math.min(window.devicePixelRatio, 2);

  try {
    const _canvas = await html2canvas(element, {
      allowTaint: true,
      useCORS: true,
      backgroundColor: null,
      scale: devicePixelRatio * 2, // Use device pixel ratio for retina screens
      logging: false,
      ignoreElements: (element) => {
        // Ignore canvas elements that might cause WebGL issues
        return element.tagName === "CANVAS";
      },
    });
    url = _canvas.toDataURL();
  } catch (error) {
    console.error("Error capturing legend with html2canvas:", error);
    // Fallback: try without ignoring canvas elements
    try {
      const _canvas = await html2canvas(element, {
        allowTaint: true,
        useCORS: true,
        backgroundColor: null,
        scale: devicePixelRatio * 2, // Use device pixel ratio for retina screens
        logging: false,
      });
      url = _canvas.toDataURL();
    } catch (fallbackError) {
      console.error("Fallback html2canvas also failed:", fallbackError);
    }
  } finally {
    if (url) {
      //width = (bbox.width / 2) * devicePixelRatio;
      //height = (bbox.height / 2) * devicePixelRatio;
      width = bbox.width;
      height = bbox.height;
    }
  }

  return { url, width, height };
}
