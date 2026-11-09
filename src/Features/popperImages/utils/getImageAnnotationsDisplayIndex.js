// Display numbering of the IMAGE annotations shown by an editor: the badge
// drawn on each photo / anchor and on its tile in PopperImages.
//
// The order is deterministic and independent of the geometry (moving or
// resizing a photo never renumbers): manual orderIndex first (non-null,
// ascending), then createdAt ascending, then id. Every host (2D, 3D,
// capture overlay) calls it on its own displayed list; the numbers agree
// because the sort is internal.

export function isDisplayableImageAnnotation(a) {
  return (
    a?.type === "IMAGE" &&
    Boolean(a.image?.imageUrlClient || a.image?.thumbnail)
  );
}

function compareNullable(a, b) {
  const aNull = a === null || a === undefined;
  const bNull = b === null || b === undefined;
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function compareImageAnnotations(a, b) {
  return (
    compareNullable(a.orderIndex, b.orderIndex) ||
    compareNullable(a.createdAt, b.createdAt) ||
    compareNullable(a.id, b.id)
  );
}

export default function getImageAnnotationsDisplayIndex(annotations) {
  const images = (annotations ?? [])
    .filter(isDisplayableImageAnnotation)
    .sort(compareImageAnnotations);
  const indexById = {};
  images.forEach((a, i) => {
    indexById[a.id] = i + 1;
  });
  return { images, indexById };
}
