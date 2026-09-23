import { useDispatch, useSelector } from "react-redux";

import db from "App/db/db";

import { triggerAnnotationsUpdate } from "../annotationsSlice";

import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import getImageRefFromEntityImage from "Features/imageAnnotations/utils/getImageRefFromEntityImage";

// Replace the image of an IMAGE annotation with a freshly picked one
// (FieldImageV2 entity field). The File goes to db.files through the entity
// pipeline (row keyed to the annotation, with its listingId so it ships in
// the Krto zip). The previous file is deleted only when it belonged to this
// annotation — a template's default image stays shared. The bbox keeps its
// width and takes the new image's aspect ratio.
export default function useUpdateAnnotationImage() {
  const dispatch = useDispatch();

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const updateEntity = useUpdateEntity();
  const baseMap = useMainBaseMap();

  return async (annotation, entityImage) => {
    const ref = getImageRefFromEntityImage(entityImage);
    if (!annotation?.id || !ref?.file) return;

    const raw = await db.annotations.get(annotation.id);
    if (!raw) return;

    // Orphan cleanup: only a file owned by this annotation.
    const oldFileName = raw.image?.fileName;
    if (oldFileName) {
      const oldFile = await db.files.get(oldFileName);
      if (oldFile?.entityId === annotation.id) {
        await db.files.delete(oldFileName);
      }
    }

    const updates = { image: ref };

    // Keep the width, follow the new aspect ratio (normalized bbox).
    const imgW = ref.imageSize?.width;
    const imgH = ref.imageSize?.height;
    const bg = baseMap?.getImageSize?.();
    if (raw.bbox && imgW > 0 && imgH > 0 && bg?.width > 0 && bg?.height > 0) {
      const heightPx = ((raw.bbox.width * bg.width) * imgH) / imgW;
      updates.bbox = { ...raw.bbox, height: heightPx / bg.height };
    }

    await updateEntity(annotation.id, updates, {
      listing: {
        id: raw.listingId ?? annotation.listingId,
        table: "annotations",
        projectId: raw.projectId ?? projectId,
      },
    });
    dispatch(triggerAnnotationsUpdate());
  };
}
