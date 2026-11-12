import { OVERLAY_WRAPPER_ATTRIBUTE } from "../constants/baseMapOverlayConstants";

// Hit test of the overlaid annotations under a screen point.
//
// The overlay wrapper is `pointer-events: none` (the editor must never
// select / drag an overlaid annotation), so the browser's own hit test skips
// it. The test is done on the GEOMETRY instead: isPointInFill /
// isPointInStroke ignore `pointer-events` and the paint, so the wide
// transparent hit bands of the annotation nodes count like in the main
// editor.
//
// Returns the `dataset` of the topmost annotation node hit, or null.

const ANNOTATION_SELECTOR = '[data-node-type="ANNOTATION"]';
const GEOMETRY_SELECTOR = "path,polygon,polyline,line,circle,ellipse,rect";
const NON_RENDERED_SELECTOR = "defs,clipPath,mask,pattern,marker,symbol";
const BBOX_MARGIN_PX = 6;

function isShapeHit(shape, clientX, clientY) {
  if (shape.closest(NON_RENDERED_SELECTOR)) return false;
  const ctm = shape.getScreenCTM?.();
  if (!ctm) return false;
  try {
    const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    if (shape.isPointInStroke(point)) return true;
    return (
      getComputedStyle(shape).fill !== "none" && shape.isPointInFill(point)
    );
  } catch {
    return false;
  }
}

function isNodeHit(node, clientX, clientY) {
  const shapes = node.matches(GEOMETRY_SELECTOR)
    ? [node]
    : node.querySelectorAll(GEOMETRY_SELECTOR);
  // No geometry (image, text, <use>): the bounding box already matched.
  if (shapes.length === 0) return true;
  for (const shape of shapes) {
    if (isShapeHit(shape, clientX, clientY)) return true;
  }
  return false;
}

export default function getOverlayAnnotationNodeAtPoint(
  container,
  clientX,
  clientY
) {
  const wrapper = container?.querySelector(`[${OVERLAY_WRAPPER_ATTRIBUTE}]`);
  if (!wrapper) return null;

  const nodes = wrapper.querySelectorAll(ANNOTATION_SELECTOR);
  // Last in document order = drawn on top.
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    const rect = node.getBoundingClientRect();
    if (
      clientX < rect.left - BBOX_MARGIN_PX ||
      clientX > rect.right + BBOX_MARGIN_PX ||
      clientY < rect.top - BBOX_MARGIN_PX ||
      clientY > rect.bottom + BBOX_MARGIN_PX
    ) {
      continue;
    }
    if (isNodeHit(node, clientX, clientY)) return { ...node.dataset };
  }
  return null;
}
