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

    await db.povs.update(pov.id, view);

    // The files table is not soft-deleted: drop the replaced thumbnail row.
    const oldFileName = pov.image?.fileName;
    if (oldFileName && oldFileName !== view.image.fileName) {
      await db.files.delete(oldFileName);
    }

    return view;
  };
}
