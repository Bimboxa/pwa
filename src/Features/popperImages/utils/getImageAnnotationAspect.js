// Width / height ratio of a photo tile: the annotation bbox (what the user
// sees in situ), else the image file size, else 4:3.
export default function getImageAnnotationAspect(annotation) {
  const b = annotation?.bbox;
  if (b?.width > 0 && b?.height > 0) return b.width / b.height;
  const size = annotation?.image?.imageSize;
  if (size?.width > 0 && size?.height > 0) return size.width / size.height;
  return 4 / 3;
}
