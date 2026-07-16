import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

// "Enregistrer la transformation": stores the AI-enhanced capture in
// db.files and references it in the POV's `transformedImage` field. The
// transformed image then becomes the POV's preview and download source.
export default function useSavePovTransformedImage() {
  return async function savePovTransformedImage(povId, blob) {
    if (!povId || !blob) return null;

    const pov = await db.povs.get(povId);
    if (!pov) return null;

    const fileName = `pov_transformed_${nanoid()}.png`;
    await db.files.put({
      fileName,
      srcFileName: fileName,
      fileMime: "image/png",
      fileType: "IMAGE",
      fileArrayBuffer: await blob.arrayBuffer(),
      projectId: pov.projectId,
    });

    await db.povs.update(povId, { transformedImage: { fileName } });

    // The files table is not soft-deleted: drop the replaced image row.
    const oldFileName = pov.transformedImage?.fileName;
    if (oldFileName && oldFileName !== fileName) {
      await db.files.delete(oldFileName);
    }

    return { fileName };
  };
}
