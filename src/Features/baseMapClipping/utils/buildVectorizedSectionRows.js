// db rows of the polylines vectorized on a base map (« Vectoriser la
// coupe »): one templateless POLYLINE annotation per polyline, its vertices
// in db.points, normalized [0..1] vs the base map image size (see
// docs/annotations/POINTS_STORAGE.md). Nothing is written here.
//
// polylines: vectorizeSliceFootprint output, in metres from the image
// top-left corner (y down). The ends welded on one junction (`joint`) share
// one db.points row. A closed loop becomes a closed line (`closeLine`).
// widthM / heightM: size of the base map image in metres.
// annotationProps: style of the lines (templateless POLYLINE draft).
// createId: () => new id.
// Returns { newPoints, newAnnotations }.
export default function buildVectorizedSectionRows({
  polylines,
  widthM,
  heightM,
  baseMapId,
  projectId,
  scopeId,
  annotationProps,
  createId,
  now = new Date().toISOString(),
}) {
  const newPoints = [];
  const newAnnotations = [];
  if (!(widthM > 0) || !(heightM > 0)) return { newPoints, newAnnotations };

  const pointIdByJoint = new Map();
  const addPoint = (p) => {
    if (p.joint !== undefined && pointIdByJoint.has(p.joint))
      return pointIdByJoint.get(p.joint);
    const id = createId();
    newPoints.push({
      id,
      x: p.x / widthM,
      y: p.y / heightM,
      projectId,
      baseMapId,
    });
    if (p.joint !== undefined) pointIdByJoint.set(p.joint, id);
    return id;
  };

  (polylines || []).forEach((polyline) => {
    if (!polyline?.points || polyline.points.length < 2) return;
    const refs = polyline.points.map((p) => ({ id: addPoint(p) }));
    newAnnotations.push({
      ...annotationProps,
      id: createId(),
      type: "POLYLINE",
      projectId,
      scopeId: scopeId ?? null,
      listingId: null,
      isTemplateless: true,
      baseMapId,
      points: refs,
      ...(polyline.closed ? { closeLine: true } : {}),
      createdAt: now,
      updatedAt: now,
    });
  });
  return { newPoints, newAnnotations };
}
