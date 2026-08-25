import db from "App/db/db";

import useCapturePovView from "./useCapturePovView";

// "Mettre à jour la vue": re-captures the displayed framed view into an
// existing POV — fresh thumbnail + metadata; id, sortIndex, description and
// createdBy are kept. A POV that carries a full-resolution `rawImage` (created
// from the capture tool, or restored after one) keeps one; the others are not
// given one for free (the HD capture is expensive).
export default function useUpdatePovView() {
  const capturePovView = useCapturePovView();

  return async function updatePovView(pov) {
    if (!pov?.id) return null;

    const view = await capturePovView({
      withRawImage: Boolean(pov.rawImage?.fileName),
    });
    if (!view) return null;

    // The saved AI-transformed image (if any) no longer matches the
    // re-captured view: drop it (a new transformation can be saved after).
    await db.povs.update(pov.id, { ...view, transformedImage: null });

    // The files table is not soft-deleted: drop the replaced rows.
    const oldFileName = pov.image?.fileName;
    if (oldFileName && oldFileName !== view.image.fileName) {
      await db.files.delete(oldFileName);
    }
    const oldRawFileName = pov.rawImage?.fileName;
    if (oldRawFileName && oldRawFileName !== view.rawImage?.fileName) {
      await db.files.delete(oldRawFileName);
    }
    const oldTransformedFileName = pov.transformedImage?.fileName;
    if (oldTransformedFileName) {
      await db.files.delete(oldTransformedFileName);
    }

    return view;
  };
}
