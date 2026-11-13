// Annotation object handed to the 2D node of a system GENERATED annotation:
// the same annotation carrying the id of its SOURCE, so every hit on the
// detail (`data-node-id`) resolves to the source annotation — the instance is
// hovered / clicked / selected as a whole, like a block. Regular annotations
// are returned as is. Cached per annotation object (stable identity for the
// memoized nodes).
const cache = new WeakMap();

export default function getSystemNodeAnnotation(annotation) {
  const sourceId = annotation?.systemSourceAnnotationId;
  if (!sourceId) return annotation;
  let node = cache.get(annotation);
  if (!node) {
    node = {
      ...annotation,
      id: sourceId,
      systemElementAnnotationId: annotation.id,
    };
    cache.set(annotation, node);
  }
  return node;
}
