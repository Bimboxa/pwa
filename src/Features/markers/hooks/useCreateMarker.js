import {nanoid} from "@reduxjs/toolkit";

import db from "App/db/db";
import store from "App/store";

import {triggerMarkersUpdate} from "../markersSlice";

import useUserEmail from "Features/auth/hooks/useUserEmail";
import useLoadedMainMap from "Features/mapEditor/hooks/useLoadedMainMap";

export default function useCreateMarker() {
  // data

  const loadedMainMap = useLoadedMainMap();
  const {value: createdBy} = useUserEmail();

  const createMarker = async ({mapId, x, y, listingId, entityId}) => {
    const updatedAt = new Date().toISOString();

    try {
      // edge case
      if (!mapId || !listingId || !entityId) {
        console.warn("[createMarker] missing data");
        return;
      }

      // main
      const entityMarker = {
        id: nanoid(),
        mapId: loadedMainMap.id,
        x,
        y,
        targetEntityId: entityId,
        targetListingId: listingId,
        createdBy,
        createdAt: new Date().toISOString(),
      };

      // old
      const oldMarkers = await db.markers
        .where("targetEntityId")
        .equals(entityId)
        .toArray();
      const oldMarker = oldMarkers?.find((marker) => marker.mapId === mapId);

      if (oldMarker) {
        await db.markers.update(oldMarker.id, {x, y, updatedAt});
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
