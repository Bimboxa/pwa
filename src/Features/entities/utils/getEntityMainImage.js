export default function getEntityMainImage(entity) {
  let image;

  Object.entries(entity).forEach(([key, value]) => {
    if (value.isImage) {
      image = {url: value.imageUrlClient};
    }
  });

  return image;
}
