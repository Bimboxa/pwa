import { nanoid } from "nanoid";

import { useDispatch, useSelector } from "react-redux";

import { triggerPhotoPlansUpdate } from "../photoPlansSlice";

import db from "App/db/db";

export default function useCreatePhotoPlan() {
  const dispatch = useDispatch();
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);

  // Creates a photoPlan row, either derived from a source POLYGON annotation
  // drawn on a photo baseMap, or covering the WHOLE photo (pass `baseMap`
  // instead — annotationId stays null and every consumer synthesizes a
  // full-image ring). Calibration comes later (Élévation tool).
  const create = async ({ annotation, baseMap, name, orientation }) => {
    const photoPlan = annotation
      ? {
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
        }
      : {
          id: nanoid(),
          projectId: baseMap.projectId,
          scopeId: selectedScopeId ?? null,
          listingId: baseMap.listingId,
          baseMapId: baseMap.id,
          annotationId: null, // whole-photo plan
          name: name || "Photo entière",
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
