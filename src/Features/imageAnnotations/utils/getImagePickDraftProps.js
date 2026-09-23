// IMAGE template without a default image: the image is picked at placement
// (IMAGE_PICK deferred commit → dialog). One interceptor per draft: an
// interceptor already on the draft (business objects) keeps priority, and the
// placement then requires a default image on the template.
export default function getImagePickDraftProps(drawingShape, draftProps) {
  if (drawingShape !== "IMAGE") return {};
  if (draftProps?.image?.fileName || draftProps?.commitInterceptor) return {};
  return { commitInterceptor: { key: "IMAGE_PICK" } };
}
