import db from "App/db/db";

import useCapturePovView from "./useCapturePovView";

// "Mettre à jour la vue": re-captures the displayed framed view into an
// existing POV — fresh thumbnail + metadata; id, sortIndex, description and
// createdBy are kept.
export default function useUpdatePovView() {
  const capturePovView = useCapturePovView();

  return async function updatePovView(pov) {
    if (!pov?.id) return null;

    const view = await capturePovView();
    if (!view) return null;

    // The saved AI-transformed image (if any) no longer matches the
    // re-captured view: drop it (a new transformation can be saved after).
    await db.povs.update(pov.id, { ...view, transformedImage: null });

    // The files table is not soft-deleted: drop the replaced rows.
    const oldFileName = pov.image?.fileName;
    if (oldFileName && oldFileName !== view.image.fileName) {
      await db.files.delete(oldFileName);
    }
    const oldTransformedFileName = pov.transformedImage?.fileName;
    if (oldTransformedFileName) {
      await db.files.delete(oldTransformedFileName);
    }

    return view;
  };
}
