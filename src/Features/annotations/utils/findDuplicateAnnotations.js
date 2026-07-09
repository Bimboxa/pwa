// Detects geometric duplicates among resolved annotations (from useAnnotationsV2,
// geometry in pixel space). Two annotations are duplicates when they share the
// same annotationTemplateId, the same type, the same layer (unless crossLayers)
// and the same geometry up to `tolerance` pixels.
//
// Within a duplicate group, the oldest annotation (createdAt) is kept in place;
// the others are returned in `duplicateIds`.

const POINT_TYPES = ["MARKER", "POINT", "REVOLUTION_POINT"];
const BBOX_TYPES = ["RECTANGLE", "IMAGE", "OBJECT_3D"];

function quantize(value, tolerance) {
  return Math.round(value / tolerance);
}

function pointKey(point, tolerance) {
  return `${quantize(point.x, tolerance)}:${quantize(point.y, tolerance)}`;
}

// sorted point keys: invariant to start vertex and direction
function ringKey(points, tolerance) {
  const keys = points.map((p) => pointKey(p, tolerance)).sort();
  return `n${points.length}|${keys.join("|")}`;
}

function getGeometryKey(annotation, tolerance) {
  if (POINT_TYPES.includes(annotation.type)) {
    if (!annotation.point) return null;
    return pointKey(annotation.point, tolerance);
  }

  if (annotation.type === "LABEL") {
    if (!annotation.targetPoint) return null;
    const parts = [pointKey(annotation.targetPoint, tolerance)];
    if (annotation.labelPoint)
      parts.push(pointKey(annotation.labelPoint, tolerance));
    return parts.join("|");
  }

  if (BBOX_TYPES.includes(annotation.type)) {
    const bbox = annotation.bbox;
    if (!bbox) return null;
    return [bbox.x, bbox.y, bbox.width, bbox.height]
      .map((v) => quantize(v, tolerance))
      .join(":");
  }

  // default: POLYLINE / POLYGON / STRIP / REVOLUTION_AXIS / ...
  const points = annotation.points;
  if (!points?.length) return null;
  const parts = [ringKey(points, tolerance)];
  annotation.cuts?.forEach((cut) => {
    if (cut?.points?.length) parts.push(`c${ringKey(cut.points, tolerance)}`);
  });
  return parts.join("|");
}

function getCreatedAtTime(annotation) {
  const t = new Date(annotation.createdAt ?? 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

export default function findDuplicateAnnotations(
  annotations,
  { crossLayers = false, tolerance = 1 } = {}
) {
  const groups = new Map();

  for (const annotation of annotations ?? []) {
    const geometryKey = getGeometryKey(annotation, tolerance);
    if (!geometryKey) continue;

    const layerKey = crossLayers ? "*" : (annotation.layerId ?? "0");
    const key = `${annotation.annotationTemplateId}|${annotation.type}|${layerKey}|${geometryKey}`;

    const group = groups.get(key);
    if (group) {
      group.push(annotation);
    } else {
      groups.set(key, [annotation]);
    }
  }

  const duplicateIds = [];
  let groupCount = 0;

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    groupCount += 1;
    const sorted = [...group].sort(
      (a, b) => getCreatedAtTime(a) - getCreatedAtTime(b)
    );
    duplicateIds.push(...sorted.slice(1).map((a) => a.id));
  }

  return { duplicateIds, groupCount };
}
