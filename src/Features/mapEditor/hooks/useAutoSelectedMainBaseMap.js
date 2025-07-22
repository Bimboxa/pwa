import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import getInitSelectedMainBaseMapId from "Features/init/services/getInitSelectedMainBaseMapId";
import { setSelectedMainBaseMapId } from "../mapEditorSlice";

import useSelectedMainBaseMap from "./useSelectedMainBaseMap";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";

import db from "App/db/db";

export default function useAutoSelectedMainBaseMap() {
  const dispatch = useDispatch();

  // data

  const baseMap = useSelectedMainBaseMap();
  const baseMaps = useBaseMaps();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  // state

  const [baseMapListing, setBaseMapListing] = useState(null);

  // helpers

  async function getBaseMapListing(listingId) {
    const listing = await db.listings.get(listingId);
    setBaseMapListing(listing);
  }

  useEffect(() => {
    if (baseMapListing && baseMaps?.length > 0) {
      const baseMapProjectId = baseMapListing?.projectId;
      if (baseMapProjectId !== projectId) {
        const baseMap0 = baseMaps[0];
        console.log("[AUTO] set baseMap to", baseMap0);
        dispatch(setSelectedMainBaseMapId(baseMap0?.id));
      }
    }
  }, [projectId, baseMapListing?.id, baseMaps?.length]);

  useEffect(() => {
    if (baseMap?.listingIg) {
      getBaseMapListing(baseMap?.listingId);
    }
  }, [baseMap?.listingId]);
}
