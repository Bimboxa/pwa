import { useDispatch, useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import { triggerRelsUpdate } from "../relsZoneEntitySlice";

import db from "App/db/db";

export default function useAddZoneToEntity() {
  const dispatch = useDispatch();

  const projectId = useSelector((s) => s.projects.selectedProjectId);

  const addZoneToEntity = async ({ zoningId, zoneId, listingId, entityId }) => {
    const rel = await db.relsZoneEntity.add({
      id: nanoid(),
      projectId,
      zoningId,
      zoneId,
      listingId,
      entityId,
    });

    dispatch(triggerRelsUpdate());

    console.log("addZoneToEntity", rel);

    return rel;
  };

  return addZoneToEntity;
}
