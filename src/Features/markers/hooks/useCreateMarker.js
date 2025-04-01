import {nanoid} from "@reduxjs/toolkit";

import db from "App/db/db";
import store from "App/store";

import {triggerMarkersUpdate} from "../markersSlice";

import useUserEmail from "Features/auth/hooks/useUserEmail";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useEntity from "Features/entities/hooks/useEntity";
import useLoadedMainMap from "Features/mapEditor/hooks/useLoadedMainMap";

export default function useCreateMarker() {
  // data

  const entity = useEntity();
  const loadedMainMap = useLoadedMainMap();
  const {value: createdBy} = useUserEmail();

  const createMarker = async ({mapId, x, y, listingId, entityId}) => {
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

      await db.markers.add(entityMarker);
      console.log("[db] marker created", entityMarker);
      store.dispatch(triggerMarkersUpdate());
    } catch (e) {
      console.error("[createMarker] error creating marker", e);
    }
  };

  return createMarker;
}
