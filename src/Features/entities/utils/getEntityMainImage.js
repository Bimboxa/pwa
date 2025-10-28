export default function getEntityMainImage(entity) {
  let image;

  Object.entries(entity).forEach(([key, value]) => {
    if (value?.isImage) {
      image = { url: value.imageUrlClient };
    }
  });

  if (!image && entity?.annotations?.length > 0) {
    image = { url: entity.annotations[0].image?.imageUrlClient };
  }
  return image;
}
