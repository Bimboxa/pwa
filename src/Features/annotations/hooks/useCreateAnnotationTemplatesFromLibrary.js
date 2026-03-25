import { generateKeyBetween } from "fractional-indexing";

import useCreateAnnotationTemplate from "./useCreateAnnotationTemplate";
import imageUrlToPng from "Features/images/utils/imageUrlToPng";
import ImageObject from "Features/images/js/ImageObject";

export default function useCreateAnnotationTemplatesFromLibrary() {
  const createAnnotationTemplate = useCreateAnnotationTemplate();

  return async (annotationTemplatesFromLibrary, options) => {
    console.log("[AnnotationTemplates] create from library", annotationTemplatesFromLibrary);

    let lastIndex = null;
    for (const rawTemplate of annotationTemplatesFromLibrary) {
      let annotationTemplate = { ...rawTemplate };

      // fetch file if image
      if (annotationTemplate.image?.imageUrlClient) {
        const file = await imageUrlToPng({
          url: annotationTemplate.image.imageUrlClient,
          name: "image.png",
        });
        if (file) {
          const image = await ImageObject.create({ imageFile: file });
          annotationTemplate.image = image.toEntityField();
        }
      }

      // assign orderIndex to preserve library order
      const orderIndex = generateKeyBetween(lastIndex, null);
      lastIndex = orderIndex;
      annotationTemplate.orderIndex = orderIndex;

      await createAnnotationTemplate(annotationTemplate, options);
    }
  };
}
