import FieldImageV2 from "Features/form/components/FieldImageV2";

import useUpdateAnnotationImage from "../hooks/useUpdateAnnotationImage";

// IMAGE annotation: the image is specific to the annotation (the template only
// provides a default). Picking a file replaces it right away.
export default function FieldAnnotationImage({ annotation }) {
  const updateAnnotationImage = useUpdateAnnotationImage();

  async function handleChange(image) {
    if (!image?.file) return; // delete = no-op, an IMAGE annotation needs an image
    await updateAnnotationImage(annotation, image);
  }

  return (
    <FieldImageV2
      label="Image"
      value={annotation?.image}
      onChange={handleChange}
    />
  );
}
