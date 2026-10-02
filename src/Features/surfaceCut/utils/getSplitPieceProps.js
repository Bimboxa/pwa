// Fields of a cut annotation that a new piece copies: everything but its
// identity, audit stamps and geometry (same rule as the 3D « Coupe face »).
export default function getSplitPieceProps(annotation) {
  const props = { ...annotation };
  for (const key of [
    "id",
    "entityId",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "createdByUserIdMaster",
    "points",
    "cuts",
  ]) {
    delete props[key];
  }
  return props;
}
