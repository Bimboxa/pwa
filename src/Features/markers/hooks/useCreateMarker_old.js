import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import store from "App/store";

import { triggerMarkersUpdate } from "../markersSlice";

import useUserEmail from "Features/auth/hooks/useUserEmail";
import useLoadedMainBaseMap from "Features/mapEditor/hooks/useLoadedMainBaseMap";

import getDateString from "Features/misc/utils/getDateString";

export default function useCreateMarker() {
  // data

  const loadedMainBaseMap = useLoadedMainBaseMap();
  const { value: createdBy } = useUserEmail();

  const createMarker = async ({ mapId, x, y, listingId, entityId }) => {
    const updatedAt = getDateString(new Date());

    try {
      // edge case
      if (!mapId || !listingId || !entityId) {
        console.warn("[createMarker] missing data");
        return;
      }

      // main
      const entityMarker = {
        id: nanoid(),
        mapId: loadedMainBaseMap.id,
        x,
        y,
        targetEntityId: entityId,
        listingId: listingId,
        createdBy,
        createdAt: getDateString(new Date()),
      };

      // old
      const oldMarkers = await db.markers
        .where("targetEntityId")
        .equals(entityId)
        .toArray();
      const oldMarker = oldMarkers?.find((marker) => marker.mapId === mapId);

      if (oldMarker) {
        await db.markers.update(oldMarker.id, { x, y, updatedAt });
        console.log("[db] marker updated", entityMarker);
      } else {
        await db.markers.add(entityMarker);
        console.log("[db] marker created", entityMarker);
      }

      store.dispatch(triggerMarkersUpdate());
    } catch (e) {
      console.error("[createMarker] error creating marker", e);
    }
  };

  return createMarker;
}
