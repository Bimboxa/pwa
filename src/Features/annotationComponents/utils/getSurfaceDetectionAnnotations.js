// Annotations the surface detection (S key on POLYGON_CLICK, « contours »
// surface drop — detectPolygonFromAnnotations) builds its closed loops from,
// as far as the components are concerned (see constants/componentConstants.js).
//
// `template.componentDetectSurfacesWithSource` (on unless `false`, merged on
// the source annotation by getAnnotationPropsFromAnnotationTemplateProps):
//
//   - ON: the component bounds a surface by its DRAWN LINE — the source is
//     fed as a thin line (no band, no stroke width) and its children are left
//     out, so a surface drawn against a component fills up to its line
//     instead of stopping at the edge of a generated band;
//   - OFF: the generated annotations bound the surface (what is displayed);
//     the hidden source is left out.
//
// A child whose source is not in the list is kept as is. Returns the input
// array itself when it holds no component child.
const lineCache = new WeakMap();

function getSourceLine(source) {
  let line = lineCache.get(source);
  if (!line) {
    line = { ...source, type: "POLYLINE", strokeWidth: 0 };
    lineCache.set(source, line);
  }
  return line;
}

export default function getSurfaceDetectionAnnotations(annotations) {
  if (!annotations?.length) return annotations;

  let sourceIds = null;
  for (const a of annotations) {
    const sourceId = a?.componentSourceAnnotationId;
    if (!sourceId) continue;
    if (!sourceIds) sourceIds = new Set();
    sourceIds.add(sourceId);
  }
  if (!sourceIds) return annotations;

  // sources present in the list → detect with the source or with its children
  const withSourceById = new Map();
  for (const a of annotations) {
    if (a && sourceIds.has(a.id))
      withSourceById.set(a.id, a.componentDetectSurfacesWithSource !== false);
  }

  const result = [];
  for (const a of annotations) {
    if (!a) continue;
    const sourceId = a.componentSourceAnnotationId;
    if (sourceId) {
      if (withSourceById.get(sourceId) !== true) result.push(a);
      continue;
    }
    if (withSourceById.has(a.id)) {
      if (withSourceById.get(a.id)) result.push(getSourceLine(a));
      // children stand for the component: its own line only counts when it
      // is the one displayed (component selected)
      else if (!a.systemSourceHidden) result.push(a);
      continue;
    }
    result.push(a);
  }
  return result;
}
