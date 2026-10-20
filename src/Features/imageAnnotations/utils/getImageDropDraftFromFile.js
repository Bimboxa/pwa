import ImageObject from "Features/images/js/ImageObject";
import { getTemplatelessDraft } from "Features/mapEditor/utils/startTemplatelessDraw";

import getImageRefFromEntityImage from "./getImageRefFromEntityImage";

// Templateless IMAGE draft for an image File dropped on the 2D editor: the
// same File → entity image path as FieldImageV2 (ImageObject), then the
// "Dessin" IMAGE draft with the picked image already in place. The draft
// armed by getTemplatelessDraft carries the IMAGE_PICK commit interceptor
// (image unknown at arm time); here the image IS known, so the interceptor
// is dropped and the commit runs straight away.
export default async function getImageDropDraftFromFile(file, rememberedProps) {
  if (!file) return null;
  const imageObject = await ImageObject.create({ imageFile: file });
  const image = getImageRefFromEntityImage(imageObject.toEntityField());
  if (!image) return null;

  const draft = getTemplatelessDraft("IMAGE", rememberedProps);
  delete draft.commitInterceptor;
  return { ...draft, type: "IMAGE", image };
}
