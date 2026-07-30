import { nanoid } from "nanoid";

import { useDispatch, useSelector } from "react-redux";

import { triggerPhotoPlansUpdate } from "../photoPlansSlice";

import db from "App/db/db";

export default function useCreatePhotoPlan() {
  const dispatch = useDispatch();
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);

  // Creates the photoPlan row derived from a source POLYGON annotation drawn
  // on a photo baseMap. Calibration comes later (Élévation tool).
  const create = async ({ annotation, name, orientation }) => {
    const photoPlan = {
      id: nanoid(),
      projectId: annotation.projectId,
      scopeId: annotation.scopeId ?? selectedScopeId ?? null,
      listingId: annotation.listingId,
      baseMapId: annotation.baseMapId,
      annotationId: annotation.id,
      name: name || "Plan photo",
      orientation: orientation || "VERTICAL",
      calibrationInputs: null,
      calibration: null,
    };

    await db.photoPlans.add(photoPlan);
    dispatch(triggerPhotoPlansUpdate());

    return photoPlan;
  };

  return create;
}
