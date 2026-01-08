import useCreateAnnotationTemplate from "./useCreateAnnotationTemplate";
import imageUrlToPng from "Features/images/utils/imageUrlToPng";
import ImageObject from "Features/images/js/ImageObject";

export default function useCreateAnnotationTemplatesFromLibrary() {
  const createAnnotationTemplate = useCreateAnnotationTemplate();

  return async (annotationTemplatesFromLibrary, options) => {
    console.log("[AnnotationTemplates] create from library", annotationTemplatesFromLibrary)
    await Promise.all(
      annotationTemplatesFromLibrary.map(async (annotationTemplate) => {
        // fetch file if image
        if (annotationTemplate.image?.imageUrlClient) {
          const file = await imageUrlToPng({
            url: annotationTemplate.image.imageUrlClient,
            name: "image.png",
          });
          if (file) {
            const image = await ImageObject.create({ imageFile: file });
            annotationTemplate = {
              ...annotationTemplate,
              image: image.toEntityField(),
            };
          }
        }
        await createAnnotationTemplate(annotationTemplate, options);
      })
    );
  };
}
